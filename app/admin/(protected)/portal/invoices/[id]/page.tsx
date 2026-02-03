// app/admin/(protected)/portal/invoices/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Receipt,
  Loader2,
  AlertTriangle,
  BadgeCheck,
  Clock,
  Calendar,
  Save,
  Pencil,
  X,
  RefreshCw,
  Hash,
  Mail,
  MapPin,
  User,
  Wrench,
  DollarSign,
  Sparkles,
  FileText,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Optional: if you already use these in tech invoice page, reuse here too.
// If your paths differ, update imports to your actual paths.
import { ServicesPerformed } from "@/components/tech/invoice/ServicesPerformed";
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

type AnyObj = Record<string, any>;

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
  paid_at?: string | null;

  // (optional extra columns if you have them — safe)
  updated_at?: string | null;
  notes?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeParamId(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return null;
}

function normStatus(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function formatDT(s?: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s ?? "");
  }
}

function formatD(s?: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return String(s ?? "");
  }
}

function moneyFromCents(cents: any) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "$0.00";
  return (n / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function toCentsInt(v: any): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function statusPill(status: string) {
  const s = normStatus(status);
  if (["paid", "complete", "completed", "settled", "finalized", "final"].includes(s)) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }
  if (["draft", "sent", "open", "unpaid", "due", "pending"].includes(s)) {
    return "border-sky-400/30 bg-sky-500/15 text-sky-200";
  }
  if (["cancelled", "canceled", "void", "denied"].includes(s)) {
    return "border-rose-400/30 bg-rose-500/15 text-rose-200";
  }
  return "border-white/15 bg-white/5 text-slate-200";
}

function isFinalizedStatus(status: any) {
  const s = normStatus(status);
  return ["paid", "complete", "completed", "settled", "finalized", "final"].includes(s);
}

function formatSupabaseError(e: any) {
  if (!e) return "Unknown error.";
  const msg = String(e?.message ?? e ?? "Unknown error.");
  const code = e?.code ? `code: ${e.code}` : "";
  const details = e?.details ? `details: ${e.details}` : "";
  const hint = e?.hint ? `hint: ${e.hint}` : "";
  return [msg, code, details, hint].filter(Boolean).join(" | ");
}

function GGBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      <div className="absolute inset-0 opacity-[0.075] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-48 -left-40 h-[34rem] w-[34rem] rounded-full bg-cyan-500/22 blur-3xl" />
      <div className="absolute -bottom-56 -right-44 h-[38rem] w-[38rem] rounded-full bg-emerald-500/18 blur-3xl" />
      <div className="absolute top-[35%] left-[55%] h-[28rem] w-[28rem] rounded-full bg-indigo-500/14 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/65 to-slate-950" />
    </div>
  );
}

function GradientBorderCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative rounded-2xl p-[1px]",
        "bg-gradient-to-br from-white/12 via-white/6 to-transparent",
        className
      )}
    >
      <div className="rounded-2xl bg-slate-950/55 backdrop-blur-xl border border-white/10">
        {children}
      </div>
    </div>
  );
}

/* ----------------------- Data fetchers ----------------------- */

async function fetchInvoiceById(invoiceId: string) {
  // Primary: tech_invoices
  const primary = await supabaseClient
    .from("tech_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!primary.error && primary.data) return primary.data as TechInvoiceRow;

  // Fallback: legacy invoices table (if you still have it)
  const legacy = await (supabaseClient.from("invoices") as any)
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!legacy.error && legacy.data) return legacy.data as TechInvoiceRow;

  // If primary had an error besides "no rows", surface it.
  if (primary.error && String(primary.error.message || "").length) throw primary.error;

  throw new Error("Invoice not found.");
}

async function updateInvoiceById(invoiceId: string, patch: Partial<TechInvoiceRow>) {
  // Try update in tech_invoices first
  const res = await (supabaseClient.from("tech_invoices") as any)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("*")
    .maybeSingle();

  if (!res.error && res.data) return res.data as TechInvoiceRow;

  // Fallback update legacy invoices
  const legacy = await (supabaseClient.from("invoices") as any)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("*")
    .maybeSingle();

  if (legacy.error) throw legacy.error;
  if (!legacy.data) throw new Error("Update returned no row (UPDATE may be blocked by RLS).");
  return legacy.data as TechInvoiceRow;
}

