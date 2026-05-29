// app/api/user/invites/lookup/route.ts
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

function isExpired(expires_at: string | null) {
  if (!expires_at) return false;
  const t = Date.parse(expires_at);
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

export async function GET(req: NextRequest) {
  try {
    const inviteId = (req.nextUrl.searchParams.get("invite") || "").trim();
    const admin = getAdminSupabase();

    // =========================================
    // MODE A: inviteId-based lookup (existing)
    // GET /api/user/invites/lookup?invite=<uuid>
    // =========================================
    if (inviteId) {
      const { data, error } = await admin
        .from("user_invites")
        .select("id, email, full_name, code, used_at, expires_at, created_at")
        .eq("id", inviteId)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

      if (data.used_at) {
        return NextResponse.json({ error: "Invite already used" }, { status: 400 });
      }

      if (isExpired(data.expires_at ?? null)) {
        return NextResponse.json({ error: "Invite expired" }, { status: 400 });
      }

      if (!data.code) {
        return NextResponse.json({ error: "Invite code missing" }, { status: 500 });
      }

      return NextResponse.json(
        {
          ok: true,
          mode: "by_invite_id",
          invite: {
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            code: data.code,
          },
        },
        { status: 200 }
      );
    }

    // =========================================
    // MODE B: authed-email lookup (NEW)
    // GET /api/user/invites/lookup
    // Requires Authorization bearer token
    // =========================================
    const supabase = getSupabaseFromAuthHeader(req);
    const { data: u, error: uErr } = await supabase.auth.getUser();

    if (uErr || !u?.user) {
      return NextResponse.json(
        { error: "invite is required (or provide Authorization to lookup by email)" },
        { status: 400 }
      );
    }

    const email = String(u.user.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // latest unused invite for this email
    const { data: inv, error: invErr } = await admin
      .from("user_invites")
      .select("id, email, full_name, code, used_at, expires_at, created_at")
      .eq("email", email)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
    if (!inv) return NextResponse.json({ error: "No pending invite found." }, { status: 404 });

    if (inv.used_at) {
      return NextResponse.json({ error: "Invite already used" }, { status: 400 });
    }

    if (isExpired(inv.expires_at ?? null)) {
      return NextResponse.json({ error: "Invite expired" }, { status: 400 });
    }

    if (!inv.code) {
      return NextResponse.json({ error: "Invite code missing" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        mode: "by_authed_email",
        invite: {
          id: inv.id,
          email: inv.email,
          full_name: inv.full_name,
          code: inv.code,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}