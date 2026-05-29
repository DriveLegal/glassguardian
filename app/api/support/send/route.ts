// app/api/support/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendSupportBody = {
  subject?: string | null;
  body?: string | null;
  appointment_id?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanName(value: unknown) {
  const v = String(value ?? "").trim().replace(/\s+/g, " ");
  return v || null;
}

function buildNameFromMetadata(meta: any): string | null {
  if (!meta) return null;

  const full =
    cleanName(meta.full_name) ||
    cleanName(meta.name) ||
    cleanName([meta.first_name, meta.last_name].filter(Boolean).join(" "));

  return full ?? null;
}

function previewFromBody(body: string, max = 180) {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const raw = (await req.json()) as SendSupportBody;

    const subject = cleanText(raw?.subject) || "Customer support request";
    const body = cleanText(raw?.body);
    const appointment_id = cleanText(raw?.appointment_id) || null;

    if (!body) {
      return NextResponse.json(
        { error: "Message body is required." },
        { status: 400 }
      );
    }

    const email = user.email.toLowerCase();
    const customerNameFromMeta = buildNameFromMetadata(user.user_metadata);

    let customer_name = customerNameFromMeta;

    // Optional enrichment from app_users
    try {
      const { data: appUser } = await supabase
        .from("app_users")
        .select("full_name")
        .ilike("email", email)
        .maybeSingle();

      if (!customer_name) {
        customer_name = cleanName((appUser as any)?.full_name ?? null);
      }
    } catch {}

    // Reuse latest open/pending thread for this customer + appointment if possible
    let conversationId: string | null = null;

    {
      let query = supabase
        .from("message_conversations")
        .select("id")
        .ilike("customer_email", email)
        .in("status", ["open", "pending"])
        .order("last_message_at", { ascending: false })
        .limit(1);

      if (appointment_id) {
        query = query.eq("appointment_id", appointment_id);
      } else {
        query = query.is("appointment_id", null);
      }

      const { data: existingConv, error: existingConvError } = await query.maybeSingle();

      if (existingConvError) {
        return NextResponse.json(
          { error: existingConvError.message || "Failed to find conversation." },
          { status: 500 }
        );
      }

      conversationId = existingConv?.id ?? null;
    }

    // Create conversation if none exists
    if (!conversationId) {
      const { data: createdConv, error: createConvError } = await supabase
        .from("message_conversations")
        .insert({
          customer_email: email,
          customer_name,
          subject,
          appointment_id,
          status: "open",
          priority: "normal",
          unread_for_admin_count: 0,
          unread_for_customer_count: 0,
          last_message_at: new Date().toISOString(),
          last_message_preview: previewFromBody(body),
        })
        .select("id")
        .single();

      if (createConvError || !createdConv?.id) {
        return NextResponse.json(
          { error: createConvError?.message || "Failed to create conversation." },
          { status: 500 }
        );
      }

      conversationId = createdConv.id;
    }

    // Insert customer message
    const { data: insertedMessage, error: insertMessageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        subject,
        body,
        appointment_id,
        sender_email: email,
        sender_role: "customer",
        recipient_email: "info@glassguardianchipandcrackrepair.com",
        recipient_role: "support",
        message_type: "support",
        is_read: false,
        read_by_admin: false,
        read_by_customer: true,
      })
      .select("id, created_at")
      .single();

    if (insertMessageError) {
      return NextResponse.json(
        { error: insertMessageError.message || "Failed to send message." },
        { status: 500 }
      );
    }

    // Update conversation metadata
    const { error: updateConvError } = await supabase
      .from("message_conversations")
      .update({
        customer_name,
        subject,
        appointment_id,
        status: "open",
        last_message_at: insertedMessage.created_at ?? new Date().toISOString(),
        last_message_preview: previewFromBody(body),
        unread_for_admin_count: 1, // trigger/backfill sql will keep this sane over time; this sets at least 1
      })
      .eq("id", conversationId);

    if (updateConvError) {
      return NextResponse.json(
        { error: updateConvError.message || "Message sent but conversation update failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversation_id: conversationId,
      message_id: insertedMessage.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}