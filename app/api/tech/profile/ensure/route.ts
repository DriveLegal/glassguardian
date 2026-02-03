// app/api/tech/profile/ensure/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AnyObj = Record<string, any>;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase env not configured (check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  return createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isTechRole(role: any) {
  const r = String(role || "").toLowerCase();
  return r === "tech" || r === "technician";
}

async function getUserFromToken(req: Request) {
  const admin = getAdminClient();

  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;

  if (!token) return { ok: false as const, reason: "Missing bearer token" };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { ok: false as const, reason: "Invalid token" };

  return { ok: true as const, user: data.user, admin };
}

export async function POST(req: Request) {
  try {
    const auth = await getUserFromToken(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: `Unauthorized: ${auth.reason}` },
        { status: 401 }
      );
    }

    const { user, admin } = auth;

    const email = String(user.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "User email missing on auth profile" },
        { status: 400 }
      );
    }

    const meta = (user.user_metadata || {}) as AnyObj;
    const role =
      (user.app_metadata as AnyObj)?.role ??
      meta.role ??
      null;

    if (!isTechRole(role)) {
      return NextResponse.json(
        { error: "Not a technician account" },
        { status: 403 }
      );
    }

    const full_name = String(meta.full_name || meta.name || email || "Technician");
    const phone = meta.phone ? String(meta.phone) : null;

    // Look for existing
    const { data: existing, error: selErr } = await admin
      .from("technicians")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json(
        { error: selErr.message || "Failed to read technicians" },
        { status: 500 }
      );
    }

    if (existing?.id) {
      const { error: updErr } = await admin
        .from("technicians")
        .update({ full_name, phone, is_active: true })
        .eq("id", existing.id);

      if (updErr) {
        return NextResponse.json(
          { error: updErr.message || "Failed to update technician" },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, mode: "updated", technician_id: existing.id });
    }

    // Insert
    const { data: inserted, error: insErr } = await admin
      .from("technicians")
      .insert({
        email,
        full_name,
        phone,
        is_active: true,
        tech_rating: 5.0,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json(
        { error: insErr?.message || "Failed to insert technician" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, mode: "inserted", technician_id: inserted.id });
  } catch (err: any) {
    console.error("Error in /api/tech/profile/ensure:", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}