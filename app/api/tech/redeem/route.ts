// app/api/tech/redeem/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getBearer(req: Request): string | null {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authz) return null;
  return authz.startsWith("Bearer ") ? authz.slice(7) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const code: string = String(body.code || "").trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
    }

    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    // Use anon client but forward JWT so RLS applies to caller.
    const client = createClient<any>(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.rpc("tech_redeem_invite", { p_code: code });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if ((data as any)?.error) {
      return NextResponse.json({ error: String((data as any).error) }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}