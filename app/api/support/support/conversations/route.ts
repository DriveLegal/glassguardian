// app/api/admin/support/conversations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toPositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

async function isAdminOrSupport(supabase: Awaited<ReturnType<typeof createSupabaseServer>>, email: string) {
  const { data, error } = await supabase
    .from("admins")
    .select("role, is_active")
    .ilike("email", email)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_active === true && ["admin", "support"].includes(String(data.role || "").toLowerCase());
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

    const allowed = await isAdminOrSupport(supabase, user.email);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;

    const page = toPositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(toPositiveInt(searchParams.get("pageSize"), 30), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const status = (searchParams.get("status") || "").trim().toLowerCase();
    const priority = (searchParams.get("priority") || "").trim().toLowerCase();
    const q = (searchParams.get("q") || "").trim();

    let query = supabase
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
      .order("last_message_at", { ascending: false });

    if (status && ["open", "pending", "resolved", "closed"].includes(status)) {
      query = query.eq("status", status);
    }

    if (priority && ["low", "normal", "high", "urgent"].includes(priority)) {
      query = query.eq("priority", priority);
    }

    if (q) {
      query = query.or(
        [
          `customer_email.ilike.%${q}%`,
          `customer_name.ilike.%${q}%`,
          `subject.ilike.%${q}%`,
          `last_message_preview.ilike.%${q}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch admin support conversations." },
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