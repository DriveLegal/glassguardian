// app/admin/(protected)/portal/invoices/[id]/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Receipt,
  Loader2,
  Calendar,
  Save,
  Pencil,
  X,
  RefreshCw,
  Hash,
  Mail,
  MapPin,
  User,
  DollarSign,
  Sparkles,
  FileText,
  Printer,
  Lock,
  Unlock,
  ShieldCheck,
  PenSquare,
  Phone,
  Car,
  BadgeDollarSign,
  PenLine,
  CheckCircle,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { ServicesPerformed } from "@/components/tech/invoice/ServicesPerformed";
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";
import SignatureCanvas from "@/components/forms/SignatureCanvas";

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

  updated_at?: string | null;
  notes?: string | null;

  appointment_id?: string | null;
  services_json?: any | null;
  windshield_repairs_json?: any[] | null;
  insurance_due_cents?: number | null;
  customer_due_cents?: number | null;
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

type VehicleRow = {
  id?: string | null;
  owner_email?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  color?: string | null;
  vin?: string | null;
  license_plate?: string | null;
  insurance_carrier?: string | null;
};

type TechnicianRow = {
  email?: string | null;
  full_name?: string | null;
};

type SafeliteBillingJobRow = {
  id: string;
  invoice_id: string;
  status: string;
  payload_json: any;
  validation_json: any;
  logs_json: any[];
  screenshots_json: any[];
  confirmation_number: string | null;
  error_message: string | null;
  submitted_at: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type InsuranceMeta = {
  date_of_loss?: string | null;
  referral_number?: string | null;
  vin?: string | null;
  vehicle_year?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;

  customer_name?: string | null;
  customer_address?: string | null;
  customer_phone?: string | null;

  shop_name?: string | null;
  shop_address?: string | null;
  shop_phone?: string | null;
  shop_fed_tax_id?: string | null;

  line_items?: Array<{
    id: string;
    label: string;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
  }>;

  signature_data_url?: string | null;
  signature_signed_at?: string | null;
};

type InsuranceFormState = {
  dateOfLoss: string;
  referralNumber: string;
  vin: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;

  lineItemPriceCents: number;

  customerName: string;
  customerAddress: string;
  customerPhone: string;

  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopFedTaxId: string;

  signatureDataUrl: string;
};

type InsuranceErrors = Partial<Record<keyof InsuranceFormState, string>>;

const DEFAULT_INSURANCE_FLAT_PRICE_CENTS = 7000;
const INSURANCE_MIN_CENTS = 100;
const INSURANCE_MAX_CENTS = 25000;
const COMPANY_LOGO_SRC = "/branding/glass-guardian-gold.png";

const SHOP_NAME = "Glass Guardian";
const SHOP_ADDRESS = "3452 Anderson Ave #E Riverside CA 92507";
const SHOP_PHONE = "9095291798";
const SHOP_FED_TAX_ID = "99-2310126";

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

function dollars(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function toCentsInt(v: any): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function dollarsInputToCents(v: any): number {
  const cleaned = String(v ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function isLockedStatus(status: any) {
  const s = normStatus(status);
  return s === "sent" || s === "paid";
}

function formatSupabaseError(e: any) {
  if (!e) return "Unknown error.";
  const msg = String(e?.message ?? e ?? "Unknown error.");
  const code = e?.code ? `code: ${e.code}` : "";
  const details = e?.details ? `details: ${e.details}` : "";
  const hint = e?.hint ? `hint: ${e.hint}` : "";
  return [msg, code, details, hint].filter(Boolean).join(" | ");
}

const SAFELITE_PROGRESS_STAGES = [
  {
    label: "Queued",
    percent: 10,
    matches: ["safelite billing job prepared"],
  },
  {
    label: "Worker Claimed",
    percent: 20,
    matches: ["worker picked up job", "worker ", "claimed job"],
  },
  {
    label: "PDF Ready",
    percent: 30,
    matches: ["receipt pdf ready", "preparing receipt pdf"],
  },
  {
    label: "Safelite Opened",
    percent: 42,
    matches: ["safelite opened"],
  },
  {
    label: "Referral Entered",
    percent: 52,
    matches: ["filling shop number", "shop-referral-filled", "continuing to create invoice"],
  },
  {
    label: "Invoice Details",
    percent: 64,
    matches: ["hard filling vin", "invoice-info-filled"],
  },
  {
    label: "Labor Entered",
    percent: 76,
    matches: ["selecting labor", "labor-filled", "entering insurance due amount"],
  },
  {
    label: "Work Order Uploaded",
    percent: 88,
    matches: ["uploading receipt", "receipt-uploaded", "document upload", "document type"],
  },
  {
    label: "Submitted",
    percent: 100,
    matches: ["safelite invoice submitted", "completed job with status submitted"],
  },
];

const SAFELITE_PENDING_STALE_MS = 2 * 60 * 1000;

function formatDurationShort(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "a moment";

  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function buildSafeliteProgress(job: SafeliteBillingJobRow | null | undefined) {
  if (!job) return null;

  const status = readSafeliteDisplayStatus(job);
  const correctedSubmitted = looksLikePostSubmitRequiredInfoReset(job);
  const logs = Array.isArray(job.logs_json) ? job.logs_json : [];
  const logText = logs
    .map((entry: any) => String(entry?.message ?? "").toLowerCase())
    .join("\n");

  let currentStage = SAFELITE_PROGRESS_STAGES[0];
  for (const stage of SAFELITE_PROGRESS_STAGES) {
    if (stage.matches.some((match) => logText.includes(match))) {
      currentStage = stage;
    }
  }

  const updatedAtMs = new Date(job.updated_at || job.created_at || "").getTime();
  const pendingAgeMs = Number.isFinite(updatedAtMs) ? Date.now() - updatedAtMs : 0;
  const hasWorkerClaimLog =
    logText.includes("claimed job") ||
    logText.includes("worker picked up job") ||
    logText.includes("preparing receipt pdf") ||
    logText.includes("safelite opened");
  const stalePending =
    status === "pending" &&
    !hasWorkerClaimLog &&
    pendingAgeMs > SAFELITE_PENDING_STALE_MS;

  if (status === "submitted") {
    currentStage = SAFELITE_PROGRESS_STAGES[SAFELITE_PROGRESS_STAGES.length - 1];
  }

  if (status === "failed") {
    return {
      percent: 100,
      label: "Failed",
      tone: "red",
      helpText: job.error_message || "Safelite automation failed. Check the latest worker log below.",
      latestLog: job.error_message || logs[logs.length - 1]?.message || "Failed.",
      logs,
    };
  }

  if (status === "needs_login") {
    return {
      percent: Math.max(currentStage.percent, 20),
      label: "Needs Login",
      tone: "sky",
      helpText: "The worker reached Safelite but needs a valid Safelite session/login before it can continue.",
      latestLog: logs[logs.length - 1]?.message || "Needs Safelite login.",
      logs,
    };
  }

  if (stalePending) {
    return {
      percent: 10,
      label: "Worker Offline",
      tone: "red",
      helpText: `Queued for ${formatDurationShort(pendingAgeMs)} without a worker claim. The Safelite worker daemon is not running, is pointed at the wrong API URL, or cannot authenticate.`,
      latestLog: logs[logs.length - 1]?.message || "Waiting for worker claim.",
      logs,
    };
  }

  if (status === "pending" && currentStage.percent <= 10) {
    return {
      percent: currentStage.percent,
      label: "Waiting For Worker",
      tone: "amber",
      helpText: "The job is queued. If it stays here, the production worker daemon has not claimed it yet.",
      latestLog: logs[logs.length - 1]?.message || "Queued.",
      logs,
    };
  }

  return {
    percent: currentStage.percent,
    label: status === "submitted" ? "Submitted" : currentStage.label,
    tone: status === "submitted" ? "emerald" : "amber",
    helpText:
      status === "submitted"
        ? "Safelite submission finished and proof is attached below."
        : "Worker progress updates automatically as each Safelite step completes.",
    latestLog: correctedSubmitted
      ? "Safelite submission was verified from the final submit flow."
      : logs[logs.length - 1]?.message || currentStage.label,
    logs,
  };
}

function safeliteLogText(job: SafeliteBillingJobRow | null | undefined) {
  const logs = Array.isArray(job?.logs_json) ? job?.logs_json : [];
  return logs.map((entry: any) => String(entry?.message ?? "").toLowerCase()).join("\n");
}

function safeliteScreenshotNames(job: SafeliteBillingJobRow | null | undefined) {
  const screenshots = Array.isArray(job?.screenshots_json) ? job?.screenshots_json : [];
  return screenshots.map((shot: any) => screenshotName(shot));
}

function looksLikePostSubmitRequiredInfoReset(job: SafeliteBillingJobRow | null | undefined) {
  if (!job || normStatus(job.status) !== "failed") return false;

  const logText = safeliteLogText(job);
  const errorText = String(job.error_message ?? "").toLowerCase();
  const combined = `${logText}\n${errorText}`;

  if (!combined.includes("submitting safelite invoice")) return false;
  if (!combined.includes("required information")) return false;

  const nonResetErrors = [
    "document type is required",
    "tax field is required",
    "invoice must contain at least one line item",
    "invoiced amount is less than deductible",
    "could not",
  ];

  if (nonResetErrors.some((needle) => combined.includes(needle))) return false;

  const names = safeliteScreenshotNames(job);
  return names.some((name) =>
    [
      "after-final-submit",
      "after-final-submit-retry",
      "submitted",
      "submitted-after-document-type-retry",
      "submit-validation-errors",
      "final-submit-error",
    ].some((needle) => name.includes(needle))
  );
}

function readSafeliteDisplayStatus(job: SafeliteBillingJobRow | null | undefined) {
  if (looksLikePostSubmitRequiredInfoReset(job)) return "submitted";
  return normStatus(job?.status);
}

function screenshotName(shot: any) {
  return String(shot?.name ?? "").toLowerCase();
}

function pickSafeliteProofScreenshot(job: SafeliteBillingJobRow | null | undefined) {
  if (!job) return null;

  const screenshots = Array.isArray(job.screenshots_json) ? job.screenshots_json : [];
  if (!screenshots.length) return null;

  const newest = [...screenshots].reverse();
  const status = readSafeliteDisplayStatus(job);

  if (status === "submitted") {
    return (
      newest.find((shot: any) => {
        const name = screenshotName(shot);
        return (
          name.includes("after-final-submit") ||
          name.includes("submitted-after-document-type-retry") ||
          name === "submitted"
        );
      }) ||
      newest.find((shot: any) => screenshotName(shot).includes("receipt-uploaded")) ||
      newest[0] ||
      null
    );
  }

  const errorLikeScreenshot = newest.find((shot: any) => {
    const name = screenshotName(shot);
    return (
      name.includes("error") ||
      name.includes("failed") ||
      name.includes("failure") ||
      name.includes("validation") ||
      name.includes("rejected")
    );
  });

  return (
    errorLikeScreenshot ||
    newest.find((shot: any) => {
      const name = screenshotName(shot);
      return [
        "final-submit-error",
        "submit-validation-errors",
        "worker-error",
        "document-type-failed",
        "parts-validation-errors",
        "submitted-after-document-type-retry",
        "document-type-reselected-before-submit",
        "submitted",
        "receipt-uploaded",
        "upload-page",
        "labor-filled",
      ].includes(name);
    }) ||
    newest[0] ||
    null
  );
}

function pickSafeliteScreenshotByNames(
  job: SafeliteBillingJobRow | null | undefined,
  names: string[]
) {
  if (!job) return null;

  const screenshots = Array.isArray(job.screenshots_json) ? job.screenshots_json : [];
  if (!screenshots.length) return null;

  const wanted = names.map((name) => name.toLowerCase());
  return (
    [...screenshots]
      .reverse()
      .find((shot: any) => {
        const name = screenshotName(shot);
        return wanted.some((item) => name === item || name.includes(item));
      }) || null
  );
}

function readScreenshotDirectUrl(shot: any) {
  return firstNonBlank(
    shot?.signedUrl,
    shot?.signed_url,
    shot?.publicUrl,
    shot?.public_url,
    shot?.url
  );
}

function readScreenshotArtifactFilename(shot: any) {
  const candidates = [
    shot?.storage_path,
    shot?.storagePath,
    shot?.filePath,
    shot?.fileName,
    shot?.filename,
  ];

  for (const value of candidates) {
    const parts = String(value ?? "").split("/").filter(Boolean);
    const filename = parts[parts.length - 1] || "";
    if (filename.endsWith(".png")) return filename;
  }

  return "";
}

function addYears(dateStr: string | null | undefined, years: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
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

function formatPhoneDisplay(v: string | null | undefined) {
  const digits = normalizePhone(String(v ?? ""));
  if (digits.length !== 10) return String(v ?? "") || "—";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function mergeServicesJson(oldJson: any, patch: Record<string, any>) {
  const base = normalizeObject(oldJson);
  return { ...base, ...patch };
}

function readInsuranceFlagFromJson(v: any): boolean {
  const sj = normalizeObject(v);
  if (typeof sj.insurance_covers_repairs === "boolean") return sj.insurance_covers_repairs;
  if (typeof sj.insurance_covered === "boolean") return sj.insurance_covered;
  return false;
}

function readInsuranceFlatPriceCentsFromJson(v: any): number {
  const sj = normalizeObject(v);

  const raw =
    typeof sj.insurance_flat_price_cents === "number"
      ? sj.insurance_flat_price_cents
      : typeof sj.insurance_flat_price === "number"
        ? Math.round(sj.insurance_flat_price * 100)
        : null;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  return DEFAULT_INSURANCE_FLAT_PRICE_CENTS;
}

function titleizeWord(s: string) {
  const x = String(s || "").trim();
  if (!x) return "";
  return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
}

function prettifyTechnicianName(v: string | null | undefined) {
  const raw = String(v ?? "").trim();
  if (!raw) return "Technician";
  if (!raw.includes("@")) return raw;

  const local = raw.split("@")[0] || "";
  const parts = local
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(titleizeWord);

  return parts.length ? parts.join(" ") : raw;
}

function firstNonBlank(...values: any[]) {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return "";
}

function readSnapshotCustomerName(snapshot: Record<string, any>, invoice?: TechInvoiceRow | null) {
  return firstNonBlank(
    invoice?.customer_name,
    snapshot.customer_name,
    snapshot.full_name,
    snapshot.customer,
    snapshot.name
  );
}

function readSnapshotCustomerEmail(snapshot: Record<string, any>, invoice?: TechInvoiceRow | null) {
  return firstNonBlank(invoice?.customer_email, snapshot.customer_email, snapshot.email).toLowerCase();
}

function readSnapshotCustomerAddress(snapshot: Record<string, any>, invoice?: TechInvoiceRow | null) {
  return firstNonBlank(
    invoice?.service_address,
    snapshot.service_address,
    snapshot.customer_address,
    snapshot.address,
    snapshot.location_address
  );
}

function readSnapshotCustomerPhone(snapshot: Record<string, any>, meta?: InsuranceMeta) {
  return normalizePhone(
    firstNonBlank(
      meta?.customer_phone,
      snapshot.customer_phone,
      snapshot.phone,
      snapshot.customer_mobile,
      snapshot.mobile
    )
  );
}

function readInsuranceMetaFromJson(v: any): InsuranceMeta {
  const sj = normalizeObject(v);
  const meta = normalizeObject(sj.insurance_meta);
  return {
    date_of_loss: typeof meta.date_of_loss === "string" ? meta.date_of_loss : "",
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
    shop_name: typeof meta.shop_name === "string" ? meta.shop_name : SHOP_NAME,
    shop_address: typeof meta.shop_address === "string" ? meta.shop_address : SHOP_ADDRESS,
    shop_phone: typeof meta.shop_phone === "string" ? meta.shop_phone : SHOP_PHONE,
    shop_fed_tax_id: typeof meta.shop_fed_tax_id === "string" ? meta.shop_fed_tax_id : SHOP_FED_TAX_ID,
    line_items: Array.isArray(meta.line_items) ? meta.line_items : [],
    signature_data_url: typeof meta.signature_data_url === "string" ? meta.signature_data_url : "",
    signature_signed_at: typeof meta.signature_signed_at === "string" ? meta.signature_signed_at : "",
  };
}

function clampInsuranceCents(n: number) {
  const x = Math.round(Number.isFinite(n) ? n : DEFAULT_INSURANCE_FLAT_PRICE_CENTS);
  return Math.max(INSURANCE_MIN_CENTS, Math.min(INSURANCE_MAX_CENTS, x));
}

function emptyInsuranceForm(): InsuranceFormState {
  return {
    dateOfLoss: "",
    referralNumber: "",
    vin: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    lineItemPriceCents: DEFAULT_INSURANCE_FLAT_PRICE_CENTS,
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    shopName: SHOP_NAME,
    shopAddress: SHOP_ADDRESS,
    shopPhone: SHOP_PHONE,
    shopFedTaxId: SHOP_FED_TAX_ID,
    signatureDataUrl: "",
  };
}

function buildInsuranceFormFromInvoice(
  invoice: TechInvoiceRow | null | undefined,
  vehicle?: VehicleRow | null
) {
  const meta = readInsuranceMetaFromJson(invoice?.services_json);
  const snapshot = normalizeObject(invoice?.appointment_snapshot);

  const fallbackName = readSnapshotCustomerName(snapshot, invoice);
  const fallbackAddress = readSnapshotCustomerAddress(snapshot, invoice);
  const fallbackPhone = readSnapshotCustomerPhone(snapshot, meta);

  const fallbackVehicleYear = firstNonBlank(
    meta.vehicle_year,
    vehicle?.year,
    snapshot.vehicle_year,
    snapshot.year
  );
  const fallbackVehicleMake = firstNonBlank(
    meta.vehicle_make,
    vehicle?.make,
    snapshot.vehicle_make,
    snapshot.make
  );
  const fallbackVehicleModel = firstNonBlank(
    meta.vehicle_model,
    vehicle?.model,
    snapshot.vehicle_model,
    snapshot.model
  );
  const fallbackVin = firstNonBlank(
    meta.vin,
    vehicle?.vin,
    snapshot.vin,
    snapshot.vehicle_vin
  );

  return {
    dateOfLoss: firstNonBlank(meta.date_of_loss),
    referralNumber: firstNonBlank(meta.referral_number),
    vin: firstNonBlank(fallbackVin).toUpperCase(),
    vehicleYear: firstNonBlank(fallbackVehicleYear),
    vehicleMake: firstNonBlank(fallbackVehicleMake),
    vehicleModel: firstNonBlank(fallbackVehicleModel),
    lineItemPriceCents:
      Array.isArray(meta.line_items) && meta.line_items[0]?.unit_price_cents
        ? clampInsuranceCents(Number(meta.line_items[0].unit_price_cents))
        : clampInsuranceCents(readInsuranceFlatPriceCentsFromJson(invoice?.services_json)),
    customerName: firstNonBlank(meta.customer_name, fallbackName),
    customerAddress: firstNonBlank(meta.customer_address, fallbackAddress),
    customerPhone: firstNonBlank(meta.customer_phone, fallbackPhone),
    shopName: SHOP_NAME,
    shopAddress: SHOP_ADDRESS,
    shopPhone: SHOP_PHONE,
    shopFedTaxId: SHOP_FED_TAX_ID,
    signatureDataUrl: firstNonBlank(meta.signature_data_url),
  } satisfies InsuranceFormState;
}

function validateInsuranceForm(form: InsuranceFormState): InsuranceErrors {
  const errors: InsuranceErrors = {};

  if (digitsOnly(form.referralNumber).length !== 6) {
    errors.referralNumber = "Referral number must be 6 digits.";
  }

  if (form.vin.trim().length !== 17) {
    errors.vin = "VIN must be 17 characters.";
  }

  if (!form.vehicleYear.trim()) errors.vehicleYear = "Year is required.";
  if (!form.vehicleMake.trim()) errors.vehicleMake = "Make is required.";
  if (!form.vehicleModel.trim()) errors.vehicleModel = "Model is required.";

  const lineItemPrice = Number(form.lineItemPriceCents);
  if (
    !Number.isFinite(lineItemPrice) ||
    lineItemPrice < INSURANCE_MIN_CENTS ||
    lineItemPrice > INSURANCE_MAX_CENTS
  ) {
    errors.lineItemPriceCents = `Enter an amount from ${moneyFromCents(INSURANCE_MIN_CENTS)} to ${moneyFromCents(INSURANCE_MAX_CENTS)}.`;
  }

  if (!form.customerName.trim()) errors.customerName = "Customer name is required.";
  if (!form.customerAddress.trim()) errors.customerAddress = "Customer address is required.";
  if (normalizePhone(form.customerPhone).length !== 10) {
    errors.customerPhone = "Customer phone must be 10 digits.";
  }

  if (!form.signatureDataUrl.trim()) {
    errors.signatureDataUrl = "Signature is required.";
  }

  return errors;
}

function insuranceMetaFromForm(form: InsuranceFormState): InsuranceMeta {
  const price = clampInsuranceCents(form.lineItemPriceCents);

  return {
    date_of_loss: form.dateOfLoss.trim() || null,
    referral_number: digitsOnly(form.referralNumber).slice(0, 6),
    vin: form.vin.trim().toUpperCase(),
    vehicle_year: form.vehicleYear.trim(),
    vehicle_make: form.vehicleMake.trim(),
    vehicle_model: form.vehicleModel.trim(),

    customer_name: form.customerName.trim(),
    customer_address: form.customerAddress.trim(),
    customer_phone: normalizePhone(form.customerPhone),

    shop_name: SHOP_NAME,
    shop_address: SHOP_ADDRESS,
    shop_phone: normalizePhone(SHOP_PHONE),
    shop_fed_tax_id: SHOP_FED_TAX_ID,

    line_items: [
      {
        id: "insurance-chip-repair-1",
        label: "Windshield chip repair",
        qty: 1,
        unit_price_cents: price,
        total_cents: price,
      },
    ],

    signature_data_url: form.signatureDataUrl.trim(),
    signature_signed_at: new Date().toISOString(),
  };
}

function FieldShell({
  label,
  required,
  error,
  icon: Icon,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5 text-amber-300/80" /> : null}
        <span>{label}</span>
        {required ? <span className="text-amber-200/90">*</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cx("text-slate-300", strong && "font-semibold text-slate-100")}>{label}</span>
      <span className={cx("font-semibold text-slate-100", valueClassName)}>{value}</span>
    </div>
  );
}

/* ----------------------- Data fetchers ----------------------- */

async function fetchInvoiceById(invoiceId: string) {
  const primary = await supabaseClient
    .from("tech_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!primary.error && primary.data) return primary.data as TechInvoiceRow;
  if (primary.error && String(primary.error.message || "").length) throw primary.error;

  throw new Error("Invoice not found.");
}

async function fetchVehicleForInvoice(invoice: TechInvoiceRow | null | undefined) {
  if (!invoice) return null;

  if (invoice.vehicle_id) {
    const byId = await (supabaseClient.from("vehicles") as any)
      .select("id, owner_email, make, model, year, color, vin, license_plate, insurance_carrier")
      .eq("id", invoice.vehicle_id)
      .maybeSingle();

    if (!byId.error && byId.data) return byId.data as VehicleRow;
  }

  const ownerEmail = String(invoice.customer_email ?? "").trim().toLowerCase();
  if (ownerEmail) {
    const byOwner = await (supabaseClient.from("vehicles") as any)
      .select("id, owner_email, make, model, year, color, vin, license_plate, insurance_carrier")
      .eq("owner_email", ownerEmail)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byOwner.error && byOwner.data) return byOwner.data as VehicleRow;
  }

  return null;
}

async function fetchTechnicianByEmail(email: string | null | undefined) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const fromTechnicians = await (supabaseClient.from("technicians") as any)
    .select("email, full_name")
    .eq("email", normalized)
    .maybeSingle();

  if (!fromTechnicians.error && fromTechnicians.data) {
    return fromTechnicians.data as TechnicianRow;
  }

  const fromUsersPublic = await (supabaseClient.from("users_public") as any)
    .select("email, full_name")
    .eq("email", normalized)
    .maybeSingle();

  if (!fromUsersPublic.error && fromUsersPublic.data) {
    return fromUsersPublic.data as TechnicianRow;
  }

  return null;
}

async function fetchAdminInvoiceDetail(invoiceId: string) {
  const invoice = await fetchInvoiceById(invoiceId);

  const [vehicle, technician] = await Promise.all([
    fetchVehicleForInvoice(invoice),
    fetchTechnicianByEmail(invoice.technician_email),
  ]);

  return {
    invoice,
    vehicle,
    technician,
  };
}

async function updateInvoiceById(invoiceId: string, patch: Partial<TechInvoiceRow>) {
  const res = await (supabaseClient.from("tech_invoices") as any)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select("*")
    .maybeSingle();

  if (!res.error && res.data) return res.data as TechInvoiceRow;
  if (res.error) throw res.error;
  throw new Error("Update returned no row.");
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
    queryKey: ["admin:invoice:detail:v5", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id in route.");
      return await fetchAdminInvoiceDetail(invoiceId);
    },
    staleTime: 10_000,
  });

  const {
    data: safeliteJob,
    refetch: refetchSafeliteJob,
    isFetching: isFetchingSafeliteJob,
  } = useQuery({
  queryKey: ["admin:safelite-billing-job:latest", invoiceId],
  enabled: !!invoiceId,
  queryFn: async () => {
    if (!invoiceId) return null;

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Admin session is required to load Safelite billing status.");

    const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/safelite-billing?live=${Date.now()}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Unable to load Safelite billing status.");
    }

    return (body.job ?? null) as SafeliteBillingJobRow | null;
  },
  staleTime: 0,
  refetchInterval: 1500,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: "always",
  refetchOnReconnect: "always",
  networkMode: "always",
  retry: false,
});

  const invoice = data?.invoice as TechInvoiceRow | undefined;
  const vehicle = (data?.vehicle as VehicleRow | null | undefined) ?? null;
  const technician = (data?.technician as TechnicianRow | null | undefined) ?? null;

  const [isEditing, setIsEditing] = React.useState(false);
  const [forceEditMode, setForceEditMode] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [safelitePreparing, setSafelitePreparing] = React.useState(false);
  const [safeliteActionLabel, setSafeliteActionLabel] = React.useState("Safelite Billing");
  const [receiptPdfDownloading, setReceiptPdfDownloading] = React.useState(false);

  const [draft, setDraft] = React.useState<Partial<TechInvoiceRow & { appointment_snapshot_text?: string }>>({});

  const [insuranceCoversRepairs, setInsuranceCoversRepairs] = React.useState(false);
  const [insuranceFlatPriceCents, setInsuranceFlatPriceCents] = React.useState(DEFAULT_INSURANCE_FLAT_PRICE_CENTS);
  const [insuranceUiTouched, setInsuranceUiTouched] = React.useState(false);

  const [insuranceForm, setInsuranceForm] = React.useState<InsuranceFormState>(emptyInsuranceForm());
  const [insuranceErrors, setInsuranceErrors] = React.useState<InsuranceErrors>({});
  const [insuranceFormTouched, setInsuranceFormTouched] = React.useState(false);
  const [safeliteScreenshotUrl, setSafeliteScreenshotUrl] = React.useState<string | null>(null);
  const [safeliteScreenshotName, setSafeliteScreenshotName] = React.useState("");
  const [safeliteScreenshotError, setSafeliteScreenshotError] = React.useState("");
  const [safeliteBeforeSubmitUrl, setSafeliteBeforeSubmitUrl] = React.useState<string | null>(null);
  const [safeliteBeforeSubmitName, setSafeliteBeforeSubmitName] = React.useState("");
  const [safeliteAfterSubmitUrl, setSafeliteAfterSubmitUrl] = React.useState<string | null>(null);
  const [safeliteAfterSubmitName, setSafeliteAfterSubmitName] = React.useState("");

  const safeliteScreenshotsFingerprint = React.useMemo(
    () => JSON.stringify(safeliteJob?.screenshots_json ?? []),
    [safeliteJob?.screenshots_json]
  );

  const safeliteProofScreenshot = React.useMemo(
    () => pickSafeliteProofScreenshot(safeliteJob),
    [safeliteJob?.id, safeliteJob?.status, safeliteScreenshotsFingerprint]
  );

  const safeliteBeforeSubmitScreenshot = React.useMemo(
    () =>
      pickSafeliteScreenshotByNames(safeliteJob, [
        "before-final-submit-retry",
        "before-final-submit",
        "work-order-document-type-selected",
        "receipt-uploaded",
      ]),
    [safeliteJob?.id, safeliteJob?.status, safeliteScreenshotsFingerprint]
  );

  const safeliteAfterSubmitScreenshot = React.useMemo(
    () =>
      pickSafeliteScreenshotByNames(safeliteJob, [
        "after-final-submit-retry",
        "after-final-submit",
        "submitted-after-document-type-retry",
        "submitted",
        "final-submit-error",
        "submit-validation-errors",
      ]),
    [safeliteJob?.id, safeliteJob?.status, safeliteScreenshotsFingerprint]
  );

  const safeliteProofScreenshotKey = React.useMemo(() => {
    if (!safeliteProofScreenshot) return "";
    return [
      safeliteJob?.id ?? "",
      safeliteJob?.status ?? "",
      safeliteProofScreenshot?.name ?? "",
      safeliteProofScreenshot?.at ?? "",
      safeliteProofScreenshot?.storage_path ?? "",
      safeliteProofScreenshot?.storagePath ?? "",
      safeliteProofScreenshot?.filePath ?? "",
      safeliteProofScreenshot?.fileName ?? "",
    ].join("|");
  }, [safeliteJob?.id, safeliteJob?.status, safeliteProofScreenshot]);

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadScreenshot() {
      setSafeliteScreenshotUrl(null);
      setSafeliteScreenshotName("");
      setSafeliteScreenshotError("");

      const job = safeliteJob;
      if (!job) return;

      const screenshot = safeliteProofScreenshot;
      if (!screenshot) {
        setSafeliteScreenshotError(
          readSafeliteDisplayStatus(job) === "failed"
            ? "No Safelite error screenshot is attached to this job yet."
            : "No Safelite screenshot is attached to this job yet."
        );
        return;
      }

      const directUrl = readScreenshotDirectUrl(screenshot);
      if (directUrl) {
        setSafeliteScreenshotName(String(screenshot?.name ?? "Safelite screenshot"));
        setSafeliteScreenshotUrl(directUrl);
        return;
      }

      const filename = readScreenshotArtifactFilename(screenshot);
      if (!job.id || !filename) {
        setSafeliteScreenshotError("Screenshot artifact metadata is missing a PNG filename.");
        return;
      }

      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setSafeliteScreenshotError("Admin session is required to load the Safelite screenshot.");
        return;
      }

      const res = await fetch(
        `/api/admin/safelite-billing/jobs/${encodeURIComponent(job.id)}/screenshots/${encodeURIComponent(filename)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (!cancelled) {
          setSafeliteScreenshotName(String(screenshot?.name ?? "Safelite screenshot"));
          setSafeliteScreenshotError(
            body.error || `Unable to load Safelite screenshot (${res.status}).`
          );
        }
        return;
      }

      const blob = await res.blob();
      if (cancelled) return;

      objectUrl = URL.createObjectURL(blob);
      setSafeliteScreenshotName(String(screenshot?.name ?? "Safelite screenshot"));
      setSafeliteScreenshotUrl(objectUrl);
    }

    loadScreenshot().catch((e: any) => {
      if (!cancelled) {
        setSafeliteScreenshotError(e?.message || "Unable to load Safelite screenshot.");
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [safeliteJob?.id, safeliteProofScreenshotKey]);

  React.useEffect(() => {
    let beforeObjectUrl: string | null = null;
    let afterObjectUrl: string | null = null;
    let cancelled = false;

    async function loadScreenshotBlobUrl(screenshot: any) {
      const job = safeliteJob;
      if (!job || !screenshot) return null;

      const directUrl = readScreenshotDirectUrl(screenshot);
      if (directUrl) return directUrl;

      const filename = readScreenshotArtifactFilename(screenshot);
      if (!job.id || !filename) return null;

      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return null;

      const res = await fetch(
        `/api/admin/safelite-billing/jobs/${encodeURIComponent(job.id)}/screenshots/${encodeURIComponent(filename)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) return null;

      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }

    async function loadSubmitProofs() {
      setSafeliteBeforeSubmitUrl(null);
      setSafeliteBeforeSubmitName("");
      setSafeliteAfterSubmitUrl(null);
      setSafeliteAfterSubmitName("");

      if (!safeliteJob || !["submitted", "failed"].includes(normStatus(safeliteJob.status))) {
        return;
      }

      if (safeliteBeforeSubmitScreenshot) {
        beforeObjectUrl = await loadScreenshotBlobUrl(safeliteBeforeSubmitScreenshot);
        if (!cancelled && beforeObjectUrl) {
          setSafeliteBeforeSubmitName(
            String(safeliteBeforeSubmitScreenshot?.name ?? "Before final submit")
          );
          setSafeliteBeforeSubmitUrl(beforeObjectUrl);
        }
      }

      if (safeliteAfterSubmitScreenshot) {
        afterObjectUrl = await loadScreenshotBlobUrl(safeliteAfterSubmitScreenshot);
        if (!cancelled && afterObjectUrl) {
          setSafeliteAfterSubmitName(
            String(safeliteAfterSubmitScreenshot?.name ?? "After final submit")
          );
          setSafeliteAfterSubmitUrl(afterObjectUrl);
        }
      }
    }

    loadSubmitProofs().catch(() => {});

    return () => {
      cancelled = true;
      if (beforeObjectUrl?.startsWith("blob:")) URL.revokeObjectURL(beforeObjectUrl);
      if (afterObjectUrl?.startsWith("blob:")) URL.revokeObjectURL(afterObjectUrl);
    };
  }, [
    safeliteJob?.id,
    safeliteJob?.status,
    safeliteScreenshotsFingerprint,
    safeliteBeforeSubmitScreenshot,
    safeliteAfterSubmitScreenshot,
  ]);

  React.useEffect(() => {
    if (!invoice) return;

    const snap = normalizeObject(invoice.appointment_snapshot);
    let snapText = "";
    try {
      snapText = invoice.appointment_snapshot ? JSON.stringify(invoice.appointment_snapshot, null, 2) : "";
    } catch {
      snapText = "";
    }

    setDraft({
      invoice_number: invoice.invoice_number ?? "",
      status: invoice.status ?? "",
      invoice_date: invoice.invoice_date ?? "",
      technician_email: invoice.technician_email ?? "",
      customer_name: readSnapshotCustomerName(snap, invoice),
      customer_email: readSnapshotCustomerEmail(snap, invoice),
      service_address: readSnapshotCustomerAddress(snap, invoice),
      client_id: invoice.client_id ?? "",
      vehicle_id: invoice.vehicle_id ?? "",
      subtotal_cents: invoice.subtotal_cents ?? 0,
      discount_cents: invoice.discount_cents ?? 0,
      tax_cents: invoice.tax_cents ?? 0,
      total_cents: invoice.total_cents ?? 0,
      paid_at: invoice.paid_at ?? null,
      notes: invoice.notes ?? "",
      appointment_snapshot_text: snapText,
    });

    const services = normalizeObject(invoice.services_json);
    const snapObj = normalizeObject(invoice.appointment_snapshot);
    const insuranceOn =
      readInsuranceFlagFromJson(services) ||
      (typeof snapObj.insurance_covers_repairs === "boolean" && snapObj.insurance_covers_repairs) ||
      (typeof snapObj.insurance_covered === "boolean" && snapObj.insurance_covered) ||
      Number(invoice.insurance_due_cents ?? 0) > 0;

    setInsuranceCoversRepairs(insuranceOn);
    setInsuranceFlatPriceCents(clampInsuranceCents(readInsuranceFlatPriceCentsFromJson(invoice.services_json)));
    setInsuranceUiTouched(false);
    setInsuranceForm(buildInsuranceFormFromInvoice(invoice, vehicle));
    setInsuranceErrors({});
    setInsuranceFormTouched(false);

    setNotice(null);
    setSaveErr(null);
    setIsEditing(false);
    setForceEditMode(false);
  }, [invoice, vehicle]);

  const derivedInsuranceOn = React.useMemo(() => {
    const services = normalizeObject(invoice?.services_json);
    const snapObj = normalizeObject(invoice?.appointment_snapshot);

    const fromInvoice =
      readInsuranceFlagFromJson(services) ||
      (typeof snapObj.insurance_covers_repairs === "boolean" && snapObj.insurance_covers_repairs) ||
      (typeof snapObj.insurance_covered === "boolean" && snapObj.insurance_covered) ||
      Number(invoice?.insurance_due_cents ?? 0) > 0;

    return insuranceUiTouched ? insuranceCoversRepairs : fromInvoice || insuranceCoversRepairs;
  }, [
    invoice?.services_json,
    invoice?.appointment_snapshot,
    invoice?.insurance_due_cents,
    insuranceCoversRepairs,
    insuranceUiTouched,
  ]);

  const recomputeTotal = React.useCallback(() => {
    if (derivedInsuranceOn) {
      const flat = clampInsuranceCents(insuranceFlatPriceCents);
      setDraft((d) => ({
        ...d,
        subtotal_cents: flat,
        discount_cents: flat,
        tax_cents: 0,
        total_cents: 0,
      }));
      return;
    }

    const sub = Number(draft.subtotal_cents ?? 0) || 0;
    const disc = Number(draft.discount_cents ?? 0) || 0;
    const tax = Number(draft.tax_cents ?? 0) || 0;
    const total = Math.max(0, sub - disc + tax);
    setDraft((d) => ({ ...d, total_cents: total }));
  }, [draft.subtotal_cents, draft.discount_cents, draft.tax_cents, derivedInsuranceOn, insuranceFlatPriceCents]);

  const validateInsuranceNow = React.useCallback(() => {
    const nextErrors = validateInsuranceForm(insuranceForm);
    setInsuranceErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [insuranceForm]);

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

      parsedSnapshot = normalizeObject(parsedSnapshot);
      parsedSnapshot.customer_phone = normalizePhone(insuranceForm.customerPhone) || null;

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
        paid_at: String((draft as any).paid_at ?? "").trim() || null,
        notes: String((draft as any).notes ?? "").trim() || null,
        appointment_snapshot: parsedSnapshot,
      } as any;

      if (derivedInsuranceOn) {
        const ok = validateInsuranceForm(insuranceForm);
        setInsuranceErrors(ok);

        if (Object.keys(ok).length > 0) {
          throw new Error("Please complete all required insurance billing fields.");
        }

        const flat = clampInsuranceCents(insuranceForm.lineItemPriceCents);
        const insuranceMeta = insuranceMetaFromForm({
          ...insuranceForm,
          lineItemPriceCents: flat,
        });

        patch.subtotal_cents = flat;
        patch.discount_cents = flat;
        patch.tax_cents = 0;
        patch.total_cents = 0;
        patch.insurance_due_cents = flat;
        patch.customer_due_cents = 0;
        patch.customer_name = insuranceForm.customerName.trim() || patch.customer_name || null;
        patch.customer_email = String(draft.customer_email ?? "").trim().toLowerCase() || null;
        patch.service_address = insuranceForm.customerAddress.trim() || patch.service_address || null;
        patch.services_json = mergeServicesJson(invoice?.services_json, {
          insurance_covers_repairs: true,
          insurance_covered: true,
          insurance_flat_price_cents: flat,
          insurance_due_cents: flat,
          customer_due_cents: 0,
          chip_repair_customer_price_cents: 0,
          chip_repair_insurance_price_cents: flat,
          insurance_meta: insuranceMeta,
        });
      } else {
        patch.subtotal_cents = toCentsInt(draft.subtotal_cents);
        patch.discount_cents = toCentsInt(draft.discount_cents);
        patch.tax_cents = toCentsInt(draft.tax_cents);
        patch.total_cents = toCentsInt(draft.total_cents);
        patch.customer_due_cents = toCentsInt(draft.total_cents);
        patch.insurance_due_cents = 0;
        patch.services_json = mergeServicesJson(invoice?.services_json, {
          insurance_covers_repairs: false,
          insurance_covered: false,
          insurance_due_cents: 0,
          customer_due_cents: toCentsInt(draft.total_cents) ?? 0,
        });
      }

      return await updateInvoiceById(invoiceId, patch);
    },
    onSuccess: async (savedInvoice) => {
    queryClient.setQueryData(
      ["admin:invoice:detail:v5", invoiceId],
      (old: any) => {
        if (!old) {
          return {
            invoice: savedInvoice,
            vehicle,
            technician,
          };
        }

        return {
          ...old,
          invoice: savedInvoice,
        };
      }
    );

    await queryClient.invalidateQueries({ queryKey: ["admin:invoices"] });

    setNotice("Saved.");
    setIsEditing(false);
    setForceEditMode(false);
  },

  onError: (e: any) => setSaveErr(formatSupabaseError(e)),
});

  if (isLoading && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] relative overflow-hidden print:bg-white">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-400/14 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-zinc-400/8 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.08),transparent_42%),radial-gradient(circle_at_100%_100%,rgba(161,161,170,0.06),transparent_38%),linear-gradient(180deg,#0d0d0f_0%,#09090b_100%)]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4 text-slate-100">
          <Loader2 className="w-10 h-10 animate-spin text-amber-300" />
          <p className="text-sm tracking-[0.25em] uppercase text-slate-400">Loading invoice</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] p-4 print:bg-white">
        <Card className="max-w-md w-full border border-red-500/30 bg-[rgba(28,28,31,0.84)] backdrop-blur-2xl text-slate-50 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-red-200">Invoice Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">There was an issue loading this invoice. Please try again.</p>
            <p className="text-xs text-red-100/80">{(error as Error)?.message || "Unknown error."}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/10 text-slate-100 bg-transparent hover:bg-white/5"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-slate-100 bg-transparent hover:bg-white/5"
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Invoices
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] p-4 print:bg-white">
        <Card className="max-w-md w-full border border-white/10 bg-[rgba(28,28,31,0.84)] backdrop-blur-2xl text-slate-50 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle>Invoice Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              We couldn&apos;t find that invoice. It may have been removed or the link is incorrect.
            </p>
            <Button
              variant="outline"
              className="border-white/10 text-slate-100 bg-transparent hover:bg-white/5"
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const snapshot = normalizeObject(invoice.appointment_snapshot);
  const status = invoice.status ?? "unknown";
  const statusLower = String(status).toLowerCase();
  const receiptMode = isLockedStatus(status) && !forceEditMode && !isEditing;

  const invoiceDate = invoice.invoice_date ?? null;
  const warrantyEnd = addYears(invoiceDate, 1);

  const subtotalDisplay = receiptMode
    ? invoice.subtotal_cents ?? 0
    : Number(draft.subtotal_cents ?? invoice.subtotal_cents ?? 0);
  const discountDisplay = receiptMode
    ? invoice.discount_cents ?? 0
    : Number(draft.discount_cents ?? invoice.discount_cents ?? 0);
  const taxDisplay = receiptMode ? invoice.tax_cents ?? 0 : Number(draft.tax_cents ?? invoice.tax_cents ?? 0);
  const totalDisplay = receiptMode
    ? invoice.total_cents ?? 0
    : Number(draft.total_cents ?? invoice.total_cents ?? 0);

  const insuranceDue = receiptMode
    ? invoice.insurance_due_cents ?? 0
    : derivedInsuranceOn
      ? clampInsuranceCents(insuranceForm.lineItemPriceCents)
      : 0;

  const customerDue = receiptMode
    ? typeof invoice.customer_due_cents === "number"
      ? invoice.customer_due_cents
      : invoice.total_cents ?? 0
    : derivedInsuranceOn
      ? 0
      : totalDisplay;

  const receiptInsuranceMeta = readInsuranceMetaFromJson(invoice.services_json);
  const lockedInsuranceMode = receiptMode && derivedInsuranceOn;
  const receiptSignaturePreview = receiptInsuranceMeta.signature_data_url || "";

  const billEmail =
    String((draft.customer_email as any) ?? "") ||
    readSnapshotCustomerEmail(snapshot, invoice) ||
    "";

  const invNumber = invoice.invoice_number ?? invoice.id;
  const technicianDisplayName =
    firstNonBlank(technician?.full_name) || prettifyTechnicianName(invoice.technician_email);

  const liveInsuranceErrors =
    derivedInsuranceOn && insuranceFormTouched ? validateInsuranceForm(insuranceForm) : {};
  const combinedInsuranceErrors = { ...liveInsuranceErrors, ...insuranceErrors };

  const insuranceLineItemPrice = clampInsuranceCents(insuranceForm.lineItemPriceCents);
  const signaturePreview = insuranceForm.signatureDataUrl?.trim() || "";

  const fallbackVehicleYear = firstNonBlank(vehicle?.year, snapshot.vehicle_year, snapshot.year);
  const fallbackVehicleMake = firstNonBlank(vehicle?.make, snapshot.vehicle_make, snapshot.make);
  const fallbackVehicleModel = firstNonBlank(vehicle?.model, snapshot.vehicle_model, snapshot.model);
  const fallbackVehicleVin = firstNonBlank(vehicle?.vin, snapshot.vin, snapshot.vehicle_vin);

  const fallbackVehicleText = firstNonBlank(
    [fallbackVehicleYear, fallbackVehicleMake, fallbackVehicleModel].filter(Boolean).join(" ")
  );

  const lockedReferralDisplay = firstNonBlank(
    receiptInsuranceMeta.referral_number,
    snapshot.referral_number,
    snapshot.referralCode,
    snapshot.referral_code,
    "—"
  );

  const lockedDateOfLossDisplay = firstNonBlank(
    receiptInsuranceMeta.date_of_loss,
    snapshot.date_of_loss,
    snapshot.loss_date,
    snapshot.dateOfLoss,
    "—"
  );

  const lockedVehicleText = firstNonBlank(
    [
      receiptInsuranceMeta.vehicle_year,
      receiptInsuranceMeta.vehicle_make,
      receiptInsuranceMeta.vehicle_model,
    ]
      .filter(Boolean)
      .join(" "),
    fallbackVehicleText,
    "—"
  );

  const lockedVehicleVin = firstNonBlank(
    receiptInsuranceMeta.vin,
    fallbackVehicleVin,
    "—"
  );

  const editReferralDisplay = firstNonBlank(
    insuranceForm.referralNumber,
    snapshot.referral_number,
    snapshot.referralCode,
    snapshot.referral_code,
    "—"
  );

  const editDateOfLossDisplay = firstNonBlank(
    insuranceForm.dateOfLoss,
    snapshot.date_of_loss,
    snapshot.loss_date,
    snapshot.dateOfLoss,
    "—"
  );

  const editVehicleTextDisplay = firstNonBlank(
    [insuranceForm.vehicleYear, insuranceForm.vehicleMake, insuranceForm.vehicleModel]
      .filter(Boolean)
      .join(" "),
    fallbackVehicleText,
    "—"
  );

  const editVehicleVinDisplay = firstNonBlank(
    insuranceForm.vin,
    fallbackVehicleVin,
    "—"
  );

  const vehicleText = lockedInsuranceMode
    ? lockedVehicleText
    : derivedInsuranceOn
      ? editVehicleTextDisplay
      : firstNonBlank(fallbackVehicleText, "—");

  const vehicleVin = lockedInsuranceMode
    ? lockedVehicleVin
    : derivedInsuranceOn
      ? editVehicleVinDisplay
      : firstNonBlank(fallbackVehicleVin, "—");

  const customerNameDisplay = firstNonBlank(
    lockedInsuranceMode ? receiptInsuranceMeta.customer_name : insuranceForm.customerName,
    draft.customer_name,
    readSnapshotCustomerName(snapshot, invoice),
    billEmail,
    "Customer"
  );

  const customerAddressDisplay = lockedInsuranceMode
    ? firstNonBlank(receiptInsuranceMeta.customer_address, draft.service_address, "—")
    : firstNonBlank(insuranceForm.customerAddress, draft.service_address, "—");

  const customerPhoneDisplay = formatPhoneDisplay(
    lockedInsuranceMode
      ? firstNonBlank(receiptInsuranceMeta.customer_phone)
      : firstNonBlank(insuranceForm.customerPhone, readSnapshotCustomerPhone(snapshot, receiptInsuranceMeta))
  );

  const claimReferralDisplay = lockedInsuranceMode
    ? lockedReferralDisplay
    : editReferralDisplay;

  const claimDateOfLossDisplay = lockedInsuranceMode
    ? lockedDateOfLossDisplay
    : editDateOfLossDisplay;

  const safeliteDisplayStatus = readSafeliteDisplayStatus(safeliteJob);
  const safeliteLooksBackfilledSubmitted = looksLikePostSubmitRequiredInfoReset(safeliteJob);
  const safeliteProgress = buildSafeliteProgress(safeliteJob);

  const receiptPrintHref = `/admin/portal/invoices/${invoice.id}/receipt?autoprint=1`;
  const openReceiptPrint = () => {
    router.push(receiptPrintHref);
  };

  async function downloadSafeliteReceiptPdf(token: string) {
    const currentInvoice = invoice!;
    const res = await fetch(`/api/admin/invoices/${encodeURIComponent(currentInvoice.id)}/receipt-pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Receipt PDF download failed.");
    }

    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/i);
    const filename =
      filenameMatch?.[1] ||
      `GlassGuardian-Safelite-WorkOrder-${currentInvoice.invoice_number || currentInvoice.id.slice(0, 8)}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return filename;
  }

  async function handleReceiptPdfDownload() {
    if (receiptPdfDownloading) return;

    setReceiptPdfDownloading(true);
    setSaveErr(null);

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Admin session is required to download the receipt PDF.");

      const filename = await downloadSafeliteReceiptPdf(token);
      setNotice(`Receipt PDF downloaded: ${filename}.`);
    } catch (e: any) {
      setSaveErr(e?.message || "Unable to download receipt PDF.");
    } finally {
      setReceiptPdfDownloading(false);
    }
  }

  async function prepareSafeliteBilling() {
    if (safelitePreparing) return;

    setSafelitePreparing(true);
    setNotice(null);
    setSaveErr(null);
    setSafeliteActionLabel(isEditing ? "Saving invoice..." : "Preparing billing...");

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Admin session is required to prepare Safelite billing.");

      if (isEditing) {
        await saveMutation.mutateAsync();
      }

      const currentInvoice = invoice!;
      setSafeliteActionLabel("Queueing billing...");
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(currentInvoice.id)}/safelite-billing`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Safelite billing preparation failed.");

      if (!body.validation?.ok) {
        const details = Array.isArray(body.validation?.errors)
          ? body.validation.errors.join(" ")
          : "Please complete the required Safelite billing fields.";
        throw new Error(details);
      }

      if (body.job) {
        queryClient.setQueryData(
          ["admin:safelite-billing-job:latest", invoiceId],
          body.job as SafeliteBillingJobRow
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["admin:safelite-billing-job:latest", invoiceId],
      });

      await refetchSafeliteJob();

      setNotice("Safelite billing queued. The production worker will submit it and attach the proof screenshot here.");
    } catch (e: any) {
      setSaveErr(e?.message || "Unable to prepare Safelite billing.");
    } finally {
      setSafelitePreparing(false);
      setSafeliteActionLabel("Safelite Billing");
    }
  }

  return (
    <div className="min-h-screen relative bg-[#0b0b0c] p-4 md:p-8 print:bg-white print:p-4 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-100 print:hidden">
        <div className="absolute -top-44 -left-36 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute top-1/3 right-[-6rem] h-[22rem] w-[22rem] rounded-full bg-yellow-500/6 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-zinc-300/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(251,191,36,0.08),transparent_36%),radial-gradient(circle_at_80%_20%,rgba(212,212,216,0.06),transparent_32%),radial-gradient(circle_at_90%_100%,rgba(245,158,11,0.06),transparent_34%),linear-gradient(180deg,#111214_0%,#0b0b0c_48%,#080809_100%)]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-2 print:hidden">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-white/10 bg-[rgba(44,44,47,0.50)] backdrop-blur-xl text-slate-100 hover:bg-[rgba(56,56,60,0.56)]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <Badge
              className={cx(
                "border text-xs px-3 py-1 tracking-[0.18em] uppercase backdrop-blur-xl",
                statusLower === "paid"
                  ? "bg-emerald-500/12 text-emerald-100 border-emerald-400/35"
                  : statusLower === "sent"
                    ? "bg-amber-400/12 text-amber-100 border-amber-300/28"
                    : "bg-white/5 text-slate-100 border-white/10"
              )}
            >
              {String(status).toUpperCase()}
            </Badge>

            {safeliteJob ? (
  <Badge
    className={cx(
      "border text-xs px-3 py-1 tracking-[0.16em] uppercase backdrop-blur-xl",
      safeliteDisplayStatus === "submitted"
        ? "bg-emerald-500/12 text-emerald-100 border-emerald-400/35"
        : safeliteDisplayStatus === "failed"
          ? "bg-red-500/12 text-red-100 border-red-400/35"
          : safeliteDisplayStatus === "needs_login"
            ? "bg-sky-500/12 text-sky-100 border-sky-300/35"
            : "bg-amber-400/12 text-amber-100 border-amber-300/28"
    )}
  >
    Safelite: {String(safeliteDisplayStatus || "pending").toUpperCase()}
    {isFetchingSafeliteJob ? " · SYNCING" : ""}
  </Badge>
) : null}

            {receiptMode && (
              <Badge className="bg-amber-400/12 text-amber-100 border border-amber-300/28 text-xs px-3 py-1 tracking-[0.18em] uppercase backdrop-blur-xl">
                <Lock className="w-3.5 h-3.5 mr-1" />
                RECEIPT VIEW
              </Badge>
            )}

            {(insuranceDue > 0 || customerDue > 0) && (
              <Badge className="bg-[rgba(51,51,56,0.52)] text-slate-100 border border-amber-300/18 text-xs px-3 py-1 tracking-[0.16em] uppercase backdrop-blur-xl">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-300" />
                INSURANCE {moneyFromCents(insuranceDue)} · CUSTOMER {moneyFromCents(customerDue)}
              </Badge>
            )}

            {isLockedStatus(status) && (
              <Button
                type="button"
                onClick={() => {
                  if (receiptMode) {
                    setForceEditMode(true);
                    setIsEditing(true);
                  } else {
                    setIsEditing(false);
                    setForceEditMode(false);
                  }
                }}
                className={cx(
                  "border shadow-none backdrop-blur-xl",
                  receiptMode
                    ? "bg-[rgba(52,52,57,0.52)] hover:bg-[rgba(66,66,72,0.58)] text-slate-100 border-amber-300/18"
                    : "bg-gradient-to-r from-amber-300 to-yellow-400 text-[#1a1208] hover:from-amber-200 hover:to-yellow-300 border-amber-300"
                )}
              >
                {receiptMode ? (
                  <>
                    <PenSquare className="w-4 h-4 mr-2" />
                    Go to Edit Mode
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Return to Receipt View
                  </>
                )}
              </Button>
            )}

            {!receiptMode && !isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-cyan-200 text-[#07141d] border border-sky-300 font-semibold shadow-[0_16px_40px_rgba(56,189,248,0.22)]"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Invoice
              </Button>
            ) : null}

            {!receiptMode && isEditing ? (
              <>
                <Button
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-slate-950 border border-emerald-300 font-semibold shadow-[0_16px_40px_rgba(16,185,129,0.20)]"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const snap = normalizeObject(invoice.appointment_snapshot);
                    let snapText = "";
                    try {
                      snapText = invoice.appointment_snapshot ? JSON.stringify(invoice.appointment_snapshot, null, 2) : "";
                    } catch {
                      snapText = "";
                    }

                    setDraft({
                      invoice_number: invoice.invoice_number ?? "",
                      status: invoice.status ?? "",
                      invoice_date: invoice.invoice_date ?? "",
                      technician_email: invoice.technician_email ?? "",
                      customer_name: readSnapshotCustomerName(snap, invoice),
                      customer_email: readSnapshotCustomerEmail(snap, invoice),
                      service_address: readSnapshotCustomerAddress(snap, invoice),
                      client_id: invoice.client_id ?? "",
                      vehicle_id: invoice.vehicle_id ?? "",
                      subtotal_cents: invoice.subtotal_cents ?? 0,
                      discount_cents: invoice.discount_cents ?? 0,
                      tax_cents: invoice.tax_cents ?? 0,
                      total_cents: invoice.total_cents ?? 0,
                      paid_at: invoice.paid_at ?? null,
                      notes: invoice.notes ?? "",
                      appointment_snapshot_text: snapText,
                    });

                    setInsuranceCoversRepairs(
                      readInsuranceFlagFromJson(invoice.services_json) || Number(invoice.insurance_due_cents ?? 0) > 0
                    );
                    setInsuranceFlatPriceCents(clampInsuranceCents(readInsuranceFlatPriceCentsFromJson(invoice.services_json)));
                    setInsuranceUiTouched(false);
                    setInsuranceForm(buildInsuranceFormFromInvoice(invoice, vehicle));
                    setInsuranceErrors({});
                    setInsuranceFormTouched(false);

                    setIsEditing(false);
                    setNotice("Reverted.");
                    setSaveErr(null);
                  }}
                  className="border-white/10 bg-[rgba(44,44,47,0.54)] text-slate-100 hover:bg-[rgba(56,56,60,0.62)] backdrop-blur-xl"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : null}

            <Button
              type="button"
              onClick={prepareSafeliteBilling}
              disabled={safelitePreparing || saveMutation.isPending}
              className="bg-emerald-500/15 border border-emerald-300/25 text-emerald-100 hover:bg-emerald-500/20 backdrop-blur-xl disabled:cursor-wait disabled:opacity-70"
            >
              {safelitePreparing || saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {safelitePreparing
                ? safeliteActionLabel
                : isEditing
                  ? "Save & Safelite Billing"
                  : "Safelite Billing"}
            </Button>

            <Button
              type="button"
              onClick={handleReceiptPdfDownload}
              disabled={receiptPdfDownloading}
              className="bg-[rgba(44,44,47,0.54)] border border-white/10 text-slate-100 hover:bg-[rgba(56,56,60,0.62)] backdrop-blur-xl disabled:cursor-wait disabled:opacity-70"
            >
              {receiptPdfDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4 mr-2" />
              )}
              PDF
            </Button>

            <Button
              type="button"
              onClick={openReceiptPrint}
              className="bg-[rgba(44,44,47,0.54)] border border-white/10 text-slate-100 hover:bg-[rgba(56,56,60,0.62)] backdrop-blur-xl"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>

            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-white/10 bg-[rgba(44,44,47,0.54)] text-slate-100 hover:bg-[rgba(56,56,60,0.62)] backdrop-blur-xl"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>

        {notice ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}

	        {saveErr ? (
	          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
	            {saveErr}
	          </div>
	        ) : null}

        {safeliteProgress ? (
          <Card className="overflow-hidden border border-amber-300/18 bg-[rgba(28,28,31,0.58)] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.34)] print:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-slate-50">
                <span className="flex items-center gap-2">
                  {safeliteProgress.tone === "red" ? (
                    <X className="h-5 w-5 text-red-300" />
                  ) : safeliteProgress.tone === "emerald" ? (
                    <CheckCircle className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
                  )}
                  Safelite Live Progress
                </span>
                <Badge
                  className={cx(
                    "border text-[11px] tracking-[0.16em] uppercase backdrop-blur-xl",
                    safeliteProgress.tone === "red"
                      ? "border-red-400/35 bg-red-500/12 text-red-100"
                      : safeliteProgress.tone === "emerald"
                        ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-100"
                        : safeliteProgress.tone === "sky"
                          ? "border-sky-300/35 bg-sky-500/12 text-sky-100"
                          : "border-amber-300/28 bg-amber-400/12 text-amber-100"
                  )}
                >
                  {safeliteProgress.label}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
                  <span>{safeliteProgress.helpText}</span>
                  <span className="font-semibold text-slate-100">
                    {safeliteProgress.percent}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/30">
                  <div
                    className={cx(
                      "h-full rounded-full transition-all duration-700",
                      safeliteProgress.tone === "red"
                        ? "bg-red-400"
                        : safeliteProgress.tone === "emerald"
                          ? "bg-emerald-400"
                          : safeliteProgress.tone === "sky"
                            ? "bg-sky-400"
                            : "bg-amber-300"
                    )}
                    style={{ width: `${safeliteProgress.percent}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Latest Worker Message
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-100">
                    {safeliteProgress.latestLog}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Job Details
                  </div>
                  <div className="mt-2 space-y-1">
                    <div>Status: {String(safeliteDisplayStatus || "pending").toUpperCase()}</div>
                    {safeliteLooksBackfilledSubmitted ? (
                      <div>Original worker status: {String(safeliteJob?.status || "").toUpperCase()}</div>
                    ) : null}
                    <div>Updated: {formatDT(safeliteJob?.updated_at)}</div>
                    <div className="break-all">Job: {safeliteJob?.id}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Worker Timeline
                </div>
                <div className="space-y-2">
                  {safeliteProgress.logs.slice(-12).map((entry: any, idx: number) => (
                    <div
                      key={`${String(entry?.at || "")}-${idx}`}
                      className="grid gap-1 text-xs text-slate-300 md:grid-cols-[155px_1fr]"
                    >
                      <span className="text-slate-500">{formatDT(entry?.at)}</span>
                      <span>{String(entry?.message || "Worker update")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

	        {safeliteDisplayStatus === "submitted" || safeliteDisplayStatus === "failed" ? (
	          <Card
              className={cx(
                "overflow-hidden backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.36)] print:hidden",
                safeliteDisplayStatus === "submitted"
                  ? "border border-emerald-400/25 bg-emerald-500/10"
                  : "border border-red-400/25 bg-red-500/10"
              )}
            >
	            <CardHeader className="pb-3">
	              <CardTitle className="flex items-center gap-2 text-slate-50">
	                {safeliteDisplayStatus === "submitted" ? (
                    <CheckCircle className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <X className="h-5 w-5 text-red-300" />
                  )}
	                {safeliteDisplayStatus === "submitted"
                    ? "Safelite Submission Proof"
                    : "Safelite Failure Screenshot"}
	              </CardTitle>
	            </CardHeader>
	            <CardContent className="space-y-3">
	              <div
                  className={cx(
                    "flex flex-wrap items-center gap-3 text-sm",
                    safeliteDisplayStatus === "submitted" ? "text-emerald-100" : "text-red-100"
                  )}
                >
	                <span>
                    {safeliteDisplayStatus === "submitted"
                      ? safeliteLooksBackfilledSubmitted
                        ? "Submitted successfully. This older worker row was corrected from its post-submit reset-page failure."
                        : "Submitted successfully."
                      : safeliteJob?.error_message || "Safelite automation failed before final submit."}
                  </span>
	                {safeliteJob?.confirmation_number ? (
	                  <span className="font-semibold">
	                    Confirmation: {safeliteJob.confirmation_number}
	                  </span>
	                ) : null}
	              </div>

                {safeliteScreenshotName ? (
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Screenshot: {safeliteScreenshotName}
                  </div>
                ) : null}

                {safeliteBeforeSubmitUrl || safeliteAfterSubmitUrl ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {safeliteBeforeSubmitUrl ? (
                      <div className="space-y-2">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Before Submit
                          {safeliteBeforeSubmitName ? `: ${safeliteBeforeSubmitName}` : ""}
                        </div>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          <img
                            src={safeliteBeforeSubmitUrl}
                            alt="Safelite before final submit screenshot"
                            className="block max-h-[360px] w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : null}

                    {safeliteAfterSubmitUrl ? (
                      <div className="space-y-2">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          After Submit
                          {safeliteAfterSubmitName ? `: ${safeliteAfterSubmitName}` : ""}
                        </div>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          <img
                            src={safeliteAfterSubmitUrl}
                            alt="Safelite after final submit screenshot"
                            className="block max-h-[360px] w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!safeliteBeforeSubmitUrl && !safeliteAfterSubmitUrl ? (
                  safeliteScreenshotUrl ? (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <img
                        src={safeliteScreenshotUrl}
                        alt="Safelite worker screenshot"
                        className="block max-h-[520px] w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                      {safeliteScreenshotError ||
                        (safeliteDisplayStatus === "submitted"
                          ? "Loading submission screenshot..."
                          : "Loading Safelite failure screenshot...")}
                    </div>
                  )
                ) : null}
	            </CardContent>
	          </Card>
	        ) : null}

	        {receiptMode && (
          <Card className="border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,214,102,0.08),rgba(55,55,60,0.28)_22%,rgba(28,28,31,0.56)_100%)] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.42)] print:hidden overflow-hidden">
            <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.55),transparent)]" />
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] tracking-[0.24em] uppercase text-amber-100 backdrop-blur-xl">
                    <Receipt className="w-3.5 h-3.5" />
                    Locked Receipt View
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-50">
                    Invoice is displayed like the finished Glass Guardian receipt view
                  </h2>
                  <p className="text-sm text-slate-300 max-w-3xl">
                    Since this invoice was {statusLower === "paid" ? "paid" : "sent"}, admin sees the polished
                    receipt-style layout by default. You can still reopen edit mode anytime above.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 min-w-[240px]">
                  <div className="rounded-2xl border border-white/10 bg-[rgba(42,42,46,0.44)] backdrop-blur-xl p-3">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Customer Due</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-50">{moneyFromCents(customerDue)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(42,42,46,0.44)] backdrop-blur-xl p-3">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Insurance Due</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-50">{moneyFromCents(insuranceDue)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card
          className={cx(
            "overflow-hidden border backdrop-blur-2xl print:bg-white print:border-slate-200 print:shadow-none",
            receiptMode
              ? "border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,220,120,0.08),rgba(70,70,75,0.22)_18%,rgba(34,34,38,0.52)_42%,rgba(22,22,25,0.68)_100%)] shadow-[0_36px_110px_rgba(0,0,0,0.48)]"
              : "border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.22),rgba(28,28,31,0.52)_24%,rgba(20,20,22,0.72)_100%)] shadow-[0_32px_100px_rgba(0,0,0,0.46)]"
          )}
        >
          <CardContent className="p-0">
            {receiptMode && (
              <div className="h-[2px] w-full bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.68),rgba(251,191,36,0.68),transparent)]" />
            )}

            <div className="p-6 md:p-8">
              <div className="grid md:grid-cols-[1.8fr_1.4fr] gap-8 items-start">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <motion.div
                      initial={{ rotateX: 25, rotateY: -25, opacity: 0 }}
                      animate={{ rotateX: 0, rotateY: 0, opacity: 1 }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                      className={cx(
                        "relative h-16 w-16 md:h-20 md:w-20 rounded-2xl border flex items-center justify-center overflow-hidden backdrop-blur-xl shrink-0",
                        receiptMode
                          ? "border-amber-300/24 bg-[linear-gradient(180deg,rgba(255,230,150,0.10),rgba(66,66,72,0.26)_30%,rgba(30,30,34,0.56)_100%)]"
                          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,220,120,0.08),rgba(64,64,68,0.20)_28%,rgba(30,30,34,0.50)_100%)]"
                      )}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.12),transparent_55%)]" />
                      <Image
                        src={COMPANY_LOGO_SRC}
                        alt="Glass Guardian logo"
                        fill
                        className="object-contain p-2.5"
                        sizes="80px"
                        priority
                      />
                    </motion.div>

                    <div className="space-y-1.5">
                      <h1 className="text-3xl md:text-4xl font-extrabold text-slate-50 leading-none">Glass Guardian</h1>
                      <p className="text-sm md:text-base font-semibold text-slate-300">Chip &amp; Crack Repair</p>

                      <div className="pt-1 space-y-1 text-xs md:text-sm text-slate-300 print:text-slate-700">
                        <p className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-amber-300/85 shrink-0" />
                          <span>{SHOP_ADDRESS}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-amber-300/85 shrink-0" />
                          <span>{formatPhoneDisplay(SHOP_PHONE)}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <BadgeDollarSign className="w-4 h-4 text-amber-300/85 shrink-0" />
                          <span>Fed Tax ID: {SHOP_FED_TAX_ID}</span>
                        </p>
                      </div>

                      {receiptMode ? (
                        <p className="pt-1 text-[11px] tracking-[0.22em] uppercase text-slate-400">
                          Prestige Repair Receipt
                        </p>
                      ) : (
                        <p className="pt-1 text-[11px] tracking-[0.22em] uppercase text-slate-400">
                          Admin Invoice Detail
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-slate-300 print:text-slate-700">
                    <p className="flex items-center gap-2">
                      <Receipt className="w-3.5 h-3.5 text-amber-300/85" />
                      <span>Invoice #{invNumber}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-300/85" />
                      <span>Invoice date: {invoiceDate || "TBD"}</span>
                    </p>
                    {invoice.created_at ? (
                      <p className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300/85" />
                        <span>Created: {formatDT(invoice.created_at)}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="md:text-right space-y-4">
                  <div className="inline-flex md:flex md:flex-col items-start md:items-end gap-2">
                    <p className="text-[0.65rem] font-semibold text-slate-400 tracking-[0.22em] uppercase">
                      {receiptMode ? "Receipt / Invoice" : isEditing ? "Admin Edit Mode" : "Invoice"}
                    </p>
                    <p className="text-xl md:text-2xl font-extrabold text-slate-50 md:leading-none">#{invNumber}</p>
                  </div>

                  <div className="flex md:justify-end flex-wrap gap-3 text-xs md:text-sm text-slate-300 print:text-slate-700">
                    {invoiceDate ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-300" />
                        <span>
                          Invoice Date:{" "}
                          <span className="font-semibold text-slate-100 print:text-slate-900">{invoiceDate}</span>
                        </span>
                      </span>
                    ) : null}

                    {warrantyEnd ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>
                          Warranty Through{" "}
                          <span className="font-semibold text-emerald-300 print:text-emerald-700">{warrantyEnd}</span>
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <Separator className="my-3 border-white/10 md:ml-auto md:w-64 print:border-slate-200" />

                  <div className="space-y-1 text-xs md:text-sm text-slate-300 print:text-slate-800">
                    <p className="text-[0.65rem] tracking-[0.2em] uppercase text-slate-400">Technician</p>
                    <p className="font-semibold text-slate-100 print:text-slate-900">{technicianDisplayName}</p>
                  </div>
                </div>
              </div>

              {receiptMode ? (
                <div className="mt-6 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-[rgba(46,46,50,0.46)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Subtotal</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{moneyFromCents(subtotalDisplay)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(46,46,50,0.46)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Discount</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{moneyFromCents(discountDisplay)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(46,46,50,0.46)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Tax</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{moneyFromCents(taxDisplay)}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,224,130,0.10),rgba(60,60,65,0.28)_34%,rgba(38,38,42,0.54)_100%)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-300">
                      {statusLower === "paid" ? "Paid Total" : "Customer Due"}
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{moneyFromCents(customerDue)}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 print:hidden">
                  <div className="rounded-xl border border-white/10 bg-[rgba(44,44,47,0.42)] backdrop-blur-xl p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs tracking-[0.2em] uppercase text-slate-400">Billing Summary</p>

                      {derivedInsuranceOn ? (
                        <Badge className="bg-amber-400/10 text-amber-100 border border-amber-300/20 text-[11px] tracking-[0.18em] uppercase backdrop-blur-xl">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Insurance Claim
                        </Badge>
                      ) : (
                        <Badge className="bg-white/5 text-slate-100 border border-white/10 text-[11px] tracking-[0.18em] uppercase backdrop-blur-xl">
                          Standard Billing
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 grid md:grid-cols-[1.3fr_1fr] gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!isEditing}
                          onClick={() => {
                            if (!isEditing) return;
                            setInsuranceCoversRepairs(false);
                            setInsuranceUiTouched(true);
                            setInsuranceErrors({});
                          }}
                          className={cx(
                            "justify-start border-white/10 bg-[rgba(40,40,44,0.44)] text-slate-100 hover:bg-[rgba(56,56,60,0.56)] disabled:opacity-70",
                            !derivedInsuranceOn && "ring-1 ring-emerald-400/30 border-emerald-400/30"
                          )}
                        >
                          <BadgeDollarSign className="w-4 h-4 mr-2 text-emerald-300" />
                          Standard / Customer
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={!isEditing}
                          onClick={() => {
                            if (!isEditing) return;
                            setInsuranceCoversRepairs(true);
                            setInsuranceUiTouched(true);
                            setInsuranceFormTouched(true);
                          }}
                          className={cx(
                            "justify-start border-white/10 bg-[rgba(40,40,44,0.44)] text-slate-100 hover:bg-[rgba(56,56,60,0.56)] disabled:opacity-70",
                            derivedInsuranceOn && "ring-1 ring-amber-400/35 border-amber-300/28"
                          )}
                        >
                          <ShieldCheck className="w-4 h-4 mr-2 text-amber-300" />
                          Insurance Claim
                        </Button>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[rgba(40,40,44,0.44)] p-3">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                            {derivedInsuranceOn ? "Insurance billing active" : "Standard billing active"}
                          </p>
                          <p className="text-sm text-slate-200">
                            {derivedInsuranceOn
                              ? "Customer stays at $0. Claim and vehicle fields live in Invoice / Vehicle Links."
                              : "Standard services and normal admin edit controls remain visible."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={recomputeTotal}
                          className="border-white/10 bg-[rgba(40,40,44,0.44)] text-slate-100 hover:bg-[rgba(56,56,60,0.56)]"
                        >
                          <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
                          Recompute Total
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className={cx(
              "border backdrop-blur-2xl print:bg-white print:border-slate-200 print:shadow-none",
              receiptMode
                ? "border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,220,120,0.06),rgba(58,58,63,0.18)_24%,rgba(30,30,34,0.50)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.36)]"
                : "border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.20),rgba(30,30,34,0.54)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.36)]"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Bill To
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200 print:text-slate-800">
              {!isEditing ? (
                <>
                  <p className="text-lg font-bold text-slate-50 print:text-slate-900">{customerNameDisplay}</p>

                  <div className="text-sm space-y-1">
                    {customerAddressDisplay ? (
                      <p className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400 print:text-slate-500" />
                        <span>{customerAddressDisplay}</span>
                      </p>
                    ) : null}

                    {billEmail ? (
                      <p className="flex items-center gap-2 break-all">
                        <Mail className="w-4 h-4 text-slate-400 print:text-slate-500" />
                        <span>{billEmail}</span>
                      </p>
                    ) : null}

                    {customerPhoneDisplay && customerPhoneDisplay !== "—" ? (
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 print:text-slate-500" />
                        <span>{customerPhoneDisplay}</span>
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <FieldShell label="Customer name" required error={combinedInsuranceErrors.customerName} icon={User}>
                    <Input
                      value={insuranceForm.customerName}
                      onChange={(e) => {
                        setInsuranceFormTouched(true);
                        setInsuranceErrors((prev) => ({ ...prev, customerName: undefined }));
                        setInsuranceForm((prev) => ({ ...prev, customerName: e.target.value }));
                        setDraft((d) => ({ ...d, customer_name: e.target.value }));
                      }}
                      className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                      placeholder="Customer name"
                    />
                  </FieldShell>

                  <FieldShell label="Customer email" icon={Mail}>
                    <Input
                      value={(draft.customer_email as any) ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, customer_email: e.target.value }))}
                      className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                      placeholder="customer@email.com"
                    />
                  </FieldShell>

                  <FieldShell label="Customer address" required error={combinedInsuranceErrors.customerAddress} icon={MapPin}>
                    <Input
                      value={insuranceForm.customerAddress}
                      onChange={(e) => {
                        setInsuranceFormTouched(true);
                        setInsuranceErrors((prev) => ({ ...prev, customerAddress: undefined }));
                        setInsuranceForm((prev) => ({ ...prev, customerAddress: e.target.value }));
                        setDraft((d) => ({
                          ...d,
                          service_address: e.target.value,
                        }));
                      }}
                      className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                      placeholder="Street, city, state ZIP"
                    />
                  </FieldShell>

                  <FieldShell label="Customer phone" required error={combinedInsuranceErrors.customerPhone} icon={Phone}>
                    <Input
                      value={insuranceForm.customerPhone}
                      onChange={(e) => {
                        setInsuranceFormTouched(true);
                        setInsuranceErrors((prev) => ({ ...prev, customerPhone: undefined }));
                        setInsuranceForm((prev) => ({
                          ...prev,
                          customerPhone: digitsOnly(e.target.value).slice(0, 10),
                        }));
                      }}
                      inputMode="numeric"
                      className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                      placeholder="9095551234"
                    />
                  </FieldShell>
                </div>
              )}

              {(snapshot.notes_customer || snapshot.damage_description) && !isEditing ? (
                <p className="text-xs text-slate-400 mt-2">Notes: {snapshot.notes_customer || snapshot.damage_description}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.20),rgba(30,30,34,0.54)_100%)] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.36)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-50 print:text-slate-900">Invoice / Vehicle Links</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-200 print:text-slate-800 space-y-3">
              {!isEditing ? (
                derivedInsuranceOn ? (
                  <>
                    <p>
                      <span className="text-slate-400">Referral #:</span>{" "}
                      <span className="font-semibold">{claimReferralDisplay}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Date of Loss:</span>{" "}
                      <span className="font-semibold">{claimDateOfLossDisplay}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Vehicle:</span>{" "}
                      <span className="font-semibold">{vehicleText}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">VIN:</span>{" "}
                      <span className="font-semibold">{vehicleVin}</span>
                    </p>
                    {vehicle?.license_plate ? (
                      <p>
                        <span className="text-slate-400">License Plate:</span>{" "}
                        <span className="font-semibold">{vehicle.license_plate}</span>
                      </p>
                    ) : null}
                    {vehicle?.insurance_carrier ? (
                      <p>
                        <span className="text-slate-400">Insurance Carrier:</span>{" "}
                        <span className="font-semibold">{vehicle.insurance_carrier}</span>
                      </p>
                    ) : null}
                    <p>
                      <span className="text-slate-400">Appointment ID:</span>{" "}
                      <span className="font-semibold">{invoice.appointment_id ?? "—"}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Technician:</span>{" "}
                      <span className="font-semibold">{technicianDisplayName}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="text-slate-400">Vehicle ID:</span>{" "}
                      <span className="font-semibold">{invoice.vehicle_id ?? "—"}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Vehicle:</span>{" "}
                      <span className="font-semibold">{vehicleText}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">VIN:</span>{" "}
                      <span className="font-semibold">{vehicleVin}</span>
                    </p>
                    {vehicle?.license_plate ? (
                      <p>
                        <span className="text-slate-400">License Plate:</span>{" "}
                        <span className="font-semibold">{vehicle.license_plate}</span>
                      </p>
                    ) : null}
                    {vehicle?.insurance_carrier ? (
                      <p>
                        <span className="text-slate-400">Insurance Carrier:</span>{" "}
                        <span className="font-semibold">{vehicle.insurance_carrier}</span>
                      </p>
                    ) : null}
                    <p>
                      <span className="text-slate-400">Appointment ID:</span>{" "}
                      <span className="font-semibold">{invoice.appointment_id ?? "—"}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Technician:</span>{" "}
                      <span className="font-semibold">{technicianDisplayName}</span>
                    </p>
                  </>
                )
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Status</p>
                    <Input
                      value={(draft.status as any) ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                      className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                      placeholder="draft / sent / paid"
                    />
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Technician</p>
                    <Input
                      value={(draft.technician_email as any) ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, technician_email: e.target.value }))}
                      className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                      placeholder="tech@email.com"
                    />
                  </div>

                  {derivedInsuranceOn ? (
                    <>
                      <FieldShell
                        label="6 digit referral number"
                        required
                        error={combinedInsuranceErrors.referralNumber}
                        icon={Hash}
                      >
                        <Input
                          value={insuranceForm.referralNumber}
                          onChange={(e) => {
                            setInsuranceFormTouched(true);
                            setInsuranceErrors((prev) => ({ ...prev, referralNumber: undefined }));
                            setInsuranceForm((prev) => ({
                              ...prev,
                              referralNumber: digitsOnly(e.target.value).slice(0, 6),
                            }));
                          }}
                          inputMode="numeric"
                          placeholder="123456"
                          className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                        />
                      </FieldShell>

                      <FieldShell label="VIN" required error={combinedInsuranceErrors.vin} icon={Car}>
                        <Input
                          value={insuranceForm.vin}
                          onChange={(e) => {
                            setInsuranceFormTouched(true);
                            setInsuranceErrors((prev) => ({ ...prev, vin: undefined }));
                            setInsuranceForm((prev) => ({
                              ...prev,
                              vin: e.target.value.toUpperCase().slice(0, 17),
                            }));
                          }}
                          placeholder="1HGCM82633A123456"
                          className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500 uppercase"
                        />
                      </FieldShell>

                      <FieldShell label="Date of loss" icon={Calendar}>
                        <Input
                          type="date"
                          value={insuranceForm.dateOfLoss}
                          onChange={(e) => {
                            setInsuranceFormTouched(true);
                            setInsuranceForm((prev) => ({
                              ...prev,
                              dateOfLoss: e.target.value,
                            }));
                          }}
                          className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                        />
                      </FieldShell>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FieldShell label="Year" required error={combinedInsuranceErrors.vehicleYear}>
                          <Input
                            value={insuranceForm.vehicleYear}
                            onChange={(e) => {
                              setInsuranceFormTouched(true);
                              setInsuranceErrors((prev) => ({ ...prev, vehicleYear: undefined }));
                              setInsuranceForm((prev) => ({
                                ...prev,
                                vehicleYear: e.target.value,
                              }));
                            }}
                            inputMode="numeric"
                            placeholder="2022"
                            className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                          />
                        </FieldShell>

                        <FieldShell label="Make" required error={combinedInsuranceErrors.vehicleMake}>
                          <Input
                            value={insuranceForm.vehicleMake}
                            onChange={(e) => {
                              setInsuranceFormTouched(true);
                              setInsuranceErrors((prev) => ({ ...prev, vehicleMake: undefined }));
                              setInsuranceForm((prev) => ({
                                ...prev,
                                vehicleMake: e.target.value,
                              }));
                            }}
                            placeholder="Toyota"
                            className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                          />
                        </FieldShell>

                        <FieldShell label="Model" required error={combinedInsuranceErrors.vehicleModel}>
                          <Input
                            value={insuranceForm.vehicleModel}
                            onChange={(e) => {
                              setInsuranceFormTouched(true);
                              setInsuranceErrors((prev) => ({ ...prev, vehicleModel: undefined }));
                              setInsuranceForm((prev) => ({
                                ...prev,
                                vehicleModel: e.target.value,
                              }));
                            }}
                            placeholder="Camry"
                            className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                          />
                        </FieldShell>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Vehicle ID</p>
                      <Input
                        value={(draft.vehicle_id as any) ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, vehicle_id: e.target.value }))}
                        className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                        placeholder="uuid"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {receiptMode ? (
          <Card className="border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,224,130,0.06),rgba(58,58,63,0.20)_24%,rgba(30,30,34,0.54)_100%)] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.36)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <Receipt className="w-4 h-4 text-amber-300" />
                Receipt Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-slate-200 print:text-slate-800">
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  {snapshot.service_type ? (
                    <p>
                      <span className="font-semibold text-slate-100">Service Type:</span> {snapshot.service_type}
                    </p>
                  ) : null}
                  {snapshot.damage_description ? (
                    <p>
                      <span className="font-semibold text-slate-100">Damage:</span> {snapshot.damage_description}
                    </p>
                  ) : null}
                  {snapshot.damage_size ? (
                    <p>
                      <span className="font-semibold text-slate-100">Size:</span> {snapshot.damage_size}
                    </p>
                  ) : null}
                  {snapshot.location_type ? (
                    <p>
                      <span className="font-semibold text-slate-100">Location Type:</span> {snapshot.location_type}
                    </p>
                  ) : null}
                  {snapshot.scheduled_date ? (
                    <p>
                      <span className="font-semibold text-slate-100">Scheduled Date:</span> {formatD(snapshot.scheduled_date)}
                    </p>
                  ) : null}
                  {lockedInsuranceMode ? (
                    <>
                      <p>
                        <span className="font-semibold text-slate-100">Referral #:</span>{" "}
                        {claimReferralDisplay}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-100">Date of Loss:</span>{" "}
                        {claimDateOfLossDisplay}
                      </p>
                    </>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[rgba(42,42,46,0.42)] backdrop-blur-xl p-4">
                  <div className="space-y-2">
                    <SummaryRow label="Subtotal" value={moneyFromCents(subtotalDisplay)} />
                    <SummaryRow label="Discount" value={moneyFromCents(discountDisplay)} />
                    <SummaryRow label="Tax" value={moneyFromCents(taxDisplay)} />
                    <Separator className="border-white/10" />
                    <SummaryRow
                      label={statusLower === "paid" ? "Paid Amount" : "Customer Due"}
                      value={moneyFromCents(customerDue)}
                      strong
                    />
                    {insuranceDue > 0 ? <SummaryRow label="Insurance Due" value={moneyFromCents(insuranceDue)} /> : null}
                  </div>
                </div>
              </div>

              {statusLower === "paid" ? (
                <div className="rounded-2xl border border-emerald-400/24 bg-emerald-500/10 backdrop-blur-xl p-4">
                  <p className="text-xs tracking-[0.18em] uppercase text-emerald-200/85">Payment Status</p>
                  <p className="mt-1 text-base font-bold text-emerald-100">Paid in full</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/08 backdrop-blur-xl p-4">
                  <p className="text-xs tracking-[0.18em] uppercase text-amber-100/78">Invoice Status</p>
                  <p className="mt-1 text-base font-bold text-slate-100">Sent to customer</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {lockedInsuranceMode && receiptSignaturePreview ? (
          <Card className="border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,220,120,0.06),rgba(58,58,63,0.20)_24%,rgba(30,30,34,0.54)_100%)] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.36)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <PenLine className="w-4 h-4 text-amber-300" />
                Customer Signature on File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-white/10 bg-[rgba(24,24,27,0.78)] p-4">
                <div className="rounded-xl border border-white/10 bg-white p-3">
                  <img
                    src={receiptSignaturePreview}
                    alt="Saved customer signature"
                    className="max-h-40 w-full object-contain"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {receiptMode ? (
          <WindshieldRepairMap
            invoice={{
              id: invoice.id,
              windshield_repairs_json: invoice.windshield_repairs_json ?? [],
            }}
            readOnly
          />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {!derivedInsuranceOn ? (
              <motion.div
                key={isEditing ? "admin-standard-edit" : "admin-standard-view"}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-6"
              >
                {!isEditing ? (
                  <>
                    <ServicesPerformed
                      {...({
                        invoice: {
                          id: invoice.id,
                          services_json: invoice.services_json ?? null,
                          discount_cents: invoice.discount_cents ?? 0,
                          tax_cents: invoice.tax_cents ?? 0,
                          subtotal_cents: invoice.subtotal_cents ?? 0,
                        },
                      } as any)}
                    />

                    <WindshieldRepairMap invoice={invoice as any} />

                    <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.22),rgba(30,30,34,0.58)_100%)] backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-slate-50">
                          <FileText className="w-4 h-4 text-amber-300" />
                          Repair Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-200">
                        {snapshot.damage_description ? (
                          <p>
                            <span className="font-semibold">Damage:</span> {snapshot.damage_description}
                          </p>
                        ) : (
                          <p className="text-slate-400">No repair notes recorded on this invoice.</p>
                        )}
                        {snapshot.damage_size ? (
                          <p>
                            <span className="font-semibold">Size:</span> {snapshot.damage_size}
                          </p>
                        ) : null}
                        {snapshot.location_type ? (
                          <p>
                            <span className="font-semibold">Location Type:</span> {snapshot.location_type}
                          </p>
                        ) : null}
                        {snapshot.service_type ? (
                          <p>
                            <span className="font-semibold">Service Type:</span> {snapshot.service_type}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.22),rgba(30,30,34,0.58)_100%)] backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-slate-50">
                        <Pencil className="w-4 h-4 text-amber-300" />
                        Admin Edit Fields
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Subtotal</p>
                          <Input
                            value={(draft.subtotal_cents as any) ?? 0}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                subtotal_cents: toCentsInt(e.target.value) ?? 0,
                              }))
                            }
                            className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Discount</p>
                          <Input
                            value={(draft.discount_cents as any) ?? 0}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                discount_cents: toCentsInt(e.target.value) ?? 0,
                              }))
                            }
                            className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Tax</p>
                          <Input
                            value={(draft.tax_cents as any) ?? 0}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                tax_cents: toCentsInt(e.target.value) ?? 0,
                              }))
                            }
                            className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Total</p>
                          <Input
                            value={(draft.total_cents as any) ?? 0}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                total_cents: toCentsInt(e.target.value) ?? 0,
                              }))
                            }
                            className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">Internal Notes</p>
                        <Textarea
                          value={((draft as any).notes as any) ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...(d as any), notes: e.target.value }))}
                          className="min-h-[100px] bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100"
                          placeholder="Admin notes…"
                        />
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
                          appointment_snapshot (JSON)
                        </p>
                        <Textarea
                          value={((draft as any).appointment_snapshot_text as any) ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...(d as any),
                              appointment_snapshot_text: e.target.value,
                            }))
                          }
                          className="min-h-[220px] font-mono text-xs bg-black/30 border-white/10 text-slate-100"
                          placeholder='{"services_performed":["Chip Repair"],"spot_location":"top_left"}'
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          Keep valid JSON. Clear it to set snapshot to null.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="admin-insurance-billing"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-6"
              >
                <Card className="border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,220,120,0.07),rgba(42,42,46,0.50)_20%,rgba(28,28,31,0.76)_100%)] backdrop-blur-2xl shadow-[0_28px_90px_rgba(0,0,0,0.42)] overflow-hidden">
                  <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.55),transparent)]" />
                  <CardHeader className="pb-4">
                    <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-slate-50">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-amber-300" />
                        Insurance Billing Details
                      </span>

                      <Badge className="bg-amber-400/10 text-amber-100 border border-amber-300/20 tracking-[0.18em] uppercase">
                        Required for claim billing
                      </Badge>
                    </CardTitle>

                    <p className="text-sm text-slate-300">
                      Customer info is edited in Bill To, shop info lives in the header, and all claim and vehicle
                      fields live in Invoice / Vehicle Links. This section only keeps pricing and signature.
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                            <DollarSign className="w-4 h-4 text-amber-300" />
                            Line item price breakdown
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
	                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
	                            <Button
	                              type="button"
	                              variant="outline"
	                              disabled={!isEditing}
	                              onClick={() => {
	                                setInsuranceFormTouched(true);
	                                setInsuranceErrors((prev) => ({ ...prev, lineItemPriceCents: undefined }));
                                setInsuranceFlatPriceCents(7000);
                                setInsuranceForm((prev) => ({ ...prev, lineItemPriceCents: 7000 }));
                              }}
                              className={cx(
                                "border-white/10 bg-[rgba(24,24,27,0.70)] text-slate-100 hover:bg-[rgba(44,44,48,0.78)]",
                                insuranceLineItemPrice === 7000 && "ring-1 ring-amber-400/35 border-amber-300/24"
                              )}
                            >
                              $70.00
                            </Button>

	                            <Button
	                              type="button"
	                              variant="outline"
	                              disabled={!isEditing}
	                              onClick={() => {
	                                setInsuranceFormTouched(true);
	                                setInsuranceErrors((prev) => ({ ...prev, lineItemPriceCents: undefined }));
                                setInsuranceFlatPriceCents(6500);
                                setInsuranceForm((prev) => ({ ...prev, lineItemPriceCents: 6500 }));
                              }}
                              className={cx(
                                "border-white/10 bg-[rgba(24,24,27,0.70)] text-slate-100 hover:bg-[rgba(44,44,48,0.78)]",
                                insuranceLineItemPrice === 6500 && "ring-1 ring-amber-400/35 border-amber-300/24"
                              )}
	                            >
	                              $65.00
	                            </Button>
	                          </div>

	                          <FieldShell
	                            label="Custom insurer billed amount"
	                            required
	                            error={combinedInsuranceErrors.lineItemPriceCents}
	                            icon={DollarSign}
	                          >
	                            <div className="relative">
	                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
	                                $
	                              </span>
	                              <Input
	                                value={(insuranceLineItemPrice / 100).toFixed(2)}
	                                onChange={(e) => {
	                                  setInsuranceFormTouched(true);
	                                  setInsuranceErrors((prev) => ({ ...prev, lineItemPriceCents: undefined }));
	                                  const nextCents = dollarsInputToCents(e.target.value);
	                                  setInsuranceFlatPriceCents(nextCents);
	                                  setInsuranceForm((prev) => ({
	                                    ...prev,
	                                    lineItemPriceCents: nextCents,
	                                  }));
	                                }}
	                                onBlur={() => {
	                                  const nextCents = clampInsuranceCents(insuranceForm.lineItemPriceCents);
	                                  setInsuranceFlatPriceCents(nextCents);
	                                  setInsuranceForm((prev) => ({
	                                    ...prev,
	                                    lineItemPriceCents: nextCents,
	                                  }));
	                                }}
	                                disabled={!isEditing}
	                                inputMode="decimal"
	                                className="bg-[rgba(24,24,27,0.84)] border-white/10 pl-7 text-slate-100 placeholder:text-slate-500 disabled:opacity-70"
	                                placeholder="70.00"
	                              />
	                            </div>
	                          </FieldShell>

	                          <div className="rounded-2xl border border-white/10 bg-[rgba(24,24,27,0.74)] p-4">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-slate-300">Windshield chip repair</span>
                              <span className="font-semibold text-slate-100">{dollars(insuranceLineItemPrice / 100)}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-slate-400">Qty</span>
                              <span className="font-semibold text-slate-100">1</span>
                            </div>
                            <Separator className="my-3 border-white/10" />
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-slate-100">Insurance due</span>
                              <span className="text-lg font-extrabold text-amber-100">
                                {dollars(insuranceLineItemPrice / 100)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-400">Customer due will remain $0.00</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                          <PenLine className="w-4 h-4 text-amber-300" />
                          Customer signature
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FieldShell label="Signature" required error={combinedInsuranceErrors.signatureDataUrl}>
                          <div className="rounded-2xl border border-white/10 bg-[rgba(24,24,27,0.80)] p-3">
                            <SignatureCanvas
                              valueDataUrl={insuranceForm.signatureDataUrl || null}
                              onChangeDataUrl={(nextValue) => {
                                setInsuranceFormTouched(true);
                                setInsuranceErrors((prev) => ({
                                  ...prev,
                                  signatureDataUrl: undefined,
                                }));
                                setInsuranceForm((prev) => ({
                                  ...prev,
                                  signatureDataUrl: String(nextValue ?? ""),
                                }));
                              }}
                              disabled={false}
                            />
                          </div>
                        </FieldShell>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setInsuranceFormTouched(true);
                              setInsuranceForm((prev) => ({ ...prev, signatureDataUrl: "" }));
                            }}
                            className="border-white/10 bg-[rgba(24,24,27,0.80)] text-slate-100 hover:bg-[rgba(44,44,48,0.78)]"
                          >
                            Clear signature
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const ok = validateInsuranceNow();
                              if (!ok) return;
                              setNotice("Insurance fields look complete. Save changes to persist them.");
                            }}
                            className="border-amber-300/20 bg-amber-400/08 text-amber-100 hover:bg-amber-400/12"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Validate insurance fields
                          </Button>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[rgba(24,24,27,0.78)] p-4">
                          {signaturePreview ? (
                            <div className="space-y-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Signature preview
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white p-3">
                                <img
                                  src={signaturePreview}
                                  alt="Saved customer signature"
                                  className="max-h-40 w-full object-contain"
                                />
                              </div>
                              <p className="text-xs text-slate-400">
                                This signature will be stored in the invoice insurance meta and shown in receipt view.
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">
                              No saved signature yet. Once captured, it will preview here.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <Card
          className={cx(
            "backdrop-blur-2xl print:bg-white print:border-emerald-300 print:shadow-none",
            receiptMode
              ? "border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,224,130,0.06),rgba(58,58,63,0.18)_22%,rgba(30,30,34,0.52)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.36)]"
              : "border border-emerald-500/24 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(58,58,63,0.16)_18%,rgba(30,30,34,0.48)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
              <ShieldCheck className={cx("w-5 h-5", receiptMode ? "text-amber-300" : "text-emerald-300")} />
              Windshield Repair Warranty
            </CardTitle>
            {invoiceDate && warrantyEnd ? (
              <Badge
                className={cx(
                  "text-[11px] backdrop-blur-xl",
                  receiptMode
                    ? "bg-amber-400/10 text-amber-100 border border-amber-300/20"
                    : "bg-emerald-500/15 text-emerald-100 border border-emerald-300/32"
                )}
              >
                {invoiceDate} → {warrantyEnd}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent
            className={cx(
              "space-y-2 text-xs md:text-sm print:text-emerald-900",
              receiptMode ? "text-slate-200" : "text-emerald-50"
            )}
          >
            <p>
              This invoice serves as the Glass Guardian warranty record for the repair performed on the vehicle listed
              above.
            </p>
          </CardContent>
        </Card>

        <div className="hidden print:block text-center text-[10px] text-slate-500 mt-4">
          Glass Guardian Chip &amp; Crack Repair — {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
