// app/admin/(protected)/portal/invoices/page.tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  DollarSign,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Sparkles,
  FileText,
  ArrowRight,
} from "lucide-react";

import { downloadInvoicePdf } from "@/lib/pdf/invoicePdf";

type AnyObj = Record<string, any>;

/* ---------- Types (tech_invoices table) ---------- */

type AdminTechInvoiceRow = {
  id: string;
  invoice_number: string | null;
  technician_email: string | null;
  client_id: string | null;
  vehicle_id: string | null;

  customer_email: string | null;
  customer_name: string | null;
  service_address: string | null;
  appointment_snapshot: any | null;

  invoice_date: string | null;
  status: string | null;

  services_json: any | null;
  windshield_repairs_json: any | null;

  subtotal_cents: number | null;
  discount_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;

  insurance_due_cents: number | null;
  customer_due_cents: number | null;
  final_paid_cents: number | null;

  payment_method: string | null;
  payment_note: string | null;
  paid_at: string | null;

  created_at: string | null;

  /** client-computed */
  computed_total_cents?: number;
};

/* ---------- Money logic (IMPORTANT) ---------- */
/**
 * Some invoices (especially insurance) store total_cents as 0 when discount wipes subtotal,
 * but the REAL amount due is in insurance_due_cents / customer_due_cents (e.g. 7000 = $70).
 * This function produces the correct "Final" number for display + summaries + PDF.
 */
function effectiveTotalCents(inv: Pick<
  AdminTechInvoiceRow,
  | "final_paid_cents"
  | "total_cents"
  | "insurance_due_cents"
  | "customer_due_cents"
  | "subtotal_cents"
  | "discount_cents"
  | "tax_cents"
>): number {
  const fp = inv.final_paid_cents ?? null;
  if (typeof fp === "number" && Number.isFinite(fp) && fp > 0) return fp;

  const total = inv.total_cents ?? 0;
  if (typeof total === "number" && Number.isFinite(total) && total > 0) return total;

  const ins = inv.insurance_due_cents ?? 0;
  const cust = inv.customer_due_cents ?? 0;
  const due = ins + cust;
  if (Number.isFinite(due) && due > 0) return due;

  const sub = inv.subtotal_cents ?? 0;
  const disc = inv.discount_cents ?? 0;
  const tax = inv.tax_cents ?? 0;
  const fallback = Math.max(0, sub - disc + tax);
  return Number.isFinite(fallback) ? fallback : 0;
}

/* ---------- Helpers ---------- */

async function fetchTechInvoices(): Promise<AdminTechInvoiceRow[]> {
  const { data, error } = await supabaseClient
    .from("tech_invoices")
    .select(
      [
        "id",
        "invoice_number",
        "technician_email",
        "client_id",
        "vehicle_id",
        "customer_email",
        "customer_name",
        "service_address",
        "appointment_snapshot",
        "invoice_date",
        "status",
        "services_json",
        "windshield_repairs_json",
        "subtotal_cents",
        "discount_cents",
        "tax_cents",
        "total_cents",
        "insurance_due_cents",
        "customer_due_cents",
        "final_paid_cents",
        "payment_method",
        "payment_note",
        "paid_at",
        "created_at",
      ].join(",")
    )
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as AdminTechInvoiceRow[];
  return rows.map((r) => ({
    ...r,
    computed_total_cents: effectiveTotalCents(r),
  }));
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  try {
    return format(d, "MMM d, yyyy");
  } catch {
    return d.toLocaleDateString();
  }
}

function centsToDollars(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toFixed(2);
}

function getStatusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "paid") {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-400/60";
  }
  if (s === "sent") {
    return "bg-sky-500/15 text-sky-200 border-sky-400/60";
  }
  if (s === "draft") {
    return "bg-slate-500/15 text-slate-200 border-slate-400/60";
  }
  return "bg-slate-600/15 text-slate-200 border-slate-500/60";
}

function getStatusIcon(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "paid") return <CheckCircle2 className="w-3 h-3" />;
  if (s === "sent") return <Clock className="w-3 h-3" />;
  if (s === "draft") return <Clock className="w-3 h-3" />;
  return <XCircle className="w-3 h-3" />;
}

/* ---------- Main Page ---------- */

