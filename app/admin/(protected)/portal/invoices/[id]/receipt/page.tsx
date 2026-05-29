// app/admin/(protected)/portal/invoices/[id]/receipt/page.tsx
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
  User,
  BadgeDollarSign,
  PenLine,
  FileText,
  Download,
} from "lucide-react";

import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  technician_email: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  service_address?: string | null;
  appointment_snapshot?: Record<string, any> | null;
  invoice_date: string | null;
  status: string | null;
  services_json?: Record<string, any> | null;
  windshield_repairs_json?: any[] | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  discount_percent?: number | null;
  tax_cents: number | null;
  tax_rate_percent?: number | null;
  total_cents: number | null;
  insurance_due_cents?: number | null;
  customer_due_cents?: number | null;
  created_at?: string | null;
  paid_at?: string | null;
  updated_at?: string | null;
  payment_method?: string | null;
  final_paid_cents?: number | null;
  appointment_id?: string | null;
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

const COMPANY = {
  name: "Glass Guardian",
  legalLine: "Chip & Crack Repair",
  phone: "(909) 529-1798",
  email: "info@glassguardianchipandcrackrepair.com",
  location: "3452 Anderson Ave #E Riverside CA 92507",
  fedTaxId: "99-2310126",
  logoSrc: "/branding/glass-guardian-gold.png",
};

const PROCESSING_FEE_CENTS = 300;

function normalizeObject(v: any): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  return {};
}

function firstNonBlank(...values: any[]) {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return "";
}

