// app/api/user/from-invite/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

/**
 * POST /api/user/from-invite
 * - Called right after user signs up from invite
 * - Uses invite code + email to materialize an app_users row
 * - Marks invite used
 * - Sets portal_activated_at (guarded so it never overwrites an existing activation)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    };

    const rawCode = String(body.code || "").trim();
    const rawEmail = String(body.email || "").trim().toLowerCase();
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();

    if (!rawCode || !rawEmail) {
      return NextResponse.json({ error: "code and email are required" }, { status: 400 });
    }

    const admin = getAdminSupabase();
    const nowIso = new Date().toISOString();

    // Find pending invite (must be unused)
    const { data: invite, error: inviteErr } = await admin
      .from("user_invites")
      .select(
        "id, code, email, full_name, phone, tech_email, created_by_tech_email, used_at, created_at"
      )
      .eq("code", rawCode)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteErr) {
      console.error("from-invite: error fetching invite:", inviteErr);
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }

    if (!invite) {
      return NextResponse.json({ error: "Invite not found or already used." }, { status: 400 });
    }

    // Verify email matches invite
    const inviteEmail = String(invite.email || "").trim().toLowerCase();
    if (inviteEmail !== rawEmail) {
      return NextResponse.json({ error: "Invite email does not match this account." }, { status: 400 });
    }

    // Build full name
    const composedName = [firstName, lastName].filter(Boolean).join(" ");
    const fullName = composedName || invite.full_name || rawEmail;

    // Upsert app_users row by email (do NOT set portal_activated_at here to avoid overwriting)
    const payload: AnyObj = {
      full_name: fullName,
      email: rawEmail,
      phone: invite.phone ?? null,
      invite_code: invite.code,
      created_by_tech: invite.tech_email ?? invite.created_by_tech_email ?? null,
      updated_at: nowIso,
    };

    const { data: appUser, error: upsertErr } = await admin
      .from("app_users")
      .upsert(payload, { onConflict: "email" })
      .select("*")
      .single();

    if (upsertErr) {
      console.error("from-invite: error upserting app_users:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    // Mark invite used (best-effort)
    const { error: usedErr } = await admin
      .from("user_invites")
      .update({ used_at: nowIso })
      .eq("id", invite.id);

    if (usedErr) {
      console.error("from-invite: error marking invite used:", usedErr);
    }

    // Guarded activation update (only if null)
    const { error: activateErr } = await admin
      .from("app_users")
      .update({ portal_activated_at: nowIso, updated_at: nowIso })
      .eq("email", rawEmail)
      .is("portal_activated_at", null);

    if (activateErr) {
      console.warn("from-invite: portal_activated_at guarded update failed:", activateErr.message);
    }

    // Fetch latest snapshot (optional)
    const { data: latest } = await admin
      .from("app_users")
      .select("*")
      .eq("email", rawEmail)
      .maybeSingle();

    return NextResponse.json({ ok: true, app_user: latest ?? appUser }, { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in /api/user/from-invite:", err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}