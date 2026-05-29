// app/api/support/conversations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toPositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = toPositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(toPositiveInt(searchParams.get("pageSize"), 20), 100);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const email = user.email.toLowerCase();

    const { data, error, count } = await supabase
      .from("message_conversations")
      .select(
        [
          "id",
          "customer_email",
          "customer_name",
          "subject",
          "status",
          "priority",
          "appointment_id",
          "unread_for_admin_count",
          "unread_for_customer_count",
          "last_message_at",
          "last_message_preview",
          "created_at",
          "updated_at",
        ].join(","),
        { count: "exact" }
      )
      .ilike("customer_email", email)
      .order("last_message_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch conversations." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total: count ?? 0,
      conversations: data ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}