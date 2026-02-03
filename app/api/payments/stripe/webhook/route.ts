//app/api/payments/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supabase service role (server-only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function getRawBody(req: Request) {
  const ab = await req.arrayBuffer();
  return Buffer.from(ab);
}

function isCheckoutPaidEvent(type: string) {
  return (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded"
  );
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe-signature or STRIPE_WEBHOOK_SECRET" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verify failed:", err?.message || err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    if (!isCheckoutPaidEvent(event.type)) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const meta = (session.metadata || {}) as Record<string, string>;
    const invoiceId = meta.invoice_id || meta.tech_invoice_id || "";

    if (!invoiceId) {
      console.warn("Stripe event missing invoice_id metadata:", {
        type: event.type,
        sessionId: session.id,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Only mark paid when Stripe confirms payment_status=paid
    const paymentStatus = String(session.payment_status || "").toLowerCase();
    if (paymentStatus !== "paid") {
      console.warn("Checkout session not paid yet:", {
        invoiceId,
        sessionId: session.id,
        payment_status: session.payment_status,
      });
      return NextResponse.json({ received: true, notPaid: true }, { status: 200 });
    }

    // Idempotency check
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("tech_invoices")
      .select("id,status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Supabase fetch tech_invoice error:", fetchErr);
      return NextResponse.json({ received: true, dbUpdated: false }, { status: 200 });
    }
    if (!existing) {
      console.warn("tech_invoices row not found for invoiceId:", invoiceId);
      return NextResponse.json({ received: true, dbUpdated: false }, { status: 200 });
    }
    if (String(existing.status || "").toLowerCase() === "paid") {
      return NextResponse.json(
        { received: true, dbUpdated: true, alreadyPaid: true },
        { status: 200 }
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    const amountTotal = session.amount_total ?? null;
    const amountSubtotal = session.amount_subtotal ?? null; // optional (not stored)
    const amountDiscount = session.total_details?.amount_discount ?? null;

    const promoCode = meta.promo_code || "";
    const promoId = meta.stripe_promotion_code_id || "";

    const noteParts = [
      "Stripe Checkout paid",
      `session=${session.id}`,
      paymentIntentId ? `pi=${paymentIntentId}` : null,
      amountTotal != null ? `amount_total=${amountTotal}` : null,
      amountSubtotal != null ? `amount_subtotal=${amountSubtotal}` : null,
      amountDiscount != null ? `discount=${amountDiscount}` : null,
      promoCode ? `promo=${promoCode}` : null,
    ].filter(Boolean);

    // ✅ Update tech_invoices (requires SQL columns you’re adding)
    const updatePayload: Record<string, any> = {
      status: "paid",
      payment_method: "stripe",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      final_paid_cents: amountTotal,
      promo_code: promoCode || null,
      stripe_promotion_code_id: promoId || null,
      promo_discount_cents: amountDiscount,
      payment_note: noteParts.join(" | ").slice(0, 500),
    };

    const { error: updateErr } = await supabaseAdmin
      .from("tech_invoices")
      .update(updatePayload)
      .eq("id", invoiceId);

    if (updateErr) {
      console.error("Supabase update tech_invoice paid error:", updateErr);
      // Return 200 to prevent Stripe retry storms if DB temporarily rejects
      return NextResponse.json({ received: true, dbUpdated: false }, { status: 200 });
    }

    return NextResponse.json({ received: true, dbUpdated: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}