// app/api/profile/ensure/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Ensures a row in public.profiles keyed by profiles.id (== auth.users.id).
 * Uses service role to verify the bearer token server-side, then upserts.
 *
 * Table shape expected:
 *   id uuid PK references auth.users(id) on delete cascade
 *   role text check in ('user','tech','admin') default 'user'
 * Optional: email/full_name/phone/service_area columns if you keep them.
 */
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "SERVICE_ROLE not configured" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice("Bearer ".length) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const defaultRole = (body?.defaultRole as string) || "user";
    const uid = userData.user.id;

    // Try existing
    const { data: existing } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", uid)
      .maybeSingle();

    if (existing?.id) {
      // If row exists but role is missing, patch it with a safe default
      if (!existing.role) {
        await admin.from("profiles").update({ role: defaultRole }).eq("id", uid);
      }
      return NextResponse.json({ ok: true, id: uid, role: existing.role ?? defaultRole });
    }

    // Create new row with defaultRole
    const { data: upserted, error: upErr } = await admin
      .from("profiles")
      .upsert({ id: uid, role: defaultRole }, { onConflict: "id" })
      .select("id, role")
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: upserted?.id, role: upserted?.role ?? defaultRole });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}