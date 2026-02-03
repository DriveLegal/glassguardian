// app/user/(protected)/dashboard/warranties/warranty/[id]/receipt/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Car,
  Clock,
  Download,
  Lock,
  MapPin,
  Printer,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

/* ---------- Types ---------- */

type WarrantyRow = {
  id: string;
  warranty_number?: string | null;
  customer_email?: string | null;
  status?: string | null;

  service_performed?: string | null;
  service_date?: string | null;
  coverage_type?: string | null;
  expiration_date?: string | null;

  qr_code_url?: string | null;

  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_plate?: string | null;

  spot_location?: string | null;
  notes?: string | null;

  [key: string]: any;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function titleCase(v: string) {
  return v
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function coveragePretty(v?: string | null) {
  const s = String(v ?? "lifetime").replace(/_/g, " ").trim().toLowerCase();
  if (!s) return "Lifetime";
  if (s.includes("life")) return "Lifetime";
  return titleCase(s);
}

function statusPretty(v?: string | null) {
  const s = String(v ?? "active").replace(/_/g, " ").trim();
  return s ? s.toUpperCase() : "ACTIVE";
}

function safeDateLabel(iso?: string | null, fallback = "—") {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return format(d, "MMM d, yyyy");
}

function daysUntil(dateIso?: string | null) {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getStatusPill(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "active")
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (normalized === "expired")
    return "bg-rose-50 text-rose-800 border-rose-200";
  if (normalized === "claimed")
    return "bg-sky-50 text-sky-800 border-sky-200";
  return "bg-slate-50 text-slate-800 border-slate-200";
}

export default function WarrantyReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) ?? null;

  const [email, setEmail] = React.useState<string | null>(null);
  const [autoPrintArmed, setAutoPrintArmed] = React.useState(false);

  // Auth guard
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!session?.user) {
        const redirectPath = id
          ? `/user/dashboard/warranties/warranty/${id}/receipt`
          : "/user/dashboard/warranties";
        router.replace(`/user/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }
      setEmail(session.user.email ?? null);
    })();
  }, [router, id]);

  const warrantyQuery = useQuery<WarrantyRow | null>({
    queryKey: ["warranty-receipt", id, email],
    enabled: !!id && !!email,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("warranties")
        .select("*")
        .eq("id", id)
        .eq("customer_email", email)
        .single();

      if (error) throw error;
      return (data ?? null) as WarrantyRow | null;
    },
  });

  const w = warrantyQuery.data ?? null;

  const statusLabel = statusPretty(w?.status);
  const coverageLabel = coveragePretty(w?.coverage_type);
  const serviceDateLabel = safeDateLabel(w?.service_date, "—");
  const expirationDateLabel = w?.expiration_date ? safeDateLabel(w?.expiration_date, "—") : "Lifetime";

  const vehicleLabel =
    (w?.vehicle_year ? `${w.vehicle_year} ` : "") +
    (w?.vehicle_make ?? "") +
    (w?.vehicle_make || w?.vehicle_model ? " " : "") +
    (w?.vehicle_model ?? "");

  const warrantyIdLabel = String(w?.warranty_number ?? w?.id ?? "").trim();
  const plateLabel = w?.vehicle_plate ?? "";
  const expiryDays = daysUntil(w?.expiration_date ?? null);

  const normalizedStatus = String(w?.status ?? "active").toLowerCase();
  const isActive = normalizedStatus === "active";
  const isExpired = normalizedStatus === "expired";

  // Optional: arm auto-print after load (kept OFF by default, but ready)
  React.useEffect(() => {
    if (!autoPrintArmed) return;
    if (!warrantyQuery.isLoading && w) {
      // slight delay helps on Safari/iOS
      const t = window.setTimeout(() => window.print(), 250);
      return () => window.clearTimeout(t);
    }
  }, [autoPrintArmed, warrantyQuery.isLoading, w]);

  if (!id) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            Missing warranty ID
          </div>
          <p className="text-sm text-slate-600 mt-2">This receipt link is missing an ID.</p>
          <div className="mt-4">
            <Button onClick={() => router.push("/user/dashboard/warranties")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (warrantyQuery.isLoading || !email) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin" />
          <p className="text-sm text-slate-600 mt-4">Preparing your printable receipt…</p>
        </div>
      </div>
    );
  }

  if (warrantyQuery.isError || !w) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            Warranty not found
          </div>
          <p className="text-sm text-slate-600 mt-2">
            We couldn&apos;t find this warranty under your account.
          </p>
          <div className="mt-4">
            <Button onClick={() => router.push(`/user/dashboard/warranties/warranty/${id}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Warranty
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const issuedLabel = format(new Date(), "MMM d, yyyy • h:mm a");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Print CSS (only this receipt prints clean) */}
      <style>{`
        @page { size: letter; margin: 0.6in; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; }
          .receipt-shell { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          .receipt-grid { break-inside: avoid; }
          .fine-print { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Top controls (not printed) */}
      <div className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button variant="outline" onClick={() => router.push(`/user/dashboard/warranties/warranty/${id}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => window.print()}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>

            {w.qr_code_url && (
              <Button asChild variant="outline">
                <a href={w.qr_code_url} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Open QR
                </a>
              </Button>
            )}

            {/* Optional auto-print (kept subtle) */}
            <button
              type="button"
              onClick={() => setAutoPrintArmed((v) => !v)}
              className={cx(
                "px-3 py-2 rounded-lg border text-xs font-medium",
                autoPrintArmed
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
              title="If enabled, the receipt will auto-open the print dialog after loading."
            >
              Auto-print: {autoPrintArmed ? "ON" : "OFF"}
            </button>

            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <Lock className="w-4 h-4 text-slate-500" />
              Record copy (view-only)
            </span>
          </div>
        </div>
      </div>

      {/* Receipt */}
      <div className="print-wrap px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="receipt-shell rounded-3xl border border-slate-200 shadow-[0_20px_60px_rgba(2,6,23,0.10)] overflow-hidden">
            {/* Header bar */}
            <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-900 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-wide">Glass Guardian</div>
                    <div className="text-xs text-white/75">Warranty Receipt • Official Record</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-white/70">Issued</div>
                  <div className="text-sm font-semibold">{issuedLabel}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                    getStatusPill(w.status),
                    "bg-white/95"
                  )}
                >
                  {isExpired ? (
                    <ShieldAlert className="w-4 h-4 text-rose-700" />
                  ) : isActive ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-slate-700" />
                  )}
                  {statusLabel}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/90">
                  <BadgeCheck className="w-4 h-4 text-emerald-300" />
                  Verified record
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/90">
                  <Lock className="w-4 h-4 text-white/80" />
                  View-only document
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Top identifiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 receipt-grid">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Warranty Number</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{warrantyIdLabel}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    Internal ID: <span className="font-medium text-slate-800">{String(w.id).slice(0, 12)}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Account Email</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 break-all">
                    {email ?? "—"}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Keep this receipt for your records.
                  </div>
                </div>
              </div>

              {/* Vehicle + Service */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 receipt-grid">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Vehicle</div>
                    <Car className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {vehicleLabel.trim().length > 0 ? vehicleLabel : "Vehicle on file"}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Plate:{" "}
                    <span className="font-semibold text-slate-900">
                      {plateLabel ? plateLabel : "—"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Service</div>
                    <BadgeCheck className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {w.service_performed ? String(w.service_performed) : "Windshield chip / crack repair"}
                  </div>
                  <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    Service date:{" "}
                    <span className="font-semibold text-slate-900">{serviceDateLabel}</span>
                  </div>
                </div>
              </div>

              {/* Coverage */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 receipt-grid">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Coverage</div>
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{coverageLabel}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    Coverage applies to the repaired area and workmanship standards.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Expiration</div>
                    <Clock className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{expirationDateLabel}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    {w.expiration_date
                      ? expiryDays !== null
                        ? expiryDays >= 0
                          ? `${expiryDays} day${expiryDays === 1 ? "" : "s"} remaining`
                          : "Expired"
                        : "—"
                      : "Most repairs are covered for life of the windshield."}
                  </div>
                </div>
              </div>

              {/* Spot info (print-safe) */}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 receipt-grid">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Protected Spot</div>
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {w.spot_location ? String(w.spot_location) : "Mapped repair (see warranty page for interactive map)"}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  For best accuracy, reference this warranty number when contacting support.
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 receipt-grid">
                <div className="text-xs uppercase tracking-wider text-slate-500">Notes</div>
                <div className="mt-2 text-sm text-slate-900 whitespace-pre-line">
                  {w.notes ? String(w.notes) : "No additional notes were provided for this repair."}
                </div>
              </div>

              {/* QR block (prints clean) */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 receipt-grid">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Verification</div>
                  <div className="mt-2 text-sm text-slate-900">
                    Scan or open the QR to view the live warranty record.
                  </div>
                  <div className="mt-3 text-xs text-slate-600">
                    Link:{" "}
                    <span className="font-medium text-slate-900 break-all">
                      {w.qr_code_url ? w.qr_code_url : "—"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-center">
                  {w.qr_code_url ? (
                    <img
                      src={w.qr_code_url}
                      alt="Warranty QR Code"
                      className="h-32 w-32 object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-slate-700" />
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">QR not available</div>
                      <div className="mt-1 text-xs text-slate-600">
                        You can still print this receipt as a record copy.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer fine print */}
              <div className="mt-6 fine-print rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-900">Workmanship Standards</div>
                <div className="mt-2 text-xs text-slate-700 leading-relaxed">
                  This receipt is a record of service and warranty coverage as displayed in your Glass Guardian account at the time of printing.
                  Coverage applies to the repaired area/spot and is subject to the terms of service and inspection.
                  If damage changes or spreads, capture a photo and reference Warranty <span className="font-semibold">{warrantyIdLabel}</span>.
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-600">
                  <div>
                    Printed: <span className="font-medium text-slate-800">{issuedLabel}</span>
                  </div>
                  <div className="hidden sm:block">
                    Glass Guardian • Warranty Receipt
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* small spacing */}
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}