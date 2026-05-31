// app/admin/(protected)/portal/insurance/page.tsx
"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO, isValid as isValidDate } from "date-fns";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ReceiptText,
  Sparkles,
  SlidersHorizontal,
  Shield,
  Building2,
  Calendar,
  Hash,
  ArrowRight,
  FileText,
  Car,
  ClipboardList,
  Loader2,
  Banknote,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ----------------------------- Types ----------------------------- */

type TechInvoiceRow = {
  id: string;
  invoice_number: string;
  technician_email: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  appointment_id: string | null;
  invoice_date: string;
  status: string;
  services_json: any | null;
  windshield_repairs_json: any | null;
  appointment_snapshot: any | null;
  subtotal_cents: number;
  discount_percent: number | null;
  discount_cents: number;
  tax_rate_percent: number | null;
  tax_cents: number;
  total_cents: number;
  payment_method: string | null;
  payment_note: string | null;
  customer_signature: string | null;
  created_at: string;
  paid_at: string | null;
  final_paid_cents: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  promo_code: string | null;
  stripe_promotion_code_id: string | null;
  promo_discount_cents: number | null;
  customer_email: string | null;
  customer_name: string | null;
  service_address: string | null;
  crack_out_occurred: boolean;
  crack_out_notes: string | null;
  crack_out_media_urls: any | null;
  repair_outcome: string | null;
  crack_out_at: string | null;
  crack_out_cause: string | null;
  crack_out_photo_url: string | null;
  replacement_required: boolean;
  replacement_status: string | null;
  insurance_due_cents: number;
  customer_due_cents: number;
};

type InsuranceMeta = {
  referral_number: string;
  vin: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_fed_tax_id: string;
  insurance_name: string;
  date_of_loss: string;
  line_items: Array<{
    id?: string;
    label?: string;
    qty?: number;
    unit_price_cents?: number;
    total_cents?: number;
  }>;
  signature_data_url: string;
  signature_signed_at: string;
  insurance_payment_received?: boolean;
  insurance_payment_received_at?: string;
  insurance_payment_received_by?: string;
};

type InsuranceValidationResult = {
  insuranceMode: boolean;
  isComplete: boolean;
  missing: string[];
  mismatches: string[];
  meta: InsuranceMeta;
  lineItemUnitPrice: number | null;
};

/* ----------------------------- Helpers ----------------------------- */

