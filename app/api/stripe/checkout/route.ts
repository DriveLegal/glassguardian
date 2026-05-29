// app/api/stripe/checkout/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  customer_email: string | null;

  deposit_request_id?: string | null;
  deposit_cents?: number | null;
  deposit_applied_at?: string | null;
};

const PROCESSING_FEE_CENTS = 300;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function getBaseUrl(req: NextRequest) {
  const envBase =
    process.env.SUPABASE_REDIRECT_BASE?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";

  if (envBase) return envBase.replace(/\/+$/, "");

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");

  if (host) {
    const proto =
      forwardedProto ||
      (host.includes("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");

    return `${proto}://${host}`;
  }

  return req.nextUrl.origin.replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await req.json();

    const invoiceId = String(body?.invoiceId ?? "").trim();
    const promoCode = String(body?.promoCode ?? "").trim() || null;
    const accessToken = String(body?.accessToken ?? "").trim();

    if (!invoiceId) {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing accessToken" },
        { status: 401 }
      );
    }

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(accessToken);

    const authedEmail = normalizeEmail(userData?.user?.email);

    if (userErr || !authedEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("tech_invoices")
      .select(
        [
          "id",
          "invoice_number",
          "status",
          "total_cents",
          "customer_email",
          "deposit_request_id",
          "deposit_cents",
          "deposit_applied_at",
        ].join(", ")
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) {
      console.error("Supabase invoice fetch error:", error);
      return NextResponse.json(
        { error: "Error loading invoice" },
        { status: 500 }
      );
    }

    const invoice = data as InvoiceRow | null;

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (String(invoice.status ?? "").toLowerCase() === "paid") {
      return NextResponse.json(
        { error: "Invoice already paid" },
        { status: 400 }
      );
    }

    const invoiceEmail = normalizeEmail(invoice.customer_email);

    if (!invoiceEmail || invoiceEmail !== authedEmail) {
      return NextResponse.json(
        { error: "Invoice not under your account" },
        { status: 403 }
      );
    }

    const serviceTotalCents = Number(invoice.total_cents ?? 0);

    if (!Number.isFinite(serviceTotalCents) || serviceTotalCents <= 0) {
      return NextResponse.json(
        { error: "Invalid invoice amount" },
        { status: 400 }
      );
    }

    const depositAppliedCents = Math.min(
      serviceTotalCents,
      Math.max(0, Number(invoice.deposit_cents ?? 0))
    );

    const balanceAfterDepositCents = Math.max(
      0,
      serviceTotalCents - depositAppliedCents
    );

    if (balanceAfterDepositCents <= 0) {
      return NextResponse.json(
        { error: "This invoice has no remaining balance due" },
        { status: 400 }
      );
    }

    const totalCharged = balanceAfterDepositCents + PROCESSING_FEE_CENTS;
    const baseUrl = getBaseUrl(req);

    const successUrl =
      `${baseUrl}/user/dashboard/pay/success` +
      `?invoice_id=${encodeURIComponent(invoice.id)}` +
      `&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${baseUrl}/user/dashboard/pay/${encodeURIComponent(invoice.id)}` +
      `?stripe=cancel`;

    let promotionCodeId: string | null = null;

    if (promoCode) {
      const promoList = await stripe.promotionCodes.list({
        code: promoCode,
        active: true,
        limit: 1,
      });

      const promo = promoList.data?.[0];

      if (!promo || !promo.active) {
        return NextResponse.json(
          { error: "Promo code not valid" },
          { status: 400 }
        );
      }

      promotionCodeId = promo.id ?? null;
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
              description:
                depositAppliedCents > 0
                  ? `Service balance after $${(
                      depositAppliedCents / 100
                    ).toFixed(2)} deposit applied`
                  : "Service balance",
            },
            unit_amount: balanceAfterDepositCents,
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: "Processing fee",
            },
            unit_amount: PROCESSING_FEE_CENTS,
          },
        },
      ],

      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : {}),

      customer_email: invoice.customer_email ?? undefined,

      metadata: {
        tech_invoice_id: invoice.id,
        invoice_id: invoice.id,
        invoice_number: String(invoice.invoice_number ?? ""),
        customer_email: invoice.customer_email ?? "",

        service_total_cents: String(serviceTotalCents),
        deposit_applied_cents: String(depositAppliedCents),
        balance_after_deposit_cents: String(balanceAfterDepositCents),
        fee_cents: String(PROCESSING_FEE_CENTS),
        total_charged_cents: String(totalCharged),

        promo_code: promoCode ?? "",
        stripe_promotion_code_id: promotionCodeId ?? "",
        deposit_request_id: invoice.deposit_request_id ?? "",
        deposit_applied_at: invoice.deposit_applied_at ?? "",
      },

      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "No checkout URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create Stripe checkout session" },
      { status: 500 }
    );
  }
}