// app/api/user/old-client-create-password/route.ts
import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function friendlyAlreadyExists(msgRaw: string) {
  const msg = (msgRaw || "").toLowerCase();
  return (
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("already associated with another user") ||
    msg.includes("duplicate") ||
    msg.includes("exists")
  );
}

function safeNameFromEmail(email: string) {
  const left = (email.split("@")[0] || "").trim();
  if (!left) return "Glass Guardian Client";
  const pretty = left
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty || "Glass Guardian Client";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const admin = getAdminSupabase();
    const nowIso = new Date().toISOString();

    // 0) Fetch existing app_users first (so we can guarantee full_name)
    const { data: appUser, error: appUserErr } = await admin
      .from("app_users")
      .select("id, email, full_name, auth_user_id, portal_activated_at")
      .eq("email", email)
      .maybeSingle();

    if (appUserErr) {
      console.error("Error fetching app_users row:", appUserErr);
      return NextResponse.json(
        { ok: false, error: "Could not read customer profile. Please contact support." },
        { status: 500 }
      );
    }

    const fullName =
      (appUser?.full_name && String(appUser.full_name).trim()) || safeNameFromEmail(email);

    // 1) Create a new auth user (email+password)
    const { data: createdUserData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: "user", product: "glass_guardian" },
    });

    if (createErr || !createdUserData?.user) {
      if (friendlyAlreadyExists(createErr?.message || "")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "An account with this email already exists. Please sign in on the customer login page.",
          },
          { status: 400 }
        );
      }

      console.error("createUser error:", createErr);
      return NextResponse.json(
        {
          ok: false,
          error: createErr?.message || "Unable to create your secure login. Please try again.",
        },
        { status: 500 }
      );
    }

    const authUserId = createdUserData.user.id;

    // 2) Ensure app_users exists + link auth_user_id + ensure full_name NOT NULL
    if (appUser?.id) {
      // Update existing
      const { error: updErr } = await admin
        .from("app_users")
        .update({
          auth_user_id: authUserId,
          // do not overwrite full_name if already set; but ensure not null
          ...(appUser.full_name ? {} : { full_name: fullName }),
          updated_at: nowIso,
        })
        .eq("id", appUser.id);

      if (updErr) {
        console.error("Error updating app_users:", updErr);
        return NextResponse.json(
          {
            ok: false,
            error:
              "Your login was created, but we couldn’t fully link your profile. Please contact support.",
          },
          { status: 500 }
        );
      }

      // Guarded activation
      const { error: actErr } = await admin
        .from("app_users")
        .update({ portal_activated_at: nowIso, updated_at: nowIso })
        .eq("id", appUser.id)
        .is("portal_activated_at", null);

      if (actErr) console.warn("old-client-create-password guarded activation failed:", actErr.message);
    } else {
      // Insert minimal, valid row
      const { error: insErr } = await admin.from("app_users").insert({
        email,
        full_name: fullName,
        auth_user_id: authUserId,
        portal_activated_at: nowIso,
        notes: "Auto-created from old-client portal password flow.",
        updated_at: nowIso,
      });

      if (insErr) {
        console.error("Error inserting app_users row:", insErr);
        return NextResponse.json(
          {
            ok: false,
            error:
              "Your login was created, but we couldn’t create your customer profile. Please contact support.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, auth_user_id: authUserId }, { status: 200 });
  } catch (err: any) {
    console.error("Unhandled error in /api/user/old-client-create-password:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}