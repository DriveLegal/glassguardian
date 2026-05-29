// app/api/user/invite-info/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: NextRequest) {
  try {
    const admin = getAdminSupabase();

    const inviteId = (req.nextUrl.searchParams.get("invite") || "").trim();
    if (!inviteId) {
      return NextResponse.json({ error: "invite is required" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("user_invites")
      .select("id, email, full_name, code, used_at, expires_at")
      .eq("id", inviteId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

    if (data.used_at) {
      return NextResponse.json({ error: "Invite already used" }, { status: 410 });
    }

    // If expires_at exists, enforce it
    if (data.expires_at) {
      const exp = new Date(data.expires_at).getTime();
      if (Number.isFinite(exp) && Date.now() > exp) {
        return NextResponse.json({ error: "Invite expired" }, { status: 410 });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        invite: {
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          code: data.code,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Unhandled error in /api/user/invite-info:", err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}