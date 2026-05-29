// app/api/tech/profile/ensure/route.ts
import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AnyObj = Record<string, any>;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

function normalizeEmail(v: any) {
  const s = String(v ?? "").trim().toLowerCase();
  return s && s !== "null" && s !== "undefined" ? s : "";
}

function cleanName(v: any) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length ? s.slice(0, 120) : "";
}

function fallbackNameFromEmail(email: string) {
  const base = (email.split("@")[0] || "Tech").replace(/[._-]+/g, " ").trim();
  const titled = base
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return titled || "Technician";
}

async function getUserFromToken(req: Request) {
  const admin = getAdminClient();

  const authz = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : "";

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

    const email = normalizeEmail(user.email);
    const auth_user_id = String(user.id || "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "User email missing on auth profile" },
        { status: 400 }
      );
    }

    if (!auth_user_id) {
      return NextResponse.json(
        { error: "User id missing on auth profile" },
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

    // ✅ Only used to FILL missing values — not overwrite
    const desiredFullName =
      cleanName(meta.full_name || meta.name) || fallbackNameFromEmail(email);

    // Look for existing row by auth_user_id OR email
    const { data: existing, error: selErr } = await admin
      .from("technicians")
      .select("id, email, auth_user_id, full_name, phone, is_active")
      .or(`auth_user_id.eq.${auth_user_id},email.ilike.${email}`)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json(
        { error: selErr.message || "Failed to read technicians" },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    // ✅ If exists: update ONLY safe fields and ONLY when missing
    if (existing?.id) {
      const patch: AnyObj = {
        // keep the row linked correctly
        is_active: true,
        updated_at: now,
      };

      // Fill missing auth_user_id (helps uid-based policies)
      if (!existing.auth_user_id) patch.auth_user_id = auth_user_id;

      // Fill missing/blank email (rare)
      if (!existing.email) patch.email = email;

      // Fill missing/blank full_name only
      if (!existing.full_name || String(existing.full_name).trim().length < 2) {
        patch.full_name = desiredFullName;
      }

      // ✅ CRITICAL: never overwrite phone here
      // patch.phone = ... NOPE

      const { error: updErr } = await admin
        .from("technicians")
        .update(patch)
        .eq("id", existing.id);

      if (updErr) {
        return NextResponse.json(
          { error: updErr.message || "Failed to update technician" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        mode: "updated",
        technician_id: existing.id,
      });
    }

    // ✅ Insert: must satisfy NOT NULL full_name. DO NOT set phone from metadata.
    const { data: inserted, error: insErr } = await admin
      .from("technicians")
      .insert({
        email,
        auth_user_id,
        full_name: desiredFullName,
        is_active: true,
        tech_rating: 5.0,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json(
        { error: insErr?.message || "Failed to insert technician" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "inserted",
      technician_id: inserted.id,
    });
  } catch (err: any) {
    console.error("Error in /api/tech/profile/ensure:", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}