// app/tech/(protected)/dashboard/invoices/invoice/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Mail,
  Printer,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  Sparkles,
  Loader2,
  FileText,
  Send,
  CheckCircle,
  TriangleAlert,
  Camera,
} from "lucide-react";

import { ServicesPerformed } from "@/components/tech/invoice/ServicesPerformed";
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";
import { InvoiceVehicleSection } from "@/components/tech/invoice/InvoiceVehicleSection";

/* ---------- Types ---------- */

type Appointment = {
  id: string;
  customer_email: string | null;
  vehicle_id: string | null;
  service_type: string | null;
  damage_size: string | null;
  damage_description: string | null;
  service_address: string | null;
  location_type: string | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  notes_customer: string | null;
  coupon_code: string | null;
  status: string | null;
  estimate_amount: number | null;
  final_amount: number | null;
  created_at: string | null;
  technician_email: string | null;
  warranty_id: string | null;

  repair_outcome: "completed" | "crack_out" | null;
  crack_out_occurred: boolean | null;
  crack_out_cause: string | null;
  crack_out_notes: string | null;
  crack_out_photo_url: string | null;
  crack_out_at: string | null;
  replacement_required: boolean | null;

  replacement_completed?: boolean | null;
  replacement_completed_at?: string | null;
  replacement_notes?: string | null;
};

type TechInvoice = {
  id: string;
  invoice_number?: string | null;

  services_json: any | null;
  windshield_repairs_json: any[] | null;

  technician_email: string | null;
  vehicle_id: string | null;

  customer_email?: string | null;
  customer_name?: string | null;
  service_address?: string | null;
  appointment_snapshot?: any | null;

  invoice_date: string | null;
  status: string | null;

  discount_percent?: number | null;
  discount_cents?: number | null;
  tax_rate_percent?: number | null;
  tax_cents?: number | null;
  subtotal_cents?: number | null;
  total_cents?: number | null;

  repair_outcome?: string | null;
  crack_out_occurred?: boolean | null;
  crack_out_at?: string | null;
  crack_out_cause?: string | null;
  crack_out_notes?: string | null;
  crack_out_photo_url?: string | null;
  replacement_required?: boolean | null;
  replacement_status?: string | null;
  crack_out_media_urls?: any | null;
};

/* ---------- Helpers ---------- */

function addYears(dateStr: string | null | undefined, years: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}

