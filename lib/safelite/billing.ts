type AnyObj = Record<string, any>;

export type SafeliteInvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  service_address?: string | null;
  appointment_snapshot?: AnyObj | null;
  services_json?: AnyObj | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  insurance_due_cents?: number | null;
  customer_due_cents?: number | null;
  technician_email?: string | null;
  vehicle_id?: string | null;
};

export type SafeliteVehicleRow = {
  id?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  vin?: string | null;
  license_plate?: string | null;
  insurance_carrier?: string | null;
};

export type SafeliteBillingPayload = {
  shopNumber: string;
  referralNumber: string;
  vin: string;
  invoiceNumber: string;
  installDate: string;
  removeDeductible: true;
  customerSignatureObtained: boolean;
  partType: "LABOR Part";
  laborAmountDollars: string;
  insuranceDueCents: number;
  insuranceDueDollars: string;
  documentType: "Work Order";
  receiptFilename: string;
  receiptDownloadPath: string;
  safeliteUrl: string;
  customerName: string;
  vehicleLabel: string;
};

export type SafeliteBillingValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export const SAFELITE_SHOP_NUMBER = "192194";
export const SAFELITE_DEFAULT_LABOR_AMOUNT_CENTS = 7000;
export const SAFELITE_MIN_LABOR_AMOUNT_CENTS = 100;
export const SAFELITE_MAX_LABOR_AMOUNT_CENTS = 25000;
export const SAFELITE_URL = "https://www.safelitesolutionsnetwork.com/";