function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function fmtCents(cents: any): string {
  const n =
    typeof cents === "number"
      ? cents
      : typeof cents === "string"
        ? Number(cents)
        : Number.NaN;

  if (!Number.isFinite(n)) return "—";

  return (n / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(v: any): string {
  const s = safeStr(v);
  if (!s) return "—";

  try {
    const d = parseISO(s);
    if (isValidDate(d)) return format(d, "MMM d, yyyy");
  } catch {}

  const d2 = new Date(s);
  if (isValidDate(d2)) return format(d2, "MMM d, yyyy");

  return s;
}

function fmtDateTime(v: any): string {
  const s = safeStr(v);
  if (!s) return "—";

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString();

  return s;
}

function normStatus(s: any): string {
  const v = safeStr(s).trim().toLowerCase();
  if (!v) return "unknown";
  return v;
}

function statusBadge(v: any) {
  const s = normStatus(v);

  const positive = new Set(["paid", "completed", "closed", "settled", "success"]);
  const pending = new Set(["pending", "sent", "submitted", "processing", "open", "draft"]);
  const denied = new Set(["denied", "rejected", "void", "canceled", "cancelled", "failed"]);

  if (positive.has(s)) {
    return {
      text: safeStr(v || "Paid"),
      className: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
      Icon: CheckCircle2,
    };
  }

  if (denied.has(s)) {
    return {
      text: safeStr(v || "Denied"),
      className: "border-rose-300/30 bg-rose-400/10 text-rose-100",
      Icon: XCircle,
    };
  }

  if (pending.has(s)) {
    return {
      text: safeStr(v || "Pending"),
      className: "border-amber-300/30 bg-amber-400/10 text-amber-100",
      Icon: Clock,
    };
  }

  return {
    text: safeStr(v || "Unknown"),
    className: "border-slate-300/20 bg-slate-200/10 text-slate-100",
    Icon: AlertCircle,
  };
}

function isInsuranceInvoice(row: TechInvoiceRow): boolean {
  const pm = safeStr(row.payment_method).toLowerCase();
  return (row.insurance_due_cents ?? 0) > 0 || pm.includes("insurance");
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function normalizeObject(v: any): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  return {};
}

function digitsOnly(v: string) {
  return String(v ?? "").replace(/\D/g, "");
}

function normalizePhone(v: string) {
  const digits = digitsOnly(v);
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function readInsuranceFlagFromJson(v: any): boolean {
  const sj = normalizeObject(v);
  if (typeof sj.insurance_covers_repairs === "boolean") return sj.insurance_covers_repairs;
  if (typeof sj.insurance_covered === "boolean") return sj.insurance_covered;
  return false;
}

function readInsuranceFlatPriceCentsFromJson(v: any): number | null {
  const sj = normalizeObject(v);

  const raw =
    typeof sj.insurance_flat_price_cents === "number"
      ? sj.insurance_flat_price_cents
      : typeof sj.insurance_flat_price === "number"
        ? Math.round(sj.insurance_flat_price * 100)
        : null;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw);

  return null;
}

function readInsuranceMetaFromJson(v: any): InsuranceMeta {
  const sj = normalizeObject(v);
  const meta = normalizeObject(sj.insurance_meta);

  return {
    referral_number: typeof meta.referral_number === "string" ? meta.referral_number : "",
    vin: typeof meta.vin === "string" ? meta.vin : "",
    vehicle_year:
      typeof meta.vehicle_year === "string"
        ? meta.vehicle_year
        : meta.vehicle_year != null
          ? String(meta.vehicle_year)
          : "",
    vehicle_make: typeof meta.vehicle_make === "string" ? meta.vehicle_make : "",
    vehicle_model: typeof meta.vehicle_model === "string" ? meta.vehicle_model : "",
    customer_name: typeof meta.customer_name === "string" ? meta.customer_name : "",
    customer_address: typeof meta.customer_address === "string" ? meta.customer_address : "",
    customer_phone: typeof meta.customer_phone === "string" ? meta.customer_phone : "",
    shop_name: typeof meta.shop_name === "string" ? meta.shop_name : "",
    shop_address: typeof meta.shop_address === "string" ? meta.shop_address : "",
    shop_phone: typeof meta.shop_phone === "string" ? meta.shop_phone : "",
    shop_fed_tax_id: typeof meta.shop_fed_tax_id === "string" ? meta.shop_fed_tax_id : "",
    insurance_name:
      typeof meta.insurance_name === "string"
        ? meta.insurance_name
        : typeof meta.carrier_name === "string"
          ? meta.carrier_name
          : typeof meta.insurance_company === "string"
            ? meta.insurance_company
            : "",
    date_of_loss:
      typeof meta.date_of_loss === "string"
        ? meta.date_of_loss
        : typeof meta.dol === "string"
          ? meta.dol
          : "",
    line_items: Array.isArray(meta.line_items) ? meta.line_items : [],
    signature_data_url: typeof meta.signature_data_url === "string" ? meta.signature_data_url : "",
    signature_signed_at: typeof meta.signature_signed_at === "string" ? meta.signature_signed_at : "",
    insurance_payment_received:
      typeof meta.insurance_payment_received === "boolean" ? meta.insurance_payment_received : false,
    insurance_payment_received_at:
      typeof meta.insurance_payment_received_at === "string" ? meta.insurance_payment_received_at : "",
    insurance_payment_received_by:
      typeof meta.insurance_payment_received_by === "string" ? meta.insurance_payment_received_by : "",
  };
}

function buildPatchedServicesJson(
  currentServicesJson: any,
  patch: Record<string, any>
): Record<string, any> {
  const base = normalizeObject(currentServicesJson);
  const insuranceMeta = normalizeObject(base.insurance_meta);

  return {
    ...base,
    insurance_meta: {
      ...insuranceMeta,
      ...patch,
    },
  };
}

function getInsuranceAdminValidation(row: TechInvoiceRow): InsuranceValidationResult {
  const services = normalizeObject(row.services_json);
  const meta = readInsuranceMetaFromJson(services);

  const insuranceMode =
    readInsuranceFlagFromJson(services) ||
    Number(row.insurance_due_cents ?? 0) > 0 ||
    safeStr(row.payment_method).toLowerCase().includes("insurance");

  const lineItemUnitPriceRaw =
    Array.isArray(meta.line_items) && meta.line_items[0]?.unit_price_cents != null
      ? Number(meta.line_items[0].unit_price_cents)
      : readInsuranceFlatPriceCentsFromJson(services);
  const lineItemUnitPrice =
    Number.isFinite(Number(lineItemUnitPriceRaw)) && Number(lineItemUnitPriceRaw) > 0
      ? Math.round(Number(lineItemUnitPriceRaw))
      : null;
  const invoiceInsuranceDue = Math.round(Number(row.insurance_due_cents ?? 0) || 0);
  const billingAmountCents =
    lineItemUnitPrice != null
      ? lineItemUnitPrice
      : invoiceInsuranceDue > 0
        ? invoiceInsuranceDue
        : null;

  const missing: string[] = [];
  const mismatches: string[] = [];

  if (!insuranceMode) {
    return {
      insuranceMode: false,
      isComplete: false,
      missing,
      mismatches,
      meta,
      lineItemUnitPrice: null,
    };
  }

  if (digitsOnly(meta.referral_number).length !== 6) missing.push("Referral number");
  if (safeStr(meta.vin).trim().length !== 17) missing.push("VIN");
  if (!safeStr(meta.vehicle_year).trim()) missing.push("Vehicle year");
  if (!safeStr(meta.vehicle_make).trim()) missing.push("Vehicle make");
  if (!safeStr(meta.vehicle_model).trim()) missing.push("Vehicle model");
  if (billingAmountCents == null) missing.push("Billing amount");
  if (!safeStr(meta.customer_name).trim()) missing.push("Customer name");
  if (!safeStr(meta.customer_address).trim()) missing.push("Customer address");
  if (normalizePhone(meta.customer_phone).length !== 10) missing.push("Customer phone");
  if (!safeStr(meta.shop_address).trim()) missing.push("Shop address");
  if (normalizePhone(meta.shop_phone).length !== 10) missing.push("Shop phone");
  if (!safeStr(meta.shop_fed_tax_id).trim()) missing.push("Fed tax ID");
  if (!safeStr(meta.signature_data_url).trim()) missing.push("Signature");

  const expectedInsuranceDue = billingAmountCents;

  if (invoiceInsuranceDue <= 0) {
    mismatches.push("Insurance due is missing");
  }

  if (
    lineItemUnitPrice != null &&
    invoiceInsuranceDue > 0 &&
    lineItemUnitPrice !== invoiceInsuranceDue
  ) {
    mismatches.push("Line item price should match insurance due");
  }

  if (Number(row.customer_due_cents ?? 0) !== 0) {
    mismatches.push("Customer due must be $0");
  }

  if (Number(row.total_cents ?? 0) !== 0) {
    mismatches.push("Total must be $0");
  }

  if (Number(row.tax_cents ?? 0) !== 0) {
    mismatches.push("Tax must be $0");
  }

  if (Number.isFinite(expectedInsuranceDue) && Number(row.subtotal_cents ?? 0) !== expectedInsuranceDue) {
    mismatches.push("Subtotal should match insurance due");
  }

  if (Number.isFinite(expectedInsuranceDue) && Number(row.discount_cents ?? 0) !== expectedInsuranceDue) {
    mismatches.push("Discount should match insurance due");
  }

  return {
    insuranceMode: true,
    isComplete: missing.length === 0 && mismatches.length === 0,
    missing,
    mismatches,
    meta,
    lineItemUnitPrice:
      lineItemUnitPrice,
  };
}

/* ----------------------------- Fetch ----------------------------- */

async function fetchInsuranceTechInvoices(): Promise<TechInvoiceRow[]> {
  const { data, error } = await supabaseClient
    .from("tech_invoices")
    .select(
      [
        "id",
        "invoice_number",
        "technician_email",
        "client_id",
        "vehicle_id",
        "appointment_id",
        "invoice_date",
        "status",
        "services_json",
        "windshield_repairs_json",
        "appointment_snapshot",
        "subtotal_cents",
        "discount_percent",
        "discount_cents",
        "tax_rate_percent",
        "tax_cents",
        "total_cents",
        "payment_method",
        "payment_note",
        "customer_signature",
        "created_at",
        "paid_at",
        "final_paid_cents",
        "stripe_checkout_session_id",
        "stripe_payment_intent_id",
        "promo_code",
        "stripe_promotion_code_id",
        "promo_discount_cents",
        "insurance_due_cents",
        "customer_due_cents",
        "customer_email",
        "customer_name",
        "service_address",
        "crack_out_occurred",
        "crack_out_notes",
        "crack_out_media_urls",
        "repair_outcome",
        "crack_out_at",
        "crack_out_cause",
        "crack_out_photo_url",
        "replacement_required",
        "replacement_status",
      ].join(",")
    )
    .or("insurance_due_cents.gt.0,payment_method.ilike.%insurance%")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  return ((data ?? []) as unknown as TechInvoiceRow[]).filter(isInsuranceInvoice);
}

/* ----------------------------- CSV Export ----------------------------- */

function toCsv(rows: TechInvoiceRow[]) {
  const headers = [
    "invoice_number",
    "status",
    "invoice_date",
    "customer_name",
    "customer_email",
    "technician_email",
    "service_address",
    "payment_method",
    "subtotal_cents",
    "discount_cents",
    "tax_cents",
    "total_cents",
    "insurance_due_cents",
    "customer_due_cents",
    "final_paid_cents",
    "paid_at",
    "created_at",
    "payment_note",
  ];

  const esc = (v: any) => `"${safeStr(v).replace(/"/g, '""')}"`;

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          // @ts-ignore
          const v = r[h];
          return esc(v ?? "");
        })
        .join(",")
    ),
  ];

  return lines.join("\n");
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ----------------------------- Tiny UI bits ----------------------------- */

