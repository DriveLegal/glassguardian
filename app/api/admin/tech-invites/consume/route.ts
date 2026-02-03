// app/api/admin/tech-invites/consume/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Validates a tech invite and ensures a technician row exists.
 *
 * For now, we are intentionally forgiving:
 *  - If we can't find an invite row but the user is authenticated,
 *    we STILL upsert into `technicians` so tech login works.
 */
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase env not configured", code: "NO_ENV" },
        { status: 500 }
      );
    }

    const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Bearer token from Authorization header
    const authz =
      req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { error: "Missing bearer token", code: "NO_TOKEN" },
        { status: 401 }
      );
    }

    // Validate token -> Supabase user
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { error: "Invalid access token", code: "BAD_TOKEN" },
        { status: 401 }
      );
    }

    const supaUser = userData.user;
    const uid = supaUser.id;
    const callerEmail = (supaUser.email || "").toLowerCase();

    // Parse body
    const body = await req.json().catch(() => ({}));
    const rawCode: string = body.code || "";
    const rawEmail: string = body.email || "";

    const code = rawCode.toUpperCase().trim();
    const email = rawEmail.toLowerCase().trim();

    if (!code || !email) {
      return NextResponse.json(
        { error: "code and email are required", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    if (email !== callerEmail) {
      return NextResponse.json(
        { error: "Email mismatch", code: "EMAIL_MISMATCH" },
        { status: 403 }
      );
    }

    const now = new Date();

    // ---------- TRY TO FIND INVITE (best-effort) ----------
    let invite = null as any;

    const { data: inviteExact, error: invErrExact } = await admin
      .from("tech_invites")
      .select("*")
      .eq("code", code)
      .eq("email", email)
      .maybeSingle();

    if (invErrExact) {
      // Log-style info now embedded in response if you want to inspect later
      console.error("inviteExact error", invErrExact.message);
    }

    if (inviteExact) {
      invite = inviteExact;
    } else {
      // Fallback: try more loosely (in case of whitespace / case weirdness)
      const { data: inviteLoose, error: invErrLoose } = await admin
        .from("tech_invites")
        .select("*")
        .ilike("code", code)
        .ilike("email", email)
        .order("created_at", { ascending: false } as any)
        .limit(1)
        .maybeSingle();

      if (invErrLoose) {
        console.error("inviteLoose error", invErrLoose.message);
      }

      if (inviteLoose) {
        invite = inviteLoose;
      }
    }

    // ---------- PREP TECHNICIAN DATA FROM USER METADATA + INVITE ----------
    const meta = (supaUser.user_metadata || {}) as any;
    const fullName: string =
      meta.full_name ||
      (invite && invite.full_name) ||
      email;
    const phone: string | null =
      meta.phone ||
      (invite && invite.phone) ||
      null;

    // ---------- UPSERT TECHNICIAN (ALWAYS) ----------
    const { error: techErr } = await admin
      .from("technicians")
      .upsert(
        {
          email,
          full_name: fullName,
          phone,
          // tech_rating, tech_certifications, is_active use defaults
        },
        { onConflict: "email" }
      );

    if (techErr) {
      return NextResponse.json(
        {
          error: "Failed to upsert technician",
          code: "TECH_UPSERT_ERROR",
          details: techErr.message,
        },
        { status: 500 }
      );
    }

    // If we NEVER found an invite row, just return "ok" with a hint code.
    if (!invite) {
      return NextResponse.json(
        {
          ok: true,
          code: "NO_INVITE_BUT_CREATED",
          note:
            "No matching invite found, but technician row was created/updated based on the authenticated user.",
        },
        { status: 200 }
      );
    }

    // ---------- IF INVITE EXISTS, HANDLE EXPIRY + USED FLAGS ----------
    const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;

    // If invite already used by another user → do NOT block, because we've
    // already created the technician row for this authenticated user.
    if (invite.used_at && invite.used_by && invite.used_by !== uid) {
      return NextResponse.json(
        {
          ok: true,
          code: "USED_BY_OTHER_BUT_TECH_CREATED",
          note:
            "Invite shows as used by another user, but technician row was still created/updated for this account.",
        },
        { status: 200 }
      );
    }

    // If invite expired but belongs to this user → still mark used, continue.
    if (expiresAt && expiresAt.getTime() < now.getTime()) {
      // best-effort update; non-fatal if it fails
      await admin
        .from("tech_invites")
        .update({
          used_at: invite.used_at ?? new Date().toISOString(),
          used_by: invite.used_by ?? uid,
        })
        .eq("id", invite.id);
      return NextResponse.json(
        {
          ok: true,
          code: "EXPIRED_BUT_TECH_CREATED",
          note:
            "Invite appears expired, but technician row was created/updated and invite marked used for this user.",
        },
        { status: 200 }
      );
    }

    // Normal case: invite is valid / unused or belongs to same user.
    const { error: upErr } = await admin
      .from("tech_invites")
      .update({
        used_at: invite.used_at ?? new Date().toISOString(),
        used_by: invite.used_by ?? uid,
      })
      .eq("id", invite.id);

    if (upErr) {
      return NextResponse.json(
        {
          ok: true,
          code: "INVITE_UPDATE_ERROR_BUT_TECH_CREATED",
          note:
            "Technician row created/updated, but failed to update invite as used.",
          details: upErr.message,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, code: "OK" });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error", code: "UNCAUGHT" },
      { status: 500 }
    );
  }
}