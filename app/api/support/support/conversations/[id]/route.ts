// app/api/admin/support/conversations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdminOrSupport(supabase: Awaited<ReturnType<typeof createSupabaseServer>>, email: string) {
  const { data, error } = await supabase
    .from("admins")
    .select("role, is_active")
    .ilike("email", email)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_active === true && ["admin", "support"].includes(String(data.role || "").toLowerCase());
}

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Conversation id is required." }, { status: 400 });
    }

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

    const { data: conversation, error: conversationError } = await supabase
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
        ].join(",")
      )
      .eq("id", id)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: conversationError?.message || "Conversation not found." },
        { status: 404 }
      );
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select(
        [
          "id",
          "conversation_id",
          "subject",
          "body",
          "appointment_id",
          "sender_email",
          "sender_role",
          "recipient_email",
          "recipient_role",
          "message_type",
          "is_read",
          "read_at",
          "read_by_admin",
          "read_by_customer",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message || "Failed to fetch conversation messages." },
        { status: 500 }
      );
    }

    // Mark customer messages in this thread as read by admin
    await supabase
      .from("messages")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        read_by_admin: true,
      })
      .eq("conversation_id", id)
      .eq("sender_role", "customer")
      .eq("read_by_admin", false);

    // Reset unread count for admin
    await supabase
      .from("message_conversations")
      .update({
        unread_for_admin_count: 0,
      })
      .eq("id", id);

    return NextResponse.json({
      ok: true,
      conversation,
      messages: messages ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}