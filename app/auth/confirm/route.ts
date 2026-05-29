// app/auth/confirm/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAnonForServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  // For verifyOtp we don't need cookies/session persistence here.
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * ✅ /auth/confirm
 * Supabase will redirect here with:
 *   - token_hash=...
 *   - type=invite | signup | recovery | email_change | magiclink (varies)
 * and your app can pass:
 *   - next=/user/signup?invite=...
 *
 * This route verifies the token, then redirects to `next`.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const token_hash = url.searchParams.get("token_hash") || "";
    const type = (url.searchParams.get("type") || "").toLowerCase();
    const nextRaw = url.searchParams.get("next") || "";

    // ✅ default target if next missing
    const fallbackNext = "/user/signup";

    // ✅ only allow internal redirects to prevent open-redirect
    const safeNext =
      nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
        ? nextRaw
        : fallbackNext;

    // If supabase didn't include required params, send them somewhere useful
    if (!token_hash || !type) {
      return NextResponse.redirect(new URL(safeNext, url.origin), 302);
    }

    const supabase = getSupabaseAnonForServer();

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    // If verification fails, redirect to signup with a hint
    if (error) {
      const dest = new URL(safeNext, url.origin);
      dest.searchParams.set("auth_error", "1");
      dest.searchParams.set("message", error.message || "Verification failed");
      return NextResponse.redirect(dest, 302);
    }

    // ✅ success: go where we intended (ex: /user/signup?invite=...)
    return NextResponse.redirect(new URL(safeNext, url.origin), 302);
  } catch (err: any) {
    // last resort: go to signup
    const origin = req.nextUrl?.origin || "https://glassguardianchipandcrackrepair.com";
    const dest = new URL("/user/signup?auth_error=1", origin);
    dest.searchParams.set("message", err?.message || "Auth confirm error");
    return NextResponse.redirect(dest, 302);
  }
}