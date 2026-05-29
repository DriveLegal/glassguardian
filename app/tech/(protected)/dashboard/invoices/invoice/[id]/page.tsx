// app/tech/(protected)/dashboard/invoices/invoice/[id]/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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
  DollarSign,
  Phone,
  Lock,
  Unlock,
  Receipt,
  PenSquare,
  Building2,
  Hash,
  Car,
  BadgeDollarSign,
  ClipboardList,
  PenLine,
} from "lucide-react";

import { ServicesPerformed } from "@/components/tech/invoice/ServicesPerformed";
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";
import { InvoiceVehicleSection } from "@/components/tech/invoice/InvoiceVehicleSection";
import SignatureCanvas from "@/components/forms/SignatureCanvas";

/* ---------- tiny class helper ---------- */
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  appointment_id?: string | null;

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

  deposit_request_id?: string | null;
  deposit_cents?: number | null;
  deposit_applied_at?: string | null;

  final_paid_cents?: number | null;
  paid_at?: string | null;
  payment_method?: string | null;

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

type TechnicianProfile = {
  full_name: string | null;
  email: string | null;
};

type InsuranceMeta = {
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

/* ---------- Helpers ---------- */

const DEFAULT_INSURANCE_FLAT_PRICE_CENTS = 7000;
const INSURANCE_MIN_CENTS = 6500;
const INSURANCE_MAX_CENTS = 7000;
const COMPANY_LOGO_SRC = "/branding/glass-guardian-gold.png";

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

function buildCrackMediaUrlsFromInvoice(inv: TechInvoice | null | undefined) {
  const anyArr = inv?.crack_out_media_urls;
  if (Array.isArray(anyArr) && anyArr.length) return anyArr;
  if (inv?.crack_out_photo_url) return [inv.crack_out_photo_url];
  return null;
}

function isCrackOutFromInvoice(inv: TechInvoice | null | undefined) {
  return inv?.crack_out_occurred === true || String(inv?.repair_outcome ?? "") === "crack_out";
}

function dollars(n: number) {
  return Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function normalizeObject(v: any): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  return {};
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

function readInsuranceMetaFromJson(v: any): InsuranceMeta {
  const sj = normalizeObject(v);
  const meta = normalizeObject(sj.insurance_meta);
  return {
    referral_number: typeof meta.referral_number === "string" ? meta.referral_number : "",
    vin: typeof meta.vin === "string" ? meta.vin : "",
    vehicle_year: typeof meta.vehicle_year === "string" ? meta.vehicle_year : meta.vehicle_year != null ? String(meta.vehicle_year) : "",
    vehicle_make: typeof meta.vehicle_make === "string" ? meta.vehicle_make : "",
    vehicle_model: typeof meta.vehicle_model === "string" ? meta.vehicle_model : "",
    customer_name: typeof meta.customer_name === "string" ? meta.customer_name : "",
    customer_address: typeof meta.customer_address === "string" ? meta.customer_address : "",
    customer_phone: typeof meta.customer_phone === "string" ? meta.customer_phone : "",
    shop_name: typeof meta.shop_name === "string" ? meta.shop_name : "",
    shop_address: typeof meta.shop_address === "string" ? meta.shop_address : "",
    shop_phone: typeof meta.shop_phone === "string" ? meta.shop_phone : "",
    shop_fed_tax_id: typeof meta.shop_fed_tax_id === "string" ? meta.shop_fed_tax_id : "",
    line_items: Array.isArray(meta.line_items) ? meta.line_items : [],
    signature_data_url: typeof meta.signature_data_url === "string" ? meta.signature_data_url : "",
    signature_signed_at: typeof meta.signature_signed_at === "string" ? meta.signature_signed_at : "",
  };
}

function clampInsuranceCents(n: number) {
  const x = Math.round(Number.isFinite(n) ? n : DEFAULT_INSURANCE_FLAT_PRICE_CENTS);
  return Math.max(INSURANCE_MIN_CENTS, Math.min(INSURANCE_MAX_CENTS, x));
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
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

function emptyInsuranceForm(): InsuranceFormState {
  return {
    referralNumber: "",
    vin: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    lineItemPriceCents: DEFAULT_INSURANCE_FLAT_PRICE_CENTS,
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    shopName: "",
    shopAddress: "",
    shopPhone: "",
    shopFedTaxId: "",
    signatureDataUrl: "",
  };
}

function buildInsuranceFormFromSources(args: {
  invoice: TechInvoice | null | undefined;
  appointment: Appointment | null | undefined;
}) {
  const meta = readInsuranceMetaFromJson(args.invoice?.services_json);
  const snapshot = normalizeObject(args.invoice?.appointment_snapshot);
  const fallbackAddress =
    args.invoice?.service_address ?? snapshot.service_address ?? args.appointment?.service_address ?? "";

  return {
    referralNumber: meta.referral_number ?? "",
    vin: (meta.vin ?? "").toUpperCase(),
    vehicleYear: meta.vehicle_year ?? "",
    vehicleMake: meta.vehicle_make ?? "",
    vehicleModel: meta.vehicle_model ?? "",
    lineItemPriceCents:
      Array.isArray(meta.line_items) && meta.line_items[0]?.unit_price_cents
        ? clampInsuranceCents(Number(meta.line_items[0].unit_price_cents))
        : clampInsuranceCents(readInsuranceFlatPriceCentsFromJson(args.invoice?.services_json)),
    customerName: meta.customer_name ?? args.invoice?.customer_name ?? "",
    customerAddress: meta.customer_address ?? fallbackAddress,
    customerPhone: meta.customer_phone ?? "",
    shopName: meta.shop_name ?? "Glass Guardian",
    shopAddress: meta.shop_address ?? "",
    shopPhone: meta.shop_phone ?? "",
    shopFedTaxId: meta.shop_fed_tax_id ?? "",
    signatureDataUrl: meta.signature_data_url ?? "",
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

  if (![6500, 7000].includes(clampInsuranceCents(form.lineItemPriceCents))) {
    errors.lineItemPriceCents = "Choose $65 or $70.";
  }

  if (!form.customerName.trim()) errors.customerName = "Customer name is required.";
  if (!form.customerAddress.trim()) errors.customerAddress = "Customer address is required.";
  if (normalizePhone(form.customerPhone).length !== 10) {
    errors.customerPhone = "Customer phone must be 10 digits.";
  }

  if (!form.shopAddress.trim()) errors.shopAddress = "Shop address is required.";
  if (normalizePhone(form.shopPhone).length !== 10) {
    errors.shopPhone = "Shop phone must be 10 digits.";
  }
  if (!form.shopFedTaxId.trim()) errors.shopFedTaxId = "Fed tax ID is required.";

  if (!form.signatureDataUrl.trim()) {
    errors.signatureDataUrl = "Signature is required.";
  }

  return errors;
}

function insuranceMetaFromForm(form: InsuranceFormState): InsuranceMeta {
  const price = clampInsuranceCents(form.lineItemPriceCents);

  return {
    referral_number: digitsOnly(form.referralNumber).slice(0, 6),
    vin: form.vin.trim().toUpperCase(),
    vehicle_year: form.vehicleYear.trim(),
    vehicle_make: form.vehicleMake.trim(),
    vehicle_model: form.vehicleModel.trim(),

    customer_name: form.customerName.trim(),
    customer_address: form.customerAddress.trim(),
    customer_phone: normalizePhone(form.customerPhone),

    shop_name: form.shopName.trim() || "Glass Guardian",
    shop_address: form.shopAddress.trim(),
    shop_phone: normalizePhone(form.shopPhone),
    shop_fed_tax_id: form.shopFedTaxId.trim(),

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

/* ---------- Main ---------- */

export default function TechInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id as string | undefined;
  const queryClient = useQueryClient();

  const RETURN_ROUTE = "/tech/dashboard/invoices";

  const [totalsSnapshot, setTotalsSnapshot] = React.useState<{
    subtotalDollars: number;
    discountDollars: number;
    taxDollars: number;
    totalDollars: number;
  } | null>(null);

  const [insuranceCoversRepairs, setInsuranceCoversRepairs] = React.useState(false);
  const [insuranceFlatPriceCents, setInsuranceFlatPriceCents] = React.useState(DEFAULT_INSURANCE_FLAT_PRICE_CENTS);
  const [insuranceUiTouched, setInsuranceUiTouched] = React.useState(false);

  const [insuranceForm, setInsuranceForm] = React.useState<InsuranceFormState>(emptyInsuranceForm());
  const [insuranceErrors, setInsuranceErrors] = React.useState<InsuranceErrors>({});
  const [insuranceFormTouched, setInsuranceFormTouched] = React.useState(false);

  const [forceEditMode, setForceEditMode] = React.useState(false);

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
            "appointment_id",
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
            "deposit_request_id",
            "deposit_cents",
            "deposit_applied_at",
            "final_paid_cents",
            "paid_at",
            "payment_method",
            "insurance_due_cents",
            "customer_due_cents",
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
      return (res.data ?? null) as TechInvoice | null;
    },
    staleTime: 10_000,
  });

  const linkedAppointmentId = React.useMemo(() => {
    const cand = techInvoice?.appointment_id;
    return cand ? String(cand) : null;
  }, [techInvoice?.appointment_id]);

  const { data: appointment, isLoading: loadingAppt } = useQuery<Appointment | null>({
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

      if (res.error) {
        console.warn("[InvoiceDetail] optional appointment load failed:", res.error);
        return null;
      }

      return (res.data ?? null) as Appointment | null;
    },
    staleTime: 10_000,
  });

  const technicianEmail = React.useMemo(() => {
    return techInvoice?.technician_email ?? appointment?.technician_email ?? null;
  }, [techInvoice?.technician_email, appointment?.technician_email]);

  const { data: technicianProfile } = useQuery<TechnicianProfile | null>({
    queryKey: ["invoice-technician-profile", technicianEmail],
    enabled: !!technicianEmail,
    queryFn: async () => {
      if (!technicianEmail) return null;

      const res = await supabaseClient
        .from("users_public")
        .select("full_name, email")
        .eq("email", technicianEmail)
        .maybeSingle();

      if (res.error) {
        console.warn("[InvoiceDetail] optional technician profile load failed:", res.error);
        return null;
      }

      return (res.data ?? null) as TechnicianProfile | null;
    },
    staleTime: 10_000,
  });

  const isCrackOut = isCrackOutFromInvoice(techInvoice);
  const replacementRequired =
    !!techInvoice?.replacement_required || isCrackOut || !!appointment?.replacement_required;

  const effectiveInvoice = React.useMemo<TechInvoice | null>(() => {
    if (!techInvoice) return null;
    return {
      ...techInvoice,
      discount_percent: techInvoice.discount_percent ?? null,
      discount_cents: techInvoice.discount_cents ?? 0,
      tax_rate_percent: techInvoice.tax_rate_percent ?? null,
      tax_cents: techInvoice.tax_cents ?? 0,
      subtotal_cents: techInvoice.subtotal_cents ?? 0,
      total_cents: techInvoice.total_cents ?? 0,
      deposit_request_id: techInvoice.deposit_request_id ?? null,
      deposit_cents: techInvoice.deposit_cents ?? 0,
      deposit_applied_at: techInvoice.deposit_applied_at ?? null,
      final_paid_cents: techInvoice.final_paid_cents ?? null,
      paid_at: techInvoice.paid_at ?? null,
      payment_method: techInvoice.payment_method ?? null,
      insurance_due_cents: techInvoice.insurance_due_cents ?? 0,
      customer_due_cents: techInvoice.customer_due_cents ?? null,
      crack_out_occurred: techInvoice.crack_out_occurred ?? false,
      crack_out_notes: techInvoice.crack_out_notes ?? null,
      crack_out_media_urls: techInvoice.crack_out_media_urls ?? null,
    };
  }, [techInvoice]);

  const derivedInsuranceOn = React.useMemo(() => {
    const sj = normalizeObject(effectiveInvoice?.services_json);
    const snap = normalizeObject(effectiveInvoice?.appointment_snapshot);
    const fromJson = readInsuranceFlagFromJson(sj);
    const fromSnap =
      typeof snap.insurance_covers_repairs === "boolean"
        ? snap.insurance_covers_repairs
        : typeof snap.insurance_covered === "boolean"
          ? snap.insurance_covered
          : false;

    return insuranceCoversRepairs || fromJson || fromSnap;
  }, [effectiveInvoice?.services_json, effectiveInvoice?.appointment_snapshot, insuranceCoversRepairs]);

  React.useEffect(() => {
    if (!effectiveInvoice) return;

    const sj = normalizeObject(effectiveInvoice.services_json);
    const snap = normalizeObject(effectiveInvoice.appointment_snapshot);

    const flag =
      typeof sj.insurance_covers_repairs === "boolean"
        ? sj.insurance_covers_repairs
        : typeof sj.insurance_covered === "boolean"
          ? sj.insurance_covered
          : typeof snap.insurance_covers_repairs === "boolean"
            ? snap.insurance_covers_repairs
            : typeof snap.insurance_covered === "boolean"
              ? snap.insurance_covered
              : false;

    setInsuranceCoversRepairs(flag);

    if (!insuranceUiTouched) {
      const fromJson = readInsuranceFlatPriceCentsFromJson(sj);
      setInsuranceFlatPriceCents(clampInsuranceCents(fromJson));
    }

    setInsuranceForm((prev) => {
      if (insuranceFormTouched) return prev;
      return buildInsuranceFormFromSources({
        invoice: effectiveInvoice,
        appointment,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveInvoice?.id, effectiveInvoice?.services_json, appointment?.id]);

  React.useEffect(() => {
    const s = String(techInvoice?.status ?? "").toLowerCase();
    if (s !== "sent" && s !== "paid") {
      setForceEditMode(false);
    }
  }, [techInvoice?.status]);

  React.useEffect(() => {
    if (!derivedInsuranceOn) {
      setInsuranceErrors({});
    }
  }, [derivedInsuranceOn]);

  const handleTotalsChange = React.useCallback(
    (totals: any) => {
      if (derivedInsuranceOn) {
        const flatDollars = clampInsuranceCents(insuranceFlatPriceCents) / 100;
        setTotalsSnapshot({
          subtotalDollars: flatDollars,
          discountDollars: flatDollars,
          taxDollars: 0,
          totalDollars: 0,
        });
        return;
      }

      const subtotalDollars =
        totals.subtotalDollars ??
        totals.subtotal ??
        (typeof totals.subtotal_cents === "number" ? totals.subtotal_cents / 100 : 0);

      const discountDollars =
        totals.discountDollars ??
        totals.discount ??
        (typeof totals.discount_cents === "number" ? totals.discount_cents / 100 : 0);

      const taxDollars =
        totals.taxDollars ??
        totals.tax ??
        (typeof totals.tax_cents === "number" ? totals.tax_cents / 100 : 0);

      const totalDollars =
        totals.totalDollars ??
        totals.total ??
        (typeof totals.total_cents === "number"
          ? totals.total_cents / 100
          : subtotalDollars - discountDollars + taxDollars);

      setTotalsSnapshot({
        subtotalDollars,
        discountDollars,
        taxDollars,
        totalDollars,
      });
    },
    [derivedInsuranceOn, insuranceFlatPriceCents]
  );

  const computeMoneyFromSnapshot = React.useCallback(() => {
    if (derivedInsuranceOn) {
      const flat = clampInsuranceCents(insuranceFlatPriceCents);
      return {
        subtotal_cents: flat,
        discount_cents: flat,
        tax_cents: 0,
        total_cents: 0,
      };
    }

    return {
      subtotal_cents:
        totalsSnapshot != null
          ? Math.round(totalsSnapshot.subtotalDollars * 100)
          : effectiveInvoice?.subtotal_cents ?? 0,
      discount_cents:
        totalsSnapshot != null
          ? Math.round(totalsSnapshot.discountDollars * 100)
          : effectiveInvoice?.discount_cents ?? 0,
      tax_cents:
        totalsSnapshot != null
          ? Math.round(totalsSnapshot.taxDollars * 100)
          : effectiveInvoice?.tax_cents ?? 0,
      total_cents:
        totalsSnapshot != null
          ? Math.round(totalsSnapshot.totalDollars * 100)
          : effectiveInvoice?.total_cents ?? 0,
    };
  }, [
    derivedInsuranceOn,
    insuranceFlatPriceCents,
    totalsSnapshot,
    effectiveInvoice?.subtotal_cents,
    effectiveInvoice?.discount_cents,
    effectiveInvoice?.tax_cents,
    effectiveInvoice?.total_cents,
  ]);

  const validateInsuranceNow = React.useCallback(() => {
    const nextErrors = validateInsuranceForm(insuranceForm);
    setInsuranceErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [insuranceForm]);

  const buildPatchedServices = React.useCallback(
    async (latestServicesJson: any, insuranceOn: boolean, flatCents: number) => {
      const insuranceMeta = insuranceMetaFromForm({
        ...insuranceForm,
        lineItemPriceCents: flatCents,
      });

      return mergeServicesJson(latestServicesJson, {
        insurance_covers_repairs: insuranceOn,
        insurance_covered: insuranceOn,
        insurance_flat_price_cents: flatCents,
        insurance_due_cents: insuranceOn ? flatCents : null,
        customer_due_cents: insuranceOn ? 0 : undefined,
        chip_repair_customer_price_cents: insuranceOn ? 0 : undefined,
        chip_repair_insurance_price_cents: insuranceOn ? flatCents : undefined,
        insurance_meta: insuranceOn ? insuranceMeta : normalizeObject(latestServicesJson).insurance_meta ?? insuranceMeta,
      });
    },
    [insuranceForm]
  );

  const readLatestInsuranceStateFromDb = React.useCallback(async () => {
    if (!invoiceId) {
      return {
        insuranceOn: derivedInsuranceOn,
        flatCents: clampInsuranceCents(insuranceFlatPriceCents),
      };
    }

    const res = await supabaseClient
      .from("tech_invoices")
      .select("services_json")
      .eq("id", invoiceId)
      .maybeSingle();

    if (res.error) {
      return {
        insuranceOn: derivedInsuranceOn,
        flatCents: clampInsuranceCents(insuranceFlatPriceCents),
        servicesJson: effectiveInvoice?.services_json ?? null,
      };
    }

    const insuranceOn = readInsuranceFlagFromJson(res.data?.services_json) || insuranceCoversRepairs;
    const flatFromDb = clampInsuranceCents(readInsuranceFlatPriceCentsFromJson(res.data?.services_json));
    const flatCents = insuranceUiTouched ? clampInsuranceCents(insuranceFlatPriceCents) : flatFromDb;

    return { insuranceOn, flatCents, servicesJson: res.data?.services_json ?? null };
  }, [
    invoiceId,
    derivedInsuranceOn,
    insuranceFlatPriceCents,
    insuranceUiTouched,
    effectiveInvoice?.services_json,
    insuranceCoversRepairs,
  ]);

  const saveInsuranceFlatMutation = useMutation({
    mutationFn: async (flatCents: number) => {
      if (!invoiceId) throw new Error("Missing invoice id");
      const flat = clampInsuranceCents(flatCents);

      const latest = await supabaseClient
        .from("tech_invoices")
        .select("services_json")
        .eq("id", invoiceId)
        .maybeSingle();

      if (latest.error) throw latest.error;

      const patched = await buildPatchedServices(latest.data?.services_json, true, flat);

      const upd = await supabaseClient
        .from("tech_invoices")
        .update({
          services_json: patched,
          insurance_due_cents: flat,
          customer_due_cents: 0,
        })
        .eq("id", invoiceId);

      if (upd.error) throw upd.error;
      return { ok: true, flat };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tech-invoice-by-id", invoiceId] });
    },
  });

  const saveInsuranceDraftMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      const flat = clampInsuranceCents(insuranceForm.lineItemPriceCents);

      const latest = await supabaseClient
        .from("tech_invoices")
        .select("services_json")
        .eq("id", invoiceId)
        .maybeSingle();

      if (latest.error) throw latest.error;

      const patched = await buildPatchedServices(latest.data?.services_json, true, flat);

      const upd = await supabaseClient
        .from("tech_invoices")
        .update({
          services_json: patched,
          insurance_due_cents: flat,
          customer_due_cents: 0,
        })
        .eq("id", invoiceId);

      if (upd.error) throw upd.error;
      return { ok: true };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tech-invoice-by-id", invoiceId] });
    },
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      if (!effectiveInvoice?.id) throw new Error("Missing invoice record");

      const todayIso = new Date().toISOString().split("T")[0];
      const { insuranceOn, flatCents, servicesJson } = await readLatestInsuranceStateFromDb();

      if (insuranceOn) {
        const ok = validateInsuranceForm({
          ...insuranceForm,
          lineItemPriceCents: flatCents,
        });
        setInsuranceErrors(ok);
        if (Object.keys(ok).length > 0) {
          throw new Error("Please complete all required insurance billing fields.");
        }
      }

      const { subtotal_cents, discount_cents, tax_cents, total_cents } = insuranceOn
        ? { subtotal_cents: flatCents, discount_cents: flatCents, tax_cents: 0, total_cents: 0 }
        : computeMoneyFromSnapshot();

      const deposit_cents = insuranceOn ? 0 : Math.min(Number(effectiveInvoice.deposit_cents || 0), total_cents);
      const deposit_applied_at =
        deposit_cents > 0 ? effectiveInvoice.deposit_applied_at ?? new Date().toISOString() : null;

      const insurance_due_cents = insuranceOn ? flatCents : 0;
      const customer_due_cents = insuranceOn ? 0 : Math.max(0, total_cents - deposit_cents);

      const patchedServices = await buildPatchedServices(
        servicesJson ?? effectiveInvoice.services_json,
        insuranceOn,
        flatCents
      );

      const res = await supabaseClient
        .from("tech_invoices")
        .update({
          services_json: patchedServices,
          invoice_date: effectiveInvoice.invoice_date ?? todayIso,
          status: "sent",
          subtotal_cents,
          discount_percent: effectiveInvoice.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
          tax_cents,
          total_cents,
          deposit_cents,
          deposit_applied_at,
          final_paid_cents: null,
          paid_at: null,
          payment_method: null,
          insurance_due_cents,
          customer_due_cents,
          repair_outcome: effectiveInvoice.repair_outcome ?? (isCrackOut ? "crack_out" : "completed"),
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tech-invoice-by-id", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }).catch(() => {});
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id");
      if (!effectiveInvoice?.id) throw new Error("Missing invoice record");

      const todayIso = new Date().toISOString().split("T")[0];
      const paidAt = new Date().toISOString();
      const { insuranceOn, flatCents, servicesJson } = await readLatestInsuranceStateFromDb();

      if (insuranceOn) {
        const ok = validateInsuranceForm({
          ...insuranceForm,
          lineItemPriceCents: flatCents,
        });
        setInsuranceErrors(ok);
        if (Object.keys(ok).length > 0) {
          throw new Error("Please complete all required insurance billing fields.");
        }
      }

      const { subtotal_cents, discount_cents, tax_cents, total_cents } = insuranceOn
        ? { subtotal_cents: flatCents, discount_cents: flatCents, tax_cents: 0, total_cents: 0 }
        : computeMoneyFromSnapshot();

      const deposit_cents = insuranceOn ? 0 : Math.min(Number(effectiveInvoice.deposit_cents || 0), total_cents);
      const deposit_applied_at =
        deposit_cents > 0 ? effectiveInvoice.deposit_applied_at ?? paidAt : null;

      const insurance_due_cents = insuranceOn ? flatCents : 0;
      const customer_due_cents = insuranceOn ? 0 : Math.max(0, total_cents - deposit_cents);

      const patchedServices = await buildPatchedServices(
        servicesJson ?? effectiveInvoice.services_json,
        insuranceOn,
        flatCents
      );

      const invRes = await supabaseClient
        .from("tech_invoices")
        .update({
          services_json: patchedServices,
          invoice_date: effectiveInvoice.invoice_date ?? todayIso,
          status: "paid",
          subtotal_cents,
          discount_percent: effectiveInvoice.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
          tax_cents,
          total_cents,
          deposit_cents,
          deposit_applied_at,
          final_paid_cents: customer_due_cents,
          paid_at: paidAt,
          payment_method: "tech_marked_paid",
          insurance_due_cents,
          customer_due_cents,
          repair_outcome: effectiveInvoice.repair_outcome ?? (isCrackOut ? "crack_out" : "completed"),
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

      if (appointment?.id) {
        const apptRes = await supabaseClient
          .from("appointments")
          .update({
            status: "paid",
            final_amount: customer_due_cents / 100,
          })
          .eq("id", appointment.id);

        if (apptRes.error) throw apptRes.error;
      }

      return { ok: true };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tech-invoice-by-id", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }).catch(() => {});
    },
  });

  const isLoading = loadingInvoice || loadingAppt;

  if (isLoading && !techInvoice) {
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

  if (invoiceErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] p-4 print:bg-white">
        <Card className="max-w-md w-full border border-red-500/30 bg-[rgba(28,28,31,0.84)] backdrop-blur-2xl text-slate-50 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-red-200">Invoice Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">There was an issue loading this invoice. Please try again.</p>
            <Button
              variant="outline"
              className="border-white/10 text-slate-100 bg-transparent hover:bg-white/5"
              onClick={() => router.push(RETURN_ROUTE)}
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
              onClick={() => router.push(RETURN_ROUTE)}
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
  const statusLower = String(status).toLowerCase();
  const isLockedByStatus = statusLower === "sent" || statusLower === "paid";
  const receiptMode = isLockedByStatus && !forceEditMode;

  const warrantyEnd = addYears(invoiceDate, 1);
  const snapshot = techInvoice.appointment_snapshot ?? {};
  const billEmail = techInvoice.customer_email ?? snapshot.customer_email ?? null;
  const money = computeMoneyFromSnapshot();

  const activeDepositCents = Math.max(0, Number(effectiveInvoice?.deposit_cents || 0));
  const serviceTotalCents = money.total_cents;
  const depositAppliedCents = derivedInsuranceOn ? 0 : Math.min(activeDepositCents, serviceTotalCents);
  const standardCustomerDueCents = Math.max(0, serviceTotalCents - depositAppliedCents);

  const insuranceDue =
    (effectiveInvoice?.insurance_due_cents ?? 0) > 0
      ? effectiveInvoice?.insurance_due_cents ?? 0
      : derivedInsuranceOn
        ? clampInsuranceCents(insuranceFlatPriceCents)
        : 0;

  const customerDue = derivedInsuranceOn
    ? 0
    : typeof effectiveInvoice?.customer_due_cents === "number" &&
        effectiveInvoice.customer_due_cents > 0 &&
        statusLower !== "draft"
      ? effectiveInvoice.customer_due_cents
      : standardCustomerDueCents;

  const technicianDisplayName = technicianProfile?.full_name?.trim() || technicianEmail || "Technician";

  const subtotalDisplay = effectiveInvoice?.subtotal_cents ?? money.subtotal_cents;
  const discountDisplay = effectiveInvoice?.discount_cents ?? money.discount_cents;
  const taxDisplay = effectiveInvoice?.tax_cents ?? money.tax_cents;

  const liveInsuranceErrors =
    derivedInsuranceOn && insuranceFormTouched ? validateInsuranceForm(insuranceForm) : {};
  const combinedInsuranceErrors = { ...liveInsuranceErrors, ...insuranceErrors };

  const insuranceLineItemPrice = clampInsuranceCents(insuranceForm.lineItemPriceCents);
  const insuranceMetaPreview = insuranceMetaFromForm({
    ...insuranceForm,
    lineItemPriceCents: insuranceLineItemPrice,
  });

  const signaturePreview = insuranceForm.signatureDataUrl?.trim() || insuranceMetaPreview.signature_data_url || "";

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
            onClick={() => router.push(RETURN_ROUTE)}
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

            {receiptMode && (
              <Badge className="bg-amber-400/12 text-amber-100 border border-amber-300/28 text-xs px-3 py-1 tracking-[0.18em] uppercase backdrop-blur-xl">
                <Lock className="w-3.5 h-3.5 mr-1" />
                RECEIPT VIEW
              </Badge>
            )}

            {depositAppliedCents > 0 && (
              <Badge className="bg-emerald-500/12 text-emerald-100 border border-emerald-400/35 text-xs px-3 py-1 tracking-[0.16em] uppercase backdrop-blur-xl">
                Deposit -{dollars(depositAppliedCents / 100)}
              </Badge>
            )}

            {insuranceDue > 0 && (
              <Badge className="bg-[rgba(51,51,56,0.52)] text-slate-100 border border-amber-300/18 text-xs px-3 py-1 tracking-[0.16em] uppercase backdrop-blur-xl">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-300" />
                INSURANCE {dollars(insuranceDue / 100)} · CUSTOMER {dollars(customerDue / 100)}
              </Badge>
            )}

            {isCrackOut && (
              <Badge className="bg-amber-400 text-[#21170a] border border-amber-200 text-xs px-3 py-1 tracking-[0.18em] uppercase">
                <TriangleAlert className="w-3.5 h-3.5 mr-1" />
                CRACK-OUT
              </Badge>
            )}

            {isLockedByStatus && (
              <Button
                type="button"
                onClick={() => setForceEditMode((v) => !v)}
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

            <Button
              onClick={() => window.print()}
              className="bg-[rgba(44,44,47,0.54)] border border-white/10 text-slate-100 hover:bg-[rgba(56,56,60,0.62)] backdrop-blur-xl"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

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
                    Invoice is now displayed like a finished Glass Guardian receipt
                  </h2>
                  <p className="text-sm text-slate-300 max-w-3xl">
                    Since this invoice was {statusLower === "paid" ? "paid" : "sent"}, the page defaults to a cleaner
                    receipt-style layout. Tech can still reopen edit mode anytime with the button above.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 min-w-[240px]">
                  <div className="rounded-2xl border border-white/10 bg-[rgba(42,42,46,0.44)] backdrop-blur-xl p-3">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Customer Due</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-50">{dollars(customerDue / 100)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(42,42,46,0.44)] backdrop-blur-xl p-3">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Insurance Due</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-50">{dollars(insuranceDue / 100)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isCrackOut && (
          <Card className="border border-amber-300/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(55,55,60,0.28)_18%,rgba(28,28,31,0.60)_100%)] backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.42)] print:bg-white print:border-amber-300 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-100 print:text-amber-900">
                <TriangleAlert className="w-5 h-5 text-amber-300" />
                Crack-out Reported During Repair
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200 print:text-slate-800">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold text-amber-200 print:text-amber-900">Replacement Required:</span>{" "}
                    <span className="font-semibold">{replacementRequired ? "Yes" : "No"}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Cause:</span>{" "}
                    {prettyCause(techInvoice.crack_out_cause ?? appointment?.crack_out_cause)}
                  </p>
                  <p className="text-xs text-slate-400 print:text-slate-700">
                    Reported at: {fmtDateTime(techInvoice.crack_out_at ?? appointment?.crack_out_at) ?? "N/A"}
                  </p>

                  {(techInvoice.crack_out_notes ?? appointment?.crack_out_notes) && (
                    <div className="rounded-lg border border-white/10 bg-[rgba(44,44,47,0.42)] backdrop-blur-xl p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80 mb-1">Notes</p>
                      <p className="text-sm text-slate-100 print:text-slate-800">
                        {techInvoice.crack_out_notes ?? appointment?.crack_out_notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Photo Evidence</p>
                    {techInvoice.crack_out_photo_url ?? appointment?.crack_out_photo_url ? (
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

                  {techInvoice.crack_out_photo_url ?? appointment?.crack_out_photo_url ? (
                    <img
                      src={techInvoice.crack_out_photo_url ?? appointment?.crack_out_photo_url ?? ""}
                      alt="Crack-out photo"
                      className="w-full max-h-64 object-cover rounded-xl border border-white/10"
                    />
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-[rgba(44,44,47,0.42)] backdrop-blur-xl p-4 text-sm text-slate-300">
                      No crack-out photo found on this invoice.
                    </div>
                  )}
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
                  <div className="flex items-center gap-4">
                    <motion.div
                      initial={{ rotateX: 25, rotateY: -25, opacity: 0 }}
                      animate={{ rotateX: 0, rotateY: 0, opacity: 1 }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                      className={cx(
                        "relative h-16 w-16 md:h-20 md:w-20 rounded-2xl border flex items-center justify-center overflow-hidden backdrop-blur-xl",
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

                    <div className="space-y-1">
                      <p className="text-[0.7rem] tracking-[0.25em] uppercase text-amber-200/90">Glass Guardian</p>
                      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-50 leading-tight">
                        Chip &amp; Crack Repair
                      </h1>
                      {receiptMode && (
                        <p className="text-[11px] tracking-[0.22em] uppercase text-slate-400">
                          Prestige Repair Receipt
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-slate-300 print:text-slate-700">
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-amber-300/85" />
                      <span>Phone: (909)5291798</span>
                    </p>
                    <p className="flex items-center gap-2 break-all">
                      <Mail className="w-3.5 h-3.5 text-amber-300/85" />
                      <span>Contact email: info@glassguardianchipandcrackrepair.com</span>
                    </p>
                  </div>
                </div>

                <div className="md:text-right space-y-4">
                  <div className="inline-flex md:flex md:flex-col items-start md:items-end gap-2">
                    <p className="text-[0.65rem] font-semibold text-slate-400 tracking-[0.22em] uppercase">
                      {receiptMode ? "Receipt / Invoice" : "Invoice"}
                    </p>
                    <p className="text-xl md:text-2xl font-extrabold text-slate-50 md:leading-none">
                      #{techInvoice.invoice_number ?? techInvoice.id}
                    </p>
                  </div>

                  <div className="flex md:justify-end flex-wrap gap-3 text-xs md:text-sm text-slate-300 print:text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-300" />
                      <span>
                        Invoice Date:{" "}
                        <span className="font-semibold text-slate-100 print:text-slate-900">
                          {invoiceDate || "TBD"}
                        </span>
                      </span>
                    </span>

                    {!isCrackOut && warrantyEnd && (
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>
                          Warranty Through{" "}
                          <span className="font-semibold text-emerald-300 print:text-emerald-700">{warrantyEnd}</span>
                        </span>
                      </span>
                    )}
                  </div>

                  <Separator className="my-3 border-white/10 md:ml-auto md:w-64 print:border-slate-200" />

                  <div className="space-y-1 text-xs md:text-sm text-slate-300 print:text-slate-800">
                    <p className="text-[0.65rem] tracking-[0.2em] uppercase text-slate-400">Technician</p>
                    <p className="font-semibold text-slate-100 print:text-slate-900">{technicianDisplayName}</p>
                    <p className="text-slate-400 text-xs">Thank you for trusting Glass Guardian with your vehicle.</p>
                  </div>
                </div>
              </div>

              {receiptMode ? (
                <div className="mt-6 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-[rgba(46,46,50,0.46)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Subtotal</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{dollars(subtotalDisplay / 100)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(46,46,50,0.46)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Discount</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{dollars(discountDisplay / 100)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[rgba(46,46,50,0.46)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">Tax</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{dollars(taxDisplay / 100)}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,224,130,0.10),rgba(60,60,65,0.28)_34%,rgba(38,38,42,0.54)_100%)] backdrop-blur-xl p-4">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-slate-300">
                      {statusLower === "paid" ? "Paid Total" : "Customer Due"}
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slate-50">{dollars(customerDue / 100)}</p>
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
                          onClick={() => {
                            setInsuranceCoversRepairs(false);
                            setInsuranceUiTouched(true);
                          }}
                          className={cx(
                            "justify-start border-white/10 bg-[rgba(40,40,44,0.44)] text-slate-100 hover:bg-[rgba(56,56,60,0.56)]",
                            !derivedInsuranceOn && "ring-1 ring-emerald-400/30 border-emerald-400/30"
                          )}
                        >
                          <BadgeDollarSign className="w-4 h-4 mr-2 text-emerald-300" />
                          Standard / Customer
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setInsuranceCoversRepairs(true);
                            setInsuranceUiTouched(true);
                            setInsuranceFormTouched(true);
                          }}
                          className={cx(
                            "justify-start border-white/10 bg-[rgba(40,40,44,0.44)] text-slate-100 hover:bg-[rgba(56,56,60,0.56)]",
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
                              ? "Customer stays at $0. Insurance-only fields and signature are required."
                              : "Standard services and normal invoice actions remain visible."}
                          </p>
                        </div>
                      </div>
                    </div>
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
                <p className="text-xs text-slate-400 mt-2">Notes: {snapshot.notes_customer || snapshot.damage_description}</p>
              )}
            </CardContent>
          </Card>

          {appointment?.id ? (
            <InvoiceVehicleSection
              appointmentId={appointment.id}
              customerEmail={appointment.customer_email}
              currentVehicleId={appointment.vehicle_id}
            />
          ) : (
            <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.20),rgba(30,30,34,0.54)_100%)] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.36)] print:bg-white print:border-slate-200 print:shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-50 print:text-slate-900">Vehicle</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-200 print:text-slate-800 space-y-2">
                <p className="text-slate-400">No appointment linked to this invoice.</p>
                <p>
                  <span className="text-slate-400">Vehicle ID:</span>{" "}
                  <span className="font-semibold">{techInvoice.vehicle_id ?? "—"}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {receiptMode && (
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
                  {snapshot.service_type && (
                    <p>
                      <span className="font-semibold text-slate-100">Service Type:</span> {snapshot.service_type}
                    </p>
                  )}
                  {snapshot.damage_description && (
                    <p>
                      <span className="font-semibold text-slate-100">Damage:</span> {snapshot.damage_description}
                    </p>
                  )}
                  {snapshot.damage_size && (
                    <p>
                      <span className="font-semibold text-slate-100">Size:</span> {snapshot.damage_size}
                    </p>
                  )}
                  {snapshot.location_type && (
                    <p>
                      <span className="font-semibold text-slate-100">Location Type:</span> {snapshot.location_type}
                    </p>
                  )}
                  {snapshot.scheduled_date && (
                    <p>
                      <span className="font-semibold text-slate-100">Scheduled Date:</span>{" "}
                      {formatDate(snapshot.scheduled_date)}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-[rgba(42,42,46,0.42)] backdrop-blur-xl p-4">
                  <div className="space-y-2">
                    <SummaryRow label="Subtotal" value={dollars(subtotalDisplay / 100)} />
                    <SummaryRow label="Discount" value={dollars(discountDisplay / 100)} />
                    <SummaryRow label="Tax" value={dollars(taxDisplay / 100)} />

                    {depositAppliedCents > 0 && (
                      <SummaryRow
                        label="Deposit Applied"
                        value={`-${dollars(depositAppliedCents / 100)}`}
                        valueClassName="text-emerald-300"
                      />
                    )}

                    <Separator className="border-white/10" />
                    <SummaryRow
                      label={statusLower === "paid" ? "Paid Amount" : "Customer Due"}
                      value={dollars(customerDue / 100)}
                      strong
                    />

                    {insuranceDue > 0 && (
                      <SummaryRow label="Insurance Due" value={dollars(insuranceDue / 100)} />
                    )}
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
        )}

        {receiptMode && effectiveInvoice && (
          <WindshieldRepairMap
            invoice={{
              id: effectiveInvoice.id,
              windshield_repairs_json: effectiveInvoice.windshield_repairs_json ?? [],
            }}
            readOnly
          />
        )}

        {!receiptMode && effectiveInvoice && (
          <>
            <AnimatePresence mode="wait" initial={false}>
              {!derivedInsuranceOn ? (
                <motion.div
                  key="standard-billing"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <ServicesPerformed
                    {...({
                      invoice: {
                        id: effectiveInvoice.id,
                        services_json: effectiveInvoice.services_json ?? null,
                        discount_percent: effectiveInvoice.discount_percent ?? null,
                        discount_cents: effectiveInvoice.discount_cents ?? 0,
                        tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
                        tax_cents: effectiveInvoice.tax_cents ?? 0,
                        subtotal_cents: effectiveInvoice.subtotal_cents ?? 0,
                        total_cents: effectiveInvoice.total_cents ?? 0,
                        deposit_cents: effectiveInvoice.deposit_cents ?? 0,
                      },
                      onTotalsChange: handleTotalsChange,
                    } as any)}
                  />

                  <WindshieldRepairMap invoice={effectiveInvoice as any} />

                  <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.22),rgba(30,30,34,0.58)_100%)] backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.42)] print:bg-white print:border-slate-200 print:shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                        <FileText className="w-4 h-4 text-amber-300" />
                        Repair Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-200 print:text-slate-800">
                      {snapshot.damage_description ? (
                        <p>
                          <span className="font-semibold">Damage:</span> {snapshot.damage_description}
                        </p>
                      ) : (
                        <p className="text-slate-400 print:text-slate-700">No repair notes recorded on this invoice.</p>
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

                  <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(58,58,63,0.22),rgba(30,30,34,0.58)_100%)] backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.42)] print:hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-slate-50">
                        <Send className="w-4 h-4 text-amber-300" />
                        {isLockedByStatus ? "Edit Invoice" : "Send Invoice (Tech → User)"}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4 text-sm text-slate-200">
                      <p className="text-xs md:text-sm text-slate-300 max-w-3xl">
                        Enter services and map the repair, then{" "}
                        <span className="font-semibold text-slate-100">Send Invoice</span> or{" "}
                        <span className="font-semibold text-slate-100">Mark Paid &amp; Send</span>.
                      </p>

                      <div className="rounded-2xl border border-white/10 bg-[rgba(24,24,27,0.72)] p-4 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Service Total</span>
                          <span className="font-semibold text-slate-100">{dollars(serviceTotalCents / 100)}</span>
                        </div>

                        {depositAppliedCents > 0 && (
                          <div className="mt-1 flex items-center justify-between text-emerald-200">
                            <span>Deposit Applied</span>
                            <span className="font-semibold">-{dollars(depositAppliedCents / 100)}</span>
                          </div>
                        )}

                        <Separator className="my-2 border-white/10" />

                        <div className="flex items-center justify-between text-slate-50">
                          <span className="font-semibold">Customer Balance</span>
                          <span className="text-lg font-extrabold text-emerald-300">
                            {dollars(customerDue / 100)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-1">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            disabled={sendInvoiceMutation.isPending || markPaidMutation.isPending}
                            onClick={async () => {
                              try {
                                await sendInvoiceMutation.mutateAsync();
                                setForceEditMode(false);
                              } catch (e) {
                                console.error("[SendInvoice] failed:", e);
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-300 to-yellow-400 hover:from-amber-200 hover:to-yellow-300 text-[#1a1208] font-semibold shadow-[0_16px_40px_rgba(251,191,36,0.22)]"
                          >
                            {sendInvoiceMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sending Invoice…
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                {statusLower === "sent" || statusLower === "paid" ? "Save & Send Again" : "Send Invoice"}
                              </>
                            )}
                          </Button>

                          <Button
                            disabled={sendInvoiceMutation.isPending || markPaidMutation.isPending}
                            onClick={async () => {
                              try {
                                await markPaidMutation.mutateAsync();
                                setForceEditMode(false);
                              } catch (e) {
                                console.error("[MarkPaid] failed:", e);
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-slate-50 font-semibold shadow-[0_16px_40px_rgba(245,158,11,0.18)]"
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
                          <span className="text-xs text-red-400">Failed to mark invoice as paid.</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="insurance-billing"
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
                        Standard send/payment controls are replaced while insurance is selected. Complete the required
                        claim fields below, save if needed, then send or mark paid.
                      </p>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                              <ClipboardList className="w-4 h-4 text-amber-300" />
                              Claim + vehicle
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
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

                            <FieldShell
                              label="17 digit VIN"
                              required
                              error={combinedInsuranceErrors.vin}
                              icon={Car}
                            >
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
                          </CardContent>
                        </Card>

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

                            {combinedInsuranceErrors.lineItemPriceCents ? (
                              <p className="text-xs text-red-300">{combinedInsuranceErrors.lineItemPriceCents}</p>
                            ) : null}

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

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                              <Phone className="w-4 h-4 text-amber-300" />
                              Customer billing details
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FieldShell label="Customer name" required error={combinedInsuranceErrors.customerName}>
                              <Input
                                value={insuranceForm.customerName}
                                onChange={(e) => {
                                  setInsuranceFormTouched(true);
                                  setInsuranceErrors((prev) => ({ ...prev, customerName: undefined }));
                                  setInsuranceForm((prev) => ({ ...prev, customerName: e.target.value }));
                                }}
                                placeholder="Full name"
                                className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                              />
                            </FieldShell>

                            <FieldShell label="Customer address" required error={combinedInsuranceErrors.customerAddress} icon={MapPin}>
                              <Input
                                value={insuranceForm.customerAddress}
                                onChange={(e) => {
                                  setInsuranceFormTouched(true);
                                  setInsuranceErrors((prev) => ({ ...prev, customerAddress: undefined }));
                                  setInsuranceForm((prev) => ({ ...prev, customerAddress: e.target.value }));
                                }}
                                placeholder="Street, city, state ZIP"
                                className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
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
                                placeholder="9095551234"
                                className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                              />
                            </FieldShell>
                          </CardContent>
                        </Card>

                        <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                              <Building2 className="w-4 h-4 text-amber-300" />
                              Shop billing details
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FieldShell label="Shop name">
                              <Input
                                value={insuranceForm.shopName}
                                onChange={(e) => {
                                  setInsuranceFormTouched(true);
                                  setInsuranceForm((prev) => ({ ...prev, shopName: e.target.value }));
                                }}
                                placeholder="Glass Guardian"
                                className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                              />
                            </FieldShell>

                            <FieldShell label="Shop address" required error={combinedInsuranceErrors.shopAddress} icon={MapPin}>
                              <Input
                                value={insuranceForm.shopAddress}
                                onChange={(e) => {
                                  setInsuranceFormTouched(true);
                                  setInsuranceErrors((prev) => ({ ...prev, shopAddress: undefined }));
                                  setInsuranceForm((prev) => ({ ...prev, shopAddress: e.target.value }));
                                }}
                                placeholder="Shop address"
                                className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                              />
                            </FieldShell>

                            <FieldShell label="Shop phone" required error={combinedInsuranceErrors.shopPhone} icon={Phone}>
                              <Input
                                value={insuranceForm.shopPhone}
                                onChange={(e) => {
                                  setInsuranceFormTouched(true);
                                  setInsuranceErrors((prev) => ({ ...prev, shopPhone: undefined }));
                                  setInsuranceForm((prev) => ({
                                    ...prev,
                                    shopPhone: digitsOnly(e.target.value).slice(0, 10),
                                  }));
                                }}
                                inputMode="numeric"
                                placeholder="9095551234"
                                className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                              />
                            </FieldShell>

                            <FieldShell
                              label="Fed tax ID number"
                              required
                              error={combinedInsuranceErrors.shopFedTaxId}
                              icon={BadgeDollarSign}
                            >
                              <Input
                                value={insuranceForm.shopFedTaxId}
                                onChange={(e) => {
                                  setInsuranceFormTouched(true);
                                  setInsuranceErrors((prev) => ({ ...prev, shopFedTaxId: undefined }));
                                  setInsuranceForm((prev) => ({ ...prev, shopFedTaxId: e.target.value }));
                                }}
                                placeholder="XX-XXXXXXX"
                                className="bg-[rgba(24,24,27,0.84)] border-white/10 text-slate-100 placeholder:text-slate-500"
                              />
                            </FieldShell>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
                        <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                              <PenLine className="w-4 h-4 text-amber-300" />
                              Customer signature
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FieldShell
                              label="Signature"
                              required
                              error={combinedInsuranceErrors.signatureDataUrl}
                            >
                              <div className="rounded-2xl border border-white/10 bg-[rgba(24,24,27,0.80)] p-3">
                                {React.createElement(SignatureCanvas as any, {
                                  value: insuranceForm.signatureDataUrl,
                                  disabled: false,
                                  onChange: (nextValue: string) => {
                                    setInsuranceFormTouched(true);
                                    setInsuranceErrors((prev: InsuranceErrors) => ({
                                      ...prev,
                                      signatureDataUrl: undefined,
                                    }));
                                    setInsuranceForm((prev) => ({
                                      ...prev,
                                      signatureDataUrl: String(nextValue ?? ""),
                                    }));
                                  },
                                })}
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
                                disabled={saveInsuranceDraftMutation.isPending}
                                onClick={async () => {
                                  try {
                                    const ok = validateInsuranceNow();
                                    if (!ok) return;
                                    await saveInsuranceDraftMutation.mutateAsync();
                                  } catch (e) {
                                    console.error("[SaveInsuranceDraft] failed:", e);
                                  }
                                }}
                                className="border-amber-300/20 bg-amber-400/08 text-amber-100 hover:bg-amber-400/12"
                              >
                                {saveInsuranceDraftMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving…
                                  </>
                                ) : (
                                  "Save insurance draft"
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                              <Receipt className="w-4 h-4 text-amber-300" />
                              Insurance invoice preview
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid gap-3">
                              <div className="rounded-xl border border-white/10 bg-[rgba(24,24,27,0.72)] px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Referral #</div>
                                <div className="mt-1 text-sm font-semibold text-slate-100">
                                  {insuranceMetaPreview.referral_number || "—"}
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-[rgba(24,24,27,0.72)] px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">VIN</div>
                                <div className="mt-1 text-sm font-semibold text-slate-100 break-all">
                                  {insuranceMetaPreview.vin || "—"}
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-[rgba(24,24,27,0.72)] px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Vehicle</div>
                                <div className="mt-1 text-sm font-semibold text-slate-100">
                                  {[insuranceMetaPreview.vehicle_year, insuranceMetaPreview.vehicle_make, insuranceMetaPreview.vehicle_model]
                                    .filter(Boolean)
                                    .join(" ") || "—"}
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-[rgba(24,24,27,0.72)] px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Customer</div>
                                <div className="mt-1 text-sm font-semibold text-slate-100">
                                  {insuranceMetaPreview.customer_name || "—"}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {insuranceMetaPreview.customer_address || "—"}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {formatPhoneDisplay(insuranceMetaPreview.customer_phone)}
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-[rgba(24,24,27,0.72)] px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Shop</div>
                                <div className="mt-1 text-sm font-semibold text-slate-100">
                                  {insuranceMetaPreview.shop_name || "Glass Guardian"}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {insuranceMetaPreview.shop_address || "—"}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {formatPhoneDisplay(insuranceMetaPreview.shop_phone)}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  Fed Tax ID: {insuranceMetaPreview.shop_fed_tax_id || "—"}
                                </div>
                              </div>

                              <div className="rounded-xl border border-amber-300/18 bg-amber-400/06 px-4 py-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-slate-300">Line item total</span>
                                  <span className="font-extrabold text-amber-100">
                                    {dollars(insuranceLineItemPrice / 100)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border border-white/10 bg-[rgba(34,34,38,0.62)] backdrop-blur-xl">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                            <FileText className="w-4 h-4 text-amber-300" />
                            Signature shown on invoice / receipt
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-2xl border border-white/10 bg-[rgba(24,24,27,0.78)] p-4">
                            {signaturePreview ? (
                              <div className="space-y-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                  Saved signature preview
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white p-3">
                                  <img
                                    src={signaturePreview}
                                    alt="Saved customer signature"
                                    className="max-h-40 w-full object-contain"
                                  />
                                </div>
                                <p className="text-xs text-slate-400">
                                  This preview is intended to be the same saved signature data used on the invoice and receipt.
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400">
                                No saved signature yet. Once captured, it will preview here instead of being hidden behind only a button.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {(sendInvoiceMutation.isError || markPaidMutation.isError || saveInsuranceDraftMutation.isError) && (
                        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          {sendInvoiceMutation.isError
                            ? "Failed to send insurance invoice."
                            : markPaidMutation.isError
                              ? "Failed to mark insurance invoice as paid."
                              : "Failed to save insurance draft."}
                        </div>
                      )}

                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="text-xs text-slate-400 max-w-2xl">
                          Insurance mode keeps the customer due at <span className="font-semibold text-emerald-300">$0.00</span>.
                          Sending or marking paid will persist the required claim fields and signature into the invoice record.
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            disabled={saveInsuranceDraftMutation.isPending || sendInvoiceMutation.isPending || markPaidMutation.isPending}
                            onClick={async () => {
                              try {
                                setInsuranceFormTouched(true);
                                const ok = validateInsuranceNow();
                                if (!ok) return;
                                await sendInvoiceMutation.mutateAsync();
                                setForceEditMode(false);
                              } catch (e) {
                                console.error("[SendInsuranceInvoice] failed:", e);
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-300 to-yellow-400 hover:from-amber-200 hover:to-yellow-300 text-[#1a1208] font-semibold shadow-[0_16px_40px_rgba(251,191,36,0.22)]"
                          >
                            {sendInvoiceMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sending…
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                {statusLower === "sent" || statusLower === "paid" ? "Save & Send Again" : "Send Insurance Invoice"}
                              </>
                            )}
                          </Button>

                          <Button
                            disabled={saveInsuranceDraftMutation.isPending || sendInvoiceMutation.isPending || markPaidMutation.isPending}
                            onClick={async () => {
                              try {
                                setInsuranceFormTouched(true);
                                const ok = validateInsuranceNow();
                                if (!ok) return;
                                await markPaidMutation.mutateAsync();
                                setForceEditMode(false);
                              } catch (e) {
                                console.error("[MarkInsurancePaid] failed:", e);
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-slate-50 font-semibold shadow-[0_16px_40px_rgba(245,158,11,0.18)]"
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
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {!isCrackOut && (
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
              {invoiceDate && warrantyEnd && (
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
              )}
            </CardHeader>
            <CardContent
              className={cx(
                "space-y-2 text-xs md:text-sm print:text-emerald-900",
                receiptMode ? "text-slate-200" : "text-emerald-50"
              )}
            >
              <p>
                This invoice serves as your official Glass Guardian warranty record for the windshield repair performed
                on the vehicle listed above.
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