export const dynamic = "force-dynamic";

export default function AdminInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();

  const invoiceId = safeParamId((params as AnyObj)?.id);

  const onBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/admin/portal/invoices");
  }, [router]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin:invoice:detail:v1", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id in route.");
      return await fetchInvoiceById(invoiceId);
    },
    staleTime: 10_000,
  });

  const invoice = (data as TechInvoiceRow | undefined) ?? undefined;

  const [isEditing, setIsEditing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState<Partial<TechInvoiceRow & { appointment_snapshot_text?: string }>>(
    {}
  );

  React.useEffect(() => {
    if (!invoice) return;

    const snap = invoice.appointment_snapshot ?? null;
    let snapText = "";
    try {
      snapText = snap ? JSON.stringify(snap, null, 2) : "";
    } catch {
      snapText = "";
    }

    setDraft({
      invoice_number: invoice.invoice_number ?? "",
      status: invoice.status ?? "",
      invoice_date: invoice.invoice_date ?? "",
      technician_email: invoice.technician_email ?? "",
      customer_name: invoice.customer_name ?? "",
      customer_email: invoice.customer_email ?? "",
      service_address: (invoice as any).service_address ?? "",
      client_id: invoice.client_id ?? "",
      vehicle_id: invoice.vehicle_id ?? "",
      subtotal_cents: invoice.subtotal_cents ?? 0,
      discount_cents: invoice.discount_cents ?? 0,
      tax_cents: invoice.tax_cents ?? 0,
      total_cents: invoice.total_cents ?? 0,
      paid_at: (invoice as any).paid_at ?? null,
      notes: (invoice as any).notes ?? "",
      appointment_snapshot_text: snapText,
    });

    setNotice(null);
    setSaveErr(null);
    setIsEditing(false);
  }, [invoice?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id.");
      setNotice(null);
      setSaveErr(null);

      let parsedSnapshot: any = invoice?.appointment_snapshot ?? null;

      const snapText = String((draft as any).appointment_snapshot_text ?? "").trim();
      if (snapText) {
        try {
          parsedSnapshot = JSON.parse(snapText);
        } catch {
          throw new Error("appointment_snapshot JSON is invalid. Fix it or clear it.");
        }
      } else {
        parsedSnapshot = null;
      }

      const patch: Partial<TechInvoiceRow> = {
        invoice_number: String(draft.invoice_number ?? "").trim() || null,
        status: String(draft.status ?? "").trim() || null,
        invoice_date: String(draft.invoice_date ?? "").trim() || null,
        technician_email: String(draft.technician_email ?? "").trim() || null,
        customer_name: String(draft.customer_name ?? "").trim() || null,
        customer_email: String(draft.customer_email ?? "").trim().toLowerCase() || null,
        service_address: String((draft as any).service_address ?? "").trim() || null,
        client_id: String(draft.client_id ?? "").trim() || null,
        vehicle_id: String(draft.vehicle_id ?? "").trim() || null,
        subtotal_cents: toCentsInt(draft.subtotal_cents),
        discount_cents: toCentsInt(draft.discount_cents),
        tax_cents: toCentsInt(draft.tax_cents),
        total_cents: toCentsInt(draft.total_cents),
        paid_at: String((draft as any).paid_at ?? "").trim() || null,
        notes: String((draft as any).notes ?? "").trim() || null,
        appointment_snapshot: parsedSnapshot,
      } as any;

      return await updateInvoiceById(invoiceId, patch);
    },
    onSuccess: async () => {
      setNotice("Saved.");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["admin:invoice:detail:v1", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["admin:invoices"] });
    },
    onError: (e: any) => setSaveErr(formatSupabaseError(e)),
  });

  const finalized = isFinalizedStatus(invoice?.status);

  const recomputeTotal = React.useCallback(() => {
    const sub = Number(draft.subtotal_cents ?? 0) || 0;
    const disc = Number(draft.discount_cents ?? 0) || 0;
    const tax = Number(draft.tax_cents ?? 0) || 0;
    const total = Math.max(0, sub - disc + tax);
    setDraft((d) => ({ ...d, total_cents: total }));
  }, [draft.subtotal_cents, draft.discount_cents, draft.tax_cents]);

  const invNumber = invoice?.invoice_number ?? invoice?.id ?? "Invoice";
  const amount = moneyFromCents(invoice?.total_cents);
  const status = invoice?.status ?? "unknown";

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <GGBackground />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className={cx(
              "w-fit border-white/15 bg-white/5 text-white hover:bg-white/10",
              "backdrop-blur"
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
              <Receipt className="w-3.5 h-3.5 mr-1.5" />
              Invoice Detail
            </Badge>

            {invoice?.id ? (
              <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                <Hash className="w-3.5 h-3.5 mr-1.5" />
                {String(invoice.id).slice(0, 8)}…
              </Badge>
            ) : null}

            <Badge className={cx(statusPill(String(status)))}>{status}</Badge>

            {finalized ? (
              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                <BadgeCheck className="w-3.5 h-3.5 mr-1.5" />
                Finalized
              </Badge>
            ) : (
              <Badge className="border-sky-400/30 bg-sky-500/15 text-sky-200">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Editable
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              {isFetching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refreshing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </span>
              )}
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <GradientBorderCard>
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl text-white">
                      Invoice {String(invNumber)}
                    </CardTitle>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                        <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                        Total: {amount}
                      </Badge>

                      {invoice?.invoice_date ? (
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                          <Calendar className="w-3.5 h-3.5 mr-1.5" />
                          Invoice date: {formatD(invoice.invoice_date)}
                        </Badge>
                      ) : null}

                      {invoice?.created_at ? (
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          Created: {formatDT(invoice.created_at)}
                        </Badge>
                      ) : null}

                      {invoice?.paid_at ? (
                        <Badge className="border-emerald-400/20 bg-emerald-500/10 text-emerald-100">
                          <BadgeCheck className="w-3.5 h-3.5 mr-1.5" />
                          Paid: {formatD(invoice.paid_at)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isEditing ? (
                      <Button
                        onClick={() => setIsEditing(true)}
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.35)]"
                        disabled={!invoice}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit invoice
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isPending}
                          className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.35)]"
                        >
                          {saveMutation.isPending ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving…
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <Save className="w-4 h-4" />
                              Save
                            </span>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            // revert to server state
                            if (!invoice) return;
                            const snap = invoice.appointment_snapshot ?? null;
                            let snapText = "";
                            try {
                              snapText = snap ? JSON.stringify(snap, null, 2) : "";
                            } catch {
                              snapText = "";
                            }
                            setDraft({
                              invoice_number: invoice.invoice_number ?? "",
                              status: invoice.status ?? "",
                              invoice_date: invoice.invoice_date ?? "",
                              technician_email: invoice.technician_email ?? "",
                              customer_name: invoice.customer_name ?? "",
                              customer_email: invoice.customer_email ?? "",
                              service_address: (invoice as any).service_address ?? "",
                              client_id: invoice.client_id ?? "",
                              vehicle_id: invoice.vehicle_id ?? "",
                              subtotal_cents: invoice.subtotal_cents ?? 0,
                              discount_cents: invoice.discount_cents ?? 0,
                              tax_cents: invoice.tax_cents ?? 0,
                              total_cents: invoice.total_cents ?? 0,
                              paid_at: (invoice as any).paid_at ?? null,
                              notes: (invoice as any).notes ?? "",
                              appointment_snapshot_text: snapText,
                            });
                            setIsEditing(false);
                            setNotice("Reverted.");
                            setSaveErr(null);
                          }}
                          className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-6">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading invoice…</span>
                  </div>
                ) : null}

                {isError ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 mt-0.5" />
                      <div className="w-full">
                        <p className="font-semibold">Couldn’t load invoice</p>
                        <p className="text-sm text-red-100/90 mt-1">
                          {(error as Error)?.message || "Failed to load invoice."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={() => refetch()}
                            disabled={isFetching}
                          >
                            {isFetching ? "Retrying…" : "Retry"}
                          </Button>
                          <Button
                            variant="outline"
                            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={onBack}
                          >
                            Go back
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {notice ? (
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    {notice}
                  </div>
                ) : null}

                {saveErr ? (
                  <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    {saveErr}
                  </div>
                ) : null}

                {!isLoading && !isError && invoice ? (
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* LEFT */}
                    <div className="lg:col-span-1 space-y-4">
                      {/* Summary */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-200" />
                              Invoice Summary
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-3 text-sm">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Status</span>
                                <Badge className={cx(statusPill(String(invoice.status ?? "")))}>
                                  {invoice.status || "unknown"}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Total</span>
                                <span className="text-slate-100 font-semibold tabular-nums">
                                  {moneyFromCents(invoice.total_cents)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Subtotal</span>
                                <span className="text-slate-100 tabular-nums">
                                  {moneyFromCents(invoice.subtotal_cents)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Discount</span>
                                <span className="text-slate-100 tabular-nums">
                                  {moneyFromCents(invoice.discount_cents)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Tax</span>
                                <span className="text-slate-100 tabular-nums">
                                  {moneyFromCents(invoice.tax_cents)}
                                </span>
                              </div>
                            </div>

                            {invoice.customer_email ? (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-center gap-2 text-slate-200">
                                  <Mail className="w-4 h-4 text-slate-300" />
                                  <span className="break-all">{invoice.customer_email}</span>
                                </div>
                                {invoice.customer_name ? (
                                  <div className="mt-2 flex items-center gap-2 text-slate-200">
                                    <User className="w-4 h-4 text-slate-300" />
                                    <span>{invoice.customer_name}</span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {invoice.service_address ? (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-center gap-2 text-slate-200">
                                  <MapPin className="w-4 h-4 text-slate-300" />
                                  <span className="break-words">{invoice.service_address}</span>
                                </div>
                              </div>
                            ) : null}

                            {invoice.technician_email ? (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-center gap-2 text-slate-200">
                                  <Wrench className="w-4 h-4 text-slate-300" />
                                  <span className="break-all">{invoice.technician_email}</span>
                                </div>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* Edit panel */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <Pencil className="w-4 h-4 text-slate-200" />
                              Admin Controls
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                              Finalized invoices show the final form by default — hit{" "}
                              <span className="text-slate-100 font-semibold">Edit invoice</span>{" "}
                              anytime to change any detail.
                            </div>

                            <Button
                              variant="outline"
                              onClick={() => setIsEditing((v) => !v)}
                              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                            >
                              {isEditing ? (
                                <span className="inline-flex items-center gap-2">
                                  <X className="w-4 h-4" />
                                  Exit edit mode
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <Pencil className="w-4 h-4" />
                                  Enter edit mode
                                </span>
                              )}
                            </Button>

                            {isEditing ? (
                              <Button
                                onClick={recomputeTotal}
                                variant="outline"
                                className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Recompute total
                              </Button>
                            ) : null}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>
                    </div>

                    {/* RIGHT */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Final view OR editable fields */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-slate-200" />
                              {isEditing ? "Edit Invoice" : finalized ? "Final Invoice" : "Invoice Details"}
                            </CardTitle>
                            <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
                              {finalized ? "Final form" : "Live"}
                            </Badge>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            {!isEditing ? (
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    Invoice number
                                  </div>
                                  <div className="mt-1 text-slate-100 font-semibold">
                                    {invoice.invoice_number || "—"}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    Invoice date
                                  </div>
                                  <div className="mt-1 text-slate-100 font-semibold">
                                    {invoice.invoice_date ? formatD(invoice.invoice_date) : "—"}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    Customer
                                  </div>
                                  <div className="mt-1 text-slate-100 font-semibold">
                                    {invoice.customer_name || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-300 break-all">
                                    {invoice.customer_email || ""}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    Address
                                  </div>
                                  <div className="mt-1 text-slate-100 font-semibold break-words">
                                    {invoice.service_address || "—"}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    Subtotal / Discount / Tax
                                  </div>
                                  <div className="mt-1 text-slate-100 tabular-nums">
                                    {moneyFromCents(invoice.subtotal_cents)} /{" "}
                                    {moneyFromCents(invoice.discount_cents)} /{" "}
                                    {moneyFromCents(invoice.tax_cents)}
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    Total
                                  </div>
                                  <div className="mt-1 text-slate-100 font-semibold tabular-nums">
                                    {moneyFromCents(invoice.total_cents)}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Invoice number
                                    </div>
                                    <Input
                                      value={(draft.invoice_number as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, invoice_number: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="INV-000123"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Status
                                    </div>
                                    <Input
                                      value={(draft.status as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, status: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="open / paid / finalized"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Invoice date (ISO or any)
                                    </div>
                                    <Input
                                      value={(draft.invoice_date as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, invoice_date: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="2026-01-25"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Paid at (optional)
                                    </div>
                                    <Input
                                      value={((draft as any).paid_at as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...(d as any), paid_at: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="2026-01-25T18:20:00Z"
                                    />
                                  </div>

                                  <div className="space-y-1 md:col-span-2">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Service address
                                    </div>
                                    <Input
                                      value={((draft as any).service_address as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...(d as any),
                                          service_address: e.target.value,
                                        }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="123 Main St, Riverside, CA"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Customer name
                                    </div>
                                    <Input
                                      value={(draft.customer_name as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, customer_name: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="Customer name"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Customer email
                                    </div>
                                    <Input
                                      value={(draft.customer_email as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, customer_email: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="customer@email.com"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Technician email
                                    </div>
                                    <Input
                                      value={(draft.technician_email as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          technician_email: e.target.value,
                                        }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="tech@email.com"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Client ID
                                    </div>
                                    <Input
                                      value={(draft.client_id as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, client_id: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="uuid"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Vehicle ID
                                    </div>
                                    <Input
                                      value={(draft.vehicle_id as any) ?? ""}
                                      onChange={(e) =>
                                        setDraft((d) => ({ ...d, vehicle_id: e.target.value }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="uuid"
                                    />
                                  </div>
                                </div>

                                <div className="grid md:grid-cols-4 gap-3">
                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Subtotal (cents)
                                    </div>
                                    <Input
                                      value={(draft.subtotal_cents as any) ?? 0}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          subtotal_cents: toCentsInt(e.target.value) ?? 0,
                                        }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Discount (cents)
                                    </div>
                                    <Input
                                      value={(draft.discount_cents as any) ?? 0}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          discount_cents: toCentsInt(e.target.value) ?? 0,
                                        }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Tax (cents)
                                    </div>
                                    <Input
                                      value={(draft.tax_cents as any) ?? 0}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          tax_cents: toCentsInt(e.target.value) ?? 0,
                                        }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Total (cents)
                                    </div>
                                    <Input
                                      value={(draft.total_cents as any) ?? 0}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          total_cents: toCentsInt(e.target.value) ?? 0,
                                        }))
                                      }
                                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                      placeholder="0"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    Internal notes (optional)
                                  </div>
                                  <Textarea
                                    value={((draft as any).notes as any) ?? ""}
                                    onChange={(e) =>
                                      setDraft((d) => ({ ...(d as any), notes: e.target.value }))
                                    }
                                    className="min-h-[90px] bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                    placeholder="Admin notes…"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                    appointment_snapshot (JSON)
                                  </div>
                                  <Textarea
                                    value={((draft as any).appointment_snapshot_text as any) ?? ""}
                                    onChange={(e) =>
                                      setDraft((d) => ({
                                        ...(d as any),
                                        appointment_snapshot_text: e.target.value,
                                      }))
                                    }
                                    className="min-h-[220px] font-mono text-xs bg-black/30 border-white/10 text-slate-100 placeholder:text-slate-500"
                                    placeholder='{"services_performed":["Chip Repair"],"spot_location":"top_left"}'
                                  />
                                  <p className="text-xs text-slate-400">
                                    Keep valid JSON. Clear it to set snapshot to null.
                                  </p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* “Final form” blocks (read-only display) */}
                      {!isEditing ? (
                        <div className="grid lg:grid-cols-2 gap-6">
                          <GradientBorderCard className="lg:col-span-1">
                            <Card className="border-0 bg-transparent shadow-none">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base text-white flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-slate-200" />
                                  Services Performed
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                {/* If your component expects invoice/appointment_snapshot, pass it through */}
                                <ServicesPerformed invoice={invoice as any} />
                              </CardContent>
                            </Card>
                          </GradientBorderCard>

                          <GradientBorderCard className="lg:col-span-1">
                            <Card className="border-0 bg-transparent shadow-none">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base text-white flex items-center gap-2">
                                  <Wrench className="w-4 h-4 text-slate-200" />
                                  Windshield Map
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <WindshieldRepairMap invoice={invoice as any} />
                              </CardContent>
                            </Card>
                          </GradientBorderCard>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>
      </div>
    </div>
  );
}