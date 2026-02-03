// app/api/stripe/validate-promo/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Minimal invoice shape needed.
 */
type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  customer_email: string | null;
};

// ✅ $3 flat processing fee (in cents)
const PROCESSING_FEE_CENTS = 300;

// Server-side Supabase client (service role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await req.json();

    const invoiceId = body?.invoiceId as string | undefined;
    const code = body?.code as string | undefined;

    // ✅ we require accessToken so server can verify who is calling this
    const accessToken = body?.accessToken as string | undefined;

    if (!invoiceId || !code?.trim()) {
      return NextResponse.json({ ok: false, message: "Missing invoiceId or code" }, { status: 400 });
    }
    if (!accessToken) {
      return NextResponse.json({ ok: false, message: "Missing accessToken" }, { status: 401 });
    }

    // ✅ Verify logged-in user via Supabase Auth (server-side)
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    const authedEmail = userData?.user?.email ?? null;

    if (userErr || !authedEmail) {
      return NextResponse.json({ ok: false, message: "Not authenticated" }, { status: 401 });
    }

    // 1) Fetch invoice
    const { data, error } = await supabaseAdmin
      .from("tech_invoices")
      .select(["id", "invoice_number", "status", "total_cents", "customer_email"].join(", "))
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) {
      console.error("Supabase invoice fetch error:", error);
      return NextResponse.json({ ok: false, message: "Error loading invoice" }, { status: 500 });
    }

    const invoice = data as InvoiceRow | null;
    if (!invoice) return NextResponse.json({ ok: false, message: "Invoice not found" }, { status: 404 });

    if (String(invoice.status).toLowerCase() === "paid") {
      return NextResponse.json({ ok: false, message: "Invoice already paid" }, { status: 400 });
    }

    // ✅ Ownership check (server-side)
    const invEmail = (invoice.customer_email ?? "").toLowerCase();
    if (!invEmail || invEmail !== authedEmail.toLowerCase()) {
      return NextResponse.json({ ok: false, message: "Invoice not under your account" }, { status: 403 });
    }

    const serviceTotalCents = Number(invoice.total_cents ?? 0);
    if (!Number.isFinite(serviceTotalCents) || serviceTotalCents <= 0) {
      return NextResponse.json({ ok: false, message: "Invalid invoice amount" }, { status: 400 });
    }

    const feeCents = PROCESSING_FEE_CENTS;

    // ✅ Important: discount only applies to service amount (not fee)
    const discountBaseCents = serviceTotalCents;

    // total due shown to user (service + fee)
    const baseTotalDueCents = serviceTotalCents + feeCents;

    // 2) Lookup promo code in Stripe
    const promoList = await stripe.promotionCodes.list({
      code: code.trim(),
      active: true,
      limit: 1,
    });

    const promo = promoList.data?.[0] as any;
    if (!promo || promo.active !== true) {
      return NextResponse.json({ ok: false, message: "Promo code not valid" }, { status: 400 });
    }

    const coupon: any = promo.coupon;

    // coupon.valid is a real Stripe field; if it exists and is false -> reject
    if (coupon && typeof coupon.valid === "boolean" && coupon.valid === false) {
      return NextResponse.json({ ok: false, message: "Promo code not valid" }, { status: 400 });
    }

    const percentOff: number | null = typeof coupon?.percent_off === "number" ? coupon.percent_off : null;

    // amount_off is in cents, but coupon may have currency set
    const amountOffCents: number | null = typeof coupon?.amount_off === "number" ? coupon.amount_off : null;
    const couponCurrency: string | null = typeof coupon?.currency === "string" ? coupon.currency : null;

    let discountCents = 0;

    if (percentOff != null && percentOff > 0) {
      discountCents = Math.round((discountBaseCents * percentOff) / 100);
    } else if (amountOffCents != null && amountOffCents > 0) {
      // If coupon has currency and it's not USD, reject to prevent wrong math
      if (couponCurrency && couponCurrency.toLowerCase() !== "usd") {
        return NextResponse.json(
          { ok: false, message: `Promo currency mismatch (${couponCurrency}). Please use a USD promo.` },
          { status: 400 }
        );
      }
      discountCents = amountOffCents;
    }

    // Clamp discount to service amount only (not fee)
    discountCents = clamp(discountCents, 0, discountBaseCents);

    // New due = (service - discount) + fee
    const newTotalDueCents = (serviceTotalCents - discountCents) + feeCents;

    const description =
      percentOff != null
        ? `${percentOff}% off applied`
        : amountOffCents != null
          ? `-$${(amountOffCents / 100).toFixed(2)} applied`
          : "Promo applied";

    return NextResponse.json(
      {
        ok: true,
        code: promo.code ?? code.trim(),
        promoId: promo.id ?? null,
        couponId: coupon?.id ?? null,
        percentOff,
        amountOffCents,
        discountCents,
        // helpful for UI
        baseTotalDueCents,
        newTotalDueCents,
        description,
        message: "Promo applied — your discount will be included when you continue to Stripe.",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("validate promo error:", err);
    return NextResponse.json({ ok: false, message: "Server error validating promo" }, { status: 500 });
  }
}