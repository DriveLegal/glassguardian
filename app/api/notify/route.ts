// app/api/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM ?? "Glass Guardian <no-reply@glassguardian.com>";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // optional

export async function POST(req: NextRequest) {
  try {
    const { to, subject, message, meta } = await req.json();

    if (!to || !subject || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Send email via Resend
    if (!RESEND_API_KEY) {
      // Soft fallback if no key configured
      console.warn("[notify] RESEND_API_KEY missing — skipping send, logging only.");
    } else {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [to],
          subject,
          text: message,
        }),
      });

      if (!r.ok) {
        const txt = await r.text();
        console.error("[notify] Resend error:", txt);
        // continue; we still try to log
      }
    }

    // Log to Supabase if possible (table: notification_logs)
    try {
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await admin.from("notification_logs").insert({
          recipient_email: to,
          notification_type: meta?.notificationType ?? null,
          appointment_id: meta?.appointmentId ?? null,
          claim_id: meta?.claimId ?? null,
          subject,
          message,
          delivery_method: "email",
          status: "sent",
          sent_at: new Date().toISOString(),
          meta: meta ?? {},
        });
      }
    } catch (logErr) {
      console.warn("[notify] Log insert failed:", logErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[notify] fatal:", err);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}