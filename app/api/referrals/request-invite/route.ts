// app/api/referrals/request-invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type Body = {
  email?: string;
  full_name?: string;
  referral_code?: string | null;
  phone?: string | null;
};

type RecentRequestRow = {
  id: string;
  created_at: string;
  status: string | null;
};

function normEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function normName(v: unknown) {
  return String(v ?? "").trim();
}

function normPhone(v: unknown) {
  const raw = String(v ?? "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits;
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getBaseUrl(req: NextRequest) {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (env) return env.replace(/\/$/, "");

  const origin = req.headers.get("origin") || "";
  if (origin) return origin.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";

  return `${proto}://${host}`.replace(/\/$/, "");
}

function generate7Digit() {
  return String(Math.floor(1_000_000 + Math.random() * 9_000_000));
}

async function generateUniqueInviteCode(
  supabaseAdmin: SupabaseClient<any, any, any>,
  maxTries = 12
) {
  for (let i = 0; i < maxTries; i++) {
    const code = generate7Digit();

    const { data, error } = await supabaseAdmin
      .from("user_invites")
      .select("id")
      .eq("code", code)
      .limit(1);

    if (error) return code;
    if (!data || data.length === 0) return code;
  }

  return generate7Digit();
}

function referralDisplayNameFromEmail(email: string | null) {
  const v = String(email ?? "").trim();
  if (!v) return null;
  return v.split("@")[0] || v;
}

function isValidReferralCode(v: string) {
  return /^[A-Za-z0-9_-]{4,64}$/.test(v);
}

async function getLatestInviteForEmail(
  supabaseAdmin: SupabaseClient<any, any, any>,
  email: string
) {
  const { data, error } = await supabaseAdmin
    .from("user_invites")
    .select("id, code, created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Invite lookup failed: ${error.message}`);
  return data;
}

async function createInviteIfMissing(opts: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  email: string;
  fullName: string;
  phone: string;
  createdBy: string;
}) {
  const existingInvite = await getLatestInviteForEmail(opts.supabaseAdmin, opts.email);

  if (existingInvite?.code) {
    return {
      inviteId: existingInvite.id as string,
      inviteCode: existingInvite.code as string,
      reused: true,
    };
  }

  const newInviteCode = await generateUniqueInviteCode(opts.supabaseAdmin);

  const inviteInsert = {
    full_name: opts.fullName,
    email: opts.email,
    phone: opts.phone,
    code: newInviteCode,
    tech_email: opts.createdBy,
    created_by_tech_email: opts.createdBy,
  };

  const { data: inviteRow, error: invErr } = await opts.supabaseAdmin
    .from("user_invites")
    .insert(inviteInsert)
    .select("id, code, created_at")
    .single();

  if (invErr) {
    throw new Error(`Invite creation failed: ${invErr.message}`);
  }

  return {
    inviteId: inviteRow.id as string,
    inviteCode: inviteRow.code as string,
    reused: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const email = normEmail(body.email);
    const fullName = normName(body.full_name);

    const bodyReferralCode = String(body.referral_code ?? "").trim();
    const cookieReferralCode = String(
      req.cookies.get("gg_ref")?.value ?? ""
    ).trim();

    const referralCodeRaw = bodyReferralCode || cookieReferralCode || "";
    const referralCode =
      referralCodeRaw && isValidReferralCode(referralCodeRaw)
        ? referralCodeRaw
        : null;

    const phoneDigits = normPhone(body.phone);
    const phone = phoneDigits || null;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Valid email is required." },
        { status: 400 }
      );
    }

    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Valid phone number is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE URL.",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const createdBy =
      process.env.REFERRAL_SYSTEM_CREATOR_EMAIL || "referral@system";

    const { data: recentReqRows, error: recentReqErr } = await supabaseAdmin
      .from("referral_invite_requests")
      .select("id, created_at, status")
      .eq("email", email)
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentReqErr) {
      return NextResponse.json(
        { ok: false, error: recentReqErr.message },
        { status: 500 }
      );
    }

    const recentReq = (recentReqRows?.[0] ?? null) as RecentRequestRow | null;

    let referrerEmail: string | null = null;
    let referrerUserId: string | null = null;
    let referrerName: string | null = null;

    if (referralCode) {
      const { data: codeRow, error: codeErr } = await supabaseAdmin
        .from("referral_codes")
        .select("referral_code, referrer_email")
        .eq("referral_code", referralCode)
        .maybeSingle();

      if (codeErr || !codeRow) {
        return NextResponse.json(
          { ok: false, error: "Invalid referral code." },
          { status: 400 }
        );
      }

      referrerEmail =
        String(codeRow.referrer_email ?? "").trim().toLowerCase() || null;
      referrerName = referralDisplayNameFromEmail(referrerEmail);

      if (referrerEmail && referrerEmail === email) {
        return NextResponse.json(
          { ok: false, error: "Self-referrals are not allowed." },
          { status: 400 }
        );
      }
    }

    let requestId: string;
    let requestCreatedAt: string;

    if (recentReq?.id) {
      requestId = recentReq.id;
      requestCreatedAt = recentReq.created_at;
    } else {
      const requestInsert = {
        email,
        full_name: fullName,
        referral_code: referralCode,
        status: "new",
      };

      const { data: requestRow, error: reqErr } = await supabaseAdmin
        .from("referral_invite_requests")
        .insert(requestInsert)
        .select("id, created_at")
        .single();

      if (reqErr) {
        return NextResponse.json(
          { ok: false, error: reqErr.message },
          { status: 500 }
        );
      }

      requestId = requestRow.id;
      requestCreatedAt = requestRow.created_at;
    }

    if (referralCode && referrerEmail) {
      const referralPayload = {
        referral_code: referralCode,
        referrer_email: referrerEmail,
        referrer_user_id: referrerUserId,
        referred_email: email,
        status: "pending",
        credit_amount: 15,
        source: "invite_request",
        credited: false,
      };

      const { error: referralUpsertErr } = await supabaseAdmin
        .from("referrals")
        .upsert(referralPayload, { onConflict: "referred_email" });

      if (referralUpsertErr) {
        const { data: existingReferral } = await supabaseAdmin
          .from("referrals")
          .select("id")
          .eq("referred_email", email)
          .limit(1)
          .maybeSingle();

        if (existingReferral?.id) {
          await supabaseAdmin
            .from("referrals")
            .update(referralPayload)
            .eq("id", existingReferral.id);
        } else {
          const { error: fallbackInsertErr } = await supabaseAdmin
            .from("referrals")
            .insert(referralPayload);

          if (fallbackInsertErr) {
            return NextResponse.json(
              { ok: false, error: fallbackInsertErr.message },
              { status: 500 }
            );
          }
        }
      }
    }

    let inviteId: string | null = null;
    let inviteCode: string | null = null;
    let deduped = false;

    try {
      const inviteResult = await createInviteIfMissing({
        supabaseAdmin,
        email,
        fullName,
        phone,
        createdBy,
      });

      inviteId = inviteResult.inviteId;
      inviteCode = inviteResult.inviteCode;
      deduped = inviteResult.reused;
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: e?.message || "Invite creation failed." },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("referral_invite_requests")
      .update({ status: "invited" })
      .eq("id", requestId);

    await sendInviteEmail({
      req,
      toEmail: email,
      fullName,
      code: inviteCode!,
      referralCode,
    });

    await notifyAdmin({
      req,
      fullName,
      email,
      phone,
      referralCode,
      inviteCode: inviteCode!,
      requestId,
      createdAt: requestCreatedAt,
      referrerEmail,
      referrerName,
    });

    return NextResponse.json({
      ok: true,
      deduped,
      request_id: requestId,
      invite_id: inviteId,
      invite_code: inviteCode,
      referral_code: referralCode,
      referrer_email: referrerEmail,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/* ------------------------- Email helpers ------------------------- */

async function sendInviteEmail(opts: {
  req: NextRequest;
  toEmail: string;
  fullName: string;
  code: string;
  referralCode: string | null;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM ||
    "Glass Guardian <no-reply@glassguardianchipandcrackrepair.com>";

  if (!resendKey) return;

  const resend = new Resend(resendKey);
  const baseUrl = getBaseUrl(opts.req);

  const signupUrl = new URL(`${baseUrl}/user/signup`);
  signupUrl.searchParams.set("email", opts.toEmail);
  signupUrl.searchParams.set("name", opts.fullName);
  signupUrl.searchParams.set("code", opts.code);
  if (opts.referralCode) signupUrl.searchParams.set("ref", opts.referralCode);

  const subject = "Your Glass Guardian Access Code (7 digits)";
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5;background:#0b0f17;padding:24px;">
      <div style="max-width:580px;margin:0 auto;background:#0f1724;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:24px;color:#e5e7eb;">
        <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#d6b25e;margin-bottom:10px;">
          Glass Guardian
        </div>

        <h2 style="margin:0 0 10px 0;font-size:28px;line-height:1.2;color:#ffffff;">
          Welcome to Glass Guardian
        </h2>

        <p style="margin:0 0 16px 0;color:#cbd5e1;">
          Use the 7-digit access code below to create your account and continue your referral invite.
        </p>

        <div style="border:1px solid rgba(214,178,94,.28);border-radius:18px;padding:18px;background:linear-gradient(135deg,rgba(214,178,94,.14),rgba(255,255,255,.03));">
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#e7c97d;">
            Your Access Code
          </div>
          <div style="font-size:34px;font-weight:800;letter-spacing:.25em;margin-top:8px;color:#ffffff;">
            ${escapeHtml(opts.code)}
          </div>
        </div>

        <div style="margin-top:18px;">
          <a href="${signupUrl.toString()}"
             style="display:inline-block;padding:12px 18px;border-radius:14px;background:linear-gradient(135deg,#d6b25e,#f0d68a);color:#111827;text-decoration:none;font-weight:800;">
            Create Account Now
          </a>
        </div>

        <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">
          If the button doesn’t work, paste this link into your browser:
        </p>

        <p style="margin:6px 0 0 0;font-size:12px;color:#cbd5e1;word-break:break-all;">
          ${escapeHtml(signupUrl.toString())}
        </p>

        <p style="margin:12px 0 0 0;font-size:12px;color:#94a3b8;">
          Tip: Your code can also be entered on the signup screen under “User ID Code”.
        </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from,
    to: opts.toEmail,
    subject,
    html,
  });
}

async function notifyAdmin(opts: {
  req: NextRequest;
  fullName: string;
  email: string;
  phone: string | null;
  referralCode: string | null;
  inviteCode: string;
  requestId: string;
  createdAt: string;
  referrerEmail: string | null;
  referrerName: string | null;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REFERRAL_ADMIN_NOTIFY_EMAIL;
  const from =
    process.env.RESEND_FROM ||
    "Glass Guardian <no-reply@glassguardianchipandcrackrepair.com>";

  if (!resendKey || !notifyTo) return;

  const resend = new Resend(resendKey);
  const baseUrl = getBaseUrl(opts.req);

  const subject = `Referral invite auto-sent: ${opts.fullName} (${opts.email})`;
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;line-height:1.45;background:#0b0f17;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:22px;color:#111827;">
        <h2 style="margin:0 0 12px 0;">Referral Invite Auto-Sent ✅</h2>

        <p style="margin:0 0 14px 0;color:#475569;">
          A referral requested access and the system automatically created or reused their invite code and emailed it.
        </p>

        <div style="padding:14px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
          <p style="margin:0 0 6px 0;"><b>Name:</b> ${escapeHtml(opts.fullName)}</p>
          <p style="margin:0 0 6px 0;"><b>Email:</b> ${escapeHtml(opts.email)}</p>
          <p style="margin:0 0 6px 0;"><b>Phone:</b> ${escapeHtml(opts.phone || "—")}</p>
          <p style="margin:0 0 6px 0;"><b>Invite code:</b> <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;">${escapeHtml(opts.inviteCode)}</span></p>
          <p style="margin:0 0 6px 0;"><b>Referral code:</b> ${escapeHtml(opts.referralCode || "—")}</p>
          <p style="margin:0 0 6px 0;"><b>Referrer:</b> ${escapeHtml(opts.referrerName || opts.referrerEmail || "—")}</p>
          <p style="margin:0 0 6px 0;"><b>Request ID:</b> ${escapeHtml(opts.requestId)}</p>
          <p style="margin:0;"><b>Created:</b> ${escapeHtml(opts.createdAt)}</p>
        </div>

        <p style="margin:14px 0 0 0;font-size:12px;color:#64748b;">
          Base URL: ${escapeHtml(baseUrl)}
        </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from,
    to: notifyTo,
    subject,
    html,
  });
}