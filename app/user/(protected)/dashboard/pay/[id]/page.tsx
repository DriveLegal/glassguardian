// app/user/(protected)/dashboard/pay/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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

  // historically used as "service date" in UI (can be date-only or timestamp)
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

// ✅ $3 flat processing fee (in cents)
const PROCESSING_FEE_CENTS = 300;

const centsToDollars = (c: number | null | undefined) => ((c || 0) / 100).toFixed(2);

/**
 * Fixes off-by-one day bug caused by UTC ↔ local conversions.
 * - If already "YYYY-MM-DD", keep exactly.
 * - If timestamp, convert to LOCAL date-only.
 */
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

function addYearsDateOnly(dateOnly: string | null | undefined, years: number): string | null {
  if (!dateOnly) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;

  const [yy, mm, dd] = dateOnly.split("-").map((x) => Number(x));
  if (!yy || !mm || !dd) return null;

  const d = new Date(yy, mm - 1, dd); // local date
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
  return <div className={`h-3 ${w} rounded-full bg-slate-800/80 animate-pulse`} />;
}
function SkeletonBlock({ h = "h-10" }: { h?: string }) {
  return <div className={`${h} w-full rounded-xl bg-slate-800/70 animate-pulse`} />;
}

export default function UserPayInvoicePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;

  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [authState, setAuthState] = React.useState<"checking" | "authed">("checking");

  const [stripeLoading, setStripeLoading] = React.useState(false);
  const [stripeError, setStripeError] = React.useState<string | null>(null);

  // Promo UI state
  const [promoInput, setPromoInput] = React.useState("");
  const [promoLoading, setPromoLoading] = React.useState(false);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [promoApplied, setPromoApplied] = React.useState<PromoPreview | null>(null);

  // ✅ Faster feeling: do auth check, but don’t block invoice query from starting.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      const email = session?.user?.email ?? null;

      if (!email) {
        if (!cancelled) {
          router.replace(`/user/login?redirect=${encodeURIComponent(`/user/dashboard/pay/${invoiceId}`)}`);
        }
        return;
      }

      if (!cancelled) {
        setUserEmail(email);
        setAuthState("authed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, invoiceId]);

  // fetch invoice (starts ASAP, cached + less refetching)
  const {
    data: invoice,
    isLoading: loadingInvoice,
    isFetching: fetchingInvoice,
    error: invoiceErr,
    refetch: refetchInvoice,
  } = useQuery<InvoiceRow | null>({
    queryKey: ["user-pay-invoice", invoiceId],
    enabled: !!invoiceId, // ✅ don’t wait on auth state (faster / uses cache immediately)
    staleTime: 60_000, // ✅ 1 min "fresh" so nav back/forth feels instant
    gcTime: 10 * 60_000, // ✅ keep in cache 10 min
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: (prev) => prev, // ✅ keeps previous data while refetching
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          [
            "id",
            "invoice_number",
            "client_id",
            "vehicle_id",
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

  // ✅ Only run crack-out fallback query if invoice itself has NO crack-related fields populated.
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

  // OPTIONAL fallback: crack-out meta from appointments (gated harder to reduce load)
  const { data: apptCrackMeta } = useQuery<any | null>({
    queryKey: ["invoice-linked-appointment-crack", invoice?.id],
    enabled: !!invoice?.id && shouldFetchCrackFallback,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
    queryFn: async () => {
      try {
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
          // NOTE: if you later have appointment_id on invoices, swap this .eq(...) to that key
          .eq("id", invoice!.id)
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
    crackOut && (crackSource?.replacement_required === true || crackSource?.replacement_required == null);
  const replacementStatus = String(crackSource?.replacement_status ?? "").toLowerCase();

  // vehicle (cached, no refetch spam)
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

  // ✅ Loading feel improvement:
  // - Don’t block the whole page while vehicle fetches.
  // - Show the main invoice card with skeletons while invoice loads.
  const invoiceReady = !!invoice;
  const softLoading = !invoiceReady && (loadingInvoice || fetchingInvoice || authState === "checking");
  const vehicleSoftLoading = !vehicle && (loadingVehicle || fetchingVehicle);

  const isPaid = String(invoice?.status ?? "").toLowerCase() === "paid";

  // ✅ consistent service date for this page + receipt page
  const serviceDate = React.useMemo(() => toLocalDateOnly(invoice?.invoice_date) ?? null, [invoice?.invoice_date]);
  const warrantyEnd = React.useMemo(() => addYearsDateOnly(serviceDate, 1), [serviceDate]);

  // totals
  const baseTotalDueCents = (invoice?.total_cents ?? 0) + PROCESSING_FEE_CENTS;
  const shownTotalDueCents = !isPaid ? promoApplied?.newTotalDueCents ?? baseTotalDueCents : baseTotalDueCents;
  const promoDiscountCents = promoApplied?.discountCents ?? 0;

  // ownership check based on customer_email
  const emailMismatch =
    !!invoice?.customer_email && !!userEmail && invoice.customer_email.toLowerCase() !== userEmail.toLowerCase();

  async function applyPromo() {
    if (!invoice) return;
    if (isPaid) return;

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
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Promo code not valid.");

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
      if (!res.ok) throw new Error(data?.error || "Failed to start Stripe checkout");
      if (!data?.url) throw new Error("No checkout URL returned");

      window.location.href = data.url as string;
    } catch (err: any) {
      console.error("Stripe checkout start error:", err);
      setStripeError(err?.message || "Could not start Stripe checkout. Please try again.");
    } finally {
      setStripeLoading(false);
    }
  }

  function goToReceipt() {
    if (!invoiceId) return;
    router.push(`/user/dashboard/pay/${invoiceId}/receipt`);
  }

  // If user comes back from Stripe, status might already be paid — refresh once (but not too late)
  React.useEffect(() => {
    if (!invoiceId) return;
    const t = setTimeout(() => {
      refetchInvoice().catch(() => {});
    }, 450); // ✅ faster refresh than 900ms
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
            <p className="text-sm">There was a problem loading your invoice. Please try again later.</p>
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

  // If we have invoice + email and it mismatches, block
  if (invoiceReady && userEmail && invoice?.customer_email && emailMismatch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full border border-slate-700 bg-slate-900/90 text-slate-50 shadow-2xl">
          <CardHeader>
            <CardTitle>Invoice Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              This invoice is not available under your account. If you believe this is a mistake, please contact Glass Guardian support.
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

  const amountPaidCents = isPaid ? baseTotalDueCents : 0;
  const remainingCents = isPaid ? 0 : shownTotalDueCents;

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 overflow-hidden">
      {/* BG */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(30,64,175,0.9),transparent_55%)]" />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Top bar (ONLY ONE back button) */}
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="outline"
            onClick={() => router.push("/user/dashboard/pay")}
            className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>

          {/* ONLY print/receipt button (routes to receipt page) */}
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

        {/* Paid completion panel */}
        {invoiceReady && isPaid && (
          <Card className="border border-emerald-400/30 bg-gradient-to-br from-emerald-950/25 via-slate-950 to-slate-950 shadow-[0_26px_90px_rgba(16,185,129,0.12)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3 text-slate-50">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  Payment Complete
                </span>
                <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-400/70">PAID</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <ReceiptText className="w-4 h-4 text-cyan-300" />
                    Invoice
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-50">#{invoice.invoice_number}</div>
                  <div className="mt-1 text-[11px] text-slate-400">Customer: {invoice.customer_name || invoice.customer_email}</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Calendar className="w-4 h-4 text-cyan-300" />
                    Service date
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-50">{serviceDate ?? "—"}</div>
                  <div className="mt-1 text-[11px] text-slate-400">Warranty through: {warrantyEnd ?? "—"}</div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-100/90">
                    <DollarSign className="w-4 h-4 text-emerald-300" />
                    Paid
                  </div>
                  <div className="mt-1 text-2xl font-extrabold text-emerald-200">${centsToDollars(amountPaidCents)}</div>
                  <div className="mt-1 text-[11px] text-emerald-100/80">Remaining: ${centsToDollars(remainingCents)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Crack-out block */}
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
                  We’re genuinely sorry — a crack-out occurred while the repair was being performed. This can happen with pre-stressed glass, but it’s
                  still on us to be transparent and take care of you.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 text-amber-100 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  You will still get the replacement.
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {replacementStatus
                    ? `Replacement status: ${replacementStatus.replace(/_/g, " ")}.`
                    : replacementRequired
                      ? "Our team will coordinate the next available replacement option with you."
                      : "Our team will follow up with next steps shortly."}
                </p>
                {(crackSource?.crack_out_notes || crackSource?.crack_out_cause) && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {crackSource?.crack_out_cause ? `Cause: ${String(crackSource.crack_out_cause)}. ` : ""}
                    {crackSource?.crack_out_notes ? String(crackSource.crack_out_notes) : ""}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main invoice */}
        <Card className="border border-slate-700/80 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/90 backdrop-blur-xl shadow-[0_28px_80px_rgba(15,23,42,0.9)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-slate-50">
              <span className="flex flex-col">
                <span className="text-xs tracking-[0.2em] uppercase text-slate-400">Glass Guardian</span>
                <span className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5 text-cyan-300" />
                  {invoiceReady && isPaid ? "Invoice Receipt" : "Review & Pay Invoice"}
                </span>
              </span>

              <Badge
                className={
                  invoiceReady && isPaid
                    ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/70"
                    : "bg-amber-500/15 text-amber-200 border-amber-300/70"
                }
              >
                {invoiceReady ? String(invoice!.status ?? "").toUpperCase() : "LOADING"}
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
                    <p className="text-xs text-slate-400">Invoice #{invoice!.invoice_number}</p>
                    <p className="text-lg font-semibold text-slate-50">
                      {invoice!.customer_name || invoice!.customer_email || "Customer"}
                    </p>
                    <p className="text-xs text-slate-400">Service date: {serviceDate ?? "—"}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">{isPaid ? "Total Paid" : "Total Due"}</p>
                    <p className="text-3xl font-extrabold text-emerald-300">
                      ${centsToDollars(isPaid ? baseTotalDueCents : shownTotalDueCents)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Includes $3.00 processing fee</p>
                    {!isPaid && promoApplied?.ok && promoDiscountCents > 0 && (
                      <p className="text-[11px] text-emerald-200 mt-1">
                        Promo applied: <span className="font-semibold">{promoApplied.code}</span> (−$
                        {centsToDollars(promoDiscountCents)})
                      </p>
                    )}
                  </div>
                </div>

                {/* Vehicle: don’t block page if it loads slower */}
                {vehicle ? (
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-300 bg-slate-900/70 border border-slate-700/80 rounded-xl px-3 py-2">
                    <Car className="w-4 h-4 text-cyan-300" />
                    <span>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {vehicle.license_plate ? ` · Plate ${vehicle.license_plate}` : ""}
                      {vehicle.color ? ` · ${vehicle.color}` : ""}
                    </span>
                  </div>
                ) : vehicleSoftLoading ? (
                  <div className="mt-1 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="h-3 w-64 rounded-full bg-slate-800/80 animate-pulse" />
                  </div>
                ) : null}

                {invoice!.windshield_repairs_json && invoice!.windshield_repairs_json.length > 0 && (
                  <div className="mt-4">
                    <WindshieldRepairMap invoice={invoice as any} readOnly />
                  </div>
                )}

                {/* Promo Code (only if unpaid) */}
                {!isPaid && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-cyan-300" />
                        <p className="text-sm font-semibold text-slate-100">Apply promo code</p>
                      </div>

                      {promoApplied?.ok ? (
                        <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-400/70">
                          {promoApplied.code}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800/60 text-slate-200 border-slate-600/70">Optional</Badge>
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
                      <p className="mt-2 text-[11px] text-slate-300">{promoApplied.description}</p>
                    )}
                    {promoError && <p className="mt-2 text-[11px] text-red-300">{promoError}</p>}
                  </div>
                )}

                {/* Breakdown */}
                <div className="mt-2 rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 space-y-2 text-sm text-slate-100">
                  <div className="flex items-center justify-between">
                    <span>Glass</span>
                    <span className="font-semibold">${Number((invoice!.services_json as any)?.glass_total ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Miscellaneous</span>
                    <span className="font-semibold">${Number((invoice!.services_json as any)?.misc_total ?? 0).toFixed(2)}</span>
                  </div>

                  <Separator className="my-2 border-slate-700/80" />

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Subtotal</span>
                    <span className="font-semibold">${centsToDollars(invoice!.subtotal_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Discount {invoice!.discount_percent ? `(${invoice!.discount_percent}%)` : ""}</span>
                    <span className="font-semibold text-emerald-300">-${centsToDollars(invoice!.discount_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Tax {invoice!.tax_rate_percent ? `(${invoice!.tax_rate_percent}%)` : ""}</span>
                    <span className="font-semibold">+${centsToDollars(invoice!.tax_cents)}</span>
                  </div>

                  <Separator className="my-2 border-slate-700/80" />

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Service Total</span>
                    <span className="font-semibold">${centsToDollars(invoice!.total_cents)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Processing Fee</span>
                    <span className="font-semibold">+${centsToDollars(PROCESSING_FEE_CENTS)}</span>
                  </div>

                  {!isPaid && promoApplied?.ok && promoDiscountCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Promo ({promoApplied.code})</span>
                      <span className="font-semibold text-emerald-300">-${centsToDollars(promoDiscountCents)}</span>
                    </div>
                  )}

                  <Separator className="my-2 border-slate-700/80" />

                  <div className="flex items-center justify-between text-lg">
                    <span className="font-bold text-slate-50">{isPaid ? "Amount Paid" : "Amount Due"}</span>
                    <span className="font-extrabold text-emerald-300 text-2xl">
                      ${centsToDollars(isPaid ? baseTotalDueCents : shownTotalDueCents)}
                    </span>
                  </div>
                </div>

                {/* Warranty */}
                {warrantyEnd && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-start gap-3 text-xs text-emerald-100">
                    <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-300" />
                    <div>
                      <p className="font-semibold">Windshield Repair Warranty</p>
                      <p>
                        Your repair (service date <span className="font-semibold">{serviceDate ?? "—"}</span>) is covered through{" "}
                        <span className="font-semibold">{warrantyEnd}</span>. Keep this invoice for your records.
                      </p>
                    </div>
                  </div>
                )}

                {/* CTA (pay button only if unpaid) */}
                <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="text-[11px] text-slate-400">
                    {isPaid
                      ? "This invoice has been paid and is locked for changes."
                      : "Once you complete your secure online payment, this invoice will be marked as paid and locked for editing."}
                  </div>

                  {!isPaid && (
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

                {stripeError && <p className="mt-2 text-xs text-red-300">{stripeError}</p>}
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center gap-3 text-slate-200">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Loading invoice</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}