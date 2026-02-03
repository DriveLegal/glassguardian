import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function normalizeEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function dataUrlToBytes(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!m) throw new Error("Invalid signature data URL");
  const contentType = m[1] || "image/png";
  const b64 = m[2] || "";
  const bytes = Buffer.from(b64, "base64");
  return { bytes, contentType };
}

function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

async function getIpUa() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const ua = h.get("user-agent") || null;
  return { ip, ua };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await context.params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase env vars." },
        { status: 500 }
      );
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    // ✅ Validate caller via anon+token
    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: authData, error: authErr } = await authed.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const authedEmail = normalizeEmail(authData.user.email);

    // ✅ Service role admin client (bypasses RLS)
    const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ✅ Pull appointment fields needed for invoice snapshot
    const { data: appt, error: apptErr } = await admin
      .from("appointments")
      .select(
        [
          "id",
          "technician_email",
          "customer_email",
          "vehicle_id",
          "service_address",
          "service_type",
          "damage_size",
          "damage_description",
          "location_type",
          "scheduled_date",
          "scheduled_time_start",
          "scheduled_time_end",
          "notes_customer",
          "coupon_code",
          "estimate_amount",
          "final_amount",
          "created_at",
          "warranty_id",
        ].join(",")
      )
      .eq("id", appointmentId)
      .maybeSingle();

    if (apptErr || !appt) {
      return NextResponse.json(
        { error: apptErr?.message || "Appointment not found." },
        { status: 404 }
      );
    }

    const appointment = appt as any;

    // ✅ Enforce assignment only when technician_email exists
    const assignedEmail = normalizeEmail(appointment.technician_email);
    if (assignedEmail && authedEmail && assignedEmail !== authedEmail) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);

    const signatureDataUrl = String(body?.signature_data_url ?? "");
    if (!signatureDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "signature_data_url must be a data:image/* base64 URL" },
        { status: 400 }
      );
    }

    // crack-out validation
    const repair_outcome =
      body?.repair_outcome === "crack_out" ? "crack_out" : "completed";
    const crack_out_occurred = !!body?.crack_out_occurred;

    const crack_out_cause = crack_out_occurred ? body?.crack_out_cause ?? null : null;
    const crack_out_notes = crack_out_occurred ? body?.crack_out_notes ?? null : null;
    const crack_out_photo_url = crack_out_occurred ? body?.crack_out_photo_url ?? null : null;

    if (crack_out_occurred) {
      if (!crack_out_cause) {
        return NextResponse.json(
          { error: "Crack-out cause is required." },
          { status: 400 }
        );
      }
      if (!crack_out_notes || String(crack_out_notes).trim().length < 10) {
        return NextResponse.json(
          { error: "Crack-out notes (min 10 chars) are required." },
          { status: 400 }
        );
      }
      if (!crack_out_photo_url) {
        return NextResponse.json(
          { error: "Crack-out photo is required." },
          { status: 400 }
        );
      }
    }

    // ✅ Upload signature
    const { bytes, contentType } = dataUrlToBytes(signatureDataUrl);
    if (bytes.length > 1_500_000) {
      return NextResponse.json(
        { error: "Signature image too large. Please try again." },
        { status: 413 }
      );
    }

    const techSigPath = `appointments/${appointmentId}/tech-signature-${Date.now()}.png`;

    const up = await admin.storage.from("waivers").upload(techSigPath, bytes, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

    if (up.error) {
      return NextResponse.json({ error: up.error.message }, { status: 400 });
    }

    // best-effort ip/ua (not stored)
    await getIpUa().catch(() => null);

    // ✅ Update appointment
    const updates: Record<string, any> = {
      status: "completed",
      actual_end_time: String(body?.actual_end_time ?? nowIso()),
      notes_tech: body?.notes_tech ?? null,
      resin_type: body?.resin_type ?? null,
      cure_duration_minutes:
        typeof body?.cure_duration_minutes === "number"
          ? body.cure_duration_minutes
          : null,

      repair_outcome,
      crack_out_occurred,
      crack_out_cause: crack_out_occurred ? crack_out_cause : null,
      crack_out_notes: crack_out_occurred ? crack_out_notes : null,
      crack_out_photo_url: crack_out_occurred ? crack_out_photo_url : null,
      crack_out_at: crack_out_occurred
        ? String(body?.crack_out_at ?? nowIso())
        : null,
      replacement_required: crack_out_occurred,

      // You said you're using this column for signature path
      customer_signature: techSigPath,
    };

    const { error: updateErr } = await admin
      .from("appointments")
      .update(updates)
      .eq("id", appointmentId);

    if (updateErr) {
      await admin.storage.from("waivers").remove([techSigPath]).catch(() => {});
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    /* ----------------------------------------------------------------
       ✅ BEST: invoice upsert by appointment_id (requires unique constraint)
    ---------------------------------------------------------------- */

    // Pull customer name + client_id (best effort)
    let customer_name: string | null = null;
    let client_id: string | null = null;

    if (appointment.customer_email) {
      const { data: u, error: uErr } = await admin
        .from("app_users")
        .select("id, full_name")
        .eq("email", appointment.customer_email)
        .maybeSingle();

      if (!uErr && u) {
        customer_name = (u as any)?.full_name ?? null;
        client_id = (u as any)?.id ?? null;
      }
    }

    const snapshot = {
      id: appointment.id,
      customer_email: appointment.customer_email,
      vehicle_id: appointment.vehicle_id,
      service_type: appointment.service_type,
      damage_size: appointment.damage_size,
      damage_description: appointment.damage_description,
      service_address: appointment.service_address,
      location_type: appointment.location_type,
      scheduled_date: appointment.scheduled_date,
      scheduled_time_start: appointment.scheduled_time_start,
      scheduled_time_end: appointment.scheduled_time_end,
      notes_customer: appointment.notes_customer,
      coupon_code: appointment.coupon_code,
      estimate_amount: appointment.estimate_amount,
      final_amount: appointment.final_amount,
      created_at: appointment.created_at,
      warranty_id: appointment.warranty_id,
    };

    const invoicePayload: Record<string, any> = {
      invoice_number: `INV-${String(appointmentId).slice(0, 8).toUpperCase()}`,
      appointment_id: appointmentId,

      technician_email: appointment.technician_email ?? authedEmail ?? null,
      client_id, // ✅ best-effort
      vehicle_id: appointment.vehicle_id ?? null,

      customer_email: appointment.customer_email ?? null,
      customer_name,
      service_address: appointment.service_address ?? null,

      appointment_snapshot: snapshot,

      invoice_date: todayIsoDate(), // ✅ NOT NULL
      status: "draft",

      services_json: null,
      windshield_repairs_json: null,

      subtotal_cents: 0,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: 0,

      crack_out_occurred,
      repair_outcome,
      crack_out_at: crack_out_occurred ? String(body?.crack_out_at ?? nowIso()) : null,
      crack_out_cause: crack_out_occurred ? crack_out_cause : null,
      crack_out_notes: crack_out_occurred ? crack_out_notes : null,
      crack_out_photo_url: crack_out_occurred ? crack_out_photo_url : null,
      crack_out_media_urls: crack_out_occurred
        ? [crack_out_photo_url].filter(Boolean)
        : null,
      replacement_required: crack_out_occurred,
      replacement_status: crack_out_occurred ? "required" : null,
    };

    // ✅ Upsert (best) — requires unique constraint on appointment_id
    const { data: upInv, error: upInvErr } = await admin
      .from("tech_invoices")
      .upsert(invoicePayload, { onConflict: "appointment_id" })
      .select("id")
      .maybeSingle();

    if (upInvErr) {
      return NextResponse.json({ error: upInvErr.message }, { status: 400 });
    }

    const invoiceId = upInv?.id ?? null;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice upsert failed (no id returned)." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: true, signature_path: techSigPath, invoice_id: invoiceId },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error" },
      { status: 400 }
    );
  }
}