// app/api/payments/deposits/[token]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    if (!token || token.trim().length < 10) {
      return NextResponse.json(
        { error: "Missing or invalid deposit token." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("deposit_requests")
      .select(
        [
          "id",
          "token",
          "customer_name",
          "customer_email",
          "customer_phone",
          "amount_cents",
          "status",
          "appointment_id",
          "paid_at",
          "created_at",
        ].join(", ")
      )
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("[GET deposit by token] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to load deposit request." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Deposit request not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      deposit: data,
    });
  } catch (e: any) {
    console.error("[GET deposit by token] Error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to load deposit request." },
      { status: 500 }
    );
  }
}