// app/user/(protected)/dashboard/pay/[id]/receipt/page.tsx
"use client";

import * as React from "react";
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

const centsToDollars = (c: number | null | undefined) => ((c || 0) / 100).toFixed(2);

/** Date-only safety: prevents 6/17 vs 6/18 vs 6/19 drift */
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

  const d = new Date(yy, mm - 1, dd);
  d.setFullYear(d.getFullYear() + years);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function UserInvoiceReceiptPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;

  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      const email = session?.user?.email ?? null;

      if (!email) {
        router.replace(
          `/user/login?redirect=${encodeURIComponent(`/user/dashboard/pay/${invoiceId}/receipt`)}`
        );
        return;
      }

      setUserEmail(email);
      setAuthChecked(true);
    })();
  }, [router, invoiceId]);

  const { data: invoice, isLoading: loadingInvoice } = useQuery<InvoiceRow | null>({
    queryKey: ["user-invoice-receipt", invoiceId],
    enabled: !!invoiceId && authChecked,
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
  const warrantyEnd = React.useMemo(() => addYearsDateOnly(serviceDate, 1), [serviceDate]);

  const baseTotalDueCents = (invoice?.total_cents ?? 0) + PROCESSING_FEE_CENTS;

  function handlePrint() {
    // ✅ allow print CSS to apply, then print just the receipt node
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
            <p className="text-sm text-slate-300">This receipt is not available under your account.</p>
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
      {/* ✅ PRINT: portrait-friendly layout + smaller type + tighter spacing */}
      <style jsx global>{`
        @media print {
          /* Force portrait + sane margins */
          @page {
            size: portrait;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Hide everything except receipt */
          body * {
            visibility: hidden !important;
          }

          #receipt-print-area,
          #receipt-print-area * {
            visibility: visible !important;
          }

          #receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }

          /* Paper-friendly resets */
          .print-shell {
            background: #ffffff !important;
            color: #0b1220 !important;
            box-shadow: none !important;
            border: 1px solid rgba(15, 23, 42, 0.15) !important;
          }

          .print-muted {
            color: rgba(15, 23, 42, 0.7) !important;
          }

          .print-badge {
            border: 1px solid rgba(15, 23, 42, 0.25) !important;
            background: rgba(15, 23, 42, 0.06) !important;
            color: #0b1220 !important;
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Never print map */
          .no-print,
          .no-print * {
            display: none !important;
          }

          /* ✅ Portrait fit controls */
          .print-fit {
            max-width: 190mm !important; /* fits inside US Letter printable area */
            width: 100% !important;
            margin: 0 auto !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }

          .print-h1 {
            font-size: 14px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }

          .print-small {
            font-size: 10px !important;
            line-height: 1.2 !important;
          }

          .print-tight {
            padding: 10px !important;
          }

          .print-gap {
            gap: 8px !important;
          }

          /* prevent long strings from forcing landscape */
          .print-wrap {
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-4">
        {/* Top bar: never printed */}
        <div className="flex items-center justify-between no-print">
          <Button
            variant="outline"
            onClick={() => router.push(`/user/dashboard/pay/${invoiceId}`)}
            className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to invoice
          </Button>

          <Button
            onClick={handlePrint}
            disabled={isLoading || !invoice || printing}
            className="bg-slate-50 text-slate-950 hover:bg-white font-semibold shadow-[0_18px_45px_rgba(255,255,255,0.10)]"
          >
            <Printer className="w-4 h-4 mr-2" />
            {printing ? "Preparing…" : "Print"}
          </Button>
        </div>

        {/* ✅ Only printed region */}
        <div id="receipt-print-area" className="print-fit">
          <Card className="print-shell avoid-break border border-slate-700/80 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/90 backdrop-blur-xl shadow-[0_28px_80px_rgba(15,23,42,0.9)]">
            <CardHeader className="pb-3 print-tight">
              <CardTitle className="flex items-center justify-between gap-3 text-slate-50 print-h1">
                <span className="flex items-center gap-2 print-wrap">
                  <ReceiptText className="w-5 h-5 text-cyan-300 no-print" />
                  Receipt / Invoice
                </span>
                <Badge
                  className={
                    isPaid
                      ? "print-badge bg-emerald-500/15 text-emerald-200 border-emerald-400/70"
                      : "print-badge bg-amber-500/15 text-amber-200 border-amber-300/70"
                  }
                >
                  {String(invoice?.status ?? "unknown").toUpperCase()}
                </Badge>
              </CardTitle>

              {/* compact brand line for paper */}
              <div className="mt-2 text-xs text-slate-400 print-muted print-small print-wrap">
                Glass Guardian • Keep for your records
              </div>
            </CardHeader>

            <CardContent className="print-tight">
              {isLoading || !invoice ? (
                <div className="py-10 flex flex-col items-center gap-3 text-slate-200 no-print">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Loading receipt</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ✅ Portrait-friendly: stack on paper by default, 2-col on screen only */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print-gap">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 print-tight">
                      <div className="text-xs text-slate-300 print-muted print-small">Invoice</div>
                      <div className="mt-0.5 text-base font-semibold print-wrap">
                        #{invoice.invoice_number}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400 print-muted print-small print-wrap">
                        Customer: {invoice.customer_name || invoice.customer_email}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 print-tight">
                      <div className="flex items-center gap-2 text-xs text-slate-300 print-muted print-small">
                        <Calendar className="w-4 h-4 text-cyan-300 no-print" />
                        Service date
                      </div>
                      <div className="mt-0.5 text-base font-semibold print-wrap">
                        {serviceDate ?? "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400 print-muted print-small print-wrap">
                        Warranty through: {warrantyEnd ?? "—"}
                      </div>
                    </div>
                  </div>

                  {vehicle && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm print-tight">
                      <div className="flex items-center gap-2 text-slate-300 print-muted print-small">
                        <Car className="w-4 h-4 text-cyan-300 no-print" />
                        Vehicle
                      </div>
                      <div className="mt-1 font-semibold print-wrap">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                        {vehicle.license_plate ? ` · Plate ${vehicle.license_plate}` : ""}
                        {vehicle.color ? ` · ${vehicle.color}` : ""}
                      </div>
                    </div>
                  )}

                  {/* map never prints, but can stay on screen */}
                  {invoice.windshield_repairs_json && invoice.windshield_repairs_json.length > 0 && (
                    <div className="no-print">
                      <WindshieldRepairMap invoice={invoice as any} readOnly />
                    </div>
                  )}

                  {/* ✅ tighter totals block */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2 text-sm print-tight">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 print-muted print-small">Service total</span>
                      <span className="font-semibold print-wrap">${centsToDollars(invoice.total_cents)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 print-muted print-small">Processing fee</span>
                      <span className="font-semibold print-wrap">+${centsToDollars(PROCESSING_FEE_CENTS)}</span>
                    </div>
                    <Separator className="my-2 border-slate-800" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold print-wrap">{isPaid ? "Total paid" : "Total due"}</span>
                      <span className="font-extrabold text-emerald-200 print-wrap">
                        ${centsToDollars(baseTotalDueCents)}
                      </span>
                    </div>
                  </div>

                  {warrantyEnd && (
                    <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 flex items-start gap-2 text-xs text-emerald-100 avoid-break print-tight">
                      <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-300 no-print" />
                      <div className="print-wrap">
                        <p className="font-semibold">Windshield Repair Warranty</p>
                        <p className="text-emerald-100/90 print-small print-wrap">
                          Covered through <span className="font-semibold">{warrantyEnd}</span> for damage repaired on{" "}
                          <span className="font-semibold">{serviceDate ?? "—"}</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  {isPaid && (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100 avoid-break print-tight">
                      <div className="flex items-center gap-2 font-semibold print-wrap">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        Payment complete
                      </div>
                      <p className="mt-1 text-xs text-emerald-100/80 print-small print-wrap">
                        Keep this receipt for your records.
                      </p>
                    </div>
                  )}

                  {/* ✅ tiny footer for paper */}
                  <div className="pt-1 text-[10px] text-slate-400 print-muted print-wrap">
                    Printed from Glass Guardian customer portal.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}