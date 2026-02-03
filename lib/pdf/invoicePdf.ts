// lib/pdf/invoicePdf.ts
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

type AnyObj = Record<string, any>;

export type CompanyInfo = {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoPngDataUrl?: string; // e.g. "data:image/png;base64,...."
  brandHex?: string;       // e.g. "#2563eb"
};

export type InvoicePdfOptions = {
  company?: CompanyInfo;
  // tweak sizes/colors if needed
  pageMargin?: number; // default 40
  accentHex?: string;  // overrides company.brandHex if provided
};

// ✅ Tuple type, not number[]
const LETTER: [number, number] = [612, 792]; // 8.5x11 @ 72dpi

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean,
    16
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return rgb(r / 255, g / 255, b / 255);
}

function money(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return `$${n.toFixed(2)}`;
}

function safeText(v: unknown, fallback = "—") {
  return (v ?? fallback) as string;
}

async function maybeEmbedPng(pdf: PDFDocument, dataUrl?: string) {
  if (!dataUrl) return null;
  try {
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1] || ""), (c) =>
      c.charCodeAt(0)
    );
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

export async function buildInvoicePdf(
  invoice: AnyObj,
  opts: InvoicePdfOptions = {}
) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const firstPage = pdf.addPage(LETTER);

  // We'll track the "current" page rather than reassign consts
  let currentPage: PDFPage = firstPage;
  const { width: PAGE_W, height: PAGE_H } = currentPage.getSize();

  // ---- THEME / COLORS ----
  const margin = opts.pageMargin ?? 40;
  const brandHex =
    opts.accentHex || opts.company?.brandHex || "#2563eb";
  const brand = hexToRgb(brandHex);
  const bandBg = rgb(0.96, 0.98, 1.0);
  const lineGrey = rgb(0.85, 0.9, 0.95);
  const textMuted = rgb(0.35, 0.4, 0.5);

  // ---- HELPERS ----
  const drawText = (
    text: string,
    x: number,
    y: number,
    {
      size = 12,
      color = rgb(0, 0, 0),
      bold = false,
      maxWidth,
    }: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean; maxWidth?: number } = {}
  ) => {
    // naive single-line trimming if maxWidth provided
    let out = text ?? "";
    if (maxWidth) {
      let width = (bold ? fontBold : font).widthOfTextAtSize(out, size);
      while (width > maxWidth && out.length > 3) {
        out = out.slice(0, -1);
        width = (bold ? fontBold : font).widthOfTextAtSize(out + "…", size);
        if (width <= maxWidth) {
          out = out + "…";
          break;
        }
      }
    }
    currentPage.drawText(out, {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  const drawHr = (x1: number, y: number, x2: number, color = lineGrey) => {
    currentPage.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 1,
      color,
    });
  };

  const wrapText = (
    text: string,
    size: number,
    maxWidth: number,
    fontUse = font
  ) => {
    const words = String(text || "").split(/\s+/);
    const lines: string[] = [];
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = fontUse.widthOfTextAtSize(test, size);
      if (width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        if (fontUse.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            const t = chunk + ch;
            if (fontUse.widthOfTextAtSize(t, size) > maxWidth) {
              if (chunk) lines.push(chunk);
              chunk = ch;
            } else {
              chunk = t;
            }
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const pages: PDFPage[] = [currentPage];
  const drawFooterPageNumber = () => {
    const pIndex = pages.length; // page we're currently on (created last)
    const footerY = margin - 20;
    currentPage.drawText(`Page ${pIndex}`, {
      x: PAGE_W - margin - 60,
      y: footerY,
      size: 10,
      font,
      color: textMuted,
    });
  };

  let cursorY = PAGE_H - margin;

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < margin + 50) {
      currentPage = pdf.addPage(LETTER);
      pages.push(currentPage);
      cursorY = PAGE_H - margin; // PAGE_W/H are same for LETTER pages
      drawFooterPageNumber();
    }
  };

  // ---- HEADER BAND ----
  currentPage.drawRectangle({
    x: 0,
    y: PAGE_H - 140,
    width: PAGE_W,
    height: 140,
    color: bandBg,
  });

  // Try embed logo
  const logo = await maybeEmbedPng(pdf, opts.company?.logoPngDataUrl);
  if (logo) {
    const w = 140;
    const scale = w / logo.width;
    const h = logo.height * scale;
    currentPage.drawImage(logo, {
      x: margin,
      y: PAGE_H - 60 - h / 2,
      width: w,
      height: h,
    });
  } else {
    drawText(opts.company?.name || "Glass Guardian", margin, PAGE_H - 70, {
      size: 26,
      bold: true,
      color: brand,
    });
  }

  // Invoice title + meta
  drawText("INVOICE", PAGE_W - margin - 150, PAGE_H - 60, {
    size: 24,
    bold: true,
  });

  const invNo =
    invoice.invoice_number || (invoice.id ? String(invoice.id).slice(0, 8) : "—");
  drawText(`Invoice #: ${invNo}`, PAGE_W - margin - 150, PAGE_H - 90, {
    size: 12,
    color: textMuted,
  });
  drawText(
    `Date: ${
      invoice.invoice_date
        ? new Date(invoice.invoice_date).toLocaleDateString()
        : "—"
    }`,
    PAGE_W - margin - 150,
    PAGE_H - 108,
    { size: 12, color: textMuted }
  );

  // Company address block (right under logo)
  const compTop = PAGE_H - 155;
  const compLeft = margin;
  const compW = 260;
  const cInfo = opts.company;

  const compLines = [
    cInfo?.name,
    cInfo?.addressLine1,
    cInfo?.addressLine2,
    cInfo?.email,
    cInfo?.phone,
    cInfo?.website,
  ].filter(Boolean) as string[];

  cursorY = compTop;
  if (compLines.length) {
    drawText("From", compLeft, cursorY, { size: 12, color: textMuted, bold: true });
    cursorY -= 16;
    for (const line of compLines) {
      const lines = wrapText(line, 11, compW);
      for (const row of lines) {
        drawText(row, compLeft, cursorY, { size: 11 });
        cursorY -= 14;
      }
    }
  }

  // Bill to block
  const billLeft = margin + 300;
  cursorY = compTop;
  drawText("Bill To", billLeft, cursorY, { size: 12, color: textMuted, bold: true });
  cursorY -= 16;
  drawText(safeText(invoice.customer_name || invoice.customer_email), billLeft, cursorY, {
    size: 12,
  });
  cursorY -= 14;
  if (invoice.customer_email) {
    drawText(invoice.customer_email, billLeft, cursorY, { size: 11, color: textMuted });
    cursorY -= 14;
  }
  if (invoice.customer_address) {
    const lines = wrapText(invoice.customer_address, 11, 260);
    for (const row of lines) {
      drawText(row, billLeft, cursorY, { size: 11, color: textMuted });
      cursorY -= 14;
    }
  }

  // ---- ITEMS TABLE ----
  cursorY -= 10;
  ensureSpace(120);

  const tableLeft = margin;
  const tableRight = PAGE_W - margin;
  const descColW = (tableRight - tableLeft) * 0.64;
  const amtColW = (tableRight - tableLeft) * 0.36;

  const thY = cursorY;
  currentPage.drawRectangle({
    x: tableLeft,
    y: thY - 26,
    width: tableRight - tableLeft,
    height: 26,
    color: rgb(0.98, 0.99, 1),
  });
  drawText("Description", tableLeft + 10, thY - 18, {
    size: 12,
    bold: true,
    color: brand,
  });
  drawText("Amount", tableLeft + 10 + descColW + amtColW - 80, thY - 18, {
    size: 12,
    bold: true,
    color: brand,
  });

  drawHr(tableLeft, thY - 26, tableRight);
  cursorY = thY - 34;

  const items: AnyObj[] = Array.isArray(invoice.line_items)
    ? invoice.line_items
    : [];

  const drawRow = (desc: string, amount: number) => {
    const dLines = wrapText(desc || "Item", 11, descColW - 20);
    const rowHeight = Math.max(20, dLines.length * 14 + 6);

    ensureSpace(rowHeight + 10);

    currentPage.drawRectangle({
      x: tableLeft,
      y: cursorY - 6,
      width: tableRight - tableLeft,
      height: rowHeight,
      color: rgb(1, 1, 1),
      opacity: 1,
    });

    currentPage.drawLine({
      start: { x: tableLeft, y: cursorY - 6 },
      end: { x: tableRight, y: cursorY - 6 },
      thickness: 0.75,
      color: lineGrey,
    });

    let y = cursorY + rowHeight - 16;
    for (const ln of dLines) {
      drawText(ln, tableLeft + 10, y, { size: 11 });
      y -= 14;
    }

    drawText(money(amount ?? 0), tableRight - 90, cursorY + rowHeight - 16, {
      size: 11,
      bold: true,
    });

    cursorY -= rowHeight;
  };

  if (items.length === 0) {
    drawRow("Service", invoice.total_amount ?? 0);
  } else {
    for (const it of items) {
      drawRow(String(it.description ?? "Item"), Number(it.total ?? 0));
    }
  }

  currentPage.drawLine({
    start: { x: tableLeft, y: cursorY - 6 },
    end: { x: tableRight, y: cursorY - 6 },
    thickness: 1,
    color: lineGrey,
  });

  // ---- TOTALS SIDEBAR ----
  const sidebarW = 220;
  const sidebarX = PAGE_W - margin - sidebarW;
  let sideY = cursorY - 14;
  if (sideY < margin + 160) {
    ensureSpace(PAGE_H); // force new page if cramped
    sideY = cursorY - 14;
  }

  currentPage.drawRectangle({
    x: sidebarX,
    y: sideY - 140,
    width: sidebarW,
    height: 140,
    color: rgb(1, 1, 1),
    borderColor: lineGrey,
    borderWidth: 1,
  });

  const totalRow = (label: string, value?: number, bold?: boolean) => {
    sideY -= 22;
    drawText(label, sidebarX + 12, sideY, {
      size: 11,
      color: textMuted,
      bold,
    });
    drawText(money(value), sidebarX + sidebarW - 90, sideY, {
      size: 11,
      bold,
    });
  };

  drawText("Summary", sidebarX + 12, sideY - 14, { size: 12, bold: true, color: brand });
  sideY -= 10;
  drawHr(sidebarX + 12, sideY - 10, sidebarX + sidebarW - 12);
  sideY -= 8;

  if (typeof invoice.subtotal === "number") totalRow("Subtotal", invoice.subtotal);
  if (typeof invoice.tax_amount === "number" && invoice.tax_amount > 0)
    totalRow("Tax", invoice.tax_amount);
  if (typeof invoice.tip_amount === "number" && invoice.tip_amount > 0)
    totalRow("Tip", invoice.tip_amount);

  totalRow("Total", invoice.total_amount ?? 0, true);

  // ---- NOTES / PAYMENT INFO ----
  cursorY = sideY - 28;
  ensureSpace(100);
  drawText("Payment", margin, cursorY, { size: 12, bold: true, color: brand });
  cursorY -= 16;
  const paidMeta = [
    ["Status", safeText(invoice.payment_status)],
    ["Method", safeText(invoice.payment_method)],
    [
      "Payment Date",
      invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString() : "—",
    ],
  ] as const;
  for (const [k, v] of paidMeta) {
    drawText(k + ":", margin, cursorY, { size: 11, color: textMuted });
    drawText(String(v), margin + 90, cursorY, { size: 11 });
    cursorY -= 16;
  }

  if (invoice.notes) {
    cursorY -= 6;
    drawText("Notes", margin, cursorY, { size: 12, bold: true, color: brand });
    cursorY -= 16;
    const notesLines = wrapText(String(invoice.notes), 11, PAGE_W - margin * 2);
    for (const row of notesLines) {
      ensureSpace(16);
      drawText(row, margin, cursorY, { size: 11 });
      cursorY -= 14;
    }
  }

  // ---- FOOTER ----
  currentPage.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: 2,
    color: brand,
    opacity: 0.35,
  });

  drawText("Thank you for your business!", margin, margin - 6, {
    size: 11,
    color: textMuted,
    bold: true,
  });

    // Page numbers for all pages
  const totalPages = pages.length;
  pages.forEach((pg, i) => {
    pg.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: PAGE_W - margin - 100,
      y: margin - 6,
      size: 10,
      font,
      color: textMuted,
    });
  });

  const bytes = await pdf.save(); // Uint8Array

  // Create a fresh ArrayBuffer (not SharedArrayBuffer) and copy into it
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);

  return new Blob([ab], { type: "application/pdf" });
}

export async function downloadInvoicePdf(
  invoice: AnyObj,
  opts?: InvoicePdfOptions
) {
  const blob = await buildInvoicePdf(invoice, opts);
  const invNo = invoice.invoice_number || (invoice.id ? String(invoice.id).slice(0, 8) : "invoice");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GlassGuardian-Invoice-${invNo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}