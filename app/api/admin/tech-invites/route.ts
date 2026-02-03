// app/api/admin/tech-invites/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

// Single authorized admin email
const ADMIN_EMAIL = "fam.ilyrecordslast8@gmail.com";

/** Generate a code like GG-482193 */
function generateTechId(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `GG-${n}`;
}

/** Build an admin Supabase client (service role) */
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase env not configured (check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  // Loosely typed client to avoid TS generics collisions
  return createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Extract and verify bearer token belongs to ADMIN_EMAIL */
async function assertAdmin(req: Request, admin: any) {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return { ok: false as const, reason: "Missing bearer token" };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false as const, reason: "Invalid token" };
  }

  const email = (data.user.email || "").toLowerCase();
  const ok = email === ADMIN_EMAIL.toLowerCase();
  if (!ok) return { ok: false as const, reason: "Not admin" };

  return { ok: true as const, email };
}

function renderEmailHTML(args: {
  origin: string;
  code: string;
  email: string;
  full_name?: string;
  expires_at?: string | null;
}) {
  const { origin, code, email, full_name, expires_at } = args;
  const activateUrl = `${origin}/tech/signup?code=${encodeURIComponent(
    code
  )}&email=${encodeURIComponent(email)}`;
  const expiresStr = expires_at ? new Date(expires_at).toLocaleString() : "—";

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#0f172a">
    <h2 style="margin:0 0 8px">Your Glass Guardian Tech Invite</h2>
    <p style="margin:0 0 16px">Hi ${full_name || "there"},</p>
    <p style="margin:0 0 12px">You’ve been invited to join <strong>Glass Guardian</strong> as a <strong>Technician</strong>.</p>
    <p style="margin:0 0 12px"><strong>Tech ID:</strong> <code style="font-weight:bold">${code}</code><br/>
    <strong>Expires:</strong> ${expiresStr}</p>
    <p style="margin:16px 0">
      <a href="${activateUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Activate Tech Account</a>
    </p>
    <p style="margin:12px 0 0"><strong>Or activate manually:</strong></p>
    <ol style="margin:6px 0 16px; padding-left:20px">
      <li>Go to <a href="${origin}/tech/signup">${origin}/tech/signup</a></li>
      <li>Enter your email, name, phone, and create a password</li>
      <li>Paste your Tech ID: <code style="font-weight:bold">${code}</code></li>
    </ol>
    <p style="margin:0;color:#475569">If you didn’t expect this invite, you can ignore this email.</p>
    <p style="margin:24px 0 0">— Glass Guardian Admin</p>
  </div>`;
}

function renderEmailText(args: {
  origin: string;
  code: string;
  email: string;
  full_name?: string;
  expires_at?: string | null;
}) {
  const { origin, code, email, full_name, expires_at } = args;
  const activateUrl = `${origin}/tech/signup?code=${encodeURIComponent(
    code
  )}&email=${encodeURIComponent(email)}`;
  const expiresStr = expires_at ? new Date(expires_at).toLocaleString() : "—";

  return [
    `Hi ${full_name || "there"},`,
    ``,
    `You’ve been invited to join Glass Guardian as a Technician.`,
    ``,
    `Tech ID: ${code}`,
    `Expires: ${expiresStr}`,
    ``,
    `Activate here: ${activateUrl}`,
    ``,
    `Or go to ${origin}/tech/signup and paste your Tech ID: ${code}`,
    ``,
    `If you didn’t expect this invite, you can ignore this email.`,
    ``,
    `— Glass Guardian Admin`,
  ].join("\n");
}

/* --------------------------------- GET ---------------------------------- */
/** List pending (non-expired) invites for the admin panel */
export async function GET(req: Request) {
  try {
    const admin = getAdminClient();

    const auth = await assertAdmin(req, admin);
    if (!auth.ok) {
      return NextResponse.json({ error: `Unauthorized: ${auth.reason}` }, { status: 401 });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await admin
      .from("tech_invites")
      .select("*")
      .is("used_at", null)
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, invites: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error (GET)" },
      { status: 500 }
    );
  }
}

/* --------------------------------- POST --------------------------------- */
/**
 * POST
 * - Normal: create a new invite row + send email
 * - reason === "resend": re-send email using existing pending invite for that email (NO new row)
 */
export async function POST(req: Request) {
  try {
    const admin = getAdminClient();

    const auth = await assertAdmin(req, admin);
    if (!auth.ok) {
      return NextResponse.json(
        { error: `Unauthorized: ${auth.reason}` },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email: string = (body.email || "").trim().toLowerCase();
    const full_name_raw: string = (body.full_name || "").trim();
    const phone: string = (body.phone || "").trim();
    const expires_in_days: number = Number(body.expires_in_days ?? 14);
    const reason: string | undefined = body.reason
      ? String(body.reason).toLowerCase()
      : undefined;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const resendMode = reason === "resend";

    // For resend we can fall back to DB full_name; for normal create we require it.
    if (!full_name_raw && !resendMode) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const origin =
      process.env.NEXT_PUBLIC_SITE_ORIGIN ||
      new URL(req.url).origin; // e.g. https://glassguardianchipandcrackrepair.com

    /* -------- RESEND MODE: reuse existing pending invite row -------- */
    if (resendMode) {
      const nowIso = new Date().toISOString();
      const { data: invite, error } = await admin
        .from("tech_invites")
        .select("*")
        .is("used_at", null)
        .gte("expires_at", nowIso)
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message || "Failed to look up invite" },
          { status: 500 }
        );
      }

      if (!invite) {
        return NextResponse.json(
          { error: "No pending invite found for this email" },
          { status: 404 }
        );
      }

      if (resendKey) {
        const resend = new Resend(resendKey);
        try {
          await resend.emails.send({
            from: "Glass Guardian <no-reply@glassguardianchipandcrackrepair.com>",
            to: email,
            subject: "Your Glass Guardian Tech Invite — Activate Your Account",
            text: renderEmailText({
              origin,
              code: invite.code,
              email: invite.email,
              full_name: invite.full_name || full_name_raw,
              expires_at: invite.expires_at,
            }),
            html: renderEmailHTML({
              origin,
              code: invite.code,
              email: invite.email,
              full_name: invite.full_name || full_name_raw,
              expires_at: invite.expires_at,
            }),
          });
        } catch (mailErr: any) {
          console.error("Resend email error (resend):", mailErr?.message || mailErr);
          // still return ok, since DB is fine; admin UI just needs to know it tried
        }
      }

      return NextResponse.json({ ok: true, invite });
    }

    /* -------- NORMAL CREATE: insert new row + send email -------- */
    const full_name = full_name_raw;

    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + Math.max(1, expires_in_days));
    const code: string = String(body.code || generateTechId()).toUpperCase();

    // try insert; handle unique code collision (23505) once
    const tryInsert = async (inviteCode: string) => {
      return admin
        .from("tech_invites")
        .insert({
          code: inviteCode,
          email,
          full_name,
          phone,
          expires_at: expires_at.toISOString(),
        })
        .select("*")
        .single();
    };

    let { data, error } = await tryInsert(code);
    if (error && (error as any).code === "23505") {
      const alt = generateTechId();
      const resp2 = await tryInsert(alt);
      data = resp2.data;
      error = resp2.error;
    }

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Insert failed" },
        { status: 500 }
      );
    }

    if (resendKey) {
      const resend = new Resend(resendKey);
      try {
        await resend.emails.send({
          from: "Glass Guardian <no-reply@glassguardianchipandcrackrepair.com>",
          to: email,
          subject: "Your Glass Guardian Tech Invite — Activate Your Account",
          text: renderEmailText({
            origin,
            code: data.code,
            email: data.email,
            full_name: data.full_name,
            expires_at: data.expires_at,
          }),
          html: renderEmailHTML({
            origin,
            code: data.code,
            email: data.email,
            full_name: data.full_name,
            expires_at: data.expires_at,
          }),
        });
      } catch (mailErr: any) {
        console.error("Resend email error (create):", mailErr?.message || mailErr);
      }
    }

    return NextResponse.json({ ok: true, invite: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error (POST)" },
      { status: 500 }
    );
  }
}