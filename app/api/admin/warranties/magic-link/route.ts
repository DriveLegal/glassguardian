// app/api/admin/warranties/magic-link/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public Supabase client (anon key) used ONLY to send magic-link emails
 * via auth.signInWithOtp. Some Supabase setups require anon, not service-role,
 * for that endpoint.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseOtpClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

/**
 * Helper: infer a reasonable full name from an email.
 * "john.doe-smith_92@example.com" -> "John Doe Smith 92"
 */
function inferFullNameFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  if (!local) return "Glass Guardian Customer";

  const cleaned = local.replace(/[._-]+/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (!parts.length) return "Glass Guardian Customer";

  const titled = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");

  return titled || "Glass Guardian Customer";
}

/**
 * POST /api/admin/warranties/magic-link
 *
 * Body: { email?: string; warrantyId: string }
 *
 * Flow:
 *   1) Verify warranty exists & get trusted customer_email
 *   2) Ensure app_users row exists (email + full_name)
 *   3) Ensure auth.users row exists (create if needed, with metadata)
 *   4) Use anon client to call auth.signInWithOtp so Supabase sends
 *      the Magic Link email using your Magic Link template.
 *
 * Returns: { ok: true } on success, or { error, details } on failure
 */
export async function POST(req: Request) {
  try {
    if (!supabaseOtpClient) {
      console.error(
        "Supabase OTP client not configured (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing)."
      );
      return NextResponse.json(
        { error: "Supabase public client not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const warrantyId = body?.warrantyId as string | undefined;
    const emailFromBody = body?.email as string | undefined;

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

    // 1) Look up the warranty so we can trust the customer_email
    const { data: warranty, error: warrantyErr } = await supabaseAdmin
      .from("warranties")
      .select("id, customer_email")
      .eq("id", warrantyId)
      .single();

    if (warrantyErr || !warranty) {
      console.error("Warranty lookup failed", warrantyErr);
      return NextResponse.json(
        { error: "Warranty not found" },
        { status: 404 }
      );
    }

    const emailRaw =
      emailFromBody?.trim() || (warranty.customer_email as string | undefined);

    if (!emailRaw) {
      return NextResponse.json(
        { error: "No customer email for this warranty" },
        { status: 400 }
      );
    }

    // Normalize email once
    const email = emailRaw.toLowerCase();

    // 2) Find or infer full name
    let fullName = inferFullNameFromEmail(email);

    const { data: existingAppUser, error: existingAppUserErr } =
      await supabaseAdmin
        .from("app_users")
        .select("full_name")
        .eq("email", email)
        .maybeSingle();

    if (existingAppUserErr) {
      console.error("app_users select error", existingAppUserErr);
    }

    if (existingAppUser?.full_name) {
      fullName = existingAppUser.full_name;
    }

    // 3) Ensure app_users row exists (portal user record)
    const { error: appUserErr } = await supabaseAdmin
      .from("app_users")
      .upsert(
        {
          email,
          full_name: fullName,
        },
        {
          onConflict: "email",
        }
      );

    if (appUserErr) {
      console.error("app_users upsert error", appUserErr);
      return NextResponse.json(
        {
          error: "Failed to sync app_users for this customer",
          details: appUserErr.message,
        },
        { status: 500 }
      );
    }

    // 4) Ensure there's an auth user for this email (and set display name / metadata)
    const { error: createErr }: any = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // treat as confirmed so magic link is just login
      user_metadata: {
        full_name: fullName, // display name in auth.users UI
      },
      app_metadata: {
        role: "user",
        product: "glass_guardian",
      },
    });

    if (createErr) {
      console.error("createUser error", createErr);

      const msg = (createErr.message || "").toLowerCase();
      const isAlreadyExists =
        msg.includes("user already registered") ||
        msg.includes("already exists") ||
        createErr.status === 422;

      if (!isAlreadyExists) {
        return NextResponse.json(
          {
            error: "Failed to prepare auth user for this customer",
            details: createErr.message,
          },
          { status: 500 }
        );
      }
      // If the user already exists, that's fine – we still send OTP
    }

    // 5) Build redirectTo so after magic login,
    //    they land directly on THEIR warranty page in the user portal.
    const redirectTo = `${siteUrl}/user/dashboard/warranties/warranty/${warrantyId}`;

    // 6) Use anon client to send the magic-link email (uses your Magic Link template)
    const { error: otpErr } = await supabaseOtpClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (otpErr) {
      console.error("signInWithOtp error", otpErr);
      return NextResponse.json(
        {
          error: "Failed to send magic login email",
          details: otpErr.message,
        },
        { status: 500 }
      );
    }

    // ✅ Email sent successfully – Supabase is handling the email using your template
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Magic link API exception", err);
    return NextResponse.json(
      {
        error: "Unexpected error sending magic link email",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}