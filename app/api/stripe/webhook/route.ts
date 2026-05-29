// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isDepositSession(meta: Record<string, string>) {
  const type = String(meta.type || meta.payment_type || "").toLowerCase();
  return (
    type === "deposit" ||
    type === "appointment_deposit" ||
    type === "repair_deposit" ||
    Boolean(meta.deposit_request_id)
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
    if (!isPaidCheckoutEvent(event.type)) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const meta = (session.metadata || {}) as Record<string, string>;
    const paymentStatus = String(session.payment_status || "").toLowerCase();

    if (paymentStatus !== "paid") {
      return NextResponse.json({ received: true, notPaid: true }, { status: 200 });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    const amountTotal = session.amount_total ?? null;
    const amountDiscount = session.total_details?.amount_discount ?? null;
    const paidAt = new Date().toISOString();

    /*
    =========================================================
    DEPOSIT HANDLING
    =========================================================
    */
    if (isDepositSession(meta)) {
      const depositId = meta.deposit_request_id || meta.deposit_id || "";
      const appointmentId = meta.appointment_id || "";

      if (!depositId) {
        console.warn("Paid deposit checkout missing deposit_request_id metadata", {
          sessionId: session.id,
          metadata: meta,
        });

        return NextResponse.json(
          { received: true, depositUpdated: false, reason: "missing_deposit_request_id" },
          { status: 200 }
        );
      }

      const { data: existingDeposit, error: depositFetchErr } = await supabaseAdmin
        .from("deposit_requests")
        .select("*")
        .eq("id", depositId)
        .maybeSingle();

      if (depositFetchErr) {
        console.error("Deposit fetch error:", depositFetchErr);
        return NextResponse.json({ received: true, depositUpdated: false }, { status: 200 });
      }

      if (!existingDeposit) {
        console.warn("Deposit not found:", depositId);
        return NextResponse.json({ received: true, depositUpdated: false }, { status: 200 });
      }

      const finalAppointmentId = existingDeposit.appointment_id || appointmentId || null;
      const depositCents = Number(existingDeposit.amount_cents || amountTotal || 2000);

      const { error: depositErr } = await supabaseAdmin
        .from("deposit_requests")
        .update({
          status: "paid",
          paid_at: paidAt,
          updated_at: paidAt,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          payment_status: "paid",
          amount_paid_cents: amountTotal,
        })
        .eq("id", depositId);

      if (depositErr) {
        console.error("Deposit update error:", depositErr);
        return NextResponse.json({ received: true, depositUpdated: false }, { status: 200 });
      }

      if (finalAppointmentId) {
        const { error: appointmentErr } = await supabaseAdmin
          .from("appointments")
          .update({
            deposit_request_id: depositId,
            deposit_cents: depositCents,
            deposit_status: "paid",
            deposit_paid_at: paidAt,
          })
          .eq("id", finalAppointmentId);

        if (appointmentErr) {
          console.error("Appointment deposit sync error:", appointmentErr);
        }
      }

      return NextResponse.json(
        { received: true, depositUpdated: true, depositId },
        { status: 200 }
      );
    }

    /*
    =========================================================
    EXISTING INVOICE LOGIC
    =========================================================
    */
    const invoiceId = meta.invoice_id || meta.tech_invoice_id || "";

    if (!invoiceId) {
      console.warn(`${event.type} without invoice_id metadata`, {
        sessionId: session.id,
        metadata: meta,
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    const promoCode = meta.promo_code || "";
    const promoId = meta.stripe_promotion_code_id || "";

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
      console.warn("tech_invoices row not found:", invoiceId);
      return NextResponse.json({ received: true, dbUpdated: false }, { status: 200 });
    }

    if (String(existing.status || "").toLowerCase() === "paid") {
      return NextResponse.json(
        { received: true, dbUpdated: true, alreadyPaid: true },
        { status: 200 }
      );
    }

    const updatePayload: Record<string, any> = {
      status: "paid",
      payment_method: "stripe",
      paid_at: paidAt,
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
      console.error("Invoice update error:", updateErr);
    }

    return NextResponse.json({ received: true, dbUpdated: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}