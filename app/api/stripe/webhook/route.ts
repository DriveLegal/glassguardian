// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supabase service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function getRawBody(req: Request) {
  const ab = await req.arrayBuffer();
  return Buffer.from(ab);
}

function isPaidCheckoutEvent(type: string) {
  return (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded"
  );
}

export async function POST(req: Request) {
  const stripe = getStripe(); // uses your configured apiVersion
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
    // ✅ Handle the paid checkout events (instant + async methods)
    if (isPaidCheckoutEvent(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;

      const meta = (session.metadata || {}) as Record<string, string>;
      const invoiceId = meta.invoice_id || meta.tech_invoice_id || "";

      if (!invoiceId) {
        console.warn(`${event.type} without invoice_id metadata`, {
          sessionId: session.id,
        });
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // ✅ Only mark paid when Stripe confirms paid
      const paymentStatus = String(session.payment_status || "").toLowerCase();
      if (paymentStatus !== "paid") {
        console.warn("Checkout session not paid yet", {
          invoiceId,
          sessionId: session.id,
          payment_status: session.payment_status,
          eventType: event.type,
        });
        return NextResponse.json(
          { received: true, notPaid: true },
          { status: 200 }
        );
      }

      // Helpful promo info if stored in metadata at checkout creation
      const promoCode = meta.promo_code || "";
      const promoId = meta.stripe_promotion_code_id || "";

      // Amounts (Stripe sends totals in cents)
      const amountTotal = session.amount_total ?? null; // total charged
      const amountDiscount = session.total_details?.amount_discount ?? null;

      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : null;

      // ✅ Idempotency: if already paid, do nothing
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from("tech_invoices")
        .select("id,status")
        .eq("id", invoiceId)
        .maybeSingle();

      if (fetchErr) {
        console.error("Supabase fetch tech_invoice error:", fetchErr);
        return NextResponse.json(
          { received: true, dbUpdated: false },
          { status: 200 }
        );
      }
      if (!existing) {
        console.warn("tech_invoices row not found for invoiceId:", invoiceId);
        return NextResponse.json(
          { received: true, dbUpdated: false },
          { status: 200 }
        );
      }
      if (String(existing.status || "").toLowerCase() === "paid") {
        return NextResponse.json(
          { received: true, dbUpdated: true, alreadyPaid: true },
          { status: 200 }
        );
      }

      // ✅ Update invoice → paid + store final numbers + promo data
      // (Requires SQL columns: paid_at, stripe_checkout_session_id, etc.)
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
        payment_note: `Stripe Checkout paid | session=${session.id}${
          paymentIntentId ? ` | pi=${paymentIntentId}` : ""
        }`,
      };

      const { error: updateErr } = await supabaseAdmin
        .from("tech_invoices")
        .update(updatePayload)
        .eq("id", invoiceId);

      if (updateErr) {
        console.error("Supabase update invoice paid error:", updateErr);
        // Return 200 so Stripe doesn't retry storm if DB rejected temporarily
        return NextResponse.json(
          { received: true, dbUpdated: false },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { received: true, dbUpdated: true },
        { status: 200 }
      );
    }

    // Ignore other events
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}