function MoneyPill({
  label,
  value,
  tone = "sky",
}: {
  label: string;
  value: string;
  tone?: "sky" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/25 bg-emerald-400/10"
      : tone === "amber"
        ? "border-amber-300/25 bg-amber-400/10"
        : tone === "rose"
          ? "border-rose-300/25 bg-rose-400/10"
          : "border-sky-300/25 bg-sky-400/10";

  return (
    <div className={`rounded-2xl border ${toneClass} p-3`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300/80">{label}</div>
      <div className="mt-1 text-[22px] leading-none font-extrabold text-slate-50 tabular-nums drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]">
        {value}
      </div>
    </div>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-300/70">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-50">{value}</div>
    </div>
  );
}

/* ----------------------------- Page ----------------------------- */

export default function AdminInsurancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "pending" | "paid" | "denied" | "unknown"
  >("all");

  const invoicesQ = useQuery({
    queryKey: ["admin-insurance-tech-invoices-v6"],
    queryFn: fetchInsuranceTechInvoices,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const toggleInsurancePaymentMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      currentServicesJson,
      nextPaidState,
    }: {
      invoiceId: string;
      currentServicesJson: any;
      nextPaidState: boolean;
    }) => {
      const nowIso = new Date().toISOString();

      const patchedServicesJson = buildPatchedServicesJson(currentServicesJson, {
        insurance_payment_received: nextPaidState,
        insurance_payment_received_at: nextPaidState ? nowIso : "",
        insurance_payment_received_by: nextPaidState ? "admin_portal" : "",
      });

      const payload: Record<string, any> = {
        services_json: patchedServicesJson,
      };

      if (nextPaidState) {
        payload.paid_at = nowIso;
        payload.final_paid_cents = Number(currentServicesJson?.insurance_due_cents ?? 0) || undefined;
      }

      const { error } = await supabaseClient
        .from("tech_invoices")
        .update(payload)
        .eq("id", invoiceId);

      if (error) throw error;

      return { ok: true };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-insurance-tech-invoices-v6"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }).catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] }).catch(() => {});
    },
  });

  const rows = invoicesQ.data ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const matchesSearch = (r: TechInvoiceRow) => {
      const insurance = getInsuranceAdminValidation(r);
      const meta = insurance.meta;

      if (!needle) return true;

      const hay = [
        r.invoice_number,
        r.status,
        r.customer_name,
        r.customer_email,
        r.technician_email,
        r.payment_method,
        r.payment_note,
        meta.referral_number,
        meta.insurance_name,
        meta.date_of_loss,
        meta.vehicle_make,
        insurance.missing.join(" "),
        insurance.mismatches.join(" "),
        meta.insurance_payment_received ? "payment received" : "payment pending",
      ]
        .map((x) => safeStr(x).toLowerCase())
        .join(" • ");

      return hay.includes(needle);
    };

    const matchesStatus = (r: TechInvoiceRow) => {
      if (statusFilter === "all") return true;

      const s = normStatus(r.status);

      if (statusFilter === "paid") return ["paid", "completed", "closed", "settled", "success"].includes(s);
      if (statusFilter === "pending") return ["pending", "sent", "submitted", "processing", "open"].includes(s);
      if (statusFilter === "draft") return s === "draft";
      if (statusFilter === "denied") return ["denied", "rejected", "void", "canceled", "cancelled", "failed"].includes(s);

      return s === "unknown" || !s;
    };

    return rows.filter((r) => matchesSearch(r) && matchesStatus(r));
  }, [rows, q, statusFilter]);

  const totals = useMemo(() => {
    const validations = filtered.map(getInsuranceAdminValidation);

    const totalInvoices = filtered.length;
    const insuranceDueCents = filtered.reduce((acc, r) => acc + (Number(r.insurance_due_cents ?? 0) || 0), 0);
    const completeCount = validations.filter((v) => v.isComplete).length;
    const needsReviewCount = validations.filter((v) => !v.isComplete).length;
    const avgInsurance = totalInvoices ? Math.round(insuranceDueCents / totalInvoices) : 0;
    const receivedCount = validations.filter((v) => v.meta.insurance_payment_received).length;

    return {
      totalInvoices,
      insuranceDueCents,
      completeCount,
      needsReviewCount,
      avgInsurance,
      receivedCount,
    };
  }, [filtered]);

  const canExport = filtered.length > 0 && !invoicesQ.isFetching;

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const r of filtered) {
      const s = normStatus(r.status);
      map.set(s, (map.get(s) ?? 0) + 1);
    }

    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 p-5 md:p-7">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -inset-24 opacity-80"
            style={{
              background:
                "radial-gradient(900px 520px at 15% 10%, rgba(56,189,248,0.24), transparent 55%), radial-gradient(820px 540px at 88% 80%, rgba(129,140,248,0.22), transparent 60%), radial-gradient(720px 520px at 55% 35%, rgba(34,197,94,0.10), transparent 60%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background:
                "linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.65), rgba(2,6,23,0.85))",
            }}
          />
        </div>

        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/10 shadow-[0_0_32px_rgba(56,189,248,0.25)]">
                <ShieldCheck className="h-5 w-5 text-sky-200" />
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-50">
                  Insurance
                </h1>
                <p className="text-sm text-slate-200/80">
                  Simplified insurance list with validation notes before opening each invoice.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-200/70">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <Sparkles className="h-3.5 w-3.5 text-sky-200/90" />
                Customer name • Referral # • Insurance name • DOL • Car make
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
                <Shield className="h-3.5 w-3.5 text-emerald-200" />
                Missing notes preserved
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-white/10 bg-slate-900/40 hover:bg-slate-900/60 text-slate-100"
              onClick={() => invoicesQ.refetch()}
              disabled={invoicesQ.isFetching}
            >
              <RefreshCw className={["mr-2 h-4 w-4", invoicesQ.isFetching ? "animate-spin" : ""].join(" ")} />
              Refresh
            </Button>

            <Button
              variant="outline"
              className="border-white/10 bg-slate-900/40 hover:bg-slate-900/60 text-slate-100"
              onClick={() => {
                const csv = toCsv(filtered);
                const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
                downloadText(`glass-guardian-insurance_${stamp}.csv`, csv);
              }}
              disabled={!canExport}
              title={!canExport ? "No rows to export" : "Download CSV"}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            <Button
              className="bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-100"
              onClick={() => router.push("/admin/portal/invoices")}
              title="Go to invoices"
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              Invoices
              <ArrowRight className="ml-2 h-4 w-4 opacity-80" />
            </Button>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
          <MoneyPill label="Insurance invoices" value={`${totals.totalInvoices}`} tone="sky" />
          <MoneyPill label="Complete" value={`${totals.completeCount}`} tone="emerald" />
          <MoneyPill label="Needs review" value={`${totals.needsReviewCount}`} tone="rose" />
          <MoneyPill label="Received" value={`${totals.receivedCount}`} tone="emerald" />
          <MoneyPill label="Avg insurance due" value={fmtCents(totals.avgInsurance)} tone="amber" />
        </div>
      </div>

      <div className="sticky top-[86px] z-20">
        <Card className="border-white/10 bg-slate-950/55 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-sky-200/90" />
              Search & Filters
              <span className="ml-2 text-[11px] font-normal text-slate-300/70">
                Showing <span className="text-slate-50 font-semibold tabular-nums">{filtered.length}</span> results
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search customer, referral #, insurance name, DOL, make, missing notes…"
                  className="pl-10 bg-slate-950/40 border-white/10 text-slate-100 placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(["all", "draft", "pending", "paid", "denied", "unknown"] as const).map((k) => {
                  const active = statusFilter === k;
                  const count = k === "all" ? filtered.length : statusCounts.get(k) ?? 0;

                  return (
                    <button
                      key={k}
                      onClick={() => setStatusFilter(k)}
                      className={[
                        "rounded-full border px-3 py-1 text-[11px] transition-all duration-150 inline-flex items-center gap-2",
                        active
                          ? "border-sky-400/70 bg-sky-500/20 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                          : "border-white/10 bg-slate-950/30 text-slate-300 hover:bg-slate-950/45",
                      ].join(" ")}
                    >
                      <span>{k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}</span>
                      <span className="tabular-nums rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-100">
                        {clamp(count, 0, 9999)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-900/40 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-sky-200/90" />
            Insurance invoices
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 md:p-5">
          {invoicesQ.isLoading && (
            <div className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-56 rounded bg-white/10" />
                <div className="h-4 w-72 rounded bg-white/10" />
                <div className="h-4 w-64 rounded bg-white/10" />
                <div className="h-4 w-60 rounded bg-white/10" />
              </div>
            </div>
          )}

          {!invoicesQ.isLoading && invoicesQ.isError && (
            <div className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-200 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-rose-100">Couldn’t read tech_invoices</div>
                  <div className="text-xs text-rose-100/80">
                    This is typically RLS permissions for admins. This page only reads from{" "}
                    <span className="font-semibold">public.tech_invoices</span>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {!invoicesQ.isLoading && !invoicesQ.isError && filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-sky-200 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-slate-100">No insurance invoices found</div>
                    <div className="text-xs text-slate-300/80">
                      That means insurance_due_cents is 0 and payment_method doesn’t include “insurance” on the rows in
                      scope — or your filters are too tight.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-slate-900/40 hover:bg-slate-900/60 text-slate-100"
                    onClick={() => {
                      setQ("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                  <Button
                    className="bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-100"
                    onClick={() => router.push("/admin/portal/invoices")}
                  >
                    Open Invoices
                    <ArrowRight className="ml-2 h-4 w-4 opacity-80" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!invoicesQ.isLoading && !invoicesQ.isError && filtered.length > 0 && (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {filtered.map((inv) => {
                  const badge = statusBadge(inv.status);
                  const StatusIcon = badge.Icon;
                  const insuranceCheck = getInsuranceAdminValidation(inv);
                  const meta = insuranceCheck.meta;
                  const isPaymentReceived = !!meta.insurance_payment_received;
                  const isTogglingThisCard =
                    toggleInsurancePaymentMutation.isPending &&
                    toggleInsurancePaymentMutation.variables?.invoiceId === inv.id;

                  return (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.18 }}
                      className="relative rounded-[2rem] border border-sky-300/20 bg-gradient-to-br from-slate-950/90 via-slate-950/70 to-slate-900/55 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] ring-1 ring-sky-200/10 transition-all duration-200 before:absolute before:inset-x-6 before:-top-px before:h-px before:bg-gradient-to-r before:from-transparent before:via-sky-300/55 before:to-transparent hover:-translate-y-1 hover:border-sky-300/35 hover:bg-slate-950/80 hover:shadow-[0_28px_90px_rgba(14,165,233,0.18)] md:p-5"
>
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-3 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={["inline-flex items-center gap-1.5 border", badge.className].join(" ")}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {badge.text}
                            </Badge>

                            <div className="inline-flex items-center gap-2 text-xs text-slate-100">
                              <Hash className="h-4 w-4 text-slate-400" />
                              <span className="font-semibold text-slate-50">{inv.invoice_number}</span>
                            </div>

                            {insuranceCheck.isComplete ? (
                              <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-100">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Complete
                              </Badge>
                            ) : (
                              <Badge className="border-amber-300/30 bg-amber-400/10 text-amber-100">
                                <AlertCircle className="mr-1 h-3.5 w-3.5" />
                                Needs Review
                              </Badge>
                            )}

                            {isPaymentReceived ? (
                              <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-100">
                                <Banknote className="mr-1 h-3.5 w-3.5" />
                                Insurance Payment Received
                              </Badge>
                            ) : (
                              <Badge className="border-slate-300/20 bg-slate-200/10 text-slate-100">
                                <Clock className="mr-1 h-3.5 w-3.5" />
                                Insurance Payment Pending
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                            <InfoChip
                              icon={ClipboardList}
                              label="Customer name"
                              value={meta.customer_name || inv.customer_name || "—"}
                            />

                            <InfoChip icon={Hash} label="Referral #" value={meta.referral_number || "—"} />

                            <InfoChip
                              icon={ShieldCheck}
                              label="Insurance name"
                              value={meta.insurance_name || safeStr(inv.payment_method) || "—"}
                            />

                            <InfoChip
                              icon={Calendar}
                              label="DOL"
                              value={meta.date_of_loss ? fmtDate(meta.date_of_loss) : "—"}
                            />

                            <InfoChip icon={Car} label="Make of car" value={meta.vehicle_make || "—"} />
                          </div>

                          {(insuranceCheck.missing.length > 0 || insuranceCheck.mismatches.length > 0) && (
                            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3">
                              <div className="text-[10px] uppercase tracking-[0.22em] text-amber-100/80">
                                What admin should check when opening invoice
                              </div>

                              {insuranceCheck.missing.length > 0 && (
                                <div className="mt-2 text-xs text-amber-50">
                                  <span className="font-semibold">Missing:</span>{" "}
                                  {insuranceCheck.missing.join(", ")}
                                </div>
                              )}

                              {insuranceCheck.mismatches.length > 0 && (
                                <div className="mt-2 text-xs text-amber-50">
                                  <span className="font-semibold">Billing mismatch:</span>{" "}
                                  {insuranceCheck.mismatches.join(", ")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 w-full xl:w-[320px] space-y-2">
                          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300/70">
                                Quick financials
                              </div>
                              <span className="text-[11px] text-slate-200/70 tabular-nums">
                                {fmtCents(inv.insurance_due_cents)}
                              </span>
                            </div>

                            <div className="mt-2 text-xs text-slate-300/80">
                              Insurance due:{" "}
                              <span className="font-semibold text-slate-50">{fmtCents(inv.insurance_due_cents)}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-300/80">
                              Customer due:{" "}
                              <span className="font-semibold text-slate-50">{fmtCents(inv.customer_due_cents)}</span>
                            </div>

                            <div
                              className={[
                                "mt-3 rounded-2xl border p-3 transition-all",
                                isPaymentReceived
                                  ? "border-emerald-300/25 bg-emerald-400/10"
                                  : "border-amber-300/20 bg-amber-400/10",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-200/80">
                                    Insurance payment
                                  </div>
                                  <div
                                    className={[
                                      "text-sm font-semibold",
                                      isPaymentReceived ? "text-emerald-100" : "text-amber-100",
                                    ].join(" ")}
                                  >
                                    {isPaymentReceived ? "Marked received" : "Awaiting confirmation"}
                                  </div>

                                  {isPaymentReceived && meta.insurance_payment_received_at ? (
                                    <div className="text-[11px] text-slate-200/70">
                                      Confirmed {fmtDateTime(meta.insurance_payment_received_at)}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-200/70">
                                      Use this to solidify that insurance payment came in.
                                    </div>
                                  )}
                                </div>

                                <Button
                                  type="button"
                                  disabled={isTogglingThisCard}
                                  onClick={async () => {
                                    try {
                                      await toggleInsurancePaymentMutation.mutateAsync({
                                        invoiceId: inv.id,
                                        currentServicesJson: inv.services_json,
                                        nextPaidState: !isPaymentReceived,
                                      });
                                    } catch (e) {
                                      console.error("[ToggleInsurancePayment] failed:", e);
                                    }
                                  }}
                                  className={
                                    isPaymentReceived
                                      ? "border border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/20"
                                      : "border border-amber-300/30 bg-amber-400/15 text-amber-100 hover:bg-amber-400/20"
                                  }
                                >
                                  {isTogglingThisCard ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Saving…
                                    </>
                                  ) : isPaymentReceived ? (
                                    <>
                                      <CheckCircle2 className="mr-2 h-4 w-4" />
                                      Received
                                    </>
                                  ) : (
                                    <>
                                      <Banknote className="mr-2 h-4 w-4" />
                                      Mark received
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="flex-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-100"
                              onClick={() => router.push(`/admin/portal/invoices/${inv.id}`)}
                              disabled={!inv.id}
                              title={inv.id ? "Open the actual invoice page" : "This invoice is missing an id"}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              View invoice
                              <ArrowRight className="ml-2 h-4 w-4 opacity-80" />
                            </Button>
                          </div>

                          {inv.technician_email && (
                            <div className="text-[11px] text-slate-200/70">
                              Tech: <span className="text-slate-50 font-semibold">{inv.technician_email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      <style jsx global>{`
        .tabular-nums {
          font-variant-numeric: tabular-nums;
        }

        .gg-force-readable,
        .gg-force-readable * {
          color: rgb(248 250 252) !important;
        }
      `}</style>
    </div>
  );
}