function normalizeObject(v: any): AnyObj {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as AnyObj;
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

function toLocalDateOnly(input: string | null | undefined): string {
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeFileSegment(v: string) {
  return String(v || "invoice")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "invoice";
}

export function readInsuranceMeta(v: any): AnyObj {
  const services = normalizeObject(v);
  return normalizeObject(services.insurance_meta);
}

function toPositiveCents(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function dollarsToCents(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function readSafeliteLaborAmountCents(invoice: SafeliteInvoiceRow) {
  const services = normalizeObject(invoice.services_json);
  const insuranceMeta = readInsuranceMeta(invoice.services_json);
  const lineItems = Array.isArray(insuranceMeta.line_items) ? insuranceMeta.line_items : [];
  const firstLineItem = lineItems.find((item) => normalizeObject(item).unit_price_cents);

  const candidates = [
    toPositiveCents(normalizeObject(firstLineItem).unit_price_cents),
    toPositiveCents(normalizeObject(firstLineItem).total_cents),
    toPositiveCents(services.insurance_flat_price_cents),
    toPositiveCents(services.chip_repair_insurance_price_cents),
    toPositiveCents(services.insurance_due_cents),
    toPositiveCents(invoice.insurance_due_cents),
    dollarsToCents(services.insurance_flat_price),
    toPositiveCents(invoice.subtotal_cents),
  ].filter((value): value is number => typeof value === "number" && value > 0);

  return candidates[0] ?? SAFELITE_DEFAULT_LABOR_AMOUNT_CENTS;
}

function centsToFixedDollars(cents: number) {
  return (Math.round(cents) / 100).toFixed(2);
}

export function buildSafeliteReceiptFilename(invoice: Pick<SafeliteInvoiceRow, "id" | "invoice_number">) {
  const inv = firstNonBlank(invoice.invoice_number, invoice.id.slice(0, 8), "invoice");
  return `GlassGuardian-Safelite-WorkOrder-${safeFileSegment(inv)}.pdf`;
}

export function buildSafeliteBillingPayload(args: {
  invoice: SafeliteInvoiceRow;
  vehicle?: SafeliteVehicleRow | null;
  origin?: string;
}): SafeliteBillingPayload {
  const { invoice, vehicle } = args;
  const snapshot = normalizeObject(invoice.appointment_snapshot);
  const insuranceMeta = readInsuranceMeta(invoice.services_json);

  const referralNumber = firstNonBlank(
    insuranceMeta.referral_number,
    snapshot.referral_number,
    snapshot.referral_code,
    snapshot.referralCode
  ).replace(/\D/g, "");

  const vin = firstNonBlank(
    insuranceMeta.vin,
    vehicle?.vin,
    snapshot.vin,
    snapshot.vehicle_vin
  ).toUpperCase();

  const invoiceNumber = firstNonBlank(invoice.invoice_number, invoice.id.slice(0, 8));
  const installDate = toLocalDateOnly(invoice.invoice_date);
  const receiptFilename = buildSafeliteReceiptFilename(invoice);
  const origin = String(args.origin || "").replace(/\/+$/, "");
  const laborAmountCents = readSafeliteLaborAmountCents(invoice);

  const vehicleLabel = firstNonBlank(
    [
      firstNonBlank(insuranceMeta.vehicle_year, vehicle?.year),
      firstNonBlank(insuranceMeta.vehicle_make, vehicle?.make),
      firstNonBlank(insuranceMeta.vehicle_model, vehicle?.model),
    ]
      .filter(Boolean)
      .join(" "),
    [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
    "Vehicle"
  );

  return {
    shopNumber: SAFELITE_SHOP_NUMBER,
    referralNumber,
    vin,
    invoiceNumber,
    installDate,
    removeDeductible: true,
    customerSignatureObtained: !!firstNonBlank(insuranceMeta.signature_data_url),
    partType: "LABOR Part",
    laborAmountDollars: centsToFixedDollars(laborAmountCents),
    insuranceDueCents: laborAmountCents,
    insuranceDueDollars: centsToFixedDollars(laborAmountCents),
    documentType: "Work Order",
    receiptFilename,
    receiptDownloadPath: `${origin}/api/admin/invoices/${encodeURIComponent(invoice.id)}/receipt-pdf`,
    safeliteUrl: SAFELITE_URL,
    customerName: firstNonBlank(
      insuranceMeta.customer_name,
      invoice.customer_name,
      snapshot.customer_name,
      snapshot.full_name,
      "Customer"
    ),
    vehicleLabel,
  };
}

export function validateSafeliteBillingPayload(payload: SafeliteBillingPayload): SafeliteBillingValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (payload.shopNumber !== SAFELITE_SHOP_NUMBER) {
    errors.push(`Shop number must be ${SAFELITE_SHOP_NUMBER}.`);
  }

  if (!/^\d{6}$/.test(payload.referralNumber)) {
    errors.push("Referral number must be 6 digits.");
  }

  if (!/^[A-Z0-9]{17}$/.test(payload.vin)) {
    errors.push("VIN must be 17 characters.");
  }

  if (!payload.invoiceNumber) {
    errors.push("Invoice number is required.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.installDate)) {
    errors.push("Install date must be present on the invoice.");
  }

  if (!payload.customerSignatureObtained) {
    errors.push("Customer signature must be on file before Safelite billing.");
  }

  const laborAmount = Number(payload.laborAmountDollars);
  if (
    !Number.isFinite(laborAmount) ||
    laborAmount < SAFELITE_MIN_LABOR_AMOUNT_CENTS / 100 ||
    laborAmount > SAFELITE_MAX_LABOR_AMOUNT_CENTS / 100
  ) {
    errors.push(
      `Safelite labor amount must be between $${(SAFELITE_MIN_LABOR_AMOUNT_CENTS / 100).toFixed(2)} and $${(SAFELITE_MAX_LABOR_AMOUNT_CENTS / 100).toFixed(2)}.`
    );
  } else if (!["65.00", "70.00"].includes(laborAmount.toFixed(2))) {
    warnings.push("Safelite labor amount is custom; verify it matches the insurer payout.");
  }

  if (payload.documentType !== "Work Order") {
    errors.push("Safelite document type must be Work Order.");
  }

  if (!payload.receiptFilename.endsWith(".pdf")) {
    warnings.push("Receipt filename should end with .pdf.");
  }

  return { ok: errors.length === 0, errors, warnings };
}
