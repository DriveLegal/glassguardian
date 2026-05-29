// app/api/admin/support/conversations/[id]/reply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReplyBody = {
  body?: string | null;
  subject?: string | null;
  status?: "open" | "pending" | "resolved" | "closed" | null;
  priority?: "low" | "normal" | "high" | "urgent" | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function previewFromBody(body: string, max = 180) {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
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

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
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

    const raw = (await req.json()) as ReplyBody;
    const body = cleanText(raw?.body);
    const subjectOverride = cleanText(raw?.subject);
    const nextStatus = cleanText(raw?.status).toLowerCase();
    const nextPriority = cleanText(raw?.priority).toLowerCase();

    if (!body) {
      return NextResponse.json(
        { error: "Reply body is required." },
        { status: 400 }
      );
    }

    type Conversation = {
      id: string;
      customer_email?: string | null;
      customer_name?: string | null;
      subject?: string | null;
      status?: "open" | "pending" | "resolved" | "closed" | null;
      priority?: "low" | "normal" | "high" | "urgent" | null;
      appointment_id?: string | null;
    };

    const { data, error: conversationError } = await supabase
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
        ].join(",")
      )
      .eq("id", id)
      .single();

    const conversation = data as Conversation | null;

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: conversationError?.message || "Conversation not found." },
        { status: 404 }
      );
    }

    const subject = subjectOverride || conversation.subject || "Support reply";

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        subject,
        body,
        appointment_id: conversation.appointment_id,
        sender_email: user.email.toLowerCase(),
        sender_role: "admin",
        recipient_email: conversation.customer_email,
        recipient_role: "customer",
        message_type: "support",
        is_read: true,
        read_by_admin: true,
        read_by_customer: false,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Failed to send admin reply." },
        { status: 500 }
      );
    }

    const updatePayload: Record<string, any> = {
      subject,
      last_message_at: inserted.created_at ?? new Date().toISOString(),
      last_message_preview: previewFromBody(body),
    };

    if (["open", "pending", "resolved", "closed"].includes(nextStatus)) {
      updatePayload.status = nextStatus;
    } else if (!conversation.status || conversation.status === "closed") {
      updatePayload.status = "pending";
    }

    if (["low", "normal", "high", "urgent"].includes(nextPriority)) {
      updatePayload.priority = nextPriority;
    }

    const { error: updateError } = await supabase
      .from("message_conversations")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Reply sent but conversation update failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message_id: inserted.id,
      conversation_id: id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}