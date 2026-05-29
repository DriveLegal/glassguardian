// app/user/(protected)/dashboard/pay/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Loader2,
  Car,
  TriangleAlert,
  HeartHandshake,
  Sparkles,
  Tag,
  X,
  CheckCircle2,
  Printer,
  ReceiptText,
  Calendar,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  client_id: string | null;
  vehicle_id: string | null;
  appointment_id?: string | null;

  invoice_date: string;
  status: string;

  customer_email: string | null;
  customer_name?: string | null;

  services_json: {
    glass_total?: number;
    misc_total?: number;
  } | null;

  windshield_repairs_json: any[] | null;

  subtotal_cents: number;
  discount_percent: number | null;
  discount_cents: number;
  tax_rate_percent: number | null;
  tax_cents: number;
  total_cents: number;

  deposit_request_id?: string | null;
  deposit_cents?: number | null;
  deposit_applied_at?: string | null;

  final_paid_cents?: number | null;
  paid_at?: string | null;
  payment_method?: string | null;

  crack_out_occurred?: boolean | null;
  crack_out_at?: string | null;
  crack_out_notes?: string | null;
  crack_out_cause?: string | null;
  crack_out_photo_url?: string | null;
  replacement_required?: boolean | null;
  replacement_status?: string | null;
  repair_outcome?: string | null;
};

type Vehicle = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  license_plate?: string | null;
  color?: string | null;
};

const PROCESSING_FEE_CENTS = 300;

const centsToDollars = (c: number | null | undefined) =>
  ((c || 0) / 100).toFixed(2);

