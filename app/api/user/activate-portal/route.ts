// app/api/user/activate-portal/route.ts
import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function getBearerToken(req: NextRequest) {
  const h =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function safeNameFromEmail(email: string) {
  const left = (email.split("@")[0] || "").trim();
  if (!left) return "Glass Guardian Client";
  // Basic prettify: john.doe -> John Doe
  const pretty = left
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty || "Glass Guardian Client";
}

/**
 * POST /api/user/activate-portal
 * - Called after user signs in (client has session token)
 * - Uses service role to:
 *   1) validate authed user (via access token)
 *   2) ensure app_users row exists (full_name NOT NULL)
 *   3) link auth_user_id and set portal_activated_at (guarded)
 */
export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing Authorization Bearer token" },
        { status: 401 }
      );
    }

    const admin = getAdminSupabase();

    // Validate token and get user identity
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { ok: false, error: userErr?.message || "Invalid session" },
        { status: 401 }
      );
    }

    const authUser = userRes.user;
    const email = String(authUser.email || "").trim().toLowerCase();
    const authUserId = authUser.id;

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Auth user has no email" },
        { status: 400 }
      );
    }

    const meta = (authUser.user_metadata || {}) as AnyObj;

    const metaName =
      (typeof meta.full_name === "string" && meta.full_name.trim()) ||
      (typeof meta.name === "string" && meta.name.trim()) ||
      "";

    const fallbackName = metaName || safeNameFromEmail(email);

    const nowIso = new Date().toISOString();

    // 1) Check if app_users row already exists
    const { data: existing, error: selErr } = await admin
      .from("app_users")
      .select("id, full_name, auth_user_id, portal_activated_at")
      .ilike("email", email)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json(
        { ok: false, error: selErr.message || "Failed to read app_users" },
        { status: 500 }
      );
    }

    // 2) If exists -> update link + guarded portal activation
    if (existing?.id) {
      const update: AnyObj = {
        auth_user_id: authUserId,
        updated_at: nowIso,
      };

      // Guarded: only set activated_at if currently null
      if (!existing.portal_activated_at) {
        update.portal_activated_at = nowIso;
      }

      // Guarded: ensure full_name is not null/empty (some legacy rows may be bad)
      if (!existing.full_name || String(existing.full_name).trim() === "") {
        update.full_name = fallbackName;
      }

      const { error: updErr } = await admin
        .from("app_users")
        .update(update)
        .eq("id", existing.id);

      if (updErr) {
        return NextResponse.json(
          { ok: false, error: updErr.message || "Failed to update app_users" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { ok: true, mode: "updated", app_user_id: existing.id },
        { status: 200 }
      );
    }

    // 3) If not exists -> insert minimal valid row (full_name required)
    const insertPayload: AnyObj = {
      email,
      full_name: fallbackName,
      auth_user_id: authUserId,
      portal_activated_at: nowIso,
      updated_at: nowIso,
      // created_at default now()
      // other nullable fields remain null
    };

    const { data: created, error: insErr } = await admin
      .from("app_users")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insErr || !created?.id) {
      return NextResponse.json(
        { ok: false, error: insErr?.message || "Failed to create app_users row" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, mode: "inserted", app_user_id: created.id },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("activate-portal error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}