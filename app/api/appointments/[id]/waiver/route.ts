// app/api/appointments/[id]/waiver/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import {
  buildGlassGuardianWaiverText,
  WAIVER_VERSION,
} from "@/lib/waivers/glassGuardianWaiver";

/**
 * appointment_waivers columns (expected):
 * id, appointment_id, signer_role, signer_name, signer_email, initials,
 * signature_name, waiver_version, waiver_text, signed_ip, signed_user_agent,
 * signed_at, created_at,
 * + signature_png_path (recommended)  <-- stored in bucket "waivers"
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoDateInTZ(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dataUrlToBytes(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!m) throw new Error("Invalid signature data URL");
  const contentType = m[1] || "image/png";
  const b64 = m[2] || "";
  const bytes = Buffer.from(b64, "base64");
  return { bytes, contentType };
}

function safeKeyPart(v: string) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 60);
}

function normalizeEmail(v: any) {
  const s = String(v ?? "").trim().toLowerCase();
  return s && s !== "null" && s !== "undefined" ? s : "";
}

function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

/**
 * ✅ Tech override:
 * If caller is authenticated AND their email is assigned as technician_email on the appointment,
 * we allow signing BEFORE the scheduled day.
 *
 * Customer portal signing can still happen any time (also allowed).
 *
 * Net result:
 * - tech device signing: allowed any time (but still must be authed)
 * - customer portal signing: allowed any time (but still must be authed)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await context.params;

    if (!appointmentId) {
      return NextResponse.json({ error: "Missing appointment id." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase env vars." },
        { status: 500 }
      );
    }

    const headerStore = (await (nextHeaders() as any)) as any;

    // ✅ Auth: bearer token (tech + user portals can send this)
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated. Missing Authorization bearer token." },
        { status: 401 }
      );
    }

    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: authData, error: authErr } = await authed.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const user = authData.user;
    const authedEmail = normalizeEmail(user.email);

    const body = await req.json().catch(() => null);

    const signer_name = String(body?.full_name ?? body?.signer_name ?? "").trim();
    const initialsRaw = String(body?.initials ?? "").trim();
    const signer_role = String(body?.signer_role ?? "user").trim() || "user";
    const signature_name = String(body?.signature_name ?? signer_name ?? "").trim();

    const signature_type = String(body?.signature_type ?? "drawn").trim();
    const signature_payload =
      (body?.signature_payload as string | null | undefined) ??
      (body?.signature_data_url as string | null | undefined) ??
      null;

    if (!signer_name || signer_name.length < 2) {
      return NextResponse.json({ error: "Signer name is required." }, { status: 400 });
    }

    if (!initialsRaw || initialsRaw.length < 1 || initialsRaw.length > 6) {
      return NextResponse.json(
        { error: "Initials are required (1–6 chars)." },
        { status: 400 }
      );
    }

    const initials = initialsRaw.toUpperCase();

    /**
     * ✅ We need technician_email for override.
     * If your schema uses a different column name, change it here.
     */
    const { data: appt, error: apptErr } = await authed
      .from("appointments")
      .select("id, customer_email, scheduled_date, technician_email")
      .eq("id", appointmentId)
      .maybeSingle();

    if (apptErr || !appt) {
      return NextResponse.json(
        { error: apptErr?.message || "Appointment not found." },
        { status: 404 }
      );
    }

    const tz = "America/Los_Angeles";

    // ✅ Decide if caller is the assigned tech
    const assignedTechEmail = normalizeEmail((appt as any)?.technician_email);
    const isAssignedTech =
      !!assignedTechEmail && !!authedEmail && assignedTechEmail === authedEmail;

    // ✅ Day-of rule: ENFORCE only if NOT assigned tech
    // (You asked: tech override, user can sign ahead of time too)
    // So: actually we allow ANY authenticated signing, regardless of date.
    // But if you still want a rule for random users, keep a soft guard:
    //
    // We'll allow ALWAYS for authed users, but keep a sanity check if scheduled_date exists.
    const apptDay = appt?.scheduled_date ? String(appt.scheduled_date).slice(0, 10) : null;
    const today = isoDateInTZ(new Date(), tz);

    // ✅ No more blocking — both customer + tech can sign ahead of time
    // (keeping variables for logging/debug if needed)
    void apptDay;
    void today;
    void isAssignedTech;

    // Capture IP + UA (best-effort)
    const ip =
      headerStore.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get?.("x-real-ip") ||
      null;
    const ua = headerStore.get?.("user-agent") || null;

    const waiver_text =
      typeof body?.waiver_text === "string" && body.waiver_text.trim().length
        ? body.waiver_text
        : buildGlassGuardianWaiverText({
            repairAmount: 60,
            customerName: signer_name,
            timeZone: tz,
          });

    // ✅ Service role for: duplicate check, upload, insert, appointment update
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Prevent duplicates
    const { data: existing, error: existErr } = await admin
      .from("appointment_waivers")
      .select("id")
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 400 });
    }
    if (existing?.id) {
      return NextResponse.json(
        { error: "Waiver already signed for this appointment." },
        { status: 409 }
      );
    }

    // Upload drawn signature to Storage if provided
    let signature_png_path: string | null = null;

    if (signature_type === "drawn") {
      if (!signature_payload || !String(signature_payload).startsWith("data:image/")) {
        return NextResponse.json({ error: "Signature image is required." }, { status: 400 });
      }

      const { bytes, contentType } = dataUrlToBytes(signature_payload);

      const maxBytes = 1_500_000;
      if (bytes.length > maxBytes) {
        return NextResponse.json(
          { error: "Signature image is too large. Please try again." },
          { status: 413 }
        );
      }

      const waiverId = crypto.randomUUID();
      const namePart = safeKeyPart(signer_name) || "signer";
      signature_png_path = `appointments/${appointmentId}/waivers/${waiverId}-${namePart}.png`;

      const up = await admin.storage.from("waivers").upload(signature_png_path, bytes, {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

      if (up.error) {
        return NextResponse.json({ error: up.error.message }, { status: 400 });
      }
    }

    const computedEmail =
      normalizeEmail(body?.signer_email) ||
      normalizeEmail(appt.customer_email) ||
      normalizeEmail(user.email) ||
      null;

    const now = new Date().toISOString();

    const { data: inserted, error: insErr } = await admin
      .from("appointment_waivers")
      .insert({
        appointment_id: appointmentId,
        signer_role,
        signer_name,
        signer_email: computedEmail,
        initials,
        signature_name,
        waiver_version: String(body?.waiver_version ?? WAIVER_VERSION),
        waiver_text,
        signed_ip: ip,
        signed_user_agent: ua,
        signature_png_path,
        signed_at: now,
        created_at: now,
      })
      .select("id, appointment_id, signed_at, signature_png_path")
      .maybeSingle();

    if (insErr) {
      if (signature_png_path) {
        await admin.storage.from("waivers").remove([signature_png_path]).catch(() => {});
      }
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    await admin
      .from("appointments")
      .update({
        waiver_signing_mode: signature_type === "drawn" ? "device" : "typed",
        waiver_signed_at: now,
      })
      .eq("id", appointmentId);

    return NextResponse.json({ ok: true, waiver: inserted }, { status: 200 });
  } catch (e: any) {
    console.error("waiver route error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}