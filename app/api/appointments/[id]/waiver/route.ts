//app/api/appointmetns/[id]/wiaver/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildGlassGuardianWaiverText,
  WAIVER_VERSION,
} from "@/lib/waivers/glassGuardianWaiver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================
   Helpers
========================= */

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

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function base64UrlToUtf8(input: string) {
  // base64url -> base64
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const out = Buffer.from(b64 + pad, "base64").toString("utf8");
  return out;
}

/**
 * ✅ Robust extraction:
 * Handles:
 * - sb-access-token (legacy)
 * - sb-<ref>-auth-token (common)
 *   value may be:
 *   - JSON
 *   - URI-encoded JSON
 *   - "base64-<base64url(json)>"
 *   - quoted variants of all above
 */
function getAccessTokenFromCookies(req: NextRequest) {
  // legacy
  const legacy = req.cookies.get("sb-access-token")?.value;
  if (legacy && legacy.trim()) return legacy.trim();

  const cookies = (req.cookies.getAll?.() ?? []) as any[];

  const authCookies = cookies.filter((c) => {
    const name = String(c?.name || "");
    return name.startsWith("sb-") && name.endsWith("-auth-token");
  });

  for (const c of authCookies) {
    const raw0 = String(c?.value ?? "");
    if (!raw0) continue;

    const candidates: string[] = [];

    // raw
    candidates.push(raw0);

    // quoted raw
    if (raw0.startsWith('"') && raw0.endsWith('"')) {
      candidates.push(raw0.slice(1, -1));
    }

    // decodeURIComponent variants
    try {
      candidates.push(decodeURIComponent(raw0));
    } catch {}
    if (raw0.startsWith('"') && raw0.endsWith('"')) {
      try {
        candidates.push(decodeURIComponent(raw0.slice(1, -1)));
      } catch {}
    }

    for (const cand0 of candidates) {
      const cand = String(cand0 || "").trim();
      if (!cand) continue;

      // case: base64-<base64url(json)>
      if (cand.startsWith("base64-")) {
        const payload = cand.slice("base64-".length);
        try {
          const jsonStr = base64UrlToUtf8(payload);
          const j = safeJsonParse(jsonStr);
          const t = j?.access_token;
          if (typeof t === "string" && t.trim()) return t.trim();
        } catch {}
      }

      // case: direct JSON
      const j1 = safeJsonParse(cand);
      const t1 = j1?.access_token;
      if (typeof t1 === "string" && t1.trim()) return t1.trim();

      // case: maybe it is base64/base64url JSON without prefix
      // (we only try decode if it looks base64-ish and doesn't contain spaces)
      const looksB64ish =
        cand.length > 40 &&
        !cand.includes("{") &&
        !cand.includes("}") &&
        !cand.includes(" ") &&
        /^[A-Za-z0-9+/_=-]+$/.test(cand);

      if (looksB64ish) {
        // try base64url decode
        try {
          const jsonStr = base64UrlToUtf8(cand);
          const j = safeJsonParse(jsonStr);
          const t = j?.access_token;
          if (typeof t === "string" && t.trim()) return t.trim();
        } catch {}
        // try standard base64 decode
        try {
          const jsonStr = Buffer.from(cand, "base64").toString("utf8");
          const j = safeJsonParse(jsonStr);
          const t = j?.access_token;
          if (typeof t === "string" && t.trim()) return t.trim();
        } catch {}
      }
    }
  }

  return "";
}

async function resolveParamsId(context: any): Promise<string> {
  try {
    const p = context?.params;
    if (!p) return "";
    if (typeof p?.then === "function") {
      const awaited = await p;
      return String(awaited?.id ?? "").trim();
    }
    return String(p?.id ?? "").trim();
  } catch {
    return "";
  }
}

/* =========================
   Route
========================= */

export async function POST(req: NextRequest, context: any) {
  try {
    const appointmentId = await resolveParamsId(context);

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

    const body = await req.json().catch(() => null);

    const tokenFromAuthHeader = getBearerToken(req);
    const tokenFromAltHeader = (req.headers.get("x-supabase-token") || "").trim();
    const tokenFromBody = String(body?.access_token ?? "").trim();
    const tokenFromCookies = getAccessTokenFromCookies(req);

    const token =
      tokenFromAuthHeader || tokenFromAltHeader || tokenFromBody || tokenFromCookies;

    // ✅ safe debug (no secrets)
    const cookieNames = (req.cookies.getAll?.() ?? []).map((c: any) => String(c?.name || ""));
    const debug = {
      hasAuthHeader: Boolean(req.headers.get("authorization")),
      hasAltHeader: Boolean(req.headers.get("x-supabase-token")),
      hasBodyToken: Boolean(tokenFromBody),
      cookieCount: cookieNames.length,
      cookieNames: cookieNames.slice(0, 6), // safe
      hasSbAccessCookie: Boolean(req.cookies.get("sb-access-token")?.value),
      hasSbAuthCookie: cookieNames.some((n) => n.startsWith("sb-") && n.endsWith("-auth-token")),
      tokenLength: token ? token.length : 0,
      routeAppointmentId: appointmentId,
    };

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated. Missing Authorization bearer token.", debug },
        { status: 401 }
      );
    }

    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: authData, error: authErr } = await authed.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated.", debug }, { status: 401 });
    }

    const user = authData.user;
    const authedEmail = normalizeEmail(user.email);
    void authedEmail;

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

    // ✅ confirm appointment exists (RLS via authed client)
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
    const apptDay = appt?.scheduled_date ? String(appt.scheduled_date).slice(0, 10) : null;
    const today = isoDateInTZ(new Date(), tz);
    void apptDay;
    void today;

    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent") || null;

    const waiver_text =
      typeof body?.waiver_text === "string" && body.waiver_text.trim().length
        ? body.waiver_text
        : buildGlassGuardianWaiverText({
            repairAmount: 70,
            customerName: signer_name,
          });

    // ✅ service role for duplicate check, upload, insert, appointment update
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: existErr } = await admin
      .from("appointment_waivers")
      .select("id")
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 400 });

    if (existing?.id) {
      return NextResponse.json(
        { error: "Waiver already signed for this appointment." },
        { status: 409 }
      );
    }

    let signature_png_path: string | null = null;

    if (signature_type === "drawn") {
      if (!signature_payload || !String(signature_payload).startsWith("data:image/")) {
        return NextResponse.json({ error: "Signature image is required." }, { status: 400 });
      }

      const { bytes, contentType } = dataUrlToBytes(signature_payload);
      if (bytes.length > 1_500_000) {
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

      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });
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