// app/api/user/profile/get/route.ts
import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function jsonError(message: string, status = 400, headers?: Headers) {
  return NextResponse.json({ ok: false, error: message }, { status, headers });
}

function shouldUseSecureCookies(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto === "https";
  return process.env.NODE_ENV === "production";
}

type SecureProfileRow = {
  id: string;
  email: string;
  full_name: string;
  auth_user_id: string | null;

  created_at: string;
  updated_at: string;

  portal_invited_at: string | null;
  portal_activated_at: string | null;

  notification_email: boolean | null;
  notification_sms: boolean | null;

  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  gate_notes: string | null;
};

export async function GET(req: NextRequest) {
  // Base response so Supabase can refresh cookies
  const res = NextResponse.json({ ok: true }, { status: 200 });
  const secure = shouldUseSecureCookies(req);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Server missing Supabase env vars.", 500);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, {
            ...options,
            secure, // ✅ do not force Secure on localhost http
            httpOnly: true,
            sameSite: options?.sameSite ?? "lax",
            path: options?.path ?? "/",
          });
        });
      },
    },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonError("Not authenticated.", 401, res.headers);
  }

  const authUserId = userData.user.id;

  // ✅ Pull decrypted profile from DB (security definer function)
  const { data, error } = await supabase.rpc("get_app_user_secure", {
    p_auth_user_id: authUserId,
  });

  if (error) return jsonError(error.message, 400, res.headers);

  const row = (Array.isArray(data) ? data[0] : data) as SecureProfileRow | null;

  if (!row?.id) {
    return jsonError(
      "Profile not found. Please re-login or contact support.",
      404,
      res.headers
    );
  }

  const profile = {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    auth_user_id: row.auth_user_id,

    created_at: row.created_at,
    updated_at: row.updated_at,

    portal_invited_at: row.portal_invited_at,
    portal_activated_at: row.portal_activated_at,

    notification_email: row.notification_email,
    notification_sms: row.notification_sms,

    // ✅ decrypted fields already
    phone: row.phone,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    notes: row.notes,
    gate_notes: row.gate_notes,
  };

  return NextResponse.json({ ok: true, profile }, { status: 200, headers: res.headers });
}