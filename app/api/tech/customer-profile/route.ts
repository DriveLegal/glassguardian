import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizeEmail(email?: string | null) {
  return String(email ?? "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const email = normalizeEmail(req.nextUrl.searchParams.get("email"));

    if (!email) {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server env is missing Supabase credentials" },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from("app_users")
      .select("id, full_name, email, phone")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("customer-profile route lookup error:", error);
      return NextResponse.json(
        { error: error.message || "Lookup failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      customer: data ?? null,
    });
  } catch (err: any) {
    console.error("customer-profile route unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}