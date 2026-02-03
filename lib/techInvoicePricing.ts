// lib/techInvoicePricing.ts

export type ServicesJson = {
  chip_count?: number;
  small_crack_count?: number;
  insurance_covered?: boolean;
  rni_rnr_total?: number;
  parts_total?: number;
  misc_total?: number;
  glass_total?: number;      // optional input / fallback
  chip_crack_gross?: number;
};

type ComputeArgs = {
  services: ServicesJson;
  discount_percent: number | null;
  discount_cents: number;
  tax_rate_percent: number | null;
  tax_cents: number;
};

/**
 * Shared pricing brain for tech_invoices:
 * - Uses 60 / 25 / 100 chip & crack pricing.
 * - If chip_count + small_crack_count == 0 and a glass_total is already
 *   provided (from appointment.final_amount), uses that as the glass price.
 */
export function computeTechInvoiceFromServices(args: ComputeArgs) {
  const {
    services,
    discount_percent,
    discount_cents,
    tax_rate_percent,
    tax_cents,
  } = args;

  const chipCount = Number(services.chip_count || 0);
  const crackCount = Number(services.small_crack_count || 0);
  const insuranceCovered = Boolean(services.insurance_covered);

  const firstChipPrice = 60;
  const extraChipPrice = 25;
  const crackPrice = 100;

  const chipsDollars =
    chipCount <= 0
      ? 0
      : firstChipPrice +
        Math.max(0, chipCount - 1) * extraChipPrice;

  const cracksDollars =
    crackCount <= 0 ? 0 : crackCount * crackPrice;

  const grossDollars = chipsDollars + cracksDollars;

  // If no chips/cracks yet BUT we already have a glass_total from elsewhere
  // (e.g., appointment.final_amount), use that as the base.
  let glassDollars: number;
  if (chipCount <= 0 && crackCount <= 0 && typeof services.glass_total === "number") {
    glassDollars = Number(services.glass_total || 0);
  } else {
    glassDollars = insuranceCovered ? 0 : grossDollars;
  }

  const rni = Number(services.rni_rnr_total || 0);
  const parts = Number(services.parts_total || 0);
  const misc = Number(services.misc_total || 0);

  const subtotalDollars = rni + parts + misc + glassDollars;
  const subtotal_cents = Math.round(subtotalDollars * 100);

  let newDiscountCents = discount_cents || 0;
  if (typeof discount_percent === "number" && discount_percent > 0) {
    newDiscountCents = Math.round(
      subtotal_cents * (discount_percent / 100)
    );
  }

  const taxableBaseCents = subtotal_cents - newDiscountCents;

  let newTaxCents = tax_cents || 0;
  if (typeof tax_rate_percent === "number" && tax_rate_percent > 0) {
    newTaxCents = Math.round(
      taxableBaseCents * (tax_rate_percent / 100)
    );
  }

  const total_cents = taxableBaseCents + newTaxCents;

  const updatedServicesJson: ServicesJson = {
    ...services,
    glass_total: glassDollars,
    chip_crack_gross: grossDollars,
    chip_count: chipCount,
    small_crack_count: crackCount,
    insurance_covered: insuranceCovered,
  };

  return {
    services_json: updatedServicesJson,
    subtotal_cents,
    discount_cents: newDiscountCents,
    tax_cents: newTaxCents,
    total_cents,
  };
}