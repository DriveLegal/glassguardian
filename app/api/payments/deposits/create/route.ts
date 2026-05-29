// app/api/payments/deposits/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function siteUrl(req: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(
    /\/$/,
    ""
  );
}

function makeToken() {
  return crypto.randomBytes(18).toString("hex");
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    const auth = req.headers.get("authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!jwt) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const body = await req.json();

    const {
      customer_name,
      customer_email,
      customer_phone,
      amount_cents = 2000,
      source = "tech_dashboard",
      appointment_id = null,
    } = body;

    if (!customer_name?.trim()) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!customer_phone?.trim()) {
      return NextResponse.json(
        { error: "Customer phone is required." },
        { status: 400 }
      );
    }

    if (Number(amount_cents) !== 2000) {
      return NextResponse.json(
        { error: "Deposit amount must be $20." },
        { status: 400 }
      );
    }

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(jwt);

    if (userErr || !userData?.user?.email) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const baseUrl = siteUrl(req);
    const token = makeToken();

    const { data: deposit, error } = await supabaseAdmin
      .from("deposit_requests")
      .insert({
        token,
        customer_name: customer_name.trim(),
        customer_email: customer_email?.trim() || null,
        customer_phone: customer_phone.trim(),
        amount_cents: 2000,
        status: "pending",
        source,
        appointment_id: appointment_id || null,
        created_by_tech_email: userData.user.email,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customer_email?.trim() || undefined,

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Glass Guardian Appointment Deposit",
              description:
                "Deposit applied toward your windshield repair total.",
            },
            unit_amount: 2000,
          },
          quantity: 1,
        },
      ],

      success_url: `${baseUrl}/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/deposit/cancel`,

      metadata: {
        type: "deposit",
        deposit_request_id: deposit.id,
        appointment_id: appointment_id ? String(appointment_id) : "",
        source,
        customer_phone: customer_phone.trim(),
      },
    });

    await supabaseAdmin
      .from("deposit_requests")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deposit.id);

    if (appointment_id) {
      await supabaseAdmin
        .from("appointments")
        .update({
          deposit_request_id: deposit.id,
          deposit_cents: 2000,
          deposit_status: "pending",
        })
        .eq("id", appointment_id);
    }

    return NextResponse.json({
      ok: true,
      deposit,
      deposit_url: session.url,
      checkout_url: session.url,
      stripe_checkout_session_id: session.id,
    });
  } catch (e: any) {
    console.error("Create deposit request error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create deposit request." },
      { status: 500 }
    );
  }
}