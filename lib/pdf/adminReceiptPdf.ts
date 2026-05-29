import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import {
  buildSafeliteReceiptFilename,
  readInsuranceMeta,
  type SafeliteInvoiceRow,
  type SafeliteVehicleRow,
} from "@/lib/safelite/billing";

type AnyObj = Record<string, any>;

type TechnicianRow = {
  email?: string | null;
  full_name?: string | null;
};

export type AdminReceiptPdfInput = {
  invoice: SafeliteInvoiceRow & {
    discount_percent?: number | null;
    tax_rate_percent?: number | null;
    paid_at?: string | null;
    payment_method?: string | null;
    final_paid_cents?: number | null;
  };
  vehicle?: SafeliteVehicleRow | null;
  technician?: TechnicianRow | null;
};

const LETTER: [number, number] = [612, 792];

const COMPANY = {
  name: "Glass Guardian",
  legalLine: "Chip & Crack Repair",
  phone: "(909) 529-1798",
  email: "info@glassguardianchipandcrackrepair.com",
  location: "3452 Anderson Ave #E Riverside CA 92507",
  fedTaxId: "99-2310126",
};

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

function normStatus(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function moneyFromCents(cents: number | null | undefined) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function dollars(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
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

function addYearsDateOnly(dateOnly: string, years: number) {
  if (!dateOnly || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return "";

  const [yy, mm, dd] = dateOnly.split("-").map((x) => Number(x));
  const d = new Date(yy, mm - 1, dd);
  d.setFullYear(d.getFullYear() + years);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function inferInsuranceCoverage(invoice: AdminReceiptPdfInput["invoice"]) {
  const subtotal = invoice.subtotal_cents ?? 0;
  const discount = invoice.discount_cents ?? 0;
  const total = invoice.total_cents ?? 0;
  const insuranceDue = invoice.insurance_due_cents ?? 0;
  const insuranceMode = insuranceDue > 0 || (subtotal > 0 && total === 0 && discount >= subtotal);
  return {
    insuranceMode,
    insuranceCoveredCents: insuranceMode ? Math.max(discount, insuranceDue) : 0,
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function maybeEmbedSignature(pdf: PDFDocument, dataUrl: string) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  const [, base64 = ""] = dataUrl.split(",");
  if (!base64) return null;

  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
      return await pdf.embedJpg(bytes);
    }
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export function getAdminReceiptPdfFilename(invoice: Pick<SafeliteInvoiceRow, "id" | "invoice_number">) {
  return buildSafeliteReceiptFilename(invoice);
}

export async function buildAdminReceiptPdf(input: AdminReceiptPdfInput) {
  const { invoice, vehicle, technician } = input;
  const snapshot = normalizeObject(invoice.appointment_snapshot);
  const insuranceMeta = readInsuranceMeta(invoice.services_json);
  const { insuranceMode, insuranceCoveredCents } = inferInsuranceCoverage(invoice);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage(LETTER);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = LETTER[0];
  const pageHeight = LETTER[1];
  const margin = 34;
  let y = pageHeight - margin;

  const gold = rgb(0.65, 0.48, 0.16);
  const ink = rgb(0.05, 0.07, 0.1);
  const muted = rgb(0.34, 0.38, 0.45);
  const line = rgb(0.83, 0.86, 0.9);
  const soft = rgb(0.98, 0.97, 0.94);

  const text = (
    value: string,
    x: number,
    ty: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number } = {}
  ) => {
    const size = opts.size ?? 10;
    const useFont = opts.font ?? font;
    let out = String(value || "");
    if (opts.maxWidth) {
      while (out.length > 3 && useFont.widthOfTextAtSize(out, size) > opts.maxWidth) {
        out = out.slice(0, -1);
      }
      if (out !== value) out = `${out.slice(0, -1)}...`;
    }
    page.drawText(out, {
      x,
      y: ty,
      size,
      font: useFont,
      color: opts.color ?? ink,
    });
  };

  const rect = (
    x: number,
    ry: number,
    width: number,
    height: number,
    opts: { color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb> } = {}
  ) => {
    page.drawRectangle({
      x,
      y: ry,
      width,
      height,
      color: opts.color ?? rgb(1, 1, 1),
      borderColor: opts.borderColor ?? line,
      borderWidth: 1,
    });
  };

  const labelValue = (label: string, value: string, x: number, ty: number, width: number) => {
    text(label.toUpperCase(), x, ty, { size: 6.5, font: bold, color: muted, maxWidth: width });
    text(value || "-", x, ty - 12, { size: 9, font: bold, color: ink, maxWidth: width });
  };

  const serviceDate = toLocalDateOnly(invoice.invoice_date);
  const warrantyEnd = addYearsDateOnly(serviceDate, 1);
  const isPaid = normStatus(invoice.status) === "paid";
  const technicianDisplayName = firstNonBlank(
    technician?.full_name,
    prettifyTechnicianName(invoice.technician_email)
  );

  const customerName = firstNonBlank(
    insuranceMeta.customer_name,
    invoice.customer_name,
    snapshot.customer_name,
    snapshot.full_name,
    "Customer"
  );
  const customerEmail = firstNonBlank(invoice.customer_email, snapshot.customer_email, snapshot.email, "-");
  const customerAddress = firstNonBlank(
    insuranceMeta.customer_address,
    invoice.service_address,
    snapshot.service_address,
    snapshot.customer_address,
    snapshot.address,
    "-"
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
    "-"
  );
  const vehicleVin = firstNonBlank(insuranceMeta.vin, vehicle?.vin, snapshot.vin, snapshot.vehicle_vin, "-");
  const referral = firstNonBlank(
    insuranceMeta.referral_number,
    snapshot.referral_number,
    snapshot.referral_code,
    snapshot.referralCode,
    "-"
  );

  const glassLineDollars =
    typeof invoice.services_json?.glass_total === "number" && invoice.services_json.glass_total > 0
      ? invoice.services_json.glass_total
      : (invoice.subtotal_cents ?? 0) / 100;
  const miscLineDollars =
    typeof invoice.services_json?.misc_total === "number" && invoice.services_json.misc_total > 0
      ? invoice.services_json.misc_total
      : 0;

  const servicePreCoverageCents = (invoice.subtotal_cents ?? 0) + (invoice.tax_cents ?? 0);
  const serviceTotalDisplay = insuranceMode ? servicePreCoverageCents : invoice.total_cents ?? 0;
  const amountPaid = isPaid && !insuranceMode ? invoice.final_paid_cents ?? invoice.total_cents ?? 0 : 0;

  rect(margin, y - 72, pageWidth - margin * 2, 72, { color: soft, borderColor: line });
  text(COMPANY.name, margin + 16, y - 26, { size: 22, font: bold, color: ink });
  text(COMPANY.legalLine, margin + 16, y - 43, { size: 10, color: muted });
  text(`${COMPANY.phone} | ${COMPANY.email}`, margin + 16, y - 58, { size: 8.5, color: muted });
  text(COMPANY.location, margin + 250, y - 28, { size: 8.5, color: muted, maxWidth: 280 });
  text(`Fed Tax ID: ${COMPANY.fedTaxId}`, margin + 250, y - 44, { size: 8.5, color: muted });
  text("WORK ORDER RECEIPT", pageWidth - margin - 145, y - 58, { size: 10, font: bold, color: gold });
  y -= 90;

  const colGap = 12;
  const leftW = (pageWidth - margin * 2 - colGap) * 0.58;
  const rightW = pageWidth - margin * 2 - colGap - leftW;
  rect(margin, y - 78, leftW, 78);
  rect(margin + leftW + colGap, y - 78, rightW, 78);
  labelValue("Receipt #", `#${invoice.invoice_number ?? "-"}`, margin + 12, y - 18, 140);
  labelValue("Status", String(invoice.status ?? "unknown").toUpperCase(), margin + 160, y - 18, 80);
  labelValue("Service Date", serviceDate || "-", margin + 12, y - 50, 100);
  labelValue("Technician", technicianDisplayName, margin + 160, y - 50, leftW - 172);
  labelValue("Customer", customerName, margin + leftW + colGap + 12, y - 18, rightW - 24);
  labelValue("Email", customerEmail, margin + leftW + colGap + 12, y - 50, rightW - 24);
  y -= 94;

  rect(margin, y - 72, leftW, 72);
  rect(margin + leftW + colGap, y - 72, rightW, 72);
  labelValue("Address", customerAddress, margin + 12, y - 18, leftW - 24);
  labelValue("Vehicle", vehicleText, margin + leftW + colGap + 12, y - 18, rightW - 24);
  labelValue("VIN", vehicleVin, margin + leftW + colGap + 12, y - 50, rightW - 24);
  labelValue("Referral #", referral, margin + 12, y - 50, 110);
  y -= 88;

  rect(margin, y - 186, pageWidth - margin * 2, 186);
  page.drawRectangle({
    x: margin,
    y: y - 28,
    width: pageWidth - margin * 2,
    height: 28,
    color: soft,
    borderColor: line,
    borderWidth: 1,
  });
  text("RECEIPT BREAKDOWN", margin + 12, y - 18, { size: 8, font: bold, color: ink });
  text("AMOUNT", pageWidth - margin - 72, y - 18, { size: 8, font: bold, color: ink });

  const rows: Array<[string, string]> = [
    ["Glass repair service", dollars(glassLineDollars)],
  ];
  if (miscLineDollars > 0) rows.push(["Miscellaneous", dollars(miscLineDollars)]);
  rows.push(["Subtotal", moneyFromCents(invoice.subtotal_cents)]);
  if (insuranceMode) {
    rows.push(["Insurance covered", `-${moneyFromCents(insuranceCoveredCents)}`]);
  } else if ((invoice.discount_cents ?? 0) > 0) {
    rows.push(["Discount", `-${moneyFromCents(invoice.discount_cents)}`]);
  }
  rows.push(["Tax", `+${moneyFromCents(invoice.tax_cents)}`]);
  rows.push(["Service total", moneyFromCents(serviceTotalDisplay)]);
  if (insuranceMode) {
    rows.push(["Insurance due", moneyFromCents(invoice.insurance_due_cents ?? insuranceCoveredCents)]);
  }

  let rowY = y - 48;
  for (const [label, value] of rows) {
    text(label, margin + 12, rowY, { size: 9, color: ink, maxWidth: 340 });
    text(value, pageWidth - margin - 78, rowY, { size: 9, font: bold, color: ink, maxWidth: 68 });
    page.drawLine({
      start: { x: margin + 10, y: rowY - 8 },
      end: { x: pageWidth - margin - 10, y: rowY - 8 },
      thickness: 0.5,
      color: line,
    });
    rowY -= 18;
  }

  const totalLabel = isPaid ? "Total paid" : "Customer due";
  const totalValue = isPaid ? amountPaid : invoice.customer_due_cents ?? invoice.total_cents ?? 0;
  text(totalLabel.toUpperCase(), pageWidth - margin - 210, y - 162, { size: 9, font: bold, color: muted });
  text(moneyFromCents(totalValue), pageWidth - margin - 96, y - 164, { size: 13, font: bold, color: ink });
  y -= 204;

  rect(margin, y - 42, leftW, 42, { color: rgb(0.98, 1, 0.97), borderColor: line });
  rect(margin + leftW + colGap, y - 42, rightW, 42, { color: soft, borderColor: line });
  text("Warranty Coverage", margin + 10, y - 15, { size: 8, font: bold, color: ink });
  text(`Covered through ${warrantyEnd || "-"} for damage repaired on ${serviceDate || "-"}.`, margin + 10, y - 29, {
    size: 8,
    color: ink,
    maxWidth: leftW - 20,
  });
  text("Admin Record Notice", margin + leftW + colGap + 10, y - 15, { size: 8, font: bold, color: ink });
  for (const [idx, lineText] of wrapText(
    "Internal admin-facing receipt copy from Glass Guardian and current invoice record.",
    font,
    8,
    rightW - 20
  ).entries()) {
    text(lineText, margin + leftW + colGap + 10, y - 29 - idx * 10, { size: 8, color: ink });
  }
  y -= 58;

  if (insuranceMeta.signature_data_url) {
    const sigBoxH = 82;
    rect(margin, y - sigBoxH, pageWidth - margin * 2, sigBoxH, { color: soft, borderColor: gold });
    text("CUSTOMER SIGNATURE", margin + 12, y - 17, { size: 8, font: bold, color: ink });
    const innerX = margin + 12;
    const innerY = y - sigBoxH + 12;
    const innerW = pageWidth - margin * 2 - 24;
    const innerH = 46;
    rect(innerX, innerY, innerW, innerH, { color: rgb(1, 1, 1), borderColor: line });

    const sig = await maybeEmbedSignature(pdf, String(insuranceMeta.signature_data_url));
    if (sig) {
      const scale = Math.min(innerW / sig.width, innerH / sig.height);
      const width = sig.width * scale;
      const height = sig.height * scale;
      page.drawImage(sig, {
        x: innerX + (innerW - width) / 2,
        y: innerY + (innerH - height) / 2,
        width,
        height,
      });
    } else {
      text("Customer signature on file", innerX + 10, innerY + 18, { size: 10, color: muted });
    }
    y -= sigBoxH + 12;
  }

  page.drawLine({
    start: { x: margin, y: margin + 16 },
    end: { x: pageWidth - margin, y: margin + 16 },
    thickness: 0.75,
    color: line,
  });
  text("Printed from the Glass Guardian admin portal.", margin, margin, { size: 7.5, color: muted });
  text(`${COMPANY.name} | ${COMPANY.legalLine} | ${COMPANY.phone}`, pageWidth - margin - 210, margin, {
    size: 7.5,
    color: muted,
    maxWidth: 210,
  });

  const bytes = await pdf.save();
  return bytes;
}
