import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  customer_email: string | null;
};

const PROCESSING_FEE_CENTS = 300;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await req.json();

    const invoiceId = body?.invoiceId as string | undefined;
    const promoCode = (body?.promoCode as string | undefined)?.trim() || null;
    const accessToken = body?.accessToken as string | undefined;

    if (!invoiceId) {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
    }
    if (!accessToken) {
      return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    const authedEmail = userData?.user?.email ?? null;

    if (userErr || !authedEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("tech_invoices")
      .select("id, invoice_number, status, total_cents, customer_email")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) {
      console.error("Supabase invoice fetch error:", error);
      return NextResponse.json({ error: "Error loading invoice" }, { status: 500 });
    }

    const invoice = data as InvoiceRow | null;

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (String(invoice.status).toLowerCase() === "paid") {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
    }

    const invEmail = (invoice.customer_email ?? "").toLowerCase();
    if (!invEmail || invEmail !== authedEmail.toLowerCase()) {
      return NextResponse.json({ error: "Invoice not under your account" }, { status: 403 });
    }

    const baseAmount = Number(invoice.total_cents ?? 0);
    if (!baseAmount || baseAmount <= 0) {
      return NextResponse.json({ error: "Invalid invoice amount" }, { status: 400 });
    }

    const totalCharged = baseAmount + PROCESSING_FEE_CENTS;

    const base =
      process.env.SUPABASE_REDIRECT_BASE ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "https://glassguardianchipandcrackrepair.com";

    const successUrl = process.env.STRIPE_SUCCESS_URL ?? `${base}/user/dashboard/pay/success`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL ?? `${base}/user/dashboard/pay/cancel`;

    let promotionCodeId: string | null = null;

    if (promoCode) {
      const promoList = await stripe.promotionCodes.list({
        code: promoCode,
        active: true,
        limit: 1,
      });

      const promo = promoList.data?.[0];
      if (!promo || !(promo as any).active) {
        return NextResponse.json({ error: "Promo code not valid" }, { status: 400 });
      }
      promotionCodeId = (promo as any).id ?? null;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `Glass Guardian Invoice #${invoice.invoice_number}`,
            },
            unit_amount: baseAmount,
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: { name: "Processing fee" },
            unit_amount: PROCESSING_FEE_CENTS,
          },
        },
      ],

      ...(promotionCodeId ? { discounts: [{ promotion_code: promotionCodeId }] } : {}),

      customer_email: invoice.customer_email ?? undefined,

      metadata: {
        tech_invoice_id: invoice.id,
        invoice_id: invoice.id,
        base_total_cents: String(baseAmount),
        fee_cents: String(PROCESSING_FEE_CENTS),
        total_charged_cents: String(totalCharged),
        promo_code: promoCode ?? "",
        stripe_promotion_code_id: promotionCodeId ?? "",
      },

      success_url: `${successUrl}?invoice_id=${encodeURIComponent(
        invoice.id
      )}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}?invoice_id=${encodeURIComponent(invoice.id)}`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create Stripe checkout session" },
      { status: 500 }
    );
  }
}