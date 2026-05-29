// app/user/(protected)/dashboard/pay/[id]/receipt/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  ArrowLeft,
  Printer,
  Loader2,
  ShieldCheck,
  Car,
  ReceiptText,
  Calendar,
  CheckCircle2,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";

import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  vehicle_id: string | null;

  invoice_date: string;
  status: string;

  customer_email: string | null;
  customer_name?: string | null;

  services_json: { glass_total?: number; misc_total?: number } | null;
  windshield_repairs_json: any[] | null;

  subtotal_cents: number;
  discount_percent: number | null;
  discount_cents: number;
  tax_rate_percent: number | null;
  tax_cents: number;
  total_cents: number;

  final_paid_cents?: number | null;
  paid_at?: string | null;
  payment_method?: string | null;
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

const COMPANY = {
  name: "Glass Guardian",
  legalLine: "Chip & Crack Repair",
  phone: "(909) 529-1798",
  email: "info@glassguardianchipandcrackrepair.com",
  location: "Riverside, California",
  logoSrc: "/branding/glass-guardian-gold.png",
};

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

function inferInsuranceCoverage(invoice: InvoiceRow | null) {
  if (!invoice) return { insuranceMode: false, insuranceCoveredCents: 0 };

  const subtotal = invoice.subtotal_cents ?? 0;
  const discount = invoice.discount_cents ?? 0;
  const serviceNet = invoice.total_cents ?? 0;

  const insuranceMode = subtotal > 0 && serviceNet === 0 && discount >= subtotal;
  const insuranceCoveredCents = insuranceMode ? discount : 0;

  return { insuranceMode, insuranceCoveredCents };
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

function formatPaymentMethod(method: string | null | undefined) {
  const raw = String(method ?? "").trim();
  if (!raw) return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function UserInvoiceReceiptPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;

  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      const email = session?.user?.email ?? null;

      if (!email) {
        router.replace(
          `/user/login?redirect=${encodeURIComponent(
            `/user/dashboard/pay/${invoiceId}/receipt`
          )}`
        );
        return;
      }

      if (!cancelled) {
        setUserEmail(email);
        setAuthChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, invoiceId]);

  const { data: invoice, isLoading: loadingInvoice } = useQuery<
    InvoiceRow | null
  >({
    queryKey: ["user-invoice-receipt", invoiceId],
    enabled: !!invoiceId && authChecked,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          [
            "id",
            "invoice_number",
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
            "final_paid_cents",
            "paid_at",
            "payment_method",
          ].join(", ")
        )
        .eq("id", invoiceId)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as InvoiceRow) ?? null;
    },
  });

  const { data: vehicle } = useQuery<Vehicle | null>({
    queryKey: ["user-invoice-receipt-vehicle", invoice?.vehicle_id],
    enabled: !!invoice?.vehicle_id,
    staleTime: 10 * 60_000,
    gcTime: 20 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("client_vehicles")
        .select("id, year, make, model, license_plate, color")
        .eq("id", invoice!.vehicle_id!)
        .maybeSingle();

      if (error) throw error;
      return (data as Vehicle) ?? null;
    },
  });

  const isLoading = !authChecked || loadingInvoice;

  const isPaid = String(invoice?.status ?? "").toLowerCase() === "paid";
  const emailMismatch =
    !!invoice?.customer_email &&
    !!userEmail &&
    invoice.customer_email.toLowerCase() !== userEmail.toLowerCase();

  const serviceDate = React.useMemo(
    () => toLocalDateOnly(invoice?.invoice_date) ?? null,
    [invoice?.invoice_date]
  );

  const warrantyEnd = React.useMemo(
    () => addYearsDateOnly(serviceDate, 1),
    [serviceDate]
  );

  const paidDate = React.useMemo(
    () => toLocalDateOnly(invoice?.paid_at) ?? null,
    [invoice?.paid_at]
  );

  const { insuranceMode, insuranceCoveredCents } = React.useMemo(
    () => inferInsuranceCoverage(invoice ?? null),
    [invoice]
  );

  const servicePreCoverageCents = React.useMemo(() => {
    const subtotal = invoice?.subtotal_cents ?? 0;
    const tax = invoice?.tax_cents ?? 0;
    return subtotal + tax;
  }, [invoice?.subtotal_cents, invoice?.tax_cents]);

  const processingFeeCents = !isPaid && !insuranceMode ? PROCESSING_FEE_CENTS : 0;

  const customerDueCents = React.useMemo(() => {
    if (!invoice) return 0;
    return (invoice.total_cents ?? 0) + processingFeeCents;
  }, [invoice, processingFeeCents]);

  const amountPaidCents = React.useMemo(() => {
    if (!invoice || !isPaid) return 0;
    if (insuranceMode) return 0;

    if (typeof invoice.final_paid_cents === "number") {
      return invoice.final_paid_cents;
    }

    if (isStripeLikePaymentMethod(invoice.payment_method)) {
      return (invoice.total_cents ?? 0) + PROCESSING_FEE_CENTS;
    }

    return invoice.total_cents ?? 0;
  }, [invoice, isPaid, insuranceMode]);

  const receiptServiceTotalDisplayCents = insuranceMode
    ? servicePreCoverageCents
    : invoice?.total_cents ?? 0;

  const glassLineDollars = React.useMemo(() => {
    const rawGlass = invoice?.services_json?.glass_total;

    if (typeof rawGlass === "number" && Number.isFinite(rawGlass) && rawGlass > 0) {
      return rawGlass;
    }

    return (invoice?.subtotal_cents ?? 0) / 100;
  }, [invoice?.services_json?.glass_total, invoice?.subtotal_cents]);

  const miscLineDollars = React.useMemo(() => {
    const rawMisc = invoice?.services_json?.misc_total;
    if (typeof rawMisc === "number" && Number.isFinite(rawMisc) && rawMisc > 0) {
      return rawMisc;
    }
    return 0;
  }, [invoice?.services_json?.misc_total]);

  function handlePrint() {
    setPrinting(true);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  React.useEffect(() => {
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  if (!isLoading && (!invoice || !invoice.customer_email || !userEmail || emailMismatch)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full border border-slate-700 bg-slate-900/90 text-slate-50 shadow-2xl">
          <CardHeader>
            <CardTitle>Receipt Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              This receipt is not available under your account.
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

  return (
    <div className={`min-h-screen bg-slate-950 p-4 md:p-8 ${printing ? "printing-mode" : ""}`}>
      <style jsx global>{`
        .screen-only { display: block; }
        .print-only { display: none; }

        @media print {
          @page {
            size: letter;
            margin: 7mm;
          }

          html, body {
            background: #ffffff !important;
            color: #0b0f1a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0 !important;
            padding: 0 !important;
          }

          *, *::before, *::after {
            box-sizing: border-box !important;
          }

          body * {
            visibility: hidden !important;
          }

          #print-root, #print-root * {
            visibility: visible !important;
            -webkit-text-fill-color: currentColor !important;
          }

          #print-root {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #0b0f1a !important;
          }

          #print-root * {
            text-shadow: none !important;
          }

          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          .no-print, .no-print * { display: none !important; }

          .paper {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
            transform: none !important;
            zoom: 1 !important;
          }

          .paper-inner {
            width: 100% !important;
            max-width: 194mm !important;
            margin: 0 auto !important;
            position: relative !important;
          }

          .paper-card {
            position: relative !important;
            isolation: isolate !important;
            border: 1px solid #d6d9e2 !important;
            border-radius: 16px !important;
            padding: 12px !important;
            background:
              linear-gradient(180deg, rgba(196,153,63,0.04) 0%, rgba(255,255,255,0) 82%),
              #ffffff !important;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.65) inset !important;
            overflow: hidden !important;
            color: #0b0f1a !important;
          }

          .paper-card::before {
            content: "" !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            height: 3px !important;
            background: linear-gradient(90deg, #8b6a21 0%, #d4b164 50%, #8b6a21 100%) !important;
            z-index: 3 !important;
          }

          .paper-brand-watermark {
            position: absolute !important;
            inset: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            pointer-events: none !important;
            z-index: 0 !important;
          }

          .paper-brand-watermark img {
            width: 128mm !important;
            height: auto !important;
            object-fit: contain !important;
            opacity: 0.028 !important;
            filter: saturate(0.9) contrast(0.95) !important;
          }

          .paper-watermark {
            position: absolute !important;
            right: 9mm !important;
            top: 24mm !important;
            transform: rotate(-18deg) !important;
            font-size: 26px !important;
            font-weight: 900 !important;
            letter-spacing: 0.16em !important;
            color: rgba(16, 185, 129, 0.09) !important;
            border: 2px solid rgba(16, 185, 129, 0.12) !important;
            border-radius: 12px !important;
            padding: 6px 12px !important;
            z-index: 0 !important;
            pointer-events: none !important;
          }

          .paper-top,
          .paper-divider,
          .paper-grid,
          .paper-section-card,
          .paper-note,
          .paper-signature-wrap,
          .paper-footer,
          .paper-brand-card,
          .paper-meta-card,
          .paper-section-head,
          .paper-section-body,
          .paper-totals {
            position: relative !important;
            z-index: 2 !important;
          }

          .paper-top {
            display: grid !important;
            grid-template-columns: minmax(0, 1.35fr) minmax(190px, 0.9fr) !important;
            gap: 10px !important;
            align-items: stretch !important;
          }

          .paper-brand-card,
          .paper-meta-card {
            border: 1px solid #e3e7ef !important;
            border-radius: 12px !important;
            background: rgba(255,255,255,0.96) !important;
            padding: 10px !important;
            color: #0b0f1a !important;
          }

          .paper-brand {
            display: flex !important;
            align-items: flex-start !important;
            gap: 10px !important;
            min-width: 0 !important;
          }

          .paper-logo-wrap {
            width: 52px !important;
            height: 52px !important;
            border-radius: 12px !important;
            border: 1px solid #eadcb5 !important;
            background: linear-gradient(180deg, #fffaf0, #ffffff) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex: 0 0 auto !important;
          }

          .paper-logo {
            width: 40px !important;
            height: 40px !important;
            object-fit: contain !important;
            display: block !important;
          }

          .paper-kicker {
            font-size: 8px !important;
            font-weight: 900 !important;
            letter-spacing: 0.18em !important;
            text-transform: uppercase !important;
            color: #8b6a21 !important;
            margin-bottom: 3px !important;
          }

          .paper-title {
            font-size: 19px !important;
            font-weight: 900 !important;
            margin: 0 !important;
            line-height: 1.02 !important;
            color: #0b0f1a !important;
          }

          .paper-sub {
            font-size: 10.5px !important;
            color: #344054 !important;
            margin-top: 2px !important;
            line-height: 1.3 !important;
          }

          .paper-contact-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 4px 10px !important;
            margin-top: 7px !important;
            font-size: 9.5px !important;
            color: #344054 !important;
            min-width: 0 !important;
          }

          .paper-contact-row {
            display: flex !important;
            align-items: flex-start !important;
            gap: 5px !important;
            min-width: 0 !important;
          }

          .paper-contact-row.full {
            grid-column: 1 / -1 !important;
          }

          .paper-contact-text {
            min-width: 0 !important;
            max-width: 100% !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            white-space: normal !important;
            line-height: 1.2 !important;
            color: #344054 !important;
          }

          .paper-dot {
            width: 4px !important;
            height: 4px !important;
            border-radius: 999px !important;
            background: #b48a34 !important;
            flex: 0 0 auto !important;
            margin-top: 4px !important;
          }

          .paper-meta-title {
            font-size: 8px !important;
            font-weight: 900 !important;
            letter-spacing: 0.18em !important;
            text-transform: uppercase !important;
            color: #667085 !important;
            margin-bottom: 6px !important;
          }

          .paper-meta-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 7px 10px !important;
          }

          .paper-meta-item {
            min-width: 0 !important;
          }

          .paper-label {
            font-size: 8px !important;
            font-weight: 800 !important;
            color: #667085 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
          }

          .paper-value {
            font-size: 11px !important;
            font-weight: 900 !important;
            color: #0b0f1a !important;
            margin-top: 2px !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            line-height: 1.2 !important;
          }

          .paper-pill {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 22px !important;
            padding: 4px 8px !important;
            border-radius: 999px !important;
            border: 1px solid #cfd5e1 !important;
            background: #f8fafc !important;
            color: #0b0f1a !important;
            font-size: 8px !important;
            font-weight: 900 !important;
            letter-spacing: 0.06em !important;
            text-transform: uppercase !important;
            white-space: nowrap !important;
          }

          .paper-divider {
            height: 1px !important;
            background: linear-gradient(90deg, rgba(139,106,33,0.12), rgba(139,106,33,0.55), rgba(139,106,33,0.12)) !important;
            margin: 9px 0 !important;
          }

          .paper-section-card {
            border: 1px solid #e3e7ef !important;
            border-radius: 12px !important;
            background: rgba(255,255,255,0.97) !important;
            overflow: hidden !important;
            color: #0b0f1a !important;
          }

          .paper-section-head {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 7px 10px !important;
            background: linear-gradient(180deg, #fcfcfd, #f8fafc) !important;
            border-bottom: 1px solid #e3e7ef !important;
          }

          .paper-section-title {
            font-size: 9px !important;
            font-weight: 900 !important;
            color: #101828 !important;
            letter-spacing: 0.06em !important;
            text-transform: uppercase !important;
          }

          .paper-section-body {
            padding: 9px 10px !important;
          }

          .paper-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 10px !important;
          }

          .paper-line-items {
            width: 100% !important;
            border-collapse: collapse !important;
            color: #0b0f1a !important;
          }

          .paper-line-items thead th {
            text-align: left !important;
            font-size: 8px !important;
            font-weight: 900 !important;
            color: #667085 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.06em !important;
            padding: 0 0 5px 0 !important;
          }

          .paper-line-items thead th:last-child {
            text-align: right !important;
          }

          .paper-line-items tbody td {
            font-size: 10px !important;
            color: #111827 !important;
            padding: 5px 0 !important;
            border-top: 1px solid #eef2f6 !important;
            vertical-align: top !important;
            line-height: 1.2 !important;
          }

          .paper-line-items tbody td:last-child {
            text-align: right !important;
            font-weight: 800 !important;
            color: #0b0f1a !important;
            white-space: nowrap !important;
          }

          .paper-totals {
            margin-top: 8px !important;
            margin-left: auto !important;
            width: 100% !important;
            max-width: 285px !important;
            border: 1px solid #dfe4ea !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            background: rgba(255,255,255,0.9) !important;
          }

          .paper-total-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 7px 10px !important;
            font-size: 10px !important;
            color: #111827 !important;
            border-top: 1px solid #eef2f6 !important;
            line-height: 1.2 !important;
          }

          .paper-total-row:first-child {
            border-top: 0 !important;
          }

          .paper-total-row strong {
            color: #0b0f1a !important;
            font-weight: 900 !important;
          }

          .paper-grand-total {
            background: linear-gradient(180deg, #fffaf0, #fffdf8) !important;
          }

          .paper-grand-total span,
          .paper-grand-total strong {
            font-size: 11px !important;
            font-weight: 900 !important;
          }

          .paper-policy-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 10px !important;
          }

          .paper-note {
            border: 1px solid #e5e7eb !important;
            background: rgba(252,252,253,0.97) !important;
            color: #1f2937 !important;
            border-radius: 12px !important;
            padding: 9px !important;
            font-size: 9px !important;
            line-height: 1.35 !important;
          }

          .paper-note.warranty {
            border-color: #dfe6d4 !important;
            background: rgba(247,250,245,0.97) !important;
          }

          .paper-signature-wrap {
            display: flex !important;
            justify-content: flex-end !important;
            margin-top: 8px !important;
          }

          .paper-signature-card {
            width: 100% !important;
            max-width: 210px !important;
            padding-top: 10px !important;
          }

          .paper-signature-line {
            border-top: 1px solid #98a2b3 !important;
            width: 100% !important;
            margin-bottom: 4px !important;
          }

          .paper-signature-label {
            font-size: 8px !important;
            color: #667085 !important;
            text-align: center !important;
            letter-spacing: 0.05em !important;
            text-transform: uppercase !important;
            font-weight: 800 !important;
          }

          .paper-footer {
            margin-top: 8px !important;
            padding-top: 7px !important;
            border-top: 1px solid #eaeef4 !important;
            font-size: 8.5px !important;
            color: #475467 !important;
            line-height: 1.25 !important;
            text-align: center !important;
          }

          .paper-title,
          .paper-value,
          .paper-total-row,
          .paper-total-row strong,
          .paper-line-items tbody td,
          .paper-line-items thead th,
          .paper-section-title,
          .paper-label,
          .paper-meta-title,
          .paper-kicker,
          .paper-sub,
          .paper-contact-text,
          .paper-signature-label,
          .paper-footer {
            color: #0b0f1a !important;
          }

          .paper-note,
          .paper-note * {
            color: #1f2937 !important;
          }

          .paper-note.warranty,
          .paper-note.warranty * {
            color: #1f2937 !important;
          }

          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .paper,
          .paper-card,
          .paper-top,
          .paper-grid,
          .paper-policy-grid,
          .paper-totals,
          .paper-section-card,
          .paper-note,
          .paper-signature-wrap {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between screen-only">
          <Button
            variant="outline"
            onClick={() => router.push(`/user/dashboard/pay/${invoiceId}`)}
            className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to invoice
          </Button>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-[11px] text-slate-400">
              For a cleaner receipt: disable “Headers &amp; Footers” in the print dialog.
            </div>
            <Button
              onClick={handlePrint}
              disabled={isLoading || !invoice || printing}
              className="bg-slate-50 text-slate-950 hover:bg-white font-semibold shadow-[0_18px_45px_rgba(255,255,255,0.10)]"
            >
              <Printer className="w-4 h-4 mr-2" />
              {printing ? "Preparing…" : "Print"}
            </Button>
          </div>
        </div>

        <div className="screen-only">
          <Card className="overflow-hidden border border-[#3a331f] bg-[radial-gradient(circle_at_top,_rgba(255,215,128,0.12),_transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <CardHeader className="border-b border-white/8 pb-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#6f5a24] bg-gradient-to-br from-[#1b1608] via-[#151108] to-slate-900 shadow-[inset_0_1px_0_rgba(255,220,140,0.25),0_12px_30px_rgba(0,0,0,0.35)]">
                    <Image
                      src={COMPANY.logoSrc}
                      alt="Glass Guardian logo"
                      fill
                      className="object-contain p-2"
                      priority
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/75">
                      Official Receipt
                    </div>
                    <CardTitle className="mt-1 text-2xl font-black tracking-tight text-white">
                      {COMPANY.name}
                    </CardTitle>
                    <div className="text-sm font-medium text-amber-100/85">
                      {COMPANY.legalLine}
                    </div>

                    <div className="mt-3 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-amber-300" />
                        <span>{COMPANY.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-amber-300" />
                        <span className="break-all">{COMPANY.email}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <MapPin className="h-3.5 w-3.5 text-amber-300" />
                        <span>{COMPANY.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 md:items-end">
                  <Badge
                    className={
                      isPaid
                        ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                        : "border-amber-300/70 bg-amber-500/15 text-amber-200"
                    }
                  >
                    {String(invoice?.status ?? "unknown").toUpperCase()}
                  </Badge>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Receipt Number
                    </div>
                    <div className="mt-1 text-xl font-black text-white">
                      #{invoice?.invoice_number ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {isPaid
                        ? `Paid ${paidDate ?? "—"}`
                        : `Service date ${serviceDate ?? "—"}`}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 md:p-6">
              {isLoading || !invoice ? (
                <div className="py-10 flex flex-col items-center gap-3 text-slate-200">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Loading receipt
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        Billed To
                      </div>
                      <div className="mt-2 text-lg font-bold text-white">
                        {invoice.customer_name || "Customer"}
                      </div>
                      <div className="mt-1 text-sm text-slate-300 break-all">
                        {invoice.customer_email || "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        Service Details
                      </div>
                      <div className="mt-2 space-y-1.5 text-sm text-slate-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-amber-300" />
                          <span>
                            <span className="text-slate-400">Service date:</span>{" "}
                            <span className="font-semibold text-white">{serviceDate ?? "—"}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-300" />
                          <span>
                            <span className="text-slate-400">Warranty through:</span>{" "}
                            <span className="font-semibold text-white">{warrantyEnd ?? "—"}</span>
                          </span>
                        </div>
                        {isPaid && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            <span>
                              <span className="text-slate-400">Payment method:</span>{" "}
                              <span className="font-semibold text-white">
                                {formatPaymentMethod(invoice.payment_method)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {vehicle && (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        <Car className="h-4 w-4 text-amber-300" />
                        Vehicle
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                        {vehicle.license_plate ? ` · Plate ${vehicle.license_plate}` : ""}
                        {vehicle.color ? ` · ${vehicle.color}` : ""}
                      </div>
                    </div>
                  )}

                  {invoice.windshield_repairs_json && invoice.windshield_repairs_json.length > 0 && (
                    <div className="no-print">
                      <WindshieldRepairMap invoice={invoice as any} readOnly />
                    </div>
                  )}

                  <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                    <div className="border-b border-white/8 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <ReceiptText className="h-4 w-4 text-amber-300" />
                        Receipt Breakdown
                      </div>
                    </div>

                    <div className="space-y-2 px-4 py-4 text-sm text-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Glass</span>
                        <span className="font-semibold">${glassLineDollars.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Miscellaneous</span>
                        <span className="font-semibold">${miscLineDollars.toFixed(2)}</span>
                      </div>

                      <Separator className="my-2 border-white/8 bg-white/8" />

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Subtotal</span>
                        <span className="font-semibold">
                          ${centsToDollars(invoice.subtotal_cents)}
                        </span>
                      </div>

                      {insuranceMode && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Insurance covered</span>
                          <span className="font-semibold text-emerald-300">
                            -${centsToDollars(insuranceCoveredCents)}
                          </span>
                        </div>
                      )}

                      {!insuranceMode && (invoice.discount_cents ?? 0) > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">
                            Discount {invoice.discount_percent ? `(${invoice.discount_percent}%)` : ""}
                          </span>
                          <span className="font-semibold text-emerald-300">
                            -${centsToDollars(invoice.discount_cents)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          Tax {invoice.tax_rate_percent ? `(${invoice.tax_rate_percent}%)` : ""}
                        </span>
                        <span className="font-semibold">+${centsToDollars(invoice.tax_cents)}</span>
                      </div>

                      <Separator className="my-2 border-white/8 bg-white/8" />

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Service total</span>
                        <span className="font-semibold">
                          ${centsToDollars(receiptServiceTotalDisplayCents)}
                        </span>
                      </div>

                      {!isPaid && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Processing fee</span>
                          <span className="font-semibold">
                            {processingFeeCents > 0
                              ? `+$${centsToDollars(processingFeeCents)}`
                              : "$0.00"}
                          </span>
                        </div>
                      )}

                      <Separator className="my-2 border-white/8 bg-white/8" />

                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-white">
                          {isPaid ? "Total paid" : "Total due"}
                        </span>
                        <span className="text-2xl font-black text-emerald-200">
                          ${centsToDollars(isPaid ? amountPaidCents : customerDueCents)}
                        </span>
                      </div>

                      {insuranceMode && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                          Insurance covered the repair. No processing fee is required.
                        </div>
                      )}
                    </div>
                  </div>

                  {warrantyEnd && (
                    <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 flex items-start gap-3 text-xs text-emerald-100">
                      <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-300" />
                      <div>
                        <p className="font-semibold">Windshield Repair Warranty</p>
                        <p className="text-emerald-100/90">
                          Covered through <span className="font-semibold">{warrantyEnd}</span> for damage repaired on{" "}
                          <span className="font-semibold">{serviceDate ?? "—"}</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  {isPaid && (
                    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        Payment complete
                      </div>
                      <p className="mt-1 text-xs text-emerald-100/80">
                        This serves as your official customer receipt. Please keep it for your records.
                      </p>
                    </div>
                  )}

                  <div className="text-[10px] leading-5 text-slate-400">
                    Printed from the Glass Guardian customer portal. This receipt reflects the service and payment details currently saved to your account.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div id="print-root" className="print-only">
          {!invoice ? null : (
            <div className="paper">
              <div className="paper-inner">
                <div className="paper-card">
                  <div className="paper-brand-watermark" aria-hidden="true">
                    <img src={COMPANY.logoSrc} alt="" />
                  </div>

                  {isPaid && <div className="paper-watermark">PAID</div>}

                  <div className="paper-top avoid-break">
                    <div className="paper-brand-card">
                      <div className="paper-brand">
                        <div className="paper-logo-wrap">
                          <img
                            src={COMPANY.logoSrc}
                            alt="Glass Guardian logo"
                            className="paper-logo"
                          />
                        </div>

                        <div style={{ minWidth: 0, maxWidth: "100%" }}>
                          <div className="paper-kicker">Official Customer Receipt</div>
                          <h1 className="paper-title">{COMPANY.name}</h1>
                          <div className="paper-sub">{COMPANY.legalLine}</div>

                          <div className="paper-contact-grid">
                            <div className="paper-contact-row">
                              <span className="paper-dot" />
                              <span className="paper-contact-text">{COMPANY.phone}</span>
                            </div>

                            <div className="paper-contact-row full">
                              <span className="paper-dot" />
                              <span className="paper-contact-text">{COMPANY.email}</span>
                            </div>

                            <div className="paper-contact-row full">
                              <span className="paper-dot" />
                              <span className="paper-contact-text">{COMPANY.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="paper-meta-card">
                      <div className="paper-meta-title">Receipt Summary</div>

                      <div className="paper-meta-grid">
                        <div className="paper-meta-item">
                          <div className="paper-label">Receipt #</div>
                          <div className="paper-value">#{invoice.invoice_number}</div>
                        </div>

                        <div className="paper-meta-item">
                          <div className="paper-label">Status</div>
                          <div className="paper-value">
                            <span className="paper-pill">
                              {String(invoice.status ?? "unknown").toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="paper-meta-item">
                          <div className="paper-label">Service Date</div>
                          <div className="paper-value">{serviceDate ?? "—"}</div>
                        </div>

                        <div className="paper-meta-item">
                          <div className="paper-label">
                            {isPaid ? "Paid Date" : "Warranty Through"}
                          </div>
                          <div className="paper-value">
                            {isPaid ? paidDate ?? "—" : warrantyEnd ?? "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="paper-divider" />

                  <div className="paper-grid avoid-break">
                    <div className="paper-section-card">
                      <div className="paper-section-head">
                        <div className="paper-section-title">Billed To</div>
                      </div>
                      <div className="paper-section-body">
                        <div className="paper-label">Customer Name</div>
                        <div className="paper-value">{invoice.customer_name || "Customer"}</div>

                        <div className="paper-label" style={{ marginTop: 8 }}>Email</div>
                        <div className="paper-value" style={{ fontSize: 10.5 }}>
                          {invoice.customer_email || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="paper-section-card">
                      <div className="paper-section-head">
                        <div className="paper-section-title">Service / Vehicle</div>
                      </div>
                      <div className="paper-section-body">
                        {vehicle ? (
                          <>
                            <div className="paper-label">Vehicle</div>
                            <div className="paper-value">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </div>

                            {(vehicle.license_plate || vehicle.color) && (
                              <>
                                <div className="paper-label" style={{ marginTop: 8 }}>
                                  Additional Info
                                </div>
                                <div className="paper-value" style={{ fontSize: 10.5 }}>
                                  {vehicle.license_plate ? `Plate ${vehicle.license_plate}` : ""}
                                  {vehicle.license_plate && vehicle.color ? " · " : ""}
                                  {vehicle.color ? vehicle.color : ""}
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="paper-label">Service Date</div>
                            <div className="paper-value">{serviceDate ?? "—"}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="paper-divider" />

                  <div className="paper-section-card avoid-break">
                    <div className="paper-section-head">
                      <div className="paper-section-title">Receipt Breakdown</div>
                      <div className="paper-pill">Official Charges</div>
                    </div>

                    <div className="paper-section-body">
                      <table className="paper-line-items" aria-label="Receipt line items">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Glass repair service</td>
                            <td>${glassLineDollars.toFixed(2)}</td>
                          </tr>

                          <tr>
                            <td>Miscellaneous</td>
                            <td>${miscLineDollars.toFixed(2)}</td>
                          </tr>

                          <tr>
                            <td>Subtotal</td>
                            <td>${centsToDollars(invoice.subtotal_cents)}</td>
                          </tr>

                          {insuranceMode ? (
                            <tr>
                              <td>Insurance covered</td>
                              <td>-${centsToDollars(insuranceCoveredCents)}</td>
                            </tr>
                          ) : (invoice.discount_cents ?? 0) > 0 ? (
                            <tr>
                              <td>
                                Discount{" "}
                                {invoice.discount_percent ? `(${invoice.discount_percent}%)` : ""}
                              </td>
                              <td>-${centsToDollars(invoice.discount_cents)}</td>
                            </tr>
                          ) : null}

                          <tr>
                            <td>
                              Tax{" "}
                              {invoice.tax_rate_percent ? `(${invoice.tax_rate_percent}%)` : ""}
                            </td>
                            <td>+${centsToDollars(invoice.tax_cents)}</td>
                          </tr>

                          <tr>
                            <td>Service total</td>
                            <td>${centsToDollars(receiptServiceTotalDisplayCents)}</td>
                          </tr>

                          {!isPaid && (
                            <tr>
                              <td>Processing fee</td>
                              <td>
                                {processingFeeCents > 0
                                  ? `+$${centsToDollars(processingFeeCents)}`
                                  : "$0.00"}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <div className="paper-totals">
                        <div className="paper-total-row">
                          <span>{isPaid ? "Amount Paid" : "Amount Due"}</span>
                          <strong>
                            ${centsToDollars(isPaid ? amountPaidCents : customerDueCents)}
                          </strong>
                        </div>

                        {!insuranceMode && isPaid && invoice.payment_method && (
                          <div className="paper-total-row">
                            <span>Payment Method</span>
                            <strong>{formatPaymentMethod(invoice.payment_method)}</strong>
                          </div>
                        )}

                        {insuranceMode && (
                          <div className="paper-total-row">
                            <span>Coverage</span>
                            <strong>Insurance</strong>
                          </div>
                        )}

                        <div className="paper-total-row paper-grand-total">
                          <span>{isPaid ? "Official Total Paid" : "Official Total Due"}</span>
                          <strong>
                            ${centsToDollars(isPaid ? amountPaidCents : customerDueCents)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="paper-divider" />

                  <div className="paper-policy-grid avoid-break">
                    <div className="paper-note warranty">
                      <strong>Warranty Coverage</strong>
                      <br />
                      Covered through <strong>{warrantyEnd ?? "—"}</strong> for damage repaired on{" "}
                      <strong>{serviceDate ?? "—"}</strong>.
                    </div>

                    <div className="paper-note">
                      <strong>Record Notice</strong>
                      <br />
                      This document serves as an official customer receipt from {COMPANY.name}.
                      Please retain it for your payment and service records.
                    </div>
                  </div>
                  <div className="paper-footer">
                    Printed from the Glass Guardian customer portal.
                    <br />
                    {COMPANY.name} · {COMPANY.legalLine} · {COMPANY.phone}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="screen-only py-6 flex items-center justify-center text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-amber-300" />
            Loading receipt…
          </div>
        )}
      </div>
    </div>
  );
}