function prettyCause(cause: string | null | undefined) {
  if (!cause) return "Not specified";
  const map: Record<string, string> = {
    pre_existing_stress: "Pre-existing stress / pressure",
    damage_too_deep: "Damage too deep",
    edge_crack: "Edge crack / near edge",
    temperature_stress: "Temperature stress",
    unknown: "Unknown",
  };
  return map[cause] ?? cause.replace(/_/g, " ");
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function isUuidLike(v: any) {
  const s = String(v ?? "").trim();
  return s.includes("-") && s.length >= 32;
}

function buildCrackMediaUrlsFromInvoice(inv: TechInvoice | null | undefined) {
  const anyArr = inv?.crack_out_media_urls;
  if (Array.isArray(anyArr) && anyArr.length) return anyArr;
  if (inv?.crack_out_photo_url) return [inv.crack_out_photo_url];
  return null;
}

function isCrackOutFromInvoice(inv: TechInvoice | null | undefined) {
  return inv?.crack_out_occurred === true || String(inv?.repair_outcome ?? "") === "crack_out";
}

/* ---------- Main component ---------- */

export default function TechInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id as string | undefined;
  const queryClient = useQueryClient();

  const INVOICES_ROUTE = "/tech/dashboard/invoices";

  const [totalsSnapshot, setTotalsSnapshot] = React.useState<{
    subtotalDollars: number;
    discountDollars: number;
    taxDollars: number;
    totalDollars: number;
  } | null>(null);

  /* --------- Load tech_invoice by ID (PRIMARY) --------- */
  const {
    data: techInvoice,
    isLoading: loadingInvoice,
    error: invoiceErr,
  } = useQuery<TechInvoice | null>({
    queryKey: ["tech-invoice-by-id", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");

      const res = await supabaseClient
        .from("tech_invoices")
        .select(
          [
            "id",
            "invoice_number",
            "services_json",
            "windshield_repairs_json",
            "technician_email",
            "vehicle_id",
            "customer_email",
            "customer_name",
            "service_address",
            "appointment_snapshot",
            "invoice_date",
            "status",
            "subtotal_cents",
            "discount_percent",
            "discount_cents",
            "tax_rate_percent",
            "tax_cents",
            "total_cents",
            "repair_outcome",
            "crack_out_occurred",
            "crack_out_at",
            "crack_out_cause",
            "crack_out_notes",
            "crack_out_photo_url",
            "replacement_required",
            "replacement_status",
            "crack_out_media_urls",
          ].join(",")
        )
        .eq("id", invoiceId)
        .maybeSingle();

      if (res.error) throw res.error;
      return (res.data ?? null) as unknown as TechInvoice | null;
    },
    staleTime: 10_000,
  });

  // Optional: try to load appointment if invoice_number is an appointment UUID
  const linkedAppointmentId = React.useMemo(() => {
    const cand = techInvoice?.invoice_number;
    return isUuidLike(cand) ? String(cand) : null;
  }, [techInvoice?.invoice_number]);

  const {
    data: appointment,
    isLoading: loadingAppt,
  } = useQuery<Appointment | null>({
    queryKey: ["appointment-for-invoice-optional", linkedAppointmentId],
    enabled: !!linkedAppointmentId,
    queryFn: async () => {
      if (!linkedAppointmentId) return null;

      const res = await supabaseClient
        .from("appointments")
        .select(
          [
            "id",
            "customer_email",
            "vehicle_id",
            "service_type",
            "damage_size",
            "damage_description",
            "service_address",
            "location_type",
            "scheduled_date",
            "scheduled_time_start",
            "scheduled_time_end",
            "notes_customer",
            "coupon_code",
            "status",
            "estimate_amount",
            "final_amount",
            "created_at",
            "technician_email",
            "warranty_id",
            "repair_outcome",
            "crack_out_occurred",
            "crack_out_cause",
            "crack_out_notes",
            "crack_out_photo_url",
            "crack_out_at",
            "replacement_required",
            "replacement_completed",
            "replacement_completed_at",
            "replacement_notes",
          ].join(",")
        )
        .eq("id", linkedAppointmentId)
        .maybeSingle();

      // If appointment doesn't exist, don't break invoice page
      if (res.error) {
        console.warn("[InvoiceDetail] optional appointment load failed:", res.error);
        return null;
      }

      return (res.data ?? null) as unknown as Appointment | null;
    },
    staleTime: 10_000,
  });

  const isCrackOut = isCrackOutFromInvoice(techInvoice);
  const replacementRequired =
    !!techInvoice?.replacement_required || isCrackOut || !!appointment?.replacement_required;

  /* --------- Stable invoice object for children --------- */
  const effectiveInvoice: TechInvoice | null = React.useMemo(() => {
    if (!techInvoice) return null;

    return {
      ...techInvoice,
      discount_percent: techInvoice.discount_percent ?? null,
      discount_cents: techInvoice.discount_cents ?? 0,
      tax_rate_percent: techInvoice.tax_rate_percent ?? null,
      tax_cents: techInvoice.tax_cents ?? 0,
      subtotal_cents: techInvoice.subtotal_cents ?? 0,
      total_cents: techInvoice.total_cents ?? 0,
      crack_out_occurred: techInvoice.crack_out_occurred ?? false,
      crack_out_notes: techInvoice.crack_out_notes ?? null,
      crack_out_media_urls: techInvoice.crack_out_media_urls ?? null,
    };
  }, [techInvoice]);

  /* --------- Capture totals from ServicesPerformed --------- */
  const handleTotalsChange = React.useCallback((totals: any) => {
    setTotalsSnapshot((prev) => {
      const next = {
        subtotalDollars: totals.subtotalDollars ?? 0,
        discountDollars: totals.discountDollars ?? 0,
        taxDollars: totals.taxDollars ?? 0,
        totalDollars:
          totals.totalDollars ??
          ((totals.subtotalDollars ?? 0) -
            (totals.discountDollars ?? 0) +
            (totals.taxDollars ?? 0)),
      };

      if (
        prev &&
        prev.subtotalDollars === next.subtotalDollars &&
        prev.discountDollars === next.discountDollars &&
        prev.taxDollars === next.taxDollars &&
        prev.totalDollars === next.totalDollars
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const computeMoneyFromSnapshot = React.useCallback(() => {
    const subtotal_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.subtotalDollars * 100)
        : effectiveInvoice?.subtotal_cents ?? 0;

    const discount_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.discountDollars * 100)
        : effectiveInvoice?.discount_cents ?? 0;

    const tax_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.taxDollars * 100)
        : effectiveInvoice?.tax_cents ?? 0;

    const total_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.totalDollars * 100)
        : effectiveInvoice?.total_cents ?? 0;

    return { subtotal_cents, discount_cents, tax_cents, total_cents };
  }, [
    totalsSnapshot,
    effectiveInvoice?.subtotal_cents,
    effectiveInvoice?.discount_cents,
    effectiveInvoice?.tax_cents,
    effectiveInvoice?.total_cents,
  ]);

  /* --------- Send Invoice (invoice-based) --------- */
  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      if (!effectiveInvoice?.id) throw new Error("Missing invoice record");

      const todayIso = new Date().toISOString().split("T")[0];
      const { subtotal_cents, discount_cents, tax_cents, total_cents } =
        computeMoneyFromSnapshot();

      const res = await supabaseClient
        .from("tech_invoices")
        .update({
          invoice_date: effectiveInvoice.invoice_date ?? todayIso,
          status: "sent",
          subtotal_cents,
          discount_percent: effectiveInvoice.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
          tax_cents,
          total_cents,

          repair_outcome:
            effectiveInvoice.repair_outcome ?? (isCrackOut ? "crack_out" : "completed"),
          crack_out_occurred: isCrackOut,
          crack_out_at: effectiveInvoice.crack_out_at ?? null,
          crack_out_cause: effectiveInvoice.crack_out_cause ?? null,
          crack_out_notes: effectiveInvoice.crack_out_notes ?? null,
          crack_out_photo_url: effectiveInvoice.crack_out_photo_url ?? null,
          replacement_required: effectiveInvoice.replacement_required ?? false,
          crack_out_media_urls: buildCrackMediaUrlsFromInvoice(effectiveInvoice),
        })
        .eq("id", invoiceId);

      if (res.error) throw res.error;
      return { ok: true };
    },
  });

  /* --------- Mark Paid (invoice-based) --------- */
  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      if (!effectiveInvoice?.id) throw new Error("Missing invoice record");

      const todayIso = new Date().toISOString().split("T")[0];
      const { subtotal_cents, discount_cents, tax_cents, total_cents } =
        computeMoneyFromSnapshot();

      const invRes = await supabaseClient
        .from("tech_invoices")
        .update({
          invoice_date: effectiveInvoice.invoice_date ?? todayIso,
          status: "paid",
          subtotal_cents,
          discount_percent: effectiveInvoice.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
          tax_cents,
          total_cents,

          repair_outcome:
            effectiveInvoice.repair_outcome ?? (isCrackOut ? "crack_out" : "completed"),
          crack_out_occurred: isCrackOut,
          crack_out_at: effectiveInvoice.crack_out_at ?? null,
          crack_out_cause: effectiveInvoice.crack_out_cause ?? null,
          crack_out_notes: effectiveInvoice.crack_out_notes ?? null,
          crack_out_photo_url: effectiveInvoice.crack_out_photo_url ?? null,
          replacement_required: effectiveInvoice.replacement_required ?? false,
          crack_out_media_urls: buildCrackMediaUrlsFromInvoice(effectiveInvoice),
        })
        .eq("id", invoiceId);

      if (invRes.error) throw invRes.error;

      // OPTIONAL: if it’s linked to a real appointment, mirror paid status
      if (appointment?.id) {
        const apptRes = await supabaseClient
          .from("appointments")
          .update({ status: "paid", final_amount: total_cents / 100 })
          .eq("id", appointment.id);

        if (apptRes.error) throw apptRes.error;
      }

      return { ok: true };
    },
  });

  /* ---------- Top-level loading / error ---------- */

  const isLoading = loadingInvoice || loadingAppt;

  if (isLoading && !techInvoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden print:bg-white">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/40 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-sky-600/40 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4 text-slate-100">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-300" />
          <p className="text-sm tracking-[0.25em] uppercase text-slate-400">
            Loading invoice
          </p>
        </div>
      </div>
    );
  }

  if (invoiceErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 print:bg-white">
        <Card className="max-w-md w-full border border-red-500/40 bg-slate-900/90 text-slate-50 shadow-[0_18px_60px_rgba(248,113,113,0.35)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-200">
              Invoice Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              There was an issue loading this invoice. Please try again or check Supabase permissions.
            </p>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-100"
              onClick={() => router.push(INVOICES_ROUTE)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!techInvoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 print:bg-white">
        <Card className="max-w-md w-full border border-slate-700 bg-slate-900/90 text-slate-50 shadow-2xl">
          <CardHeader>
            <CardTitle>Invoice Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              We couldn&apos;t find that invoice. It may have been removed or the link is incorrect.
            </p>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-100"
              onClick={() => router.push(INVOICES_ROUTE)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoiceDate = techInvoice.invoice_date ?? null;
  const status = techInvoice.status ?? "unknown";
  const warrantyEnd = addYears(invoiceDate, 1);

  const snapshot = techInvoice.appointment_snapshot ?? {};
  const billEmail = techInvoice.customer_email ?? snapshot.customer_email ?? null;

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 print:bg-white print:p-4 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80 print:hidden">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(30,64,175,0.9),transparent_55%)]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Actions */}
        <div className="flex items-center justify-between mb-2 print:hidden">
          <Button
            variant="outline"
            onClick={() => router.push(INVOICES_ROUTE)}
            className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>

          <div className="flex items-center gap-3">
            <Badge
              className={[
                "border text-xs px-3 py-1 tracking-[0.18em] uppercase",
                status === "paid"
                  ? "bg-emerald-500/10 text-emerald-200 border-emerald-400/60"
                  : "bg-amber-500/10 text-amber-200 border-amber-300/70",
              ].join(" ")}
            >
              {String(status).toUpperCase()}
            </Badge>

            {isCrackOut && (
              <Badge className="bg-amber-500/90 text-slate-950 border border-amber-200 text-xs px-3 py-1 tracking-[0.18em] uppercase">
                <TriangleAlert className="w-3.5 h-3.5 mr-1" />
                CRACK-OUT
              </Badge>
            )}

            <Button
              onClick={() => window.print()}
              className="bg-slate-900/80 border border-slate-600 text-slate-50 hover:bg-slate-800"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Crack-out banner (invoice-first, appointment optional) */}
        {isCrackOut && (
          <Card className="border border-amber-400/60 bg-gradient-to-br from-amber-500/15 via-slate-900/70 to-amber-700/20 backdrop-blur-2xl shadow-[0_24px_80px_rgba(251,191,36,0.35)] print:bg-white print:border-amber-300 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-100 print:text-amber-900">
                <TriangleAlert className="w-5 h-5 text-amber-300" />
                Crack-out Reported During Repair
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-100 print:text-slate-800">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold text-amber-200 print:text-amber-900">
                      Replacement Required:
                    </span>{" "}
                    <span className="font-semibold">{replacementRequired ? "Yes" : "No"}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Cause:</span>{" "}
                    {prettyCause(techInvoice.crack_out_cause ?? appointment?.crack_out_cause)}
                  </p>
                  <p className="text-xs text-slate-300 print:text-slate-700">
                    Reported at: {fmtDateTime(techInvoice.crack_out_at ?? appointment?.crack_out_at) ?? "N/A"}
                  </p>

                  {(techInvoice.crack_out_notes ?? appointment?.crack_out_notes) && (
                    <div className="rounded-lg border border-amber-400/30 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80 mb-1">
                        Notes
                      </p>
                      <p className="text-sm text-slate-100 print:text-slate-800">
                        {techInvoice.crack_out_notes ?? appointment?.crack_out_notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">
                      Photo Evidence
                    </p>
                    {(techInvoice.crack_out_photo_url ?? appointment?.crack_out_photo_url) ? (
                      <Badge className="bg-emerald-500 text-slate-950">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Saved
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500 text-slate-950">
                        <Camera className="w-3.5 h-3.5 mr-1" />
                        Missing
                      </Badge>
                    )}
                  </div>

                  {(techInvoice.crack_out_photo_url ?? appointment?.crack_out_photo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={techInvoice.crack_out_photo_url ?? appointment?.crack_out_photo_url ?? ""}
                      alt="Crack-out photo"
                      className="w-full max-h-64 object-cover rounded-xl border border-slate-700/70"
                    />
                  ) : (
                    <div className="rounded-xl border border-amber-400/30 bg-slate-950/40 p-4 text-sm text-slate-200">
                      No crack-out photo found on this invoice.
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-amber-100/80 print:text-amber-800">
                This invoice will show crack-out status so replacement can be processed smoothly while the service remains paid.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <Card className="border border-slate-700/80 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/90 backdrop-blur-xl shadow-[0_28px_80px_rgba(15,23,42,0.9)] print:bg-white print:border-slate-200 print:shadow-none">
          <CardContent className="p-6 md:p-8">
            <div className="grid md:grid-cols-[1.8fr_1.4fr] gap-8 items-start">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ rotateX: 25, rotateY: -25, opacity: 0 }}
                    animate={{ rotateX: 0, rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 shadow-[0_18px_45px_rgba(56,189,248,0.7)] flex items-center justify-center overflow-hidden"
                  >
                    <div className="absolute inset-1 rounded-xl bg-slate-950/70 backdrop-blur-xl border border-cyan-200/70" />
                    <div className="relative w-10 h-8 border-2 border-cyan-300/80 rounded-t-[1.2rem] rounded-b-lg bg-gradient-to-b from-sky-400/40 to-slate-900/80 shadow-[0_10px_25px_rgba(15,23,42,0.8)]" />
                  </motion.div>
                  <div className="space-y-1">
                    <p className="text-[0.7rem] tracking-[0.25em] uppercase text-cyan-200/80">
                      Glass Guardian
                    </p>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-50 leading-tight">
                      Chip &amp; Crack Repair
                    </h1>
                    <p className="text-xs text-slate-400">
                      Mobile windshield specialists · Rock chip &amp; crack stabilization
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-300 print:text-slate-700">
                  <p>Serving: Wasatch Front &amp; surrounding areas</p>
                  <p>Phone: (555) 555-0199 · Email: support@glassguardian.com</p>
                  <p>Web: glassguardianchipandcrackrepair.com</p>
                </div>
              </div>

              <div className="md:text-right space-y-4">
                <div className="inline-flex md:flex md:flex-col items-start md:items-end gap-2">
                  <p className="text-[0.65rem] font-semibold text-slate-400 tracking-[0.22em] uppercase">
                    Invoice
                  </p>
                  <p className="text-xl md:text-2xl font-extrabold text-slate-50 md:leading-none">
                    #{techInvoice.invoice_number ?? techInvoice.id}
                  </p>
                </div>

                <div className="flex md:justify-end flex-wrap gap-3 text-xs md:text-sm text-slate-200 print:text-slate-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-sky-300" />
                    <span>
                      Invoice Date:{" "}
                      <span className="font-semibold text-slate-50 print:text-slate-900">
                        {invoiceDate || "TBD"}
                      </span>
                    </span>
                  </span>

                  {!isCrackOut && warrantyEnd && (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>
                        Warranty Through{" "}
                        <span className="font-semibold text-emerald-300 print:text-emerald-700">
                          {warrantyEnd}
                        </span>
                      </span>
                    </span>
                  )}
                </div>

                <Separator className="my-3 border-slate-700/70 md:ml-auto md:w-64 print:border-slate-200" />

                <div className="space-y-1 text-xs md:text-sm text-slate-200 print:text-slate-800">
                  <p className="text-[0.65rem] tracking-[0.2em] uppercase text-slate-400">
                    Technician
                  </p>
                  <p className="font-semibold">{techInvoice.technician_email || "Technician"}</p>
                  <p className="text-slate-400 text-xs">
                    Thank you for trusting Glass Guardian with your vehicle.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parties */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.8)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                Bill To
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-100 print:text-slate-800">
              <p className="text-lg font-bold text-slate-50 print:text-slate-900">
                {techInvoice.customer_name || billEmail || "Customer"}
              </p>

              <div className="text-sm space-y-1">
                {(techInvoice.service_address || snapshot.service_address) && (
                  <p className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-slate-400 print:text-slate-500" />
                    <span>{techInvoice.service_address || snapshot.service_address}</span>
                  </p>
                )}

                {billEmail && (
                  <p className="flex items-center gap-2 break-all">
                    <Mail className="w-4 h-4 text-slate-400 print:text-slate-500" />
                    <span>{billEmail}</span>
                  </p>
                )}
              </div>

              {(snapshot.notes_customer || snapshot.damage_description) && (
                <p className="text-xs text-slate-400 mt-2">
                  Notes: {snapshot.notes_customer || snapshot.damage_description}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Vehicle section: prefer appointment id, fall back to invoice vehicle_id */}
          {appointment?.id ? (
            <InvoiceVehicleSection
              appointmentId={appointment.id}
              customerEmail={appointment.customer_email}
              currentVehicleId={appointment.vehicle_id}
            />
          ) : (
            <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.8)] print:bg-white print:border-slate-200 print:shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-50 print:text-slate-900">
                  Vehicle
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-200 print:text-slate-800 space-y-2">
                <p className="text-slate-300">
                  No appointment linked to this invoice.
                </p>
                <p>
                  <span className="text-slate-400">Vehicle ID:</span>{" "}
                  <span className="font-semibold">{techInvoice.vehicle_id ?? "—"}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Services */}
        {effectiveInvoice && (
          <ServicesPerformed
            invoice={{
              id: effectiveInvoice.id,
              services_json: effectiveInvoice.services_json ?? null,
              discount_percent: effectiveInvoice.discount_percent ?? null,
              discount_cents: effectiveInvoice.discount_cents ?? 0,
              tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
              tax_cents: effectiveInvoice.tax_cents ?? 0,
              subtotal_cents: effectiveInvoice.subtotal_cents ?? 0,
            }}
            onTotalsChange={handleTotalsChange}
          />
        )}

        {/* Map */}
        {effectiveInvoice && <WindshieldRepairMap invoice={effectiveInvoice as any} />}

        {/* Repair Details (from snapshot) */}
        <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.9)] print:bg-white print:border-slate-200 print:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
              <FileText className="w-4 h-4 text-sky-300" />
              Repair Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-100 print:text-slate-800">
            {snapshot.damage_description ? (
              <p>
                <span className="font-semibold">Damage:</span> {snapshot.damage_description}
              </p>
            ) : (
              <p className="text-slate-300 print:text-slate-700">
                No repair notes recorded on this invoice.
              </p>
            )}
            {snapshot.damage_size && (
              <p>
                <span className="font-semibold">Size:</span> {snapshot.damage_size}
              </p>
            )}
            {snapshot.location_type && (
              <p>
                <span className="font-semibold">Location Type:</span> {snapshot.location_type}
              </p>
            )}
            {snapshot.service_type && (
              <p>
                <span className="font-semibold">Service Type:</span> {snapshot.service_type}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Send / Paid */}
        {effectiveInvoice && (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_20px_60px_rgba(15,23,42,0.85)] print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-slate-50">
                <Send className="w-4 h-4 text-emerald-300" />
                Send Invoice (Tech → User)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-slate-200">
              <p className="text-xs md:text-sm text-slate-300 max-w-xl">
                Enter services and map the repair, then{" "}
                <span className="font-semibold text-emerald-300">Send Invoice</span>{" "}
                or <span className="font-semibold text-emerald-300">Mark Paid &amp; Send</span>.
              </p>

              <div className="flex flex-col items-stretch gap-1">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    disabled={sendInvoiceMutation.isPending || markPaidMutation.isPending}
                    onClick={async () => {
                      try {
                        await sendInvoiceMutation.mutateAsync();
                        setTimeout(() => {
                          queryClient.invalidateQueries({ queryKey: ["tech-invoice-by-id", invoiceId] });
                          queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
                        }, 0);
                        router.replace(INVOICES_ROUTE);
                      } catch (e) {
                        console.error("[SendInvoice] failed:", e);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold shadow-[0_16px_40px_rgba(45,212,191,0.65)]"
                  >
                    {sendInvoiceMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending Invoice…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Invoice
                      </>
                    )}
                  </Button>

                  <Button
                    disabled={sendInvoiceMutation.isPending || markPaidMutation.isPending}
                    onClick={async () => {
                      try {
                        await markPaidMutation.mutateAsync();
                        setTimeout(() => {
                          queryClient.invalidateQueries({ queryKey: ["tech-invoice-by-id", invoiceId] });
                          queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
                        }, 0);
                        router.replace(INVOICES_ROUTE);
                      } catch (e) {
                        console.error("[MarkPaid] failed:", e);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-slate-50 font-semibold shadow-[0_16px_40px_rgba(45,212,191,0.75)]"
                  >
                    {markPaidMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Marking Paid…
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Mark Paid &amp; Send
                      </>
                    )}
                  </Button>
                </div>

                {sendInvoiceMutation.isError && (
                  <span className="text-xs text-red-400">
                    Failed to update <code>tech_invoices</code> as sent.
                  </span>
                )}
                {markPaidMutation.isError && (
                  <span className="text-xs text-red-400">
                    Failed to mark invoice as paid.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warranty */}
        {!isCrackOut && (
          <Card className="border border-emerald-500/50 bg-gradient-to-br from-emerald-500/15 via-slate-900/80 to-emerald-700/30 backdrop-blur-2xl shadow-[0_24px_80px_rgba(16,185,129,0.7)] print:bg-white print:border-emerald-300 print:shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                Windshield Repair Warranty
              </CardTitle>
              {invoiceDate && warrantyEnd && (
                <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/70 text-[11px] print:bg-emerald-100 print:text-emerald-800">
                  {invoiceDate} → {warrantyEnd}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-xs md:text-sm text-emerald-50 print:text-emerald-900">
              <p>
                This invoice serves as your official Glass Guardian warranty record for the windshield repair performed on the vehicle listed above.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="hidden print:block text-center text-[10px] text-slate-500 mt-4">
          Glass Guardian Chip &amp; Crack Repair — {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}