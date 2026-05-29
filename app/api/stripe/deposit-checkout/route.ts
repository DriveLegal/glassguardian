import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function siteUrl(req: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin
  ).replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Missing deposit token." }, { status: 400 });
    }

    const { data: deposit, error } = await supabaseAdmin
      .from("deposit_requests")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !deposit) {
      return NextResponse.json({ error: "Deposit request not found." }, { status: 404 });
    }

    if (deposit.status === "paid") {
      return NextResponse.json({ error: "This deposit has already been paid." }, { status: 400 });
    }

    if (deposit.status !== "pending") {
      return NextResponse.json({ error: "This deposit is no longer payable." }, { status: 400 });
    }

    const base = siteUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: deposit.customer_email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: deposit.amount_cents,
            product_data: {
              name: "Glass Guardian Appointment Deposit",
              description: "$20 deposit applied toward final repair total.",
            },
          },
        },
      ],
      metadata: {
        type: "deposit",
        deposit_request_id: deposit.id,
        deposit_token: deposit.token,
      },
      payment_intent_data: {
        metadata: {
          type: "deposit",
          deposit_request_id: deposit.id,
          deposit_token: deposit.token,
        },
      },
      success_url: `${base}/deposit/${deposit.token}?success=1`,
      cancel_url: `${base}/deposit/${deposit.token}?cancelled=1`,
    });

    await supabaseAdmin
      .from("deposit_requests")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deposit.id);

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to create Stripe checkout." },
      { status: 500 }
    );
  }
}