function normStatus(s: any) {
  return String(s ?? "").trim().toLowerCase();
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

function centsToDollars(c: number | null | undefined) {
  return ((c || 0) / 100).toFixed(2);
}

function moneyFromCents(cents: number | null | undefined) {
  return `$${centsToDollars(cents)}`;
}

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
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferInsuranceCoverage(invoice: InvoiceRow | null) {
  if (!invoice) return { insuranceMode: false, insuranceCoveredCents: 0 };

  const subtotal = invoice.subtotal_cents ?? 0;
  const discount = invoice.discount_cents ?? 0;
  const total = invoice.total_cents ?? 0;
  const insuranceDue = invoice.insurance_due_cents ?? 0;

  const insuranceMode =
    insuranceDue > 0 || (subtotal > 0 && total === 0 && discount >= subtotal);

  const insuranceCoveredCents = insuranceMode ? Math.max(discount, insuranceDue) : 0;

  return { insuranceMode, insuranceCoveredCents };
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
    shop_name: typeof meta.shop_name === "string" ? meta.shop_name : COMPANY.name,
    shop_address: typeof meta.shop_address === "string" ? meta.shop_address : COMPANY.location,
    shop_phone: typeof meta.shop_phone === "string" ? meta.shop_phone : COMPANY.phone,
    shop_fed_tax_id:
      typeof meta.shop_fed_tax_id === "string" ? meta.shop_fed_tax_id : COMPANY.fedTaxId,
    line_items: Array.isArray(meta.line_items) ? meta.line_items : [],
    signature_data_url: typeof meta.signature_data_url === "string" ? meta.signature_data_url : "",
    signature_signed_at:
      typeof meta.signature_signed_at === "string" ? meta.signature_signed_at : "",
  };
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

async function createHighContrastSignatureDataUrl(dataUrl: string) {
  if (!dataUrl || typeof document === "undefined") return dataUrl;

  return await new Promise<string>((resolve) => {
    const img = document.createElement("img");

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, width, height);
      } catch {
        resolve(dataUrl);
        return;
      }

      const pixels = imageData.data;
      const cornerIndexes = [
        0,
        (width - 1) * 4,
        (width * (height - 1)) * 4,
        (width * height - 1) * 4,
      ];

      const cornerStats = cornerIndexes.reduce(
        (acc, i) => {
          const luma = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
          acc.alpha += pixels[i + 3];
          acc.luma += luma;
          return acc;
        },
        { alpha: 0, luma: 0 }
      );

      const bgAlpha = cornerStats.alpha / cornerIndexes.length;
      const bgLuma = cornerStats.luma / cornerIndexes.length;
      const solidLightBackground = bgAlpha > 220 && bgLuma > 235;

      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha < 8) continue;

        const luma = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
        const isInk = solidLightBackground ? luma < bgLuma - 8 : alpha > 8;

        if (!isInk) continue;

        pixels[i] = 11;
        pixels[i + 1] = 18;
        pixels[i + 2] = 32;
        pixels[i + 3] = Math.max(alpha, 235);
      }

      ctx.putImageData(imageData, 0, 0);

      try {
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function fetchInvoiceById(invoiceId: string) {
  const { data, error } = await supabaseClient
    .from("tech_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Invoice not found.");
  return data as InvoiceRow;
}

async function fetchVehicleForInvoice(invoice: InvoiceRow | null | undefined) {
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

async function fetchAdminReceiptDetail(invoiceId: string) {
  const invoice = await fetchInvoiceById(invoiceId);
  const [vehicle, technician] = await Promise.all([
    fetchVehicleForInvoice(invoice),
    fetchTechnicianByEmail(invoice.technician_email),
  ]);

  return { invoice, vehicle, technician };
}

export default function AdminInvoiceReceiptPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;

  const [printing, setPrinting] = React.useState(false);
  const [pdfDownloading, setPdfDownloading] = React.useState(false);
  const [printSignatureSrc, setPrintSignatureSrc] = React.useState("");
  const autoPrintStartedRef = React.useRef(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-invoice-receipt", invoiceId],
    enabled: !!invoiceId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!invoiceId) throw new Error("Missing invoice id.");
      return await fetchAdminReceiptDetail(invoiceId);
    },
  });

  const invoice = data?.invoice ?? null;
  const vehicle = data?.vehicle ?? null;
  const technician = data?.technician ?? null;

  const snapshot = React.useMemo(
    () => normalizeObject(invoice?.appointment_snapshot),
    [invoice?.appointment_snapshot]
  );

  const insuranceMeta = React.useMemo(
    () => readInsuranceMetaFromJson(invoice?.services_json),
    [invoice?.services_json]
  );

  const isPaid = normStatus(invoice?.status) === "paid";
  const serviceDate = React.useMemo(
    () => toLocalDateOnly(invoice?.invoice_date) ?? null,
    [invoice?.invoice_date]
  );
  const paidDate = React.useMemo(
    () => toLocalDateOnly(invoice?.paid_at) ?? null,
    [invoice?.paid_at]
  );
  const warrantyEnd = React.useMemo(
    () => addYearsDateOnly(serviceDate, 1),
    [serviceDate]
  );

  const { insuranceMode, insuranceCoveredCents } = React.useMemo(
    () => inferInsuranceCoverage(invoice),
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
    if (typeof invoice.customer_due_cents === "number") return invoice.customer_due_cents;
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
  }, [invoice?.services_json, invoice?.subtotal_cents]);

  const miscLineDollars = React.useMemo(() => {
    const rawMisc = invoice?.services_json?.misc_total;
    if (typeof rawMisc === "number" && Number.isFinite(rawMisc) && rawMisc > 0) {
      return rawMisc;
    }
    return 0;
  }, [invoice?.services_json]);

  const technicianDisplayName = firstNonBlank(
    technician?.full_name,
    prettifyTechnicianName(invoice?.technician_email)
  );

  const vehicleText = firstNonBlank(
    [
      firstNonBlank(insuranceMeta.vehicle_year, vehicle?.year),
      firstNonBlank(insuranceMeta.vehicle_make, vehicle?.make),
      firstNonBlank(insuranceMeta.vehicle_model, vehicle?.model),
    ]
      .filter(Boolean)
      .join(" "),
    [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
    "—"
  );

  const vehicleVin = firstNonBlank(
    insuranceMeta.vin,
    vehicle?.vin,
    snapshot.vin,
    snapshot.vehicle_vin,
    "—"
  );

  const customerNameDisplay = firstNonBlank(
    insuranceMeta.customer_name,
    invoice?.customer_name,
    snapshot.customer_name,
    snapshot.full_name,
    "Customer"
  );

  const customerEmailDisplay = firstNonBlank(
    invoice?.customer_email,
    snapshot.customer_email,
    snapshot.email,
    "—"
  );

  const customerAddressDisplay = firstNonBlank(
    insuranceMeta.customer_address,
    invoice?.service_address,
    snapshot.service_address,
    snapshot.customer_address,
    snapshot.address,
    "—"
  );

  const customerPhoneDisplay = formatPhoneDisplay(
    firstNonBlank(
      insuranceMeta.customer_phone,
      snapshot.customer_phone,
      snapshot.phone,
      snapshot.customer_mobile
    )
  );

  const referralDisplay = firstNonBlank(
    insuranceMeta.referral_number,
    snapshot.referral_number,
    snapshot.referral_code,
    snapshot.referralCode,
    "—"
  );

  const dateOfLossDisplay = firstNonBlank(
    insuranceMeta.date_of_loss,
    snapshot.date_of_loss,
    snapshot.loss_date,
    snapshot.dateOfLoss,
    "—"
  );

  const signaturePreview = insuranceMeta.signature_data_url || "";
  const signaturePrintSrc = printSignatureSrc || signaturePreview;
  const signatureReadyForPrint = !signaturePreview || !!printSignatureSrc;

  React.useEffect(() => {
    let alive = true;

    if (!signaturePreview) {
      setPrintSignatureSrc("");
      return () => {
        alive = false;
      };
    }

    createHighContrastSignatureDataUrl(signaturePreview).then((nextSrc) => {
      if (alive) setPrintSignatureSrc(nextSrc);
    });

    return () => {
      alive = false;
    };
  }, [signaturePreview]);

  const waitForPrintReady = React.useCallback(async () => {
    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      try {
        await fonts.ready;
      } catch {}
    }

    const images = Array.from(document.querySelectorAll<HTMLImageElement>("#print-root img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    );

    await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
  }, []);

  const handlePrint = React.useCallback(() => {
    if (printing) return;
    setPrinting(true);

    void waitForPrintReady().then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          window.setTimeout(() => setPrinting(false), 1500);
        });
      });
    });
  }, [printing, waitForPrintReady]);

  const handleDownloadPdf = React.useCallback(async () => {
    if (!invoiceId || pdfDownloading) return;

    setPdfDownloading(true);
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Admin session is required to download the PDF.");

      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoiceId)}/receipt-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "PDF download failed.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const fallbackInvoice = invoice?.invoice_number || invoiceId.slice(0, 8);
      const filename =
        filenameMatch?.[1] || `GlassGuardian-Safelite-WorkOrder-${fallbackInvoice}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Unable to download receipt PDF.");
    } finally {
      setPdfDownloading(false);
    }
  }, [invoice?.invoice_number, invoiceId, pdfDownloading]);

  React.useEffect(() => {
    const onAfterPrint = () => setPrinting(false);
    const onBeforePrint = () => setPrinting(true);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  React.useEffect(() => {
    const autoPrint = new URLSearchParams(window.location.search).get("autoprint");
    if (autoPrint === "1" && invoice && signatureReadyForPrint && !autoPrintStartedRef.current) {
      autoPrintStartedRef.current = true;
      handlePrint();
    }
  }, [handlePrint, invoice, signatureReadyForPrint]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="flex flex-col items-center gap-3 text-slate-200">
          <Loader2 className="w-7 h-7 animate-spin text-amber-300" />
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
            Loading admin receipt
          </p>
        </div>
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full border border-red-500/30 bg-slate-900/90 text-slate-50 shadow-2xl">
          <CardHeader>
            <CardTitle>Receipt Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              There was an issue loading this admin receipt.
            </p>
            <p className="text-xs text-red-200/80">
              {(error as Error)?.message || "Unknown error."}
            </p>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-100"
              onClick={() => router.push("/admin/portal/invoices")}
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
    <div
      className={`receipt-print-page min-h-screen bg-slate-950 p-4 md:p-8 ${printing ? "printing-mode" : ""}`}
    >
      <style jsx global>{`
        .screen-only { display: block; }
        .print-only { display: none; }

        @media print {
          @page {
            size: letter;
            margin: 3mm 6mm 6mm 6mm;
          }

          html, body {
            background: #ffffff !important;
            color: #0b0f1a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          body > div,
          body > div > div,
          .admin-mobile-fullscreen,
          .admin-mobile-fullscreen > div,
          .admin-mobile-fullscreen main,
          .admin-mobile-fullscreen main > div {
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .admin-mobile-fullscreen > .pointer-events-none,
          .admin-mobile-fullscreen aside,
          .admin-mobile-fullscreen header,
          .admin-mobile-fullscreen nav {
            display: none !important;
          }

          *, *::before, *::after {
            box-sizing: border-box !important;
          }

          body * {
            visibility: hidden !important;
          }

          .receipt-print-page,
          .receipt-print-frame {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          .receipt-print-frame > * {
            margin-top: 0 !important;
          }

          #print-root, #print-root * {
            visibility: visible !important;
            -webkit-text-fill-color: currentColor !important;
          }

          #print-root {
            position: static !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            padding: 0 !important;
            margin: 18mm 0 0 0 !important;
            color: #0b0f1a !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
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
            padding-top: 0 !important;
            display: flex !important;
            justify-content: center !important;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
            transform: none !important;
            zoom: 1 !important;
          }

          .paper-inner {
            width: 202mm !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding-top: 0 !important;
            position: relative !important;
          }

          .paper-card {
            position: relative !important;
            isolation: isolate !important;
            border: 1px solid #d6d9e2 !important;
            border-radius: 14px !important;
            padding: 9px !important;
            margin-top: 0 !important;
            min-height: 0 !important;
            display: block !important;
            background:
              linear-gradient(180deg, rgba(196,153,63,0.035) 0%, rgba(255,255,255,0) 82%),
              #ffffff !important;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.65) inset !important;
            overflow: visible !important;
            color: #0b0f1a !important;
          }

          .paper-card::before {
            content: "" !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            height: 2px !important;
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
            width: 120mm !important;
            height: auto !important;
            object-fit: contain !important;
            opacity: 0.022 !important;
            filter: saturate(0.9) contrast(0.95) !important;
          }

          .paper-watermark {
            position: absolute !important;
            right: 7mm !important;
            top: 18mm !important;
            transform: rotate(-18deg) !important;
            font-size: 22px !important;
            font-weight: 900 !important;
            letter-spacing: 0.14em !important;
            color: rgba(16, 185, 129, 0.08) !important;
            border: 2px solid rgba(16, 185, 129, 0.10) !important;
            border-radius: 10px !important;
            padding: 5px 10px !important;
            z-index: 0 !important;
            pointer-events: none !important;
          }

          .paper-admin-watermark {
            position: absolute !important;
            left: 8mm !important;
            top: 18mm !important;
            transform: rotate(-18deg) !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            letter-spacing: 0.15em !important;
            color: rgba(139, 106, 33, 0.08) !important;
            border: 2px solid rgba(139, 106, 33, 0.09) !important;
            border-radius: 8px !important;
            padding: 4px 8px !important;
            z-index: 0 !important;
            pointer-events: none !important;
          }

          .paper-top,
          .paper-divider,
          .paper-grid,
          .paper-section-card,
          .paper-note,
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
            grid-template-columns: minmax(0, 1.35fr) minmax(180px, 0.85fr) !important;
            gap: 8px !important;
            align-items: stretch !important;
          }

          .paper-brand-card,
          .paper-meta-card {
            border: 1px solid #e3e7ef !important;
            border-radius: 10px !important;
            background: rgba(255,255,255,0.96) !important;
            padding: 8px !important;
            color: #0b0f1a !important;
          }

          .paper-brand {
            display: flex !important;
            align-items: flex-start !important;
            gap: 8px !important;
            min-width: 0 !important;
          }

          .paper-logo-wrap {
            width: 46px !important;
            height: 46px !important;
            border-radius: 10px !important;
            border: 1px solid #eadcb5 !important;
            background: linear-gradient(180deg, #fffaf0, #ffffff) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex: 0 0 auto !important;
          }

          .paper-logo {
            width: 34px !important;
            height: 34px !important;
            object-fit: contain !important;
            display: block !important;
          }

          .paper-kicker {
            font-size: 7px !important;
            font-weight: 900 !important;
            letter-spacing: 0.16em !important;
            text-transform: uppercase !important;
            color: #8b6a21 !important;
            margin-bottom: 2px !important;
          }

          .paper-title {
            font-size: 17px !important;
            font-weight: 900 !important;
            margin: 0 !important;
            line-height: 1.02 !important;
            color: #0b0f1a !important;
          }

          .paper-sub {
            font-size: 9.5px !important;
            color: #344054 !important;
            margin-top: 1px !important;
            line-height: 1.2 !important;
          }

          .paper-contact-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 3px 8px !important;
            margin-top: 5px !important;
            font-size: 8.5px !important;
            color: #344054 !important;
            min-width: 0 !important;
          }

          .paper-contact-row {
            display: flex !important;
            align-items: flex-start !important;
            gap: 4px !important;
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
            line-height: 1.15 !important;
            color: #344054 !important;
          }

          .paper-dot {
            width: 4px !important;
            height: 4px !important;
            border-radius: 999px !important;
            background: #b48a34 !important;
            flex: 0 0 auto !important;
            margin-top: 3px !important;
          }

          .paper-meta-title {
            font-size: 7px !important;
            font-weight: 900 !important;
            letter-spacing: 0.16em !important;
            text-transform: uppercase !important;
            color: #667085 !important;
            margin-bottom: 5px !important;
          }

          .paper-meta-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 6px 8px !important;
          }

          .paper-meta-item {
            min-width: 0 !important;
          }

          .paper-label {
            font-size: 7px !important;
            font-weight: 800 !important;
            color: #667085 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
          }

          .paper-value {
            font-size: 10px !important;
            font-weight: 900 !important;
            color: #0b0f1a !important;
            margin-top: 1px !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            line-height: 1.15 !important;
          }

          .paper-pill {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 18px !important;
            padding: 3px 7px !important;
            border-radius: 999px !important;
            border: 1px solid #cfd5e1 !important;
            background: #f8fafc !important;
            color: #0b0f1a !important;
            font-size: 7px !important;
            font-weight: 900 !important;
            letter-spacing: 0.05em !important;
            text-transform: uppercase !important;
            white-space: nowrap !important;
          }

          .paper-divider {
            height: 1px !important;
            background: linear-gradient(90deg, rgba(139,106,33,0.12), rgba(139,106,33,0.55), rgba(139,106,33,0.12)) !important;
            margin: 5px 0 !important;
          }

          .paper-section-card {
            border: 1px solid #e3e7ef !important;
            border-radius: 10px !important;
            background: rgba(255,255,255,0.97) !important;
            overflow: hidden !important;
            color: #0b0f1a !important;
          }

          .paper-section-head {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 6px 8px !important;
            background: linear-gradient(180deg, #fcfcfd, #f8fafc) !important;
            border-bottom: 1px solid #e3e7ef !important;
          }

          .paper-section-title {
            font-size: 8px !important;
            font-weight: 900 !important;
            color: #101828 !important;
            letter-spacing: 0.05em !important;
            text-transform: uppercase !important;
          }

          .paper-section-body {
            padding: 6px 8px !important;
          }

          .paper-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 8px !important;
          }

          .paper-line-items {
            width: 100% !important;
            border-collapse: collapse !important;
            color: #0b0f1a !important;
          }

          .paper-line-items thead th {
            text-align: left !important;
            font-size: 7px !important;
            font-weight: 900 !important;
            color: #667085 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            padding: 0 0 4px 0 !important;
          }

          .paper-line-items thead th:last-child {
            text-align: right !important;
          }

          .paper-line-items tbody td {
            font-size: 9px !important;
            color: #111827 !important;
            padding: 3px 0 !important;
            border-top: 1px solid #eef2f6 !important;
            vertical-align: top !important;
            line-height: 1.15 !important;
          }

          .paper-line-items tbody td:last-child {
            text-align: right !important;
            font-weight: 800 !important;
            color: #0b0f1a !important;
            white-space: nowrap !important;
          }

          .paper-totals {
            margin-top: 6px !important;
            margin-left: auto !important;
            width: 100% !important;
            max-width: 285px !important;
            border: 1px solid #dfe4ea !important;
            border-radius: 10px !important;
            overflow: hidden !important;
            background: rgba(255,255,255,0.9) !important;
          }

          .paper-total-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 5px 8px !important;
            font-size: 9px !important;
            color: #111827 !important;
            border-top: 1px solid #eef2f6 !important;
            line-height: 1.15 !important;
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
            font-size: 10px !important;
            font-weight: 900 !important;
          }

          .paper-policy-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 8px !important;
          }

          .paper-note {
            border: 1px solid #e5e7eb !important;
            background: rgba(252,252,253,0.97) !important;
            color: #1f2937 !important;
            border-radius: 10px !important;
            padding: 5px 7px !important;
            font-size: 8px !important;
            line-height: 1.25 !important;
          }

          .paper-note.warranty {
            border-color: #dfe6d4 !important;
            background: rgba(247,250,245,0.97) !important;
          }

          .paper-note.admin {
            border-color: #e7dec8 !important;
            background: rgba(255,250,240,0.97) !important;
          }

          .paper-footer {
            margin-top: 4px !important;
            padding-top: 4px !important;
            border-top: 1px solid #eaeef4 !important;
            font-size: 7.5px !important;
            color: #475467 !important;
            line-height: 1.15 !important;
            text-align: center !important;
          }

          .paper-signature-compact {
            border: 1.5px solid #c9a24b !important;
            background:
              linear-gradient(180deg, rgba(255,250,240,0.98), rgba(255,255,255,0.99)) !important;
            box-shadow: 0 0 0 1px rgba(201, 162, 75, 0.12) inset !important;
          }

          .paper-signature-compact .paper-section-head {
            background: linear-gradient(180deg, #fff7e6, #fffaf0) !important;
            border-bottom: 1px solid rgba(201, 162, 75, 0.38) !important;
          }

          .paper-signature-body {
            padding: 4px 7px !important;
          }

          .paper-signature-box {
            border: 1.5px solid #b48a34 !important;
            border-radius: 10px !important;
            background:
              linear-gradient(180deg, #fffaf0 0%, #ffffff 100%) !important;
            padding: 4px !important;
            box-shadow: 0 0 0 2px rgba(180, 138, 52, 0.06) inset !important;
          }

          .paper-signature-image {
            width: 100% !important;
            max-height: 64px !important;
            object-fit: contain !important;
            display: block !important;
            filter: contrast(1.45) saturate(0.1) !important;
            mix-blend-mode: multiply !important;
          }

          .paper-signature-meta {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            margin-top: 3px !important;
            font-size: 7.5px !important;
            line-height: 1.15 !important;
            color: #667085 !important;
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
          .paper-footer {
            color: #0b0f1a !important;
          }

          .paper-note,
          .paper-note * {
            color: #1f2937 !important;
          }

          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .paper-top,
          .paper-grid,
          .paper-policy-grid,
          .paper-totals,
          .paper-section-card,
          .paper-note,
          .paper-signature-compact {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .paper,
          .paper-inner,
          .paper-card {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      <div className="receipt-print-frame max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between screen-only">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/portal/invoices/${invoiceId}`)}
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
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfDownloading}
              variant="outline"
              className="border-white/10 bg-[rgba(44,44,47,0.54)] text-slate-100 hover:bg-[rgba(56,56,60,0.62)] backdrop-blur-xl disabled:cursor-wait disabled:opacity-70"
            >
              {pdfDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {pdfDownloading ? "Downloading..." : "Download PDF"}
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="bg-[rgba(44,44,47,0.54)] border border-white/10 text-slate-100 hover:bg-[rgba(56,56,60,0.62)] backdrop-blur-xl disabled:cursor-wait disabled:opacity-70"
            >
              {printing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              {printing ? "Preparing..." : "Print Receipt"}
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
                      Admin Receipt
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
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <BadgeDollarSign className="h-3.5 w-3.5 text-amber-300" />
                        <span>Fed Tax ID: {COMPANY.fedTaxId}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 md:items-end">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Badge
                      className={
                        isPaid
                          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                          : "border-amber-300/70 bg-amber-500/15 text-amber-200"
                      }
                    >
                      {String(invoice.status ?? "unknown").toUpperCase()}
                    </Badge>

                    <Badge className="border-amber-300/50 bg-amber-400/10 text-amber-100">
                      ADMIN COPY
                    </Badge>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Receipt Number
                    </div>
                    <div className="mt-1 text-xl font-black text-white">
                      #{invoice.invoice_number ?? "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {isPaid ? `Paid ${paidDate ?? "—"}` : `Service date ${serviceDate ?? "—"}`}
                    </div>
                    {invoice.created_at ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        Created {toLocalDateOnly(invoice.created_at) ?? "—"}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 md:p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Billed To
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">
                      {customerNameDisplay}
                    </div>
                    <div className="mt-1 text-sm text-slate-300 break-all">
                      {customerEmailDisplay}
                    </div>
                    {customerAddressDisplay && customerAddressDisplay !== "—" ? (
                      <div className="mt-2 text-sm text-slate-300">{customerAddressDisplay}</div>
                    ) : null}
                    {customerPhoneDisplay && customerPhoneDisplay !== "—" ? (
                      <div className="mt-2 text-sm text-slate-300">{customerPhoneDisplay}</div>
                    ) : null}
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

                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-amber-300" />
                        <span>
                          <span className="text-slate-400">Technician:</span>{" "}
                          <span className="font-semibold text-white">{technicianDisplayName}</span>
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

                {(vehicleText !== "—" || vehicle?.license_plate || vehicle?.color || vehicleVin !== "—") && (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <Car className="h-4 w-4 text-amber-300" />
                      Vehicle / Claim
                    </div>

                    <div className="mt-2 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
                      <div>
                        <span className="text-slate-400">Vehicle:</span>{" "}
                        <span className="font-semibold text-white">{vehicleText}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">VIN:</span>{" "}
                        <span className="font-semibold text-white">{vehicleVin}</span>
                      </div>

                      {vehicle?.license_plate ? (
                        <div>
                          <span className="text-slate-400">License Plate:</span>{" "}
                          <span className="font-semibold text-white">{vehicle.license_plate}</span>
                        </div>
                      ) : null}

                      {vehicle?.insurance_carrier ? (
                        <div>
                          <span className="text-slate-400">Insurance Carrier:</span>{" "}
                          <span className="font-semibold text-white">{vehicle.insurance_carrier}</span>
                        </div>
                      ) : null}

                      {insuranceMode && referralDisplay !== "—" ? (
                        <div>
                          <span className="text-slate-400">Referral #:</span>{" "}
                          <span className="font-semibold text-white">{referralDisplay}</span>
                        </div>
                      ) : null}

                      {insuranceMode && dateOfLossDisplay !== "—" ? (
                        <div>
                          <span className="text-slate-400">Date of Loss:</span>{" "}
                          <span className="font-semibold text-white">{dateOfLossDisplay}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {invoice.windshield_repairs_json && invoice.windshield_repairs_json.length > 0 && (
                  <div className="no-print">
                    <WindshieldRepairMap
                      invoice={{
                        id: invoice.id,
                        windshield_repairs_json: invoice.windshield_repairs_json ?? [],
                      }}
                      readOnly
                    />
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

                    {miscLineDollars > 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Miscellaneous</span>
                        <span className="font-semibold">${miscLineDollars.toFixed(2)}</span>
                      </div>
                    ) : null}

                    <Separator className="my-2 border-white/8 bg-white/8" />

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Subtotal</span>
                      <span className="font-semibold">
                        {moneyFromCents(invoice.subtotal_cents)}
                      </span>
                    </div>

                    {insuranceMode ? (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Insurance covered</span>
                        <span className="font-semibold text-emerald-300">
                          -{moneyFromCents(insuranceCoveredCents)}
                        </span>
                      </div>
                    ) : (invoice.discount_cents ?? 0) > 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          Discount
                          {invoice.discount_percent ? ` (${invoice.discount_percent}%)` : ""}
                        </span>
                        <span className="font-semibold text-emerald-300">
                          -{moneyFromCents(invoice.discount_cents)}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">
                        Tax
                        {invoice.tax_rate_percent ? ` (${invoice.tax_rate_percent}%)` : ""}
                      </span>
                      <span className="font-semibold">+{moneyFromCents(invoice.tax_cents)}</span>
                    </div>

                    <Separator className="my-2 border-white/8 bg-white/8" />

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Service total</span>
                      <span className="font-semibold">
                        {moneyFromCents(receiptServiceTotalDisplayCents)}
                      </span>
                    </div>

                    {!isPaid && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Processing fee</span>
                        <span className="font-semibold">
                          {processingFeeCents > 0 ? `+${centsToDollars(processingFeeCents)}` : "$0.00"}
                        </span>
                      </div>
                    )}

                    {insuranceMode && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Insurance due</span>
                        <span className="font-semibold text-amber-100">
                          {moneyFromCents(invoice.insurance_due_cents ?? insuranceCoveredCents)}
                        </span>
                      </div>
                    )}

                    <Separator className="my-2 border-white/8 bg-white/8" />

                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">
                        {isPaid ? "Total paid" : "Customer due"}
                      </span>
                      <span className="text-2xl font-black text-emerald-200">
                        {moneyFromCents(isPaid ? amountPaidCents : customerDueCents)}
                      </span>
                    </div>

                    {insuranceMode && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                        Insurance billing is active on this invoice. Customer due remains{" "}
                        <span className="font-semibold">{moneyFromCents(customerDueCents)}</span>.
                      </div>
                    )}
                  </div>
                </div>

                {snapshot.service_type || snapshot.damage_description || snapshot.damage_size || snapshot.location_type ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <FileText className="h-4 w-4 text-amber-300" />
                      Repair Notes
                    </div>

                    <div className="mt-2 space-y-1.5 text-sm text-slate-200">
                      {snapshot.service_type ? (
                        <div>
                          <span className="text-slate-400">Service type:</span>{" "}
                          <span className="font-semibold text-white">{snapshot.service_type}</span>
                        </div>
                      ) : null}
                      {snapshot.damage_description ? (
                        <div>
                          <span className="text-slate-400">Damage:</span>{" "}
                          <span className="font-semibold text-white">{snapshot.damage_description}</span>
                        </div>
                      ) : null}
                      {snapshot.damage_size ? (
                        <div>
                          <span className="text-slate-400">Size:</span>{" "}
                          <span className="font-semibold text-white">{snapshot.damage_size}</span>
                        </div>
                      ) : null}
                      {snapshot.location_type ? (
                        <div>
                          <span className="text-slate-400">Location type:</span>{" "}
                          <span className="font-semibold text-white">{snapshot.location_type}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

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

                {signaturePreview ? (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-50">
                    <div className="flex items-center gap-2 font-semibold">
                      <PenLine className="w-4 h-4 text-amber-300" />
                      Customer signature on file
                    </div>
                    <div className="mt-3 rounded-xl border border-white/10 bg-white p-3">
                      <img
                        src={signaturePreview}
                        alt="Saved customer signature"
                        className="max-h-40 w-full object-contain"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="text-[10px] leading-5 text-slate-400">
                  Printed from the Glass Guardian admin portal. This document reflects the service, billing, and claim details currently saved to the invoice record.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div id="print-root" className="print-only">
          <div className="paper">
            <div className="paper-inner">
              <div className="paper-card">
                <div className="paper-brand-watermark" aria-hidden="true">
                  <img src={COMPANY.logoSrc} alt="" />
                </div>

                <div className="paper-admin-watermark">ADMIN COPY</div>
                {isPaid && <div className="paper-watermark">PAID</div>}

                <div className="paper-top avoid-break">
                  <div className="paper-brand-card">
                    <div className="paper-brand">
                      <div className="paper-logo-wrap">
                        <img src={COMPANY.logoSrc} alt="Glass Guardian logo" className="paper-logo" />
                      </div>

                      <div style={{ minWidth: 0, maxWidth: "100%" }}>
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

                          <div className="paper-contact-row full">
                            <span className="paper-dot" />
                            <span className="paper-contact-text">Fed Tax ID: {COMPANY.fedTaxId}</span>
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
                        <div className="paper-value">#{invoice.invoice_number ?? "—"}</div>
                      </div>

                      <div className="paper-meta-item">
                        <div className="paper-label">Service Date</div>
                        <div className="paper-value">{serviceDate ?? "—"}</div>
                      </div>

                      <div className="paper-meta-item">
                        <div className="paper-label">Status</div>
                        <div className="paper-value">
                          {String(invoice.status ?? "unknown").toUpperCase()}
                        </div>
                      </div>

                      {isPaid ? (
                        <div className="paper-meta-item">
                          <div className="paper-label">Paid Date</div>
                          <div className="paper-value">{paidDate ?? "—"}</div>
                        </div>
                      ) : null}

                      <div className="paper-meta-item">
                        <div className="paper-label">Technician</div>
                        <div className="paper-value">{technicianDisplayName}</div>
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
                      <div className="paper-value">{customerNameDisplay}</div>

                      <div className="paper-label" style={{ marginTop: 6 }}>Email</div>
                      <div className="paper-value" style={{ fontSize: 9.5 }}>
                        {customerEmailDisplay}
                      </div>

                      <div className="paper-label" style={{ marginTop: 6 }}>Address</div>
                      <div className="paper-value" style={{ fontSize: 9.5 }}>
                        {customerAddressDisplay}
                      </div>

                      {customerPhoneDisplay !== "—" ? (
                        <>
                          <div className="paper-label" style={{ marginTop: 6 }}>Phone</div>
                          <div className="paper-value" style={{ fontSize: 9.5 }}>
                            {customerPhoneDisplay}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="paper-section-card">
                    <div className="paper-section-head">
                      <div className="paper-section-title">Service / Vehicle</div>
                    </div>
                    <div className="paper-section-body">
                      <div className="paper-label">Vehicle</div>
                      <div className="paper-value">{vehicleText}</div>

                      <div className="paper-label" style={{ marginTop: 6 }}>VIN</div>
                      <div className="paper-value" style={{ fontSize: 9.5 }}>
                        {vehicleVin}
                      </div>

                      {vehicle?.license_plate ? (
                        <>
                          <div className="paper-label" style={{ marginTop: 6 }}>License Plate</div>
                          <div className="paper-value" style={{ fontSize: 9.5 }}>
                            {vehicle.license_plate}
                          </div>
                        </>
                      ) : null}

                      {insuranceMode && referralDisplay !== "—" ? (
                        <>
                          <div className="paper-label" style={{ marginTop: 6 }}>Referral #</div>
                          <div className="paper-value" style={{ fontSize: 9.5 }}>
                            {referralDisplay}
                          </div>
                        </>
                      ) : null}

                      {insuranceMode && dateOfLossDisplay !== "—" ? (
                        <>
                          <div className="paper-label" style={{ marginTop: 6 }}>Date of Loss</div>
                          <div className="paper-value" style={{ fontSize: 9.5 }}>
                            {dateOfLossDisplay}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="paper-divider" />

                <div className="paper-section-card avoid-break">
                  <div className="paper-section-head">
                    <div className="paper-section-title">Receipt Breakdown</div>
                    <div className="paper-pill">Admin Charges View</div>
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

                        {miscLineDollars > 0 ? (
                          <tr>
                            <td>Miscellaneous</td>
                            <td>${miscLineDollars.toFixed(2)}</td>
                          </tr>
                        ) : null}

                        <tr>
                          <td>Subtotal</td>
                          <td>{moneyFromCents(invoice.subtotal_cents)}</td>
                        </tr>

                        {insuranceMode ? (
                          <tr>
                            <td>Insurance covered</td>
                            <td>-{moneyFromCents(insuranceCoveredCents)}</td>
                          </tr>
                        ) : (invoice.discount_cents ?? 0) > 0 ? (
                          <tr>
                            <td>
                              Discount
                              {invoice.discount_percent ? ` (${invoice.discount_percent}%)` : ""}
                            </td>
                            <td>-{moneyFromCents(invoice.discount_cents)}</td>
                          </tr>
                        ) : null}

                        <tr>
                          <td>
                            Tax
                            {invoice.tax_rate_percent ? ` (${invoice.tax_rate_percent}%)` : ""}
                          </td>
                          <td>+{moneyFromCents(invoice.tax_cents)}</td>
                        </tr>

                        <tr>
                          <td>Service total</td>
                          <td>{moneyFromCents(receiptServiceTotalDisplayCents)}</td>
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

                        {insuranceMode ? (
                          <tr>
                            <td>Insurance due</td>
                            <td>{moneyFromCents(invoice.insurance_due_cents ?? insuranceCoveredCents)}</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>

                    <div className="paper-totals">
                      <div className="paper-total-row">
                        <span>{isPaid ? "Amount Paid" : "Customer Due"}</span>
                        <strong>{moneyFromCents(isPaid ? amountPaidCents : customerDueCents)}</strong>
                      </div>

                      {insuranceMode && (
                        <div className="paper-total-row">
                          <span>Insurance Due</span>
                          <strong>{moneyFromCents(invoice.insurance_due_cents ?? insuranceCoveredCents)}</strong>
                        </div>
                      )}

                      {!insuranceMode && isPaid && invoice.payment_method && (
                        <div className="paper-total-row">
                          <span>Payment Method</span>
                          <strong>{formatPaymentMethod(invoice.payment_method)}</strong>
                        </div>
                      )}

                      <div className="paper-total-row paper-grand-total">
                        <span>{isPaid ? "Official Total Paid" : "Official Customer Due"}</span>
                        <strong>{moneyFromCents(isPaid ? amountPaidCents : customerDueCents)}</strong>
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

                  <div className="paper-note admin">
                    <strong>Admin Record Notice</strong>
                    <br />
                    This document serves as an internal admin-facing receipt copy from {COMPANY.name} and reflects the current invoice record.
                  </div>
                </div>

                {signaturePreview ? (
                  <>
                    <div className="paper-divider" />
                    <div className="paper-section-card avoid-break paper-signature-compact">
                      <div className="paper-section-head">
                        <div className="paper-section-title">Customer Signature</div>
                        <div className="paper-pill">On File</div>
                      </div>
                      <div className="paper-section-body paper-signature-body">
                        <div className="paper-signature-box">
                          <img
                            src={signaturePrintSrc}
                            alt="Saved customer signature"
                            className="paper-signature-image"
                          />
                        </div>
                        <div className="paper-signature-meta">
                          <span>Customer signature on file</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="paper-footer">
                  Printed from the Glass Guardian admin portal.
                  <br />
                  {COMPANY.name} · {COMPANY.legalLine} · {COMPANY.phone}
                </div>
              </div>
            </div>
          </div>
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
