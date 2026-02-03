// app/api/tech/users/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type AnyObj = Record<string, any>;

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSupabaseFromAuthHeader(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
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

  // DevSim override
  if (devRole === "tech") return "dev.tech@example.com";

  const supabase = getSupabaseFromAuthHeader(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  return (data.user.email || "").toLowerCase() || null;
}

async function sendUserInviteEmail(params: {
  to: string;
  full_name: string | null;
  user_code: string;
}) {
  const { to, full_name, user_code } = params;

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Glass Guardian <noreply@glassguardianchipandcrackrepair.com>";

  if (!apiKey) return;

  const resend = new Resend(apiKey);

  const loginUrl = `https://glassguardianchipandcrackrepair.com/user/login?code=${encodeURIComponent(
    user_code
  )}&email=${encodeURIComponent(to)}&name=${encodeURIComponent(full_name || "")}`;

  await resend.emails.send({
    from,
    to,
    subject: "Activate your Glass Guardian User Portal",
    html: `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color:#0f172a;">
        <p style="margin:0 0 12px;">Hi ${full_name || "there"},</p>
        <p style="margin:0 0 10px;">Thank you for choosing <strong>Glass Guardian Chip &amp; Crack Repair</strong>.</p>
        <p style="margin:0 0 12px;">Your secure <strong>User Access Code</strong> is:</p>
        <p style="font-size: 26px;font-weight: 700;letter-spacing: 6px;margin: 10px 0 18px;padding: 10px 16px;display:inline-block;border-radius: 10px;background:#020617;color:#e5e7eb;">
          ${user_code}
        </p>
        <p style="margin:16px 0;">
          <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
            Create my user portal
          </a>
        </p>
        <p style="margin:0 0 12px; font-size:12px; color:#64748b;">
          If the button doesn&apos;t work, paste this link into your browser:<br/>
          <span style="word-break:break-all; color:#0f172a;">${loginUrl}</span>
        </p>
        <p style="margin:12px 0 0; font-size:12px; color:#94a3b8;">— Glass Guardian Chip &amp; Crack Repair</p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const techEmail = await assertActiveTechEmail(req);
    if (!techEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      | { action: "resend"; invite_id: string };

    // =========================
    // RESEND
    // =========================
    if ("action" in body && body.action === "resend") {
      const invite_id = String(body.invite_id || "").trim();
      if (!invite_id) {
        return NextResponse.json({ error: "invite_id is required for resend" }, { status: 400 });
      }

      const { data: invite, error: invErr } = await admin
        .from("user_invites")
        .select("id, email, full_name, code, used_at, tech_email")
        .eq("id", invite_id)
        .single();

      if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
      if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

      if (invite.tech_email && invite.tech_email !== techEmail) {
        return NextResponse.json({ error: "You are not allowed to resend this invite" }, { status: 403 });
      }

      if (invite.used_at) {
        return NextResponse.json({ error: "This invite has already been used." }, { status: 400 });
      }

      await sendUserInviteEmail({
        to: invite.email,
        full_name: invite.full_name,
        user_code: invite.code,
      });

      return NextResponse.json({ ok: true, invite_id: invite.id }, { status: 200 });
    }

    // =========================
    // CREATE / REUSE
    // =========================
    const full_name = String((body as any).full_name || "").trim();
    const email = String((body as any).email || "").trim().toLowerCase();
    const phone = String((body as any).phone || "").trim();

    if (!full_name || !email) {
      return NextResponse.json({ error: "full_name and email are required" }, { status: 400 });
    }

    const { data: existingInvites, error: existingErr } = await admin
      .from("user_invites")
      .select("id, code, email, full_name, phone, created_at, expires_at, used_at, tech_email")
      .eq("email", email)
      .eq("tech_email", techEmail)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

    let inviteRow: AnyObj;

    if (existingInvites && existingInvites.length > 0) {
      inviteRow = existingInvites[0];

      await sendUserInviteEmail({
        to: inviteRow.email,
        full_name: inviteRow.full_name ?? full_name,
        user_code: inviteRow.code,
      });
    } else {
      const user_code = String(Math.floor(1_000_000 + Math.random() * 9_000_000));

      const { data: inserted, error: insertErr } = await admin
        .from("user_invites")
        .insert({
          code: user_code,
          email,
          full_name,
          phone: phone || null,
          tech_email: techEmail,
          created_by_tech_email: techEmail,
        })
        .select("id, code, email, full_name, phone, created_at, expires_at, used_at, tech_email")
        .single();

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

      inviteRow = inserted;

      await sendUserInviteEmail({
        to: inviteRow.email,
        full_name: inviteRow.full_name,
        user_code: inviteRow.code,
      });
    }

    return NextResponse.json({ user_code: inviteRow.code, invite: inviteRow }, { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in /api/tech/users:", err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}