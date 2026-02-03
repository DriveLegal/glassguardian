// app/api/auth/invitng-existing/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { encryptField } from "@/lib/fieldCrypto";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Optional: require a shared secret header (recommended for any route that issues magic tokens)
function requireSecret(req: Request) {
  const secret = process.env.AUTH_INVITE_EXISTING_SECRET;
  if (!secret) return true; // if you didn't set it yet, don't hard-block
  const h =
    req.headers.get("x-admin-secret") ||
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";

  const token = h.startsWith("Bearer ") ? h.slice(7) : h;
  return token === secret;
}

export async function POST(req: Request) {
  try {
    if (!requireSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const warrantyId = String(body.warrantyId || "").trim();
    const emailFromBody = String(body.email || "").trim().toLowerCase();

    if (!warrantyId) {
      return NextResponse.json(
        { error: "Missing warrantyId" },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL not set" },
        { status: 500 }
      );
    }

    const admin = getAdmin();

    // ✅ Trust DB: get the warranty + trusted customer_email
    const { data: warranty, error: wErr } = await admin
      .from("warranties")
      .select("id, customer_email")
      .eq("id", warrantyId)
      .maybeSingle();

    if (wErr) {
      return NextResponse.json(
        { error: "Failed to read warranty", details: wErr.message },
        { status: 500 }
      );
    }

    if (!warranty?.customer_email) {
      return NextResponse.json(
        { error: "Warranty not found or missing customer_email" },
        { status: 404 }
      );
    }

    const emailTrusted = String(warranty.customer_email).trim().toLowerCase();

    // If caller provided email, enforce it matches warranty record
    if (emailFromBody && emailFromBody !== emailTrusted) {
      return NextResponse.json(
        {
          error: "Email does not match warranty customer_email",
          trusted: emailTrusted,
        },
        { status: 400 }
      );
    }

    // ✅ Generate token (15 minutes)
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // ✅ Phase-1 safe: keep existing flow working by writing plaintext token to magic_token,
    // and ALSO attempt to write encrypted token (if your column exists).
    // NOTE: Your app_users schema shows magic_token + magic_token_expires_at exist already.
    const { error: upsertErr } = await admin
      .from("app_users")
      .upsert(
        {
          email: emailTrusted,
          magic_token: token,
          magic_token_expires_at: expires,
          portal_invited_at: new Date().toISOString(),
        } as any,
        { onConflict: "email" }
      );

    if (upsertErr) {
      return NextResponse.json(
        { error: "Failed to upsert app_users", details: upsertErr.message },
        { status: 500 }
      );
    }

    // Best-effort: if you later add `magic_token_encrypted`, this will populate it.
    // If the column doesn't exist, we ignore the error to avoid breaking prod.
    try {
      await admin
        .from("app_users")
        .update({
          magic_token_encrypted: encryptField(token),
        } as any)
        .eq("email", emailTrusted);
    } catch {
      // ignore — column may not exist yet
    }

    // Build magic link URL
    const magicUrl = `${siteUrl}/user/magic-login?token=${token}&wid=${encodeURIComponent(
      warrantyId
    )}`;

    return NextResponse.json({ ok: true, magicUrl });
  } catch (err: any) {
    console.error("Error in /api/auth/invitng-existing:", err);
    return NextResponse.json(
      { error: "Failed to create magic login link", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}