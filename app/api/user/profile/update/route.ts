// app/api/user/profile/update/route.ts
import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { encryptMaybe } from "@/lib/fieldCrypto";

function jsonError(message: string, status = 400, headers?: Headers) {
  return NextResponse.json({ ok: false, error: message }, { status, headers });
}

function parseCookies(header: string) {
  return header
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      const name = idx >= 0 ? pair.slice(0, idx) : pair;
      const value = idx >= 0 ? pair.slice(idx + 1) : "";
      return { name, value };
    });
}

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production";

  // NOTE: App Route handlers cannot use NextResponse.next()
  // We create a JSON response object and attach refreshed cookies to it.
  const res = NextResponse.json({ ok: true }, { status: 200 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Server missing Supabase env vars.", 500);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookieHeader = req.headers.get("cookie") ?? "";
        return parseCookies(cookieHeader);
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, {
            ...options,
            secure: isProd, // ✅ FIX
            httpOnly: true,
            sameSite: options?.sameSite ?? "lax",
            path: options?.path ?? "/",
          });
        });
      },
    },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (userErr || !user) {
    return jsonError("Not authenticated.", 401, res.headers);
  }

  const authUserId = user.id;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400, res.headers);
  }

  const phone = typeof body.phone === "string" ? body.phone : undefined;
  const address_line1 = typeof body.address_line1 === "string" ? body.address_line1 : undefined;
  const address_line2 = typeof body.address_line2 === "string" ? body.address_line2 : undefined;
  const city = typeof body.city === "string" ? body.city : undefined;
  const state = typeof body.state === "string" ? body.state : undefined;
  const zip = typeof body.zip === "string" ? body.zip : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const gate_notes = typeof body.gate_notes === "string" ? body.gate_notes : undefined;

  const update: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (phone !== undefined) update.phone_encrypted = encryptMaybe(phone);
  if (address_line1 !== undefined) update.address_line1_encrypted = encryptMaybe(address_line1);
  if (address_line2 !== undefined) update.address_line2_encrypted = encryptMaybe(address_line2);
  if (city !== undefined) update.city_encrypted = encryptMaybe(city);
  if (state !== undefined) update.state_encrypted = encryptMaybe(state);
  if (zip !== undefined) update.zip_encrypted = encryptMaybe(zip);
  if (notes !== undefined) update.notes_encrypted = encryptMaybe(notes);
  if (gate_notes !== undefined) update.gate_notes_encrypted = encryptMaybe(gate_notes);

  const keys = Object.keys(update).filter((k) => k !== "updated_at");
  if (keys.length === 0) {
    return jsonError("No profile fields provided.", 400, res.headers);
  }

  const { error: updErr } = await supabase
    .from("app_users")
    .update(update)
    .eq("auth_user_id", authUserId);

  if (updErr) {
    return jsonError(updErr.message, 400, res.headers);
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: res.headers });
}