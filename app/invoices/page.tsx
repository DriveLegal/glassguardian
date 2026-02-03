// app/tech/(protected)/dashboard/invoices/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ArrowRight,
  FileText,
  Search,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Copy,
  Navigation,
  Mail,
  Phone,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Receipt,
  BadgeDollarSign,
} from "lucide-react";

/* ---------- Types ---------- */

type TechInvoiceRow = {
  id: string;
  invoice_number: string | null;
  technician_email: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  service_address?: string | null;
  appointment_snapshot?: any | null;
  invoice_date: string | null;
  status: string | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  created_at: string | null;
};

/* ---------- Helpers ---------- */

function centsToDollars(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toFixed(2);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function safeCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function mapsUrl(addr?: string | null) {
  const q = encodeURIComponent(addr || "");
  return `https://maps.google.com/?q=${q}`;
}

function normalizeStatus(
  s: string | null | undefined
): "draft" | "sent" | "paid" | "overdue" | "denied" | "unknown" {
  const v = String(s ?? "").toLowerCase();
  if (v === "draft") return "draft";
  if (v === "sent") return "sent";
  if (v === "paid") return "paid";
  if (v === "overdue") return "overdue";
  if (v === "denied") return "denied";
  return "unknown";
}

function statusMeta(status: string | null | undefined) {
  const s = normalizeStatus(status);
  if (s === "paid")
    return {
      label: "PAID",
      badge:
        "bg-emerald-500/15 text-emerald-200 border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.22)]",
      dot: "bg-emerald-400",
      icon: CheckCircle2,
    };
  if (s === "sent")
    return {
      label: "SENT",
      badge:
        "bg-sky-500/15 text-sky-200 border-sky-400/60 shadow-[0_0_24px_rgba(56,189,248,0.20)]",
      dot: "bg-sky-400",
      icon: Clock,
    };
  if (s === "draft")
    return {
      label: "DRAFT",
      badge: "bg-slate-500/15 text-slate-200 border-slate-400/60",
      dot: "bg-slate-400",
      icon: FileText,
    };
  if (s === "overdue")
    return {
      label: "OVERDUE",
      badge:
        "bg-amber-500/15 text-amber-200 border-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.22)]",
      dot: "bg-amber-400",
      icon: AlertCircle,
    };
  if (s === "denied")
    return {
      label: "DENIED",
      badge:
        "bg-red-500/15 text-red-200 border-red-400/60 shadow-[0_0_24px_rgba(248,113,113,0.22)]",
      dot: "bg-red-400",
      icon: AlertCircle,
    };
  return {
    label: (status ?? "UNKNOWN").toString().toUpperCase(),
    badge: "bg-slate-600/15 text-slate-200 border-slate-500/60",
    dot: "bg-slate-400",
    icon: AlertCircle,
  };
}

function shineClass(enabled: boolean) {
  return enabled
    ? "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] before:animate-[shimmer_2.8s_infinite]"
    : "";
}

/* ---------- Main Page ---------- */

export default function TechDashboardInvoicesPage() {
  const router = useRouter();
  const [techEmail, setTechEmail] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "draft" | "sent" | "paid" | "overdue" | "denied"
  >("all");
  const [toast, setToast] = React.useState<string | null>(null);

  /* ------ Auth: derive current tech email ------ */
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!mounted) return;
      const email = session?.user?.email ?? null;
      setTechEmail(email);
      if (!email) {
        router.replace(
          `/tech/login?redirect=${encodeURIComponent(
            "/tech/dashboard/invoices"
          )}`
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ------ Query: invoices for this tech ------ */

  const {
    data: invoices = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["tech-dashboard-invoices", techEmail],
    enabled: !!techEmail,
    queryFn: async () => {
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
            "subtotal_cents",
            "discount_cents",
            "tax_cents",
            "total_cents",
            "created_at",
          ].join(",")
        )
        .eq("technician_email", techEmail as string)
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as TechInvoiceRow[];
    },
    staleTime: 15_000,
  });

  /* ------ Derived summaries ------ */

  const totals = React.useMemo(() => {
    const paid = invoices.filter((inv) => normalizeStatus(inv.status) === "paid");
    const open = invoices.filter((inv) => {
      const s = normalizeStatus(inv.status);
      return s !== "paid" && s !== "unknown";
    });

    const overdue = invoices.filter((inv) => normalizeStatus(inv.status) === "overdue");
    const denied = invoices.filter((inv) => normalizeStatus(inv.status) === "denied");

    const sum = (rows: TechInvoiceRow[]) =>
      rows.reduce((acc, inv) => acc + (inv.total_cents ?? 0), 0);

    return {
      countAll: invoices.length,
      countPaid: paid.length,
      countOpen: open.length,
      countOverdue: overdue.length,
      countDenied: denied.length,
      sumPaid: sum(paid),
      sumOpen: sum(open),
      sumOverdue: sum(overdue),
    };
  }, [invoices]);

  /* ------ Filter & search ------ */

  const filteredInvoices = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    return invoices.filter((inv) => {
      if (statusFilter !== "all") {
        if (normalizeStatus(inv.status) !== statusFilter) return false;
      }

      if (!term) return true;

      const appt = inv.appointment_snapshot ?? {};
      const fields = [
        inv.invoice_number ?? "",
        inv.customer_email ?? "",
        inv.customer_name ?? "",
        appt.service_type ?? "",
        appt.damage_description ?? "",
        inv.service_address ?? "",
      ];

      return fields.some((f) => String(f).toLowerCase().includes(term));
    });
  }, [invoices, search, statusFilter]);

  /* ------ UI helpers ------ */

  const pillClass = (active: boolean) =>
    active
      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.65)]"
      : "bg-slate-900/80 text-slate-300 border-slate-700 hover:border-cyan-400/70 hover:text-cyan-100";

  const avgTicket =
    totals.countAll > 0
      ? ((totals.sumPaid + totals.sumOpen) / totals.countAll / 100).toFixed(2)
      : "0.00";

  /* ---------- RENDER ---------- */

  return (
    <div className="min-h-screen relative bg-slate-950 px-4 py-6 md:px-8 md:py-10 overflow-hidden">
      {/* local keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Elite background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-48 -left-48 h-[26rem] w-[26rem] rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute -bottom-56 -right-48 h-[30rem] w-[30rem] rounded-full bg-sky-600/22 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(8,47,73,0.95),transparent_58%),radial-gradient(circle_at_92%_100%,rgba(30,64,175,0.95),transparent_58%)]" />
        <div className="absolute inset-0 opacity-[0.11] [background-image:linear-gradient(to_right,rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(circle_at_50%_30%,black,transparent_60%)] bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.20),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(99,102,241,0.16),transparent_40%)]" />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div
              className={cx(
                "rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur",
                shineClass(true)
              )}
            >
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header row (NO back button) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-11 w-11 rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/70 to-slate-950/70 backdrop-blur flex items-center justify-center shadow-[0_18px_60px_rgba(15,23,42,0.95)]">
              <Receipt className="w-5 h-5 text-cyan-200" />
            </div>

            <div>
              <p className="text-[0.65rem] tracking-[0.28em] uppercase text-cyan-200/80">
                Glass Guardian · Tech
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-50">
                  Invoices
                </h1>
                <Sparkles className="w-4 h-4 text-cyan-300" />

                <Badge className="border border-slate-700 bg-slate-950/50 text-slate-200 backdrop-blur-sm">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-cyan-200" />
                  Tech view
                </Badge>

                {isFetching && (
                  <Badge className="bg-slate-800/60 text-slate-200 border border-slate-700 backdrop-blur">
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Syncing
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Your invoice ledger — clean totals, fast search, and quick actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await refetch();
                setToast("Refreshed");
              }}
              className={cx(
                "hidden sm:inline-flex border-slate-700 bg-slate-900/60 text-slate-50 hover:bg-slate-800 transition-all",
                shineClass(false)
              )}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => router.push("/tech/dashboard/invoices/newinvoice")}
              className={cx(
                "inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold shadow-[0_12px_35px_rgba(45,212,191,0.55)] transition-all",
                shineClass(true)
              )}
            >
              <span className="text-xs md:text-sm">New Invoice</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className={cx(
              "border border-slate-700/70 bg-slate-900/70 backdrop-blur-2xl",
              "shadow-[0_18px_60px_rgba(15,23,42,0.9)]"
            )}
          >
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">
                  Total Invoices
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-50">
                  {totals.countAll}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-300 flex items-center justify-center shadow-lg shadow-slate-900/80">
                <FileText className="w-5 h-5 text-slate-950" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-amber-400/40 bg-amber-500/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(251,191,36,0.3)]">
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

          <Card className="border border-emerald-400/50 bg-emerald-500/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(16,185,129,0.45)]">
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

          <Card className="border border-sky-400/50 bg-sky-500/10 backdrop-blur-2xl shadow-[0_18px_60px_rgba(56,189,248,0.45)]">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-sky-200/80">
                  Avg Ticket
                </p>
                <p className="mt-1 text-2xl font-bold text-sky-50">${avgTicket}</p>
                <p className="text-[11px] text-sky-100/80 mt-0.5">Across all invoices</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-300 flex items-center justify-center shadow-lg shadow-sky-500/80">
                <BadgeDollarSign className="w-5 h-5 text-sky-950" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + filters */}
        <Card className="border border-slate-700/80 bg-slate-900/70 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
          <CardContent className="py-4 px-4 md:px-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex-1 flex items-center gap-2">
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by invoice #, email, name, notes, address…"
                  className="pl-9 bg-slate-950/40 border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-400/40"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {(
                ["all", "draft", "sent", "paid", "overdue", "denied"] as const
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cx(
                    "px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.16em] border transition",
                    pillClass(statusFilter === s)
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content (loading / error / list) */}
        {isLoading && (
          <Card className="border border-slate-700/80 bg-slate-900/70 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
            <CardContent className="py-10 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-60 bg-cyan-500/18 animate-pulse" />
                <div className="relative h-10 w-10 rounded-full border-2 border-cyan-400/60 border-t-transparent animate-spin" />
              </div>
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
                  "Something went wrong fetching invoices from Supabase."}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && filteredInvoices.length === 0 && (
          <Card className="border border-slate-700/80 bg-slate-900/70 backdrop-blur-2xl shadow-[0_22px_70px_rgba(15,23,42,0.9)]">
            <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
              <FileText className="w-9 h-9 text-slate-400 mb-1" />
              <p className="text-slate-100 font-semibold">
                No invoices match your filters
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Try clearing the search or changing the status filter. You can
                create a new invoice from the top-right button.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && filteredInvoices.length > 0 && (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.95)] overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-slate-50">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
                  Invoice List
                </span>
                <span className="text-xs font-normal text-slate-400">
                  Showing {filteredInvoices.length} of {invoices.length}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 overflow-hidden">
              {/* Desktop header */}
              <div className="hidden md:grid grid-cols-[1.25fr_1.6fr_0.95fr_0.85fr_0.8fr_0.72fr] px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 bg-slate-950/30 border-b border-slate-700/80">
                <div>Invoice</div>
                <div>Customer / Notes</div>
                <div>Date</div>
                <div>Total</div>
                <div>Status</div>
                <div className="text-right">Action</div>
              </div>

              <div className="divide-y divide-slate-800/80">
                {filteredInvoices.map((inv) => {
                  const total = centsToDollars(inv.total_cents);
                  const dateLabel = inv.invoice_date ?? inv.created_at ?? null;
                  const appt = inv.appointment_snapshot ?? {};

                  // ✅ FIX: Always route by invoice id (invoice detail should be viewable immediately)
                  const invoiceDetailId = inv.id;
                  const canView = !!invoiceDetailId;

                  const email = inv.customer_email ?? "";
                  const name = inv.customer_name ?? "";
                  const address = inv.service_address ?? "";

                  const meta = statusMeta(inv.status);
                  const StatusIcon = meta.icon;

                  return (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className={cx(
                        "px-4 md:px-5 py-4 transition-colors",
                        "hover:bg-slate-950/25"
                      )}
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-[1.25fr_1.6fr_0.95fr_0.85fr_0.8fr_0.72fr] gap-3 items-center">
                        {/* Invoice meta */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-50">
                              #{inv.invoice_number ?? "—"}
                            </span>

                            {appt.service_type && (
                              <Badge className="bg-sky-500/15 text-sky-200 border-sky-400/60 text-[10px]">
                                {String(appt.service_type).toUpperCase().slice(0, 22)}
                                {String(appt.service_type).length > 22 ? "…" : ""}
                              </Badge>
                            )}

                            {appt?.replacement_required && (
                              <Badge className="bg-amber-500/15 text-amber-200 border-amber-400/60 text-[10px]">
                                CRACK-OUT
                              </Badge>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400">
                            {email || name || "No customer email on file"}
                          </p>

                          {/* quick actions */}
                          <div className="mt-1 flex items-center gap-3">
                            {email ? (
                              <button
                                className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-200 transition"
                                onClick={async () => {
                                  const ok = await safeCopy(email);
                                  setToast(ok ? "Email copied" : "Copy failed");
                                }}
                                type="button"
                              >
                                <Copy className="w-3 h-3" />
                                Copy email
                              </button>
                            ) : null}

                            {address ? (
                              <button
                                className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-200 transition"
                                onClick={() => window.open(mapsUrl(address), "_blank")}
                                type="button"
                              >
                                <Navigation className="w-3 h-3" />
                                Map
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Customer + notes */}
                        <div className="flex flex-col gap-1 text-xs text-slate-200">
                          {appt.damage_description ? (
                            <p className="line-clamp-2">{appt.damage_description}</p>
                          ) : (
                            <p className="text-slate-500">No repair notes recorded.</p>
                          )}

                          {address && (
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              {address}
                            </p>
                          )}
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-2 text-xs text-slate-200">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{formatDate(dateLabel)}</span>
                        </div>

                        {/* Total */}
                        <div className="flex items-center gap-2 text-xs">
                          <DollarSign className="w-4 h-4 text-emerald-300" />
                          <span className="font-semibold text-emerald-100">
                            ${total}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2">
                          <span className={cx("h-2 w-2 rounded-full", meta.dot)} />
                          <Badge
                            className={cx(
                              "px-3 py-1 text-[10px] tracking-[0.18em] uppercase border",
                              meta.badge
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </div>

                        {/* Action */}
                        <div className="flex justify-end">
                          {canView ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                router.push(
                                  `/tech/dashboard/invoices/invoice/${invoiceDetailId}`
                                )
                              }
                              className={cx(
                                "border-slate-700 bg-slate-950/20 hover:bg-slate-900/40 text-slate-100 hover:text-slate-50 shadow-none flex items-center gap-1 transition-all",
                                "backdrop-blur"
                              )}
                            >
                              <span className="text-xs">View</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="border-slate-800 text-slate-500 bg-slate-950/30 cursor-not-allowed"
                              title="Missing invoice id."
                            >
                              Coming Soon
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Mobile layout */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-50">
                              #{inv.invoice_number ?? "—"}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatDate(dateLabel)}
                            </p>

                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {appt.service_type && (
                                <Badge className="bg-sky-500/15 text-sky-200 border-sky-400/60 text-[10px]">
                                  {String(appt.service_type).toUpperCase().slice(0, 18)}
                                  {String(appt.service_type).length > 18 ? "…" : ""}
                                </Badge>
                              )}
                              {appt?.replacement_required && (
                                <Badge className="bg-amber-500/15 text-amber-200 border-amber-400/60 text-[10px]">
                                  CRACK-OUT
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Badge
                            className={cx(
                              "px-2 py-0.5 text-[10px] tracking-[0.16em] uppercase border flex items-center",
                              meta.badge
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-200">
                          <p className="font-medium">
                            {email || name || "No customer email"}
                          </p>
                          {appt.damage_description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                              {appt.damage_description}
                            </p>
                          )}
                          {address && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                              {address}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1 text-xs text-emerald-100">
                            <DollarSign className="w-3 h-3 text-emerald-300" />
                            <span className="font-semibold">${total}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {email ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`mailto:${email}`, "_self")}
                                className="border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/50 h-8 px-3"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </Button>
                            ) : null}

                            {customer_email_to_phone_appt(appt) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(
                                    `tel:${customer_email_to_phone_appt(appt)}`,
                                    "_self"
                                  )
                                }
                                className="border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/50 h-8 px-3"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            ) : null}

                            {address ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(mapsUrl(address), "_blank")}
                                className="border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/50 h-8 px-3"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                              </Button>
                            ) : null}

                            {canView ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(
                                    `/tech/dashboard/invoices/invoice/${invoiceDetailId}`
                                  )
                                }
                                className="border-slate-700 bg-slate-950/20 text-slate-100 hover:bg-slate-900/50 flex items-center gap-1 h-8 px-3"
                              >
                                <span className="text-[11px]">View</span>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                Detail view coming soon
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer hint */}
        {!isLoading && !isError && invoices.length > 0 && (
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
              Tip:
            </span>
            Click <span className="text-slate-300">View</span> to open the invoice detail.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Optional: best-effort phone extraction from snapshot for mobile quick-call button.
 * (Doesn't break anything if it's missing.)
 */
function customer_email_to_phone_appt(appt: any): string | null {
  const v =
    appt?.customer_phone ??
    appt?.phone ??
    appt?.client_phone ??
    appt?.app_user_phone ??
    null;
  if (!v) return null;
  const s = String(v).trim();
  return s.length >= 7 ? s : null;
}