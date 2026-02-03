import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = NextResponse.json({ ok: true }, { status: 200 });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: u, error: uErr } = await supabase.auth.getUser();

  let appUser: any = null;
  if (u?.user) {
    const { data } = await supabase
      .from("app_users")
      .select("id,email,auth_user_id,full_name")
      .eq("auth_user_id", u.user.id)
      .maybeSingle();
    appUser = data ?? null;
  }

  return NextResponse.json(
    {
      ok: true,
      auth_error: uErr?.message ?? null,
      auth_user: u?.user ? { id: u.user.id, email: u.user.email } : null,
      app_user_row_visible_via_rls: appUser,
    },
    { status: 200, headers: res.headers }
  );
}