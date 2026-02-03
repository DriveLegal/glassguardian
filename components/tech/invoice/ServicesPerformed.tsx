"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";

type InvoiceLike = {
  id: string;
  services_json: any | null;
  discount_percent: number | null;
  discount_cents: number | null;
  tax_rate_percent: number | null;
  tax_cents: number | null;
  subtotal_cents: number | null;
};

type ServicesPerformedProps = {
  invoice: InvoiceLike;
  onTotalsChange?: (totals: {
    subtotalDollars: number;
    discountDollars: number;
    taxDollars: number;
    totalDollars: number;
  }) => void;
};

export const ServicesPerformed: React.FC<ServicesPerformedProps> = ({
  invoice,
  onTotalsChange,
}) => {
  const queryClient = useQueryClient();

  const currentServices = (invoice.services_json || {}) as any;

  // Local state for chip / crack / insurance controls
  const [chipCount, setChipCount] = React.useState(
    Number(currentServices.chip_count || 0)
  );
  const [crackCount, setCrackCount] = React.useState(
    Number(currentServices.small_crack_count || 0)
  );
  const [insuranceCovered, setInsuranceCovered] =
    React.useState<boolean>(
      Boolean(currentServices.insurance_covered)
    );

  // Re-seed local state when invoice changes (e.g. nav / refetch)
  React.useEffect(() => {
    const sj = (invoice.services_json || {}) as any;
    setChipCount(Number(sj.chip_count || 0));
    setCrackCount(Number(sj.small_crack_count || 0));
    setInsuranceCovered(Boolean(sj.insurance_covered));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  // Live preview for the tech (uses local state)
  const pricingPreview = React.useMemo(() => {
    const firstChipPrice = 60; // dollars
    const extraChipPrice = 25;
    const crackPrice = 100;

    const chips =
      chipCount <= 0
        ? 0
        : firstChipPrice +
          Math.max(0, chipCount - 1) * extraChipPrice;
    const cracks =
      crackCount <= 0 ? 0 : crackCount * crackPrice;
    const gross = chips + cracks;
    const chargeable = insuranceCovered ? 0 : gross;

    return {
      chips,
      cracks,
      gross,
      chargeable,
    };
  }, [chipCount, crackCount, insuranceCovered]);

  // 🔹 Push live totals up to parent (so Totals & Payment always matches)
  React.useEffect(() => {
    if (!onTotalsChange) return;

    const sj = (invoice.services_json || {}) as any;

    const rni = Number(sj.rni_rnr_total || 0);
    const parts = Number(sj.parts_total || 0);
    const misc = Number(sj.misc_total || 0);

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
    const glass = insuranceCovered ? 0 : grossDollars;

    const subtotalDollars = rni + parts + misc + glass;

    const discountPercent =
      typeof invoice.discount_percent === "number"
        ? invoice.discount_percent
        : 0;
    const fixedDiscountCents = invoice.discount_cents ?? 0;

    let discountDollars = 0;
    if (discountPercent > 0) {
      discountDollars =
        subtotalDollars * (discountPercent / 100);
    } else {
      discountDollars = fixedDiscountCents / 100;
    }

    const taxableBaseDollars =
      subtotalDollars - discountDollars;

    const taxRatePercent =
      typeof invoice.tax_rate_percent === "number"
        ? invoice.tax_rate_percent
        : 0;
    const fixedTaxCents = invoice.tax_cents ?? 0;

    let taxDollars = 0;
    if (taxRatePercent > 0) {
      taxDollars =
        taxableBaseDollars * (taxRatePercent / 100);
    } else {
      taxDollars = fixedTaxCents / 100;
    }

    const totalDollars =
      taxableBaseDollars + taxDollars;

    onTotalsChange({
      subtotalDollars,
      discountDollars,
      taxDollars,
      totalDollars,
    });
  }, [
    chipCount,
    crackCount,
    insuranceCovered,
    invoice.discount_percent,
    invoice.discount_cents,
    invoice.tax_rate_percent,
    invoice.tax_cents,
    invoice.services_json,
    onTotalsChange,
  ]);

  const updatePricingMutation = useMutation({
    mutationFn: async () => {
      const firstChipPrice = 60;
      const extraChipPrice = 25;
      const crackPrice = 100;

      // --- compute chip/crack pricing in dollars ---
      const chipsDollars =
        chipCount <= 0
          ? 0
          : firstChipPrice +
            Math.max(0, chipCount - 1) * extraChipPrice;
      const cracksDollars =
        crackCount <= 0 ? 0 : crackCount * crackPrice;
      const grossDollars = chipsDollars + cracksDollars;
      const chargeableDollars = insuranceCovered
        ? 0
        : grossDollars;

      const sj = (invoice.services_json || {}) as any;

      const updatedServicesJson = {
        ...sj,
        glass_total: chargeableDollars,
        chip_count: chipCount,
        small_crack_count: crackCount,
        insurance_covered: insuranceCovered,
        chip_crack_gross: grossDollars,
      };

      const rni = Number(sj.rni_rnr_total || 0);
      const parts = Number(sj.parts_total || 0);
      const misc = Number(sj.misc_total || 0);
      const glass = Number(updatedServicesJson.glass_total || 0);

      const newSubtotalDollars = rni + parts + misc + glass;
      const newSubtotalCents = Math.round(
        newSubtotalDollars * 100
      );

      const discountPercent =
        typeof invoice.discount_percent === "number"
          ? invoice.discount_percent
          : 0;
      const currentDiscountCents =
        invoice.discount_cents ?? 0;

      let newDiscountCents = currentDiscountCents;
      if (discountPercent > 0) {
        newDiscountCents = Math.round(
          newSubtotalCents * (discountPercent / 100)
        );
      }

      const taxableBaseCents =
        newSubtotalCents - newDiscountCents;

      const taxRatePercent =
        typeof invoice.tax_rate_percent === "number"
          ? invoice.tax_rate_percent
          : 0;
      const currentTaxCents = invoice.tax_cents ?? 0;

      let newTaxCents = currentTaxCents;
      if (taxRatePercent > 0) {
        newTaxCents = Math.round(
          taxableBaseCents * (taxRatePercent / 100)
        );
      }

      const newTotalCents =
        taxableBaseCents + newTaxCents;

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .update({
          services_json: updatedServicesJson,
          subtotal_cents: newSubtotalCents,
          discount_cents: newDiscountCents,
          tax_cents: newTaxCents,
          total_cents: newTotalCents,
        })
        .eq("id", invoice.id)
        .select(
          "id, services_json, subtotal_cents, discount_cents, tax_cents, total_cents"
        )
        .maybeSingle();

      if (error) {
        console.error(
          "updatePricing tech_invoices error:",
          error
        );
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      // Update the main invoice query cache so other sections see latest values
      queryClient.setQueryData(
        ["tech-invoice", invoice.id],
        (old: any) =>
          old ? { ...old, ...(data ?? {}) } : data ?? old
      );

      // Make sure any watchers refetch
      queryClient.invalidateQueries({
        queryKey: ["tech-invoice", invoice.id],
      });
    },
  });

  // ---------- Display values (customer-facing) ----------
  const firstChipPriceDisplay = 60;
  const extraChipPriceDisplay = 25;
  const crackPriceDisplay = 100;

  const storedChipsGross =
    chipCount <= 0
      ? 0
      : firstChipPriceDisplay +
        Math.max(0, chipCount - 1) *
          extraChipPriceDisplay;
  const storedCracksGross =
    crackCount <= 0
      ? 0
      : crackCount * crackPriceDisplay;

  const chipLineAmount = insuranceCovered
    ? 0
    : storedChipsGross;
  const crackLineAmount = insuranceCovered
    ? 0
    : storedCracksGross;

  const miscAmount = Number(currentServices.misc_total || 0);

  return (
    <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_22px_70px_rgba(15,23,42,0.9)] print:bg-white print:border-slate-200 print:shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          Services Performed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tech pricing controls */}
        <div className="mb-4 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 text-xs md:text-sm text-slate-100 print:hidden">
          <p className="text-[11px] text-slate-400 mb-3">
            Set chip / crack pricing for this invoice. First chip
            is <span className="font-semibold">$60</span>, each
            additional chip is{" "}
            <span className="font-semibold">$25</span>. Each small
            crack is{" "}
            <span className="font-semibold">$100</span>. If
            insurance is checked, customer amount becomes{" "}
            <span className="font-semibold">$0</span> (but gross
            is recorded in the invoice JSON).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="flex items-center justify-between gap-2">
              <span>Chip repairs</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-600 text-xs"
                  onClick={() =>
                    setChipCount((c) => (c > 0 ? c - 1 : 0))
                  }
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  className="w-16 rounded border border-slate-600 bg-slate-950/60 px-2 py-1 text-right text-xs"
                  value={chipCount}
                  onChange={(e) =>
                    setChipCount(
                      Math.max(
                        0,
                        Number(e.target.value || 0)
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-600 text-xs"
                  onClick={() =>
                    setChipCount((c) => c + 1)
                  }
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>Small cracks</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-600 text-xs"
                  onClick={() =>
                    setCrackCount((c) => (c > 0 ? c - 1 : 0))
                  }
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  className="w-16 rounded border border-slate-600 bg-slate-950/60 px-2 py-1 text-right text-xs"
                  value={crackCount}
                  onChange={(e) =>
                    setCrackCount(
                      Math.max(
                        0,
                        Number(e.target.value || 0)
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-slate-600 text-xs"
                  onClick={() =>
                    setCrackCount((c) => c + 1)
                  }
                >
                  +
                </button>
              </div>
            </div>

            <label className="flex items-center justify-between gap-2">
              <span>Insurance covers this repair</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-500"
                checked={insuranceCovered}
                onChange={(e) =>
                  setInsuranceCovered(e.target.checked)
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] md:text-xs">
            <div className="space-y-0.5">
              <p className="text-slate-300">
                Gross (chips + cracks):{" "}
                <span className="font-semibold text-emerald-300">
                  ${pricingPreview.gross.toFixed(2)}
                </span>
              </p>
              <p className="text-slate-300">
                Customer amount (after insurance):{" "}
                <span className="font-semibold text-emerald-300">
                  $
                  {pricingPreview.chargeable.toFixed(2)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {updatePricingMutation.isError && (
                <span className="text-red-400 text-[11px] mr-2">
                  Failed to save, check console / Supabase RLS.
                </span>
              )}
              {updatePricingMutation.isSuccess && (
                <span className="text-emerald-300 text-[11px] mr-2">
                  Pricing saved to invoice.
                </span>
              )}
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-500"
                disabled={updatePricingMutation.isPending}
                onClick={() =>
                  updatePricingMutation.mutate()
                }
              >
                {updatePricingMutation.isPending
                  ? "Saving..."
                  : "Save Pricing to Invoice"}
              </Button>
            </div>
          </div>
        </div>

        {/* Display values (customer-facing) */}
        <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/50 print:bg-white print:border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-300 print:bg-slate-100 print:text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  Category
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Chip repair row – only if there are chips */}
              {chipCount > 0 && (
                <tr className="border-t border-slate-800/80 print:border-slate-200 bg-slate-900/60 print:bg-white">
                  <td className="px-4 py-3 text-slate-100 print:text-slate-800">
                    Chip repair x{chipCount}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-50 font-semibold print:text-slate-900">
                    ${chipLineAmount.toFixed(2)}
                  </td>
                </tr>
              )}

              {/* Small crack row – only if there are cracks */}
              {crackCount > 0 && (
                <tr className="border-t border-slate-800/80 print:border-slate-200 bg-slate-900/60 print:bg-white">
                  <td className="px-4 py-3 text-slate-100 print:text-slate-800">
                    Small crack x{crackCount}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-50 font-semibold print:text-slate-900">
                    ${crackLineAmount.toFixed(2)}
                  </td>
                </tr>
              )}

              {/* Miscellaneous (other charges) */}
              <tr className="border-t border-slate-800/80 print:border-slate-200 bg-slate-900/40 print:bg-slate-50">
                <td className="px-4 py-3 text-slate-100 print:text-slate-800">
                  Miscellaneous
                </td>
                <td className="px-4 py-3 text-right text-slate-50 font-semibold print:text-slate-900">
                  ${miscAmount.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Optional text summary */}
        <div className="mt-3 text-[11px] text-slate-400 print:text-slate-700">
          <p>
            Chip repairs:{" "}
            <span className="text-slate-100 print:text-slate-900">
              {chipCount}
            </span>{" "}
            · Small cracks:{" "}
            <span className="text-slate-100 print:text-slate-900">
              {crackCount}
            </span>{" "}
            · Insurance:{" "}
            <span className="text-slate-100 print:text-slate-900">
              {insuranceCovered ? "Yes" : "No"}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};