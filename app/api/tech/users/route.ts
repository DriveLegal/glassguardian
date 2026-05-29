// app/api/tech/users/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type AnyObj = Record<string, any>;

function envSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://glassguardianchipandcrackrepair.com"
  );
}

// ✅ build base URL from the actual request host (fixes preview/dev/prod mismatch)
function requestBaseUrl(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.nextUrl?.protocol ? req.nextUrl.protocol.replace(":", "") : "https");

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.host;

  if (!host) return envSiteUrl();
  return `${proto}://${host}`;
}

function isLocalHostUrl(url: string) {
  try {
    const u = new URL(url);
    const h = (u.hostname || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
  } catch {
    return false;
  }
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSupabaseFromAuthHeader(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";

  const headers: Record<string, string> = {};
  if (authHeader) headers["Authorization"] = authHeader;

  return createClient(url, anonKey, { global: { headers } });
}

async function assertActiveTechEmail(req: NextRequest) {
  const cookieStore = await cookies();
  const devRole = cookieStore.get("gg_dev_role")?.value ?? null;

  if (devRole === "tech") return "dev.tech@example.com";

  const supabase = getSupabaseFromAuthHeader(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  return (data.user.email || "").toLowerCase() || null;
}

function sevenDigitCode() {
  // 1,000,000–9,999,999
  return String(Math.floor(1_000_000 + Math.random() * 9_000_000));
}

/**
 * ✅ Generates Supabase INVITE link that redirects to:
 *    /user/signup#invite=<inviteId>
 *
 * IMPORTANT:
 * - This avoids querystring allowlist issues (?invite=...).
 * - Supabase validates only the base URL (fragment is not sent to server).
 *
 * Supabase Auth → URL Configuration → Redirect URLs should include:
 * - https://glassguardianchipandcrackrepair.com/user/signup
 * - http://localhost:3000/user/signup (optional for local dev)
 */
async function generateSupabaseInviteLink(params: {
  req: NextRequest;
  admin: ReturnType<typeof getAdminSupabase>;
  email: string;
  inviteId: string;
}) {
  const { req, admin, email, inviteId } = params;

  const basePrimary = requestBaseUrl(req);
  const baseFallback = envSiteUrl();

  // ✅ NO querystring. Put inviteId in hash fragment.
  const makeRedirect = (base: string) =>
    `${base.replace(/\/+$/, "")}/user/signup#invite=${encodeURIComponent(inviteId)}`;

  // ✅ Prefer prod site first so local dev doesn't "win" and cause Supabase to fallback.
  // Still include basePrimary for preview/dev environments.
  const orderedBases = Array.from(new Set([baseFallback, basePrimary]));

  const redirectCandidates = orderedBases.map(makeRedirect);

  console.log("[invite] redirect candidates:", redirectCandidates);

  let lastErr: any = null;

  for (const redirectTo of redirectCandidates) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (!error) {
      const actionLink = (data as AnyObj)?.properties?.action_link as
        | string
        | undefined;

      console.log("[invite] used redirectTo:", redirectTo);
      console.log("[invite] action_link:", actionLink || "(missing)");

      if (actionLink) return { link: actionLink, usedRedirectTo: redirectTo };
      lastErr = new Error("generateLink returned no action_link");
      continue;
    }

    lastErr = error;
  }

  return { link: null as string | null, error: lastErr };
}

/* =========================================================================================
   ✅ Resend click tracking disable (prevents resend-links.com wrapping)
   ========================================================================================= */

let _trackingConfigured = false;

async function ensureResendClickTrackingDisabled(resend: Resend) {
  if (_trackingConfigured) return;

  const domainId = process.env.RESEND_DOMAIN_ID;
  if (!domainId) return;

  try {
    await (resend as any).domains.update({
      id: domainId,
      clickTracking: false,
      // openTracking: true, // optional
    });

    _trackingConfigured = true;
    console.log("[resend] click tracking disabled for domain:", domainId);
  } catch (e: any) {
    console.warn("[resend] failed to update tracking:", e?.message || e);
  }
}

async function sendUserInviteEmail(params: {
  to: string;
  full_name: string | null;
  supabaseInviteLink: string;
}) {
  const { to, full_name, supabaseInviteLink } = params;

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Glass Guardian <noreply@glassguardianchipandcrackrepair.com>";

  if (!apiKey) return;

  const resend = new Resend(apiKey);

  // ✅ Key line: ensure click tracking is off (no resend-links.com wrapper)
  await ensureResendClickTrackingDisabled(resend);

  const signupUrl = supabaseInviteLink;

  await resend.emails.send({
    from,
    to,
    subject: "Your Glass Guardian Secure Portal",
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Glass Guardian</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1220;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your secure access link is inside. Confirm once and you’re in.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0b1220;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;border-collapse:separate;">
            <tr>
              <td style="padding:0 0 14px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:18px;overflow:hidden;">
                  <tr>
                    <td style="padding:16px 18px;background:linear-gradient(135deg,#0ea5e9 0%, #2563eb 45%, #22c55e 115%);">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="left" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;">
                            <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.9;font-weight:700;">
                              GLASS GUARDIAN
                            </div>
                            <div style="font-size:14px;opacity:0.9;margin-top:2px;">
                              Chip &amp; Crack Repair · User Portal
                            </div>
                          </td>
                          <td align="right" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;">
                            <div style="font-size:11px;opacity:0.9;">Secure Invite</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#0f172a;border:1px solid rgba(148,163,184,0.22);border-radius:20px;overflow:hidden;box-shadow:0 28px 90px rgba(0,0,0,0.55);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:6px;background:linear-gradient(90deg, rgba(56,189,248,0.9), rgba(37,99,235,0.9), rgba(34,197,94,0.85));"></td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:22px 22px 10px 22px;">
                      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e5e7eb;">
                        <div style="font-size:16px;line-height:1.5;margin:0 0 10px 0;">
                          Hi <span style="color:#ffffff;font-weight:800;">${full_name || "there"}</span>,
                        </div>

                        <div style="font-size:22px;line-height:1.25;font-weight:900;color:#ffffff;margin:0 0 10px 0;">
                          Your Glass Guardian portal is ready
                        </div>

                        <div style="font-size:13px;line-height:1.65;color:#cbd5e1;margin:0 0 14px 0;">
                          Confirm your email once, set your password, and you&apos;re in.<br />
                          <span style="color:#ffffff;font-weight:900;">One secure link — no extra codes.</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 22px 22px 22px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td align="left" style="padding:0 0 10px 0;">
                            <a href="${signupUrl}"
                               style="display:inline-block;background:linear-gradient(135deg,#0ea5e9 0%, #2563eb 55%, #22c55e 140%);color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-weight:900;font-size:14px;letter-spacing:0.02em;">
                              Set up my portal
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;line-height:1.55;color:#94a3b8;">
                            If the button doesn&apos;t work, paste this link into your browser:<br />
                            <span style="word-break:break-all;color:#cbd5e1;">${signupUrl}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:16px 22px;background:rgba(2,6,23,0.55);border-top:1px solid rgba(148,163,184,0.14);">
                      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;">
                        — Glass Guardian Chip &amp; Crack Repair<br />
                        <span style="color:#64748b;">This is a secure invite to access your customer portal.</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr><td style="height:14px;"></td></tr>

            <tr>
              <td align="center" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#475569;font-size:11px;line-height:1.6;padding:0 10px;">
                If you didn&apos;t request this, you can ignore this email.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  });
}

export async function POST(req: NextRequest) {
  try {
    const techEmail = await assertActiveTechEmail(req);
    if (!techEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminSupabase();

    // 🔒 real lock: tech must be active
    const { data: techRow, error: techErr } = await admin
      .from("technicians")
      .select("is_active")
      .eq("email", techEmail)
      .maybeSingle();

    if (techErr || !techRow?.is_active) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as
      | { full_name?: string; email?: string; phone?: string }
      | { action: "resend"; invite_id: string }
      | { mode: "resend_invite"; invite_id: string };

    // ✅ accept resend via action=resend OR mode=resend_invite (your UI uses mode)
    const resendMode =
      ("action" in body && (body as any).action === "resend") ||
      ("mode" in body && (body as any).mode === "resend_invite");

    // =========================
    // RESEND
    // =========================
    if (resendMode) {
      const invite_id = String((body as any).invite_id || "").trim();
      if (!invite_id) {
        return NextResponse.json(
          { error: "invite_id is required for resend" },
          { status: 400 }
        );
      }

      const { data: invite, error: invErr } = await admin
        .from("user_invites")
        .select("id, email, full_name, used_at, tech_email, code")
        .eq("id", invite_id)
        .single();

      if (invErr)
        return NextResponse.json({ error: invErr.message }, { status: 500 });
      if (!invite)
        return NextResponse.json({ error: "Invite not found" }, { status: 404 });

      if (invite.tech_email && invite.tech_email !== techEmail) {
        return NextResponse.json(
          { error: "You are not allowed to resend this invite" },
          { status: 403 }
        );
      }

      if (invite.used_at) {
        return NextResponse.json(
          { error: "This invite has already been used." },
          { status: 400 }
        );
      }

      // Ensure DB NOT NULL constraint for code
      if (!invite.code) {
        const newCode = sevenDigitCode();
        const { error: patchErr } = await admin
          .from("user_invites")
          .update({ code: newCode })
          .eq("id", invite.id);

        if (patchErr) {
          return NextResponse.json(
            { error: patchErr.message || "Failed to repair invite code" },
            { status: 500 }
          );
        }
        (invite as any).code = newCode;
      }

      const gen = await generateSupabaseInviteLink({
        req,
        admin,
        email: invite.email,
        inviteId: invite.id,
      });

      if (!gen.link) {
        const msg =
          (gen as any)?.error?.message ||
          (gen as any)?.error?.error_description ||
          "Unknown error";

        return NextResponse.json(
          {
            error: `Failed to generate invite link: ${msg}`,
            hint:
              "Supabase Auth → URL Configuration → Redirect URLs MUST include: https://YOURDOMAIN/user/signup (and preview/localhost).",
          },
          { status: 500 }
        );
      }

      await sendUserInviteEmail({
        to: invite.email,
        full_name: invite.full_name,
        supabaseInviteLink: gen.link,
      });

      return NextResponse.json(
        {
          ok: true,
          invite_id: invite.id,
          user_code: invite.code,
          used_redirect_to: (gen as any).usedRedirectTo || null,
          action_link: gen.link,
        },
        { status: 200 }
      );
    }

    // =========================
    // CREATE / REUSE
    // =========================
    const full_name = String((body as any).full_name || "").trim();
    const email = String((body as any).email || "").trim().toLowerCase();
    const phone = String((body as any).phone || "").trim();

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "full_name and email are required" },
        { status: 400 }
      );
    }

    const { data: existingInvites, error: existingErr } = await admin
      .from("user_invites")
      .select(
        "id, email, full_name, phone, created_at, expires_at, used_at, tech_email, code"
      )
      .eq("email", email)
      .eq("tech_email", techEmail)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingErr)
      return NextResponse.json({ error: existingErr.message }, { status: 500 });

    let inviteRow: AnyObj;

    if (existingInvites && existingInvites.length > 0) {
      inviteRow = existingInvites[0];

      if (!inviteRow.code) {
        const newCode = sevenDigitCode();
        const { error: patchErr } = await admin
          .from("user_invites")
          .update({ code: newCode })
          .eq("id", inviteRow.id);

        if (patchErr) {
          return NextResponse.json(
            { error: patchErr.message || "Failed to repair invite code" },
            { status: 500 }
          );
        }
        inviteRow.code = newCode;
      }
    } else {
      const code = sevenDigitCode();

      const { data: inserted, error: insertErr } = await admin
        .from("user_invites")
        .insert({
          code,
          email,
          full_name,
          phone: phone || null,
          tech_email: techEmail,
          created_by_tech_email: techEmail,
        })
        .select(
          "id, email, full_name, phone, created_at, expires_at, used_at, tech_email, code"
        )
        .single();

      if (insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      inviteRow = inserted;
    }

    const gen = await generateSupabaseInviteLink({
      req,
      admin,
      email: inviteRow.email,
      inviteId: inviteRow.id,
    });

    if (!gen.link) {
      const msg =
        (gen as any)?.error?.message ||
        (gen as any)?.error?.error_description ||
        "Unknown error";

      return NextResponse.json(
        {
          error: `Failed to generate invite link: ${msg}`,
          hint:
            "Supabase Auth → URL Configuration → Redirect URLs MUST include: https://YOURDOMAIN/user/signup (and preview/localhost).",
        },
        { status: 500 }
      );
    }

    await sendUserInviteEmail({
      to: inviteRow.email,
      full_name: inviteRow.full_name,
      supabaseInviteLink: gen.link,
    });

    return NextResponse.json(
      {
        ok: true,
        invite: inviteRow,
        user_code: inviteRow.code,
        used_redirect_to: (gen as any).usedRedirectTo || null,
        action_link: gen.link,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Unhandled error in /api/tech/users:", err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}