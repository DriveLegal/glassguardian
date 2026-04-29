// lib/invoiceHelpers.ts
//
// Centralised helpers for money computations and insurance validation used by
// the tech invoice detail page. Keeping this logic here means the mutations on
// the page only hold their minimal differences (status value + appointment
// update for markPaid) while everything shared lives in one place.

import type { InsuranceData, ServiceItem } from "@/lib/types/invoice";

// ── Insurance validation ──────────────────────────────────────────────────────

/**
 * Returns an error message string if the insurance data is missing required
 * fields/signature, or null when validation passes.
 */
export function validateInsurance(data: InsuranceData | null): string | null {
  if (!data) return "Insurance information is missing.";
  if (!data.company?.trim()) return "Insurance company is required.";
  if (!data.policy_number?.trim()) return "Policy number is required.";
  if (!data.customer_signature?.trim())
    return "Customer signature is required before submitting.";
  return null;
}

// ── Money computations ────────────────────────────────────────────────────────

/**
 * Sums service line-items using the insurance unit price when useInsurance is
 * true (falling back to the standard price when insurance_price is absent).
 * Returns the total in the same unit as the individual prices (e.g. cents).
 */
export function computeTotal(
  services: ServiceItem[],
  useInsurance: boolean
): number {
  return services.reduce((sum, item) => {
    const unitPrice =
      useInsurance ? (item.insurance_price ?? item.price) : item.price;
    return sum + unitPrice * item.quantity;
  }, 0);
}

/**
 * Returns a new services array where each item's active price reflects the
 * current mode.  The original array is not mutated.
 */
export function patchServicesForMode(
  services: ServiceItem[],
  useInsurance: boolean
): ServiceItem[] {
  return services.map((item) => ({
    ...item,
    price: useInsurance ? (item.insurance_price ?? item.price) : item.price,
  }));
}