export default function AdminInvoicesPage() {
  const router = useRouter();

  const goToInvoice = React.useCallback(
    (id: string) => {
      const clean = String(id ?? "").trim();
      if (!clean) return;
      router.push(`/admin/portal/invoices/${clean}`);
    },
    [router]
  );

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "draft" | "sent" | "paid"
  >("all");

  const {
    data: invoices = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin:tech_invoices"],
    queryFn: fetchTechInvoices,
    staleTime: 15_000,
  });

  /* ------ Summaries (across all techs) ------ */

  const totals = React.useMemo(() => {
    const paid = invoices.filter(
      (inv) => (inv.status ?? "").toLowerCase() === "paid"
    );
    const open = invoices.filter((inv) => {
      const s = (inv.status ?? "").toLowerCase();
      return s !== "paid" && s !== "";
    });

    const sumEffective = (rows: AdminTechInvoiceRow[]) =>
      rows.reduce((acc, inv) => acc + (inv.computed_total_cents ?? effectiveTotalCents(inv)), 0);

    const sumPaid = sumEffective(paid);
    const sumOpen = sumEffective(open);

    const allTotals = invoices.map((inv) => inv.computed_total_cents ?? effectiveTotalCents(inv));
    const avg =
      allTotals.length > 0
        ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length
        : 0;

    return {
      countAll: invoices.length,
      countPaid: paid.length,
      countOpen: open.length,
      sumPaid,
      sumOpen,
      avgTicket: avg,
    };
  }, [invoices]);

  /* ------ Filter & search ------ */

  const filteredInvoices = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const status = (inv.status ?? "").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (!term) return true;

      const appt = inv.appointment_snapshot ?? {};
      const fields = [
        inv.invoice_number ?? "",
        inv.customer_email ?? "",
        inv.customer_name ?? "",
        inv.technician_email ?? "",
        inv.payment_method ?? "",
        inv.payment_note ?? "",
        appt.service_type ?? "",
        appt.damage_description ?? "",
        inv.service_address ?? "",
        // insurance flags in services_json sometimes useful for searching
        inv.services_json ? JSON.stringify(inv.services_json) : "",
      ];

      return fields.some((f) => String(f).toLowerCase().includes(term));
    });
  }, [invoices, search, statusFilter]);

  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen relative px-4 py-6 md:px-8 md:py-10 bg-[radial-gradient(circle_at_top,_#020617_0,_#020617_45%,_#000000_100%)] text-slate-100 overflow-hidden">
      {/* Glassy background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[22rem] w-[22rem] rounded-full bg-sky-600/35 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] tracking-[0.25em] uppercase text-cyan-200/80">
              Glass Guardian · Admin
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-50 flex items-center gap-2">
              Tech Invoice Ledger
              <Sparkles className="w-4 h-4 text-cyan-300" />
            </h1>
            <p className="text-xs text-slate-400">
              Global view of all technician invoices, status, and revenue.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-semibold shadow-[0_0_24px_rgba(34,211,238,0.6)] hover:from-cyan-300 hover:to-emerald-300"
              onClick={() => router.push("/admin/portal/invoices/newinvoice")}
            >
              <FileText className="w-4 h-4 mr-2" />
              New Invoice
            </Button>

            <Button
              variant="outline"
              className="border-cyan-400/60 bg-slate-950/70 text-cyan-100 hover:bg-slate-900 hover:border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.5)]"
              onClick={() => {
                console.log("Admin export coming soon");
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total invoices */}
          <Card className="border border-slate-700/70 bg-slate-900/80 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">
                  Total Invoices
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-50">
                  {totals.countAll}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Across all technicians
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-300 flex items-center justify-center shadow-lg shadow-slate-900/80">
                <FileText className="w-5 h-5 text-slate-950" />
              </div>
            </CardContent>
          </Card>

          {/* Open balance */}
          <Card className="border border-amber-400/60 bg-amber-500/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(251,191,36,0.45)]">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-amber-200/80">
                  Open Balance
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-50">
                  ${centsToDollars(totals.sumOpen)}
                </p>
                <p className="text-[11px] text-amber-100/80 mt-0.5">
                  {totals.countOpen} open invoice{totals.countOpen === 1 ? "" : "s"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-300 flex items-center justify-center shadow-lg shadow-amber-500/80">
                <Clock className="w-5 h-5 text-amber-950" />
              </div>
            </CardContent>
          </Card>

          {/* Paid total */}
          <Card className="border border-emerald-400/60 bg-emerald-500/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(16,185,129,0.5)]">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-emerald-200/80">
                  Paid To Date
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-50">
                  ${centsToDollars(totals.sumPaid)}
                </p>
                <p className="text-[11px] text-emerald-100/80 mt-0.5">
                  {totals.countPaid} paid invoice{totals.countPaid === 1 ? "" : "s"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-lime-300 flex items-center justify-center shadow-lg shadow-emerald-500/80">
                <CheckCircle2 className="w-5 h-5 text-emerald-950" />
              </div>
            </CardContent>
          </Card>

          {/* Avg ticket */}
          <Card className="border border-sky-400/60 bg-sky-500/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(56,189,248,0.5)]">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-sky-200/80">
                  Avg Ticket
                </p>
                <p className="mt-1 text-2xl font-bold text-sky-50">
                  ${centsToDollars(totals.avgTicket)}
                </p>
                <p className="text-[11px] text-sky-100/80 mt-0.5">
                  Across all tech invoices
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-300 flex items-center justify-center shadow-lg shadow-sky-500/80">
                <DollarSign className="w-5 h-5 text-sky-950" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters / search */}
        <Card className="border border-slate-700/80 bg-slate-900/85 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
          <CardContent className="py-4 px-4 md:px-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex-1 flex items-center gap-2">
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by invoice #, customer, tech, or notes…"
                  className="pl-9 bg-slate-950/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["all", "draft", "sent", "paid"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={[
                    "px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.16em] border transition",
                    statusFilter === s
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.7)]"
                      : "bg-slate-950/80 text-slate-300 border-slate-600 hover:border-cyan-400/70 hover:text-cyan-100",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* States: loading / error / empty / list */}

        {isLoading && (
          <Card className="border border-slate-700/80 bg-slate-900/85 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
            <CardContent className="py-10 flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-cyan-400/60 border-t-transparent animate-spin" />
              <p className="text-xs tracking-[0.25em] uppercase text-slate-400">
                Loading invoices
              </p>
            </CardContent>
          </Card>
        )}

        {isError && (
          <Card className="border border-red-500/60 bg-red-500/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(248,113,113,0.6)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-100">
                <AlertCircle className="w-4 h-4" />
                Error Loading Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-100/90">
                {(error as any)?.message ??
                  "Something went wrong fetching tech invoices from Supabase."}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && filteredInvoices.length === 0 && (
          <Card className="border border-slate-700/80 bg-slate-900/85 backdrop-blur-2xl shadow-[0_22px_70px_rgba(15,23,42,0.95)]">
            <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
              <DollarSign className="w-9 h-9 text-slate-400 mb-1" />
              <p className="text-slate-100 font-semibold">
                No invoices match your filters
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Try clearing the search or switching the status filter to see more
                records.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && filteredInvoices.length > 0 && (
          <Card className="border border-slate-700/80 bg-slate-950/95 backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.98)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-slate-50">
                <span>Invoice Ledger</span>
                <span className="text-xs font-normal text-slate-400">
                  Showing {filteredInvoices.length} of {invoices.length}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 overflow-hidden">
              {/* Desktop header row */}
              <div className="hidden md:grid grid-cols-[1.3fr_1.5fr_0.9fr_0.8fr_0.7fr_0.7fr] px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 bg-slate-950 border-b border-slate-800/80">
                <div>Invoice</div>
                <div>Customer / Tech / Notes</div>
                <div>Date</div>
                <div>Final</div>
                <div>Status</div>
                <div className="text-right">PDF</div>
              </div>

              <div className="divide-y divide-slate-800/80">
                {filteredInvoices.map((inv) => {
                  const appt = inv.appointment_snapshot ?? {};
                  const dateLabel = inv.invoice_date ?? inv.created_at ?? null;

                  const finalCents = inv.computed_total_cents ?? effectiveTotalCents(inv);

                  // Map tech invoice → shape expected by PDF helper
                  const pdfInvoice: AnyObj = {
                    ...inv,
                    subtotal: (inv.subtotal_cents ?? 0) / 100,
                    tax_amount: (inv.tax_cents ?? 0) / 100,
                    tip_amount: 0,
                    total_amount: finalCents / 100,
                    invoice_date: inv.invoice_date ?? inv.created_at,
                    payment_status: inv.status,
                    line_items: appt.line_items ?? [],
                  };

                  return (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToInvoice(inv.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToInvoice(inv.id);
                        }
                      }}
                      className="px-4 md:px-5 py-4 hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 cursor-pointer"
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-[1.3fr_1.5fr_0.9fr_0.8fr_0.7fr_0.7fr] gap-3 items-center">
                        {/* Invoice meta */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-50">
                              #{inv.invoice_number ?? inv.id.slice(0, 8)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {inv.customer_email ??
                              inv.customer_name ??
                              "Unknown customer"}
                          </p>
                          {inv.technician_email && (
                            <p className="text-[11px] text-slate-500">
                              Tech: {inv.technician_email}
                            </p>
                          )}
                        </div>

                        {/* Customer / tech / notes */}
                        <div className="flex flex-col gap-1 text-xs text-slate-200">
                          {appt.damage_description ? (
                            <p className="line-clamp-2">{appt.damage_description}</p>
                          ) : (
                            <p className="text-slate-500">
                              No repair notes recorded.
                            </p>
                          )}
                          {appt.service_type && (
                            <p className="text-[11px] text-slate-400">
                              Service: {String(appt.service_type)}
                            </p>
                          )}
                          {inv.payment_method ? (
                            <p className="text-[11px] text-slate-500">
                              Method: {inv.payment_method}
                              {inv.payment_note ? ` • ${inv.payment_note}` : ""}
                            </p>
                          ) : inv.service_address ? (
                            <p className="text-[11px] text-slate-500">
                              {inv.service_address}
                            </p>
                          ) : null}
                        </div>

                        {/* Date */}
                        <div className="flex flex-col gap-1 text-xs text-slate-200">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>{formatDate(dateLabel)}</span>
                          </div>
                        </div>

                        {/* Final (REAL) */}
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-300" />
                            <span className="font-semibold text-emerald-100">
                              ${centsToDollars(finalCents)}
                            </span>
                          </div>

                          {/* Optional breakdown */}
                          <p className="text-[11px] text-slate-500">
                            {inv.insurance_due_cents && inv.insurance_due_cents > 0
                              ? `Ins $${centsToDollars(inv.insurance_due_cents)}`
                              : null}
                            {inv.customer_due_cents && inv.customer_due_cents > 0
                              ? `${inv.insurance_due_cents && inv.insurance_due_cents > 0 ? " · " : ""}Cust $${centsToDollars(inv.customer_due_cents)}`
                              : null}
                            {(!inv.insurance_due_cents && !inv.customer_due_cents) ||
                            ((inv.insurance_due_cents ?? 0) + (inv.customer_due_cents ?? 0) <= 0)
                              ? `Subtotal $${centsToDollars(inv.subtotal_cents)} · Tax $${centsToDollars(inv.tax_cents)}`
                              : null}
                          </p>
                        </div>

                        {/* Status */}
                        <div>
                          <Badge
                            className={[
                              "px-3 py-1 text-[10px] tracking-[0.18em] uppercase border inline-flex items-center gap-1",
                              getStatusBadgeClass(inv.status),
                            ].join(" ")}
                          >
                            {getStatusIcon(inv.status)}
                            {(inv.status ?? "unknown").toUpperCase()}
                          </Badge>
                        </div>

                        {/* PDF action */}
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              downloadInvoicePdf(pdfInvoice, {
                                company: {
                                  name: "Glass Guardian",
                                  addressLine1: "123 Repair Ln",
                                  addressLine2: "Los Angeles, CA 90001",
                                  email: "billing@glassguardian.com",
                                  phone: "(555) 555-0199",
                                  website: "glassguardian.com",
                                  brandHex: "#22d3ee",
                                },
                              });
                            }}
                            className="border-slate-600 text-black-100 hover:bg-slate-800 flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span className="text-xs">PDF</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Mobile layout */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-50">
                              #{inv.invoice_number ?? inv.id.slice(0, 8)}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatDate(dateLabel)}
                            </p>
                            {inv.technician_email && (
                              <p className="text-[10px] text-slate-500">
                                Tech: {inv.technician_email}
                              </p>
                            )}
                          </div>

                          <Badge
                            className={[
                              "px-2 py-0.5 text-[10px] tracking-[0.16em] uppercase border inline-flex items-center gap-1",
                              getStatusBadgeClass(inv.status),
                            ].join(" ")}
                          >
                            {getStatusIcon(inv.status)}
                            {(inv.status ?? "unknown").toUpperCase()}
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-200">
                          <p className="font-medium">
                            {inv.customer_email ??
                              inv.customer_name ??
                              "Unknown customer"}
                          </p>
                          {appt.damage_description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                              {appt.damage_description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 text-xs text-emerald-100">
                              <DollarSign className="w-3 h-3 text-emerald-300" />
                              <span className="font-semibold">
                                ${centsToDollars(finalCents)}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              downloadInvoicePdf(pdfInvoice, {
                                company: {
                                  name: "Glass Guardian",
                                  addressLine1: "123 Repair Ln",
                                  addressLine2: "Los Angeles, CA 90001",
                                  email: "billing@glassguardian.com",
                                  phone: "(555) 555-0199",
                                  website: "glassguardian.com",
                                  brandHex: "#22d3ee",
                                },
                              });
                            }}
                            className="border-slate-600 text-slate-100 hover:bg-slate-800 flex items-center gap-1 h-8 px-3"
                          >
                            <Download className="w-3 h-3" />
                            <span className="text-[11px]">PDF</span>
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}