function toLocalDateOnly(input: string | null | undefined): string | null {
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addYearsDateOnly(
  dateOnly: string | null | undefined,
  years: number
): string | null {
  if (!dateOnly) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;

  const [yy, mm, dd] = dateOnly.split("-").map((x) => Number(x));
  if (!yy || !mm || !dd) return null;

  const d = new Date(yy, mm - 1, dd);
  d.setFullYear(d.getFullYear() + years);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isCrackOutFromRow(row: any) {
  const outcome = String(row?.repair_outcome ?? "").toLowerCase();
  return row?.crack_out_occurred === true || outcome === "crack_out";
}

function isStripeLikePaymentMethod(method: string | null | undefined) {
  const m = String(method ?? "").trim().toLowerCase();
  if (!m) return false;

  return (
    m === "stripe" ||
    m === "stripe_checkout" ||
    m === "stripe_checkout_session" ||
    m === "stripe_link" ||
    m === "card_online" ||
    m === "online_card" ||
    m.includes("stripe")
  );
}

type PromoPreview = {
  ok: boolean;
  code?: string;
  promoId?: string;
  couponId?: string;
  description?: string;
  percentOff?: number | null;
  amountOffCents?: number | null;
  discountCents?: number;
  newTotalDueCents?: number;
  message?: string;
};

function SkeletonLine({ w = "w-32" }: { w?: string }) {
  return (
    <div className={`h-3 ${w} rounded-full bg-slate-800/80 animate-pulse`} />
  );
}

function SkeletonBlock({ h = "h-10" }: { h?: string }) {
  return (
    <div className={`${h} w-full rounded-xl bg-slate-800/70 animate-pulse`} />
  );
}

function inferInsuranceCoverage(invoice: InvoiceRow | null) {
  if (!invoice) return { insuranceMode: false, insuranceCoveredCents: 0 };

  const subtotal = invoice.subtotal_cents ?? 0;
  const discount = invoice.discount_cents ?? 0;
  const serviceTotal = invoice.total_cents ?? 0;

  const insuranceMode =
    subtotal > 0 && serviceTotal === 0 && discount >= subtotal;

  return {
    insuranceMode,
    insuranceCoveredCents: insuranceMode ? discount : 0,
  };
}

export default function UserPayInvoicePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;
  const pathname = usePathname();

  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [authState, setAuthState] = React.useState<"checking" | "authed">(
    "checking"
  );

  const [stripeLoading, setStripeLoading] = React.useState(false);
  const [stripeError, setStripeError] = React.useState<string | null>(null);

  const [promoInput, setPromoInput] = React.useState("");
  const [promoLoading, setPromoLoading] = React.useState(false);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [promoApplied, setPromoApplied] = React.useState<PromoPreview | null>(
    null
  );

  React.useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    async function resolveAuth() {
      try {
        if (redirectTimer) {
          clearTimeout(redirectTimer);
          redirectTimer = null;
        }

        await new Promise((r) => setTimeout(r, 250));

        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData?.session ?? null;
        const sessionEmail = session?.user?.email ?? null;

        if (sessionEmail) {
          if (!cancelled) {
            setUserEmail(sessionEmail);
            setAuthState("authed");
          }
          return;
        }

        const { data: userData, error: userError } =
          await supabaseClient.auth.getUser();

        const nextUserEmail = userData?.user?.email ?? null;

        if (!userError && nextUserEmail) {
          if (!cancelled) {
            setUserEmail(nextUserEmail);
            setAuthState("authed");
          }
          return;
        }

        redirectTimer = setTimeout(() => {
          if (cancelled) return;

          router.replace(
            `/user/login?redirect=${encodeURIComponent(
              pathname || `/user/dashboard/pay/${invoiceId}`
            )}`
          );
        }, 1200);
      } catch {
        if (redirectTimer) {
          clearTimeout(redirectTimer);
          redirectTimer = null;
        }

        redirectTimer = setTimeout(() => {
          if (cancelled) return;

          router.replace(
            `/user/login?redirect=${encodeURIComponent(
              pathname || `/user/dashboard/pay/${invoiceId}`
            )}`
          );
        }, 1200);
      }
    }

    resolveAuth();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      if (!email || cancelled) return;

      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }

      setUserEmail(email);
      setAuthState("authed");
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        resolveAuth();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, invoiceId, pathname]);

  const {
    data: invoice,
    isLoading: loadingInvoice,
    isFetching: fetchingInvoice,
    error: invoiceErr,
    refetch: refetchInvoice,
  } = useQuery<InvoiceRow | null>({
    queryKey: ["user-pay-invoice", invoiceId],
    enabled: !!invoiceId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          [
            "id",
            "invoice_number",
            "client_id",
            "vehicle_id",
            "appointment_id",
            "invoice_date",
            "status",
            "customer_email",
            "customer_name",
            "services_json",
            "windshield_repairs_json",
            "subtotal_cents",
            "discount_percent",
            "discount_cents",
            "tax_rate_percent",
            "tax_cents",
            "total_cents",
            "deposit_request_id",
            "deposit_cents",
            "deposit_applied_at",
            "final_paid_cents",
            "paid_at",
            "payment_method",
            "crack_out_occurred",
            "crack_out_at",
            "crack_out_notes",
            "crack_out_cause",
            "crack_out_photo_url",
            "replacement_required",
            "replacement_status",
            "repair_outcome",
          ].join(", ")
        )
        .eq("id", invoiceId)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as InvoiceRow) ?? null;
    },
  });

  const shouldFetchCrackFallback = React.useMemo(() => {
    if (!invoice?.id) return false;
    const invHasAny =
      invoice.crack_out_occurred != null ||
      invoice.repair_outcome != null ||
      invoice.replacement_required != null ||
      invoice.crack_out_notes != null ||
      invoice.crack_out_cause != null;
    return !invHasAny;
  }, [invoice]);

  const { data: apptCrackMeta } = useQuery<any | null>({
    queryKey: ["invoice-linked-appointment-crack", invoice?.appointment_id],
    enabled: !!invoice?.appointment_id && shouldFetchCrackFallback,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
    queryFn: async () => {
      try {
        if (!invoice?.appointment_id) return null;
        const { data, error } = await supabaseClient
          .from("appointments")
          .select(
            [
              "id",
              "crack_out_occurred",
              "crack_out_at",
              "crack_out_notes",
              "crack_out_cause",
              "crack_out_photo_url",
              "replacement_required",
              "replacement_status",
              "repair_outcome",
              "status",
            ].join(", ")
          )
          .eq("id", invoice.appointment_id)
          .maybeSingle();
        if (error) return null;
        return data ?? null;
      } catch {
        return null;
      }
    },
  });

  const crackSource: any = React.useMemo(() => {
    if (!invoice) return apptCrackMeta;
    const invHasAny =
      invoice.crack_out_occurred != null ||
      invoice.repair_outcome != null ||
      invoice.replacement_required != null ||
      invoice.crack_out_notes != null ||
      invoice.crack_out_cause != null;
    return invHasAny ? invoice : apptCrackMeta;
  }, [invoice, apptCrackMeta]);

  const crackOut = isCrackOutFromRow(crackSource);
  const replacementRequired =
    crackOut &&
    (crackSource?.replacement_required === true ||
      crackSource?.replacement_required == null);
  const replacementStatus = String(
    crackSource?.replacement_status ?? ""
  ).toLowerCase();

  const {
    data: vehicle,
    isLoading: loadingVehicle,
    isFetching: fetchingVehicle,
  } = useQuery<Vehicle | null>({
    queryKey: ["user-pay-vehicle", invoice?.vehicle_id],
    enabled: !!invoice?.vehicle_id,
    staleTime: 10 * 60_000,
    gcTime: 20 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!invoice?.vehicle_id) return null;
      const { data, error } = await supabaseClient
        .from("client_vehicles")
        .select("id, year, make, model, license_plate, color")
        .eq("id", invoice.vehicle_id)
        .maybeSingle();
      if (error) throw error;
      return (data as Vehicle) ?? null;
    },
  });

  const invoiceReady = !!invoice;
  const softLoading =
    !invoiceReady &&
    (loadingInvoice || fetchingInvoice || authState === "checking");
  const vehicleSoftLoading = !vehicle && (loadingVehicle || fetchingVehicle);

  const isPaid = String(invoice?.status ?? "").toLowerCase() === "paid";

  const serviceDate = React.useMemo(
    () => toLocalDateOnly(invoice?.invoice_date) ?? null,
    [invoice?.invoice_date]
  );

  const warrantyEnd = React.useMemo(
    () => addYearsDateOnly(serviceDate, 1),
    [serviceDate]
  );

  const { insuranceMode, insuranceCoveredCents } = React.useMemo(
    () => inferInsuranceCoverage(invoice ?? null),
    [invoice]
  );

  const depositAppliedCents = React.useMemo(() => {
    if (!invoice || insuranceMode) return 0;
    return Math.max(0, Number(invoice.deposit_cents || 0));
  }, [invoice, insuranceMode]);

  const serviceBalanceAfterDepositCents = React.useMemo(() => {
    if (!invoice || insuranceMode) return 0;
    return Math.max(0, Number(invoice.total_cents || 0) - depositAppliedCents);
  }, [invoice, insuranceMode, depositAppliedCents]);

  const serviceTotalBeforeCoverageCents = React.useMemo(() => {
    if (!invoice) return 0;
    const subtotal = invoice.subtotal_cents ?? 0;
    const tax = invoice.tax_cents ?? 0;
    return insuranceMode ? subtotal + tax : invoice.total_cents ?? 0;
  }, [invoice, insuranceMode]);

  const processingFeeCents = !isPaid && !insuranceMode ? PROCESSING_FEE_CENTS : 0;

  const baseCustomerDueCents =
    serviceBalanceAfterDepositCents + processingFeeCents;

  const promoDiscountCents = promoApplied?.discountCents ?? 0;
  const shownCustomerDueCents =
    !isPaid && !insuranceMode
      ? promoApplied?.newTotalDueCents ?? baseCustomerDueCents
      : baseCustomerDueCents;

  const amountPaidCents = React.useMemo(() => {
    if (!invoice || !isPaid) return 0;
    if (insuranceMode) return 0;

    if (typeof invoice.final_paid_cents === "number") {
      return invoice.final_paid_cents;
    }

    if (isStripeLikePaymentMethod(invoice.payment_method)) {
      return serviceBalanceAfterDepositCents + PROCESSING_FEE_CENTS;
    }

    return serviceBalanceAfterDepositCents;
  }, [invoice, isPaid, insuranceMode, serviceBalanceAfterDepositCents]);

  const remainingCents = isPaid ? 0 : shownCustomerDueCents;

  const emailMismatch =
    !!invoice?.customer_email &&
    !!userEmail &&
    invoice.customer_email.toLowerCase() !== userEmail.toLowerCase();

  async function applyPromo() {
    if (!invoice) return;
    if (isPaid) return;
    if (insuranceMode) return;

    const code = promoInput.trim();
    if (!code) {
      setPromoError("Enter a promo code.");
      return;
    }

    try {
      setPromoError(null);
      setPromoLoading(true);

      const { data: s } = await supabaseClient.auth.getSession();
      const accessToken = s?.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please log in again.");

      const res = await fetch("/api/stripe/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, code, accessToken }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Promo code not valid.");
      }

      setPromoApplied(data);
    } catch (e: any) {
      setPromoApplied(null);
      setPromoError(e?.message || "Could not apply promo code.");
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setPromoApplied(null);
    setPromoError(null);
    setPromoInput("");
  }

  async function handleStripePay() {
    if (!invoice) return;
    if (isPaid) return;
    if (insuranceMode) return;

    try {
      setStripeError(null);
      setStripeLoading(true);

      const { data: s } = await supabaseClient.auth.getSession();
      const accessToken = s?.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please log in again.");

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          promoCode: promoApplied?.code || null,
          accessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to start Stripe checkout");
      }
      if (!data?.url) throw new Error("No checkout URL returned");

      window.location.href = data.url as string;
    } catch (err: any) {
      console.error("Stripe checkout start error:", err);
      setStripeError(
        err?.message || "Could not start Stripe checkout. Please try again."
      );
    } finally {
      setStripeLoading(false);
    }
  }

  function goToReceipt() {
    if (!invoiceId) return;
    router.push(`/user/dashboard/pay/${invoiceId}/receipt`);
  }

  React.useEffect(() => {
    if (!invoiceId) return;
    const t = setTimeout(() => {
      refetchInvoice().catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [invoiceId, refetchInvoice]);

  if (invoiceErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full border border-red-500/40 bg-slate-900/90 text-slate-50 shadow-[0_18px_60px_rgba(248,113,113,0.35)]">
          <CardHeader>
            <CardTitle>Invoice Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              There was a problem loading your invoice. Please try again later.
            </p>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-100"
              onClick={() => router.push("/user/dashboard/pay")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoiceReady && userEmail && invoice?.customer_email && emailMismatch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full border border-slate-700 bg-slate-900/90 text-slate-50 shadow-2xl">
          <CardHeader>
            <CardTitle>Invoice Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              This invoice is not available under your account. If you believe
              this is a mistake, please contact Glass Guardian support.
            </p>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-100"
              onClick={() => router.push("/user/dashboard/pay")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headlineTotalCents = invoiceReady
    ? insuranceMode
      ? 0
      : isPaid
      ? amountPaidCents
      : shownCustomerDueCents
    : 0;

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(30,64,175,0.9),transparent_55%)]" />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="outline"
            onClick={() => router.push("/user/dashboard/pay")}
            className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>

          <Button
            onClick={goToReceipt}
            disabled={!invoiceId || softLoading}
            className="bg-slate-50 text-slate-950 hover:bg-white font-semibold shadow-[0_18px_45px_rgba(255,255,255,0.10)]"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print receipt / invoice
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {invoiceReady && (isPaid || insuranceMode) && (
          <Card className="border border-emerald-400/30 bg-gradient-to-br from-emerald-950/25 via-slate-950 to-slate-950 shadow-[0_26px_90px_rgba(16,185,129,0.12)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3 text-slate-50">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  {insuranceMode ? "Service Covered" : "Payment Complete"}
                </span>
                <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-400/70">
                  {insuranceMode ? "COVERED" : "PAID"}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <ReceiptText className="w-4 h-4 text-cyan-300" />
                    Invoice
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-50">
                    #{invoice!.invoice_number}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Customer: {invoice!.customer_name || invoice!.customer_email}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Calendar className="w-4 h-4 text-cyan-300" />
                    Service date
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-50">
                    {serviceDate ?? "—"}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Warranty through: {warrantyEnd ?? "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-100/90">
                    <DollarSign className="w-4 h-4 text-emerald-300" />
                    {insuranceMode ? "Customer Paid" : "Paid"}
                  </div>

                  <div className="mt-1 text-2xl font-extrabold text-emerald-200">
                    ${centsToDollars(insuranceMode ? 0 : amountPaidCents)}
                  </div>

                  <div className="mt-1 text-[11px] text-emerald-100/80">
                    Remaining: ${centsToDollars(0)}
                  </div>

                  {depositAppliedCents > 0 && !insuranceMode && (
                    <div className="mt-2 text-[11px] text-emerald-100/80">
                      Deposit applied: -${centsToDollars(depositAppliedCents)}
                    </div>
                  )}

                  {insuranceMode && (
                    <div className="mt-2 text-[11px] text-emerald-100/80">
                      Insurance covered: ${centsToDollars(insuranceCoveredCents)}
                    </div>
                  )}

                  {!insuranceMode && isPaid && invoice?.payment_method && (
                    <div className="mt-2 text-[11px] text-emerald-100/80">
                      Payment method:{" "}
                      {String(invoice.payment_method).replace(/_/g, " ")}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {invoiceReady && crackOut && (
          <Card className="border border-amber-400/35 bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950 shadow-[0_26px_90px_rgba(251,191,36,0.12)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-100">
                <HeartHandshake className="w-5 h-5 text-amber-300" />
                A quick note about your service
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200/90">
              <div className="flex items-start gap-3">
                <TriangleAlert className="w-5 h-5 mt-0.5 text-amber-300" />
                <p>
                  We’re genuinely sorry — a crack-out occurred while the repair
                  was being performed. This can happen with pre-stressed glass,
                  but it’s still on us to be transparent and take care of you.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 text-amber-100 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  You will still get the replacement.
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {replacementStatus
                    ? `Replacement status: ${replacementStatus.replace(
                        /_/g,
                        " "
                      )}.`
                    : replacementRequired
                    ? "Our team will coordinate the next available replacement option with you."
                    : "Our team will follow up with next steps shortly."}
                </p>
                {(crackSource?.crack_out_notes ||
                  crackSource?.crack_out_cause) && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {crackSource?.crack_out_cause
                      ? `Cause: ${String(crackSource.crack_out_cause)}. `
                      : ""}
                    {crackSource?.crack_out_notes
                      ? String(crackSource.crack_out_notes)
                      : ""}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-slate-700/80 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/90 backdrop-blur-xl shadow-[0_28px_80px_rgba(15,23,42,0.9)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-slate-50">
              <span className="flex flex-col">
                <span className="text-xs tracking-[0.2em] uppercase text-slate-400">
                  Glass Guardian
                </span>
                <span className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5 text-cyan-300" />
                  {invoiceReady && (isPaid || insuranceMode)
                    ? "Invoice Receipt"
                    : "Review & Pay Invoice"}
                </span>
              </span>

              <Badge
                className={
                  invoiceReady && (isPaid || insuranceMode)
                    ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/70"
                    : "bg-amber-500/15 text-amber-200 border-amber-300/70"
                }
              >
                {invoiceReady
                  ? insuranceMode
                    ? "COVERED"
                    : String(invoice!.status ?? "").toUpperCase()
                  : "LOADING"}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent>
            {softLoading ? (
              <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-2">
                    <SkeletonLine w="w-40" />
                    <SkeletonLine w="w-64" />
                    <SkeletonLine w="w-44" />
                  </div>
                  <div className="md:text-right space-y-2">
                    <SkeletonLine w="w-24" />
                    <div className="h-10 w-44 rounded-xl bg-slate-800/80 animate-pulse" />
                    <SkeletonLine w="w-36" />
                  </div>
                </div>
                <SkeletonBlock h="h-11" />
                <SkeletonBlock h="h-40" />
                <SkeletonBlock h="h-28" />
                <div className="h-11 w-full rounded-xl bg-slate-800/80 animate-pulse" />
              </div>
            ) : invoiceReady ? (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">
                      Invoice #{invoice!.invoice_number}
                    </p>
                    <p className="text-lg font-semibold text-slate-50">
                      {invoice!.customer_name ||
                        invoice!.customer_email ||
                        "Customer"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Service date: {serviceDate ?? "—"}
                    </p>

                    {insuranceMode && (
                      <p className="mt-1 text-[11px] text-emerald-200/90">
                        Insurance marked to pay the service total — no customer
                        payment required.
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      {insuranceMode
                        ? "Customer Due"
                        : isPaid
                        ? "Total Paid"
                        : "Total Due"}
                    </p>

                    <p className="text-3xl font-extrabold text-emerald-300">
                      ${centsToDollars(headlineTotalCents)}
                    </p>

                    {depositAppliedCents > 0 && !insuranceMode && (
                      <p className="text-[11px] text-emerald-200 mt-1">
                        Includes -${centsToDollars(depositAppliedCents)} deposit
                        applied
                      </p>
                    )}

                    {!isPaid && processingFeeCents > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Includes $3.00 processing fee
                      </p>
                    )}

                    {!insuranceMode &&
                      !isPaid &&
                      promoApplied?.ok &&
                      promoDiscountCents > 0 && (
                        <p className="text-[11px] text-emerald-200 mt-1">
                          Promo applied:{" "}
                          <span className="font-semibold">
                            {promoApplied.code}
                          </span>{" "}
                          (−${centsToDollars(promoDiscountCents)})
                        </p>
                      )}

                    {insuranceMode && (
                      <p className="text-[11px] text-slate-300 mt-1">
                        Service covered: ${centsToDollars(insuranceCoveredCents)}
                      </p>
                    )}

                    {!insuranceMode && isPaid && invoice?.payment_method && (
                      <p className="text-[11px] text-slate-300 mt-1">
                        Paid via{" "}
                        {String(invoice.payment_method).replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </div>

                {vehicle ? (
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-300 bg-slate-900/70 border border-slate-700/80 rounded-xl px-3 py-2">
                    <Car className="w-4 h-4 text-cyan-300" />
                    <span>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {vehicle.license_plate
                        ? ` · Plate ${vehicle.license_plate}`
                        : ""}
                      {vehicle.color ? ` · ${vehicle.color}` : ""}
                    </span>
                  </div>
                ) : vehicleSoftLoading ? (
                  <div className="mt-1 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="h-3 w-64 rounded-full bg-slate-800/80 animate-pulse" />
                  </div>
                ) : null}

                {invoice!.windshield_repairs_json &&
                  invoice!.windshield_repairs_json.length > 0 && (
                    <div className="mt-4">
                      <WindshieldRepairMap invoice={invoice as any} readOnly />
                    </div>
                  )}

                {!isPaid && !insuranceMode && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-cyan-300" />
                        <p className="text-sm font-semibold text-slate-100">
                          Apply promo code
                        </p>
                      </div>

                      {promoApplied?.ok ? (
                        <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-400/70">
                          {promoApplied.code}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800/60 text-slate-200 border-slate-600/70">
                          Optional
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <Input
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Enter code (e.g. WINTER10)"
                        className="bg-slate-950/50 border-slate-700 text-slate-100 placeholder:text-slate-500"
                        disabled={promoLoading || !!promoApplied?.ok}
                      />
                      {!promoApplied?.ok ? (
                        <Button
                          onClick={applyPromo}
                          disabled={promoLoading}
                          className="bg-slate-50 text-slate-950 hover:bg-white font-semibold"
                        >
                          {promoLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Checking…
                            </>
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={removePromo}
                          className="border-slate-700 bg-slate-950/40 text-slate-100 hover:bg-slate-900"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>

                    {promoApplied?.ok && promoApplied.description && (
                      <p className="mt-2 text-[11px] text-slate-300">
                        {promoApplied.description}
                      </p>
                    )}
                    {promoError && (
                      <p className="mt-2 text-[11px] text-red-300">
                        {promoError}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-2 rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 space-y-2 text-sm text-slate-100">
                  <div className="flex items-center justify-between">
                    <span>Glass</span>
                    <span className="font-semibold">
                      $
                      {Number(
                        (invoice!.services_json as any)?.glass_total ?? 0
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Miscellaneous</span>
                    <span className="font-semibold">
                      $
                      {Number(
                        (invoice!.services_json as any)?.misc_total ?? 0
                      ).toFixed(2)}
                    </span>
                  </div>

                  <Separator className="my-2 border-slate-700/80" />

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Subtotal</span>
                    <span className="font-semibold">
                      ${centsToDollars(invoice!.subtotal_cents)}
                    </span>
                  </div>

                  {insuranceMode ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Insurance Covered</span>
                      <span className="font-semibold text-emerald-300">
                        -${centsToDollars(insuranceCoveredCents)}
                      </span>
                    </div>
                  ) : invoice!.discount_cents > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">
                        Discount{" "}
                        {invoice!.discount_percent
                          ? `(${invoice!.discount_percent}%)`
                          : ""}
                      </span>
                      <span className="font-semibold text-emerald-300">
                        -${centsToDollars(invoice!.discount_cents)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">
                      Tax{" "}
                      {invoice!.tax_rate_percent
                        ? `(${invoice!.tax_rate_percent}%)`
                        : ""}
                    </span>
                    <span className="font-semibold">
                      +${centsToDollars(invoice!.tax_cents)}
                    </span>
                  </div>

                  <Separator className="my-2 border-slate-700/80" />

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Service Total</span>
                    <span className="font-semibold">
                      ${centsToDollars(serviceTotalBeforeCoverageCents)}
                    </span>
                  </div>

                  {depositAppliedCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Deposit Applied</span>
                      <span className="font-semibold text-emerald-300">
                        -${centsToDollars(depositAppliedCents)}
                      </span>
                    </div>
                  )}

                  {!isPaid && processingFeeCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Processing Fee</span>
                      <span className="font-semibold">
                        +${centsToDollars(processingFeeCents)}
                      </span>
                    </div>
                  )}

                  {!insuranceMode &&
                    !isPaid &&
                    promoApplied?.ok &&
                    promoDiscountCents > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          Promo ({promoApplied.code})
                        </span>
                        <span className="font-semibold text-emerald-300">
                          -${centsToDollars(promoDiscountCents)}
                        </span>
                      </div>
                    )}

                  <Separator className="my-2 border-slate-700/80" />

                  <div className="flex items-center justify-between text-lg">
                    <span className="font-bold text-slate-50">
                      {insuranceMode
                        ? "Customer Due"
                        : isPaid
                        ? "Amount Paid"
                        : "Amount Due"}
                    </span>

                    <span className="font-extrabold text-emerald-300 text-2xl">
                      $
                      {centsToDollars(
                        insuranceMode
                          ? 0
                          : isPaid
                          ? amountPaidCents
                          : shownCustomerDueCents
                      )}
                    </span>
                  </div>

                  {insuranceMode && (
                    <div className="pt-2 text-[11px] text-slate-300">
                      Insurance covered the service amount. No online payment is
                      required.
                    </div>
                  )}

                  {!insuranceMode && isPaid && invoice?.payment_method && (
                    <div className="pt-2 text-[11px] text-slate-300">
                      Payment method on file:{" "}
                      {String(invoice.payment_method).replace(/_/g, " ")}
                    </div>
                  )}
                </div>

                {warrantyEnd && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-start gap-3 text-xs text-emerald-100">
                    <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-300" />
                    <div>
                      <p className="font-semibold">Windshield Repair Warranty</p>
                      <p>
                        Your repair (service date{" "}
                        <span className="font-semibold">{serviceDate ?? "—"}</span>
                        ) is covered through{" "}
                        <span className="font-semibold">{warrantyEnd}</span>.
                        Keep this invoice for your records.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="text-[11px] text-slate-400">
                    {insuranceMode
                      ? "Insurance is covering this service. No payment is required."
                      : isPaid
                      ? "This invoice has been paid and is locked for changes."
                      : "Once you complete your secure online payment, this invoice will be marked as paid."}
                  </div>

                  {!isPaid && !insuranceMode && (
                    <Button
                      className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold shadow-[0_16px_40px_rgba(45,212,191,0.65)]"
                      onClick={handleStripePay}
                      disabled={stripeLoading || promoLoading}
                    >
                      {stripeLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting to Stripe…
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Pay with Stripe
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {stripeError && (
                  <p className="mt-2 text-xs text-red-300">{stripeError}</p>
                )}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center gap-3 text-slate-200">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Loading invoice
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}