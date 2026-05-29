// components/tech/invoice/ServicesPerformed.tsx
"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ShieldCheck, Loader2, CreditCard } from "lucide-react";

type InvoiceLike = {
  id: string;
  services_json: any | null;
  discount_percent: number | null;
  discount_cents: number | null;
  tax_rate_percent: number | null;
  tax_cents: number | null;
  subtotal_cents: number | null;
  total_cents?: number | null;
  deposit_cents?: number | null;
};

type InvoiceTotals = {
  subtotalDollars: number;
  discountDollars: number;
  taxDollars: number;
  totalDollars: number;
};

type ServicesPerformedProps = {
  invoice: InvoiceLike;
  onTotalsChange?: (totals: InvoiceTotals) => void;
  onTotalsChangeAction?: (totals: InvoiceTotals) => void;
};

function normalizeObject(v: any): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  return {};
}

function dollars(n: number) {
  return Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

const FIRST_CHIP_PRICE = 70;
const EXTRA_CHIP_PRICE = 35;
const SMALL_CRACK_PRICE = 100;
const INSURANCE_FLAT_CENTS = 7000;

function clampInsuranceCents(n: number) {
  const x = Math.round(Number.isFinite(n) ? n : INSURANCE_FLAT_CENTS);
  return x > 0 ? INSURANCE_FLAT_CENTS : INSURANCE_FLAT_CENTS;
}

function readInsuranceFlagFromJson(v: any): boolean {
  const sj = normalizeObject(v);
  if (typeof sj.insurance_covers_repairs === "boolean") return sj.insurance_covers_repairs;
  if (typeof sj.insurance_covered === "boolean") return sj.insurance_covered;
  return false;
}

function readInsuranceFlatCentsFromJson(v: any): number {
  const sj = normalizeObject(v);

  if (typeof sj.insurance_flat_price_cents === "number") {
    return INSURANCE_FLAT_CENTS;
  }

  if (typeof sj.insurance_flat_price === "number") {
    return INSURANCE_FLAT_CENTS;
  }

  return INSURANCE_FLAT_CENTS;
}

function getChipTotal(chipCount: number) {
  if (chipCount <= 0) return 0;
  return FIRST_CHIP_PRICE + Math.max(0, chipCount - 1) * EXTRA_CHIP_PRICE;
}

function getCrackTotal(crackCount: number) {
  if (crackCount <= 0) return 0;
  return crackCount * SMALL_CRACK_PRICE;
}

export const ServicesPerformed: React.FC<ServicesPerformedProps> = ({
  invoice,
  onTotalsChange,
  onTotalsChangeAction,
}) => {
  const queryClient = useQueryClient();

  const currentServices = React.useMemo(
    () => normalizeObject(invoice.services_json),
    [invoice.services_json]
  );

  const emitTotals = onTotalsChange ?? onTotalsChangeAction;

  const [chipCount, setChipCount] = React.useState<number>(
    Number(currentServices.chip_count || 0)
  );
  const [crackCount, setCrackCount] = React.useState<number>(
    Number(currentServices.small_crack_count || 0)
  );

  const [insuranceCoversRepairs, setInsuranceCoversRepairs] =
    React.useState<boolean>(() => readInsuranceFlagFromJson(currentServices));

  const [insuranceFlatCents, setInsuranceFlatCents] = React.useState<number>(
    () => clampInsuranceCents(readInsuranceFlatCentsFromJson(currentServices))
  );

  const [insuranceUiTouched, setInsuranceUiTouched] =
    React.useState<boolean>(false);

  React.useEffect(() => {
    const sj = normalizeObject(invoice.services_json);

    setChipCount(Number(sj.chip_count || 0));
    setCrackCount(Number(sj.small_crack_count || 0));
    setInsuranceCoversRepairs(readInsuranceFlagFromJson(sj));

    if (!insuranceUiTouched) {
      setInsuranceFlatCents(clampInsuranceCents(readInsuranceFlatCentsFromJson(sj)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id, invoice.services_json]);

  const depositCents = Number(invoice.deposit_cents || 0);
  const depositDollars = depositCents / 100;

  const pricingPreview = React.useMemo(() => {
    const chips = getChipTotal(chipCount);
    const cracks = getCrackTotal(crackCount);
    const gross = chips + cracks;

    const insuranceFlatDollars = clampInsuranceCents(insuranceFlatCents) / 100;

    const customerChargeable = insuranceCoversRepairs ? 0 : gross;
    const insuranceDue = insuranceCoversRepairs ? insuranceFlatDollars : 0;

    return {
      chips,
      cracks,
      gross,
      customerChargeable,
      insuranceDue,
      insuranceFlatDollars,
    };
  }, [chipCount, crackCount, insuranceCoversRepairs, insuranceFlatCents]);

  React.useEffect(() => {
    if (!emitTotals) return;

    const insuranceFlatDollars = clampInsuranceCents(insuranceFlatCents) / 100;

    if (insuranceCoversRepairs) {
      emitTotals({
        subtotalDollars: insuranceFlatDollars,
        discountDollars: insuranceFlatDollars,
        taxDollars: 0,
        totalDollars: 0,
      });
      return;
    }

    const sj = normalizeObject(invoice.services_json);

    const rni = Number(sj.rni_rnr_total || 0);
    const parts = Number(sj.parts_total || 0);
    const glass = getChipTotal(chipCount) + getCrackTotal(crackCount);

    const subtotalDollars = rni + parts + glass;

    const discountPercent =
      typeof invoice.discount_percent === "number" ? invoice.discount_percent : 0;
    const fixedDiscountCents = invoice.discount_cents ?? 0;

    let discountDollars = 0;
    if (discountPercent > 0) discountDollars = subtotalDollars * (discountPercent / 100);
    else discountDollars = fixedDiscountCents / 100;

    const taxableBaseDollars = Math.max(0, subtotalDollars - discountDollars);

    const taxRatePercent =
      typeof invoice.tax_rate_percent === "number" ? invoice.tax_rate_percent : 0;
    const fixedTaxCents = invoice.tax_cents ?? 0;

    let taxDollars = 0;
    if (taxRatePercent > 0) taxDollars = taxableBaseDollars * (taxRatePercent / 100);
    else taxDollars = fixedTaxCents / 100;

    const totalDollars = taxableBaseDollars + taxDollars;

    emitTotals({
      subtotalDollars,
      discountDollars,
      taxDollars,
      totalDollars,
    });
  }, [
    chipCount,
    crackCount,
    insuranceCoversRepairs,
    insuranceFlatCents,
    invoice.discount_percent,
    invoice.discount_cents,
    invoice.tax_rate_percent,
    invoice.tax_cents,
    invoice.services_json,
    emitTotals,
  ]);

  const saveInsuranceFlatMutation = useMutation({
    mutationFn: async (flatCents: number) => {
      const flat = clampInsuranceCents(flatCents);
      const sj = normalizeObject(invoice.services_json);

      const updatedServicesJson = {
        ...sj,
        insurance_flat_price_cents: flat,
        insurance_flat_price: Math.round(flat / 100),
      };

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .update({ services_json: updatedServicesJson })
        .eq("id", invoice.id)
        .select("id, services_json")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tech-invoice-by-id", invoice.id],
      });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async () => {
      const chipsDollars = getChipTotal(chipCount);
      const cracksDollars = getCrackTotal(crackCount);
      const grossDollars = chipsDollars + cracksDollars;

      const sj = normalizeObject(invoice.services_json);

      const flatCents = clampInsuranceCents(insuranceFlatCents);
      const flatDollars = flatCents / 100;

      const updatedServicesJson: any = {
        ...sj,
        chip_count: chipCount,
        small_crack_count: crackCount,
        insurance_covers_repairs: insuranceCoversRepairs,
        insurance_covered: insuranceCoversRepairs,
        chip_crack_gross: grossDollars,
        insurance_flat_price_cents: flatCents,
        insurance_flat_price: Math.round(flatDollars),
        insurance_due_cents: insuranceCoversRepairs ? flatCents : null,
        customer_due_cents: insuranceCoversRepairs ? 0 : null,
        glass_total: insuranceCoversRepairs ? 0 : grossDollars,
        misc_total: 0,
        chip_repair_customer_price_cents: insuranceCoversRepairs ? 0 : undefined,
        chip_repair_insurance_price_cents: insuranceCoversRepairs ? flatCents : undefined,
      };

      let newSubtotalCents = 0;
      let newDiscountCents = 0;
      let newTaxCents = 0;
      let newTotalCents = 0;

      if (insuranceCoversRepairs) {
        newSubtotalCents = flatCents;
        newDiscountCents = flatCents;
        newTaxCents = 0;
        newTotalCents = 0;
      } else {
        const rni = Number(sj.rni_rnr_total || 0);
        const parts = Number(sj.parts_total || 0);
        const glass = Number(updatedServicesJson.glass_total || 0);

        const newSubtotalDollars = rni + parts + glass;
        newSubtotalCents = Math.round(newSubtotalDollars * 100);

        const discountPercent =
          typeof invoice.discount_percent === "number" ? invoice.discount_percent : 0;
        const currentDiscountCents = invoice.discount_cents ?? 0;

        newDiscountCents = currentDiscountCents;
        if (discountPercent > 0) {
          newDiscountCents = Math.round(newSubtotalCents * (discountPercent / 100));
        }

        const taxableBaseCents = Math.max(0, newSubtotalCents - newDiscountCents);

        const taxRatePercent =
          typeof invoice.tax_rate_percent === "number" ? invoice.tax_rate_percent : 0;
        const currentTaxCents = invoice.tax_cents ?? 0;

        newTaxCents = currentTaxCents;
        if (taxRatePercent > 0) {
          newTaxCents = Math.round(taxableBaseCents * (taxRatePercent / 100));
        }

        newTotalCents = taxableBaseCents + newTaxCents;

        updatedServicesJson.customer_due_cents = newTotalCents;
        updatedServicesJson.insurance_due_cents = null;
      }

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
        .select("id, services_json, subtotal_cents, discount_cents, tax_cents, total_cents")
        .maybeSingle();

      if (error) {
        console.error("updatePricing tech_invoices error:", error);
        throw error;
      }

      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["tech-invoice-by-id", invoice.id],
      });

      queryClient.setQueryData(["tech-invoice-by-id", invoice.id], (old: any) =>
        old ? { ...old, ...(data ?? {}) } : data ?? old
      );
    },
  });

  const chipsGross = getChipTotal(chipCount);
  const cracksGross = getCrackTotal(crackCount);

  const insuranceFlatDollars = clampInsuranceCents(insuranceFlatCents) / 100;
  const insuranceSuffix = insuranceCoversRepairs
    ? ` (Ins ${dollars(insuranceFlatDollars)})`
    : "";

  const chipLineAmountDisplay = insuranceCoversRepairs
    ? `${dollars(0)}${insuranceSuffix}`
    : dollars(chipsGross);

  const crackLineAmountDisplay = insuranceCoversRepairs
    ? `${dollars(0)}${insuranceSuffix}`
    : dollars(cracksGross);

  return (
    <Card className="border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,221,128,0.08),rgba(58,58,63,0.22)_20%,rgba(30,30,34,0.58)_100%)] backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)] print:bg-white print:border-slate-200 print:shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-50 print:text-slate-900">
          <DollarSign className="w-5 h-5 text-amber-300" />
          Services Performed
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="mb-4 rounded-xl border border-white/10 bg-[rgba(42,42,46,0.44)] backdrop-blur-xl px-4 py-3 text-xs md:text-sm text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] print:hidden">
          <p className="mb-3 text-[11px] text-amber-100/62">
            Counts are for documentation. If{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-amber-100">
              <ShieldCheck className="w-3.5 h-3.5" />
              Insurance Covers Repairs
            </span>{" "}
            is ON, customer due stays{" "}
            <span className="font-semibold text-emerald-200">$0</span> and
            insurance is billed a flat amount.
          </p>

          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-[rgba(32,32,36,0.32)] px-3 py-2">
              <span className="text-amber-50/88">Chip repairs</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-amber-300/20 bg-[rgba(48,48,52,0.46)] px-2 py-1 text-xs text-amber-50 hover:bg-[rgba(60,60,66,0.56)]"
                  onClick={() => setChipCount((c) => (c > 0 ? c - 1 : 0))}
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  className="w-16 rounded border border-white/10 bg-[rgba(28,28,31,0.60)] px-2 py-1 text-right text-xs text-amber-50 outline-none"
                  value={chipCount}
                  onChange={(e) =>
                    setChipCount(Math.max(0, Number(e.target.value || 0)))
                  }
                />
                <button
                  type="button"
                  className="rounded border border-amber-300/20 bg-[rgba(48,48,52,0.46)] px-2 py-1 text-xs text-amber-50 hover:bg-[rgba(60,60,66,0.56)]"
                  onClick={() => setChipCount((c) => c + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-[rgba(32,32,36,0.32)] px-3 py-2">
              <span className="text-amber-50/88">Small cracks</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-amber-300/20 bg-[rgba(48,48,52,0.46)] px-2 py-1 text-xs text-amber-50 hover:bg-[rgba(60,60,66,0.56)]"
                  onClick={() => setCrackCount((c) => (c > 0 ? c - 1 : 0))}
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  className="w-16 rounded border border-white/10 bg-[rgba(28,28,31,0.60)] px-2 py-1 text-right text-xs text-amber-50 outline-none"
                  value={crackCount}
                  onChange={(e) =>
                    setCrackCount(Math.max(0, Number(e.target.value || 0)))
                  }
                />
                <button
                  type="button"
                  className="rounded border border-amber-300/20 bg-[rgba(48,48,52,0.46)] px-2 py-1 text-xs text-amber-50 hover:bg-[rgba(60,60,66,0.56)]"
                  onClick={() => setCrackCount((c) => c + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <label className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-[rgba(32,32,36,0.32)] px-3 py-2">
              <span className="inline-flex items-center gap-2 text-amber-50/88">
                <ShieldCheck className="h-4 w-4 text-amber-300" />
                Insurance covers repairs
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-amber-300/25 bg-transparent accent-amber-400"
                checked={insuranceCoversRepairs}
                onChange={(e) => setInsuranceCoversRepairs(e.target.checked)}
              />
            </label>
          </div>

          {insuranceCoversRepairs && (
            <div className="mb-3 rounded-lg border border-amber-300/20 bg-[linear-gradient(180deg,rgba(255,221,128,0.08),rgba(32,32,36,0.44)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/78">
                    Insurance Flat Price
                  </p>
                  <p className="text-[11px] text-amber-50/68">
                    Flat insurance amount is locked to $70.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-amber-100">
                  {dollars(insuranceFlatDollars)}
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-300/20 bg-[rgba(44,44,47,0.50)] text-amber-50 hover:bg-[rgba(58,58,63,0.60)]"
                  disabled={saveInsuranceFlatMutation.isPending}
                  onClick={() => {
                    setInsuranceUiTouched(true);
                    setInsuranceFlatCents(7000);
                    saveInsuranceFlatMutation.mutate(7000);
                  }}
                >
                  Set $70
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300/20 bg-[rgba(44,44,47,0.50)] text-amber-50 hover:bg-[rgba(58,58,63,0.60)]"
                  disabled={saveInsuranceFlatMutation.isPending}
                  onClick={() =>
                    saveInsuranceFlatMutation.mutate(clampInsuranceCents(insuranceFlatCents))
                  }
                >
                  {saveInsuranceFlatMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] md:text-xs">
            <div className="space-y-0.5">
              <p className="text-amber-50/72">
                Gross repairs:{" "}
                <span className="font-semibold text-amber-100">
                  {dollars(pricingPreview.gross)}
                </span>
              </p>

              {depositDollars > 0 && (
                <p className="text-amber-50/72">
                  Deposit applied:{" "}
                  <span className="font-semibold text-emerald-200">
                    -{dollars(depositDollars)}
                  </span>
                </p>
              )}

              {insuranceCoversRepairs ? (
                <>
                  <p className="text-amber-50/72">
                    Customer amount:{" "}
                    <span className="font-semibold text-emerald-200">{dollars(0)}</span>
                  </p>
                  <p className="text-amber-50/72">
                    Insurance due:{" "}
                    <span className="font-semibold text-amber-100">
                      {dollars(pricingPreview.insuranceDue)}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-amber-50/72">
                  Customer amount before deposit:{" "}
                  <span className="font-semibold text-emerald-200">
                    {dollars(pricingPreview.customerChargeable)}
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {updatePricingMutation.isError && (
                <span className="mr-2 text-[11px] text-red-400">
                  Failed to save, check console / Supabase RLS.
                </span>
              )}
              {updatePricingMutation.isSuccess && (
                <span className="mr-2 text-[11px] text-emerald-300">
                  Saved to invoice.
                </span>
              )}

              <Button
                size="sm"
                className="bg-gradient-to-r from-amber-300 to-yellow-400 text-xs font-semibold text-[#1a1208] hover:from-amber-200 hover:to-yellow-300"
                disabled={updatePricingMutation.isPending}
                onClick={() => updatePricingMutation.mutate()}
              >
                {updatePricingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Services"
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[rgba(34,34,38,0.52)] backdrop-blur-xl print:bg-white print:border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(46,46,50,0.60)] text-amber-100/72 print:bg-slate-100 print:text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>

            <tbody>
              {chipCount > 0 && (
                <tr className="border-t border-white/8 bg-[rgba(40,40,44,0.34)] print:border-slate-200 print:bg-white">
                  <td className="px-4 py-3 text-amber-50 print:text-slate-800">
                    Chip repair x{chipCount}
                    {insuranceCoversRepairs && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-200">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Covered
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-50 print:text-slate-900">
                    {chipLineAmountDisplay}
                  </td>
                </tr>
              )}

              {crackCount > 0 && (
                <tr className="border-t border-white/8 bg-[rgba(40,40,44,0.34)] print:border-slate-200 print:bg-white">
                  <td className="px-4 py-3 text-amber-50 print:text-slate-800">
                    Small crack x{crackCount}
                    {insuranceCoversRepairs && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-200">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Covered
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-50 print:text-slate-900">
                    {crackLineAmountDisplay}
                  </td>
                </tr>
              )}

              {depositDollars > 0 && (
                <tr className="border-t border-white/8 bg-[rgba(34,34,38,0.24)] print:border-slate-200 print:bg-slate-50">
                  <td className="px-4 py-3 text-emerald-100 print:text-emerald-800">
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Deposit Applied
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-100 print:text-emerald-800">
                    -{dollars(depositDollars)}
                  </td>
                </tr>
              )}

              {chipCount <= 0 && crackCount <= 0 && (
                <tr className="border-t border-white/8 bg-[rgba(40,40,44,0.34)] print:border-slate-200 print:bg-white">
                  <td className="px-4 py-3 text-amber-50/70 print:text-slate-700">
                    No glass services recorded yet
                  </td>
                  <td className="px-4 py-3 text-right text-amber-50/70 print:text-slate-700">
                    {dollars(0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-amber-100/58 print:text-slate-700">
          <p>
            Chip repairs:{" "}
            <span className="text-amber-50 print:text-slate-900">{chipCount}</span> ·
            Small cracks:{" "}
            <span className="text-amber-50 print:text-slate-900">{crackCount}</span> ·
            Deposit:{" "}
            <span className="text-amber-50 print:text-slate-900">
              {depositDollars > 0 ? dollars(depositDollars) : "None"}
            </span>{" "}
            · Insurance:{" "}
            <span className="text-amber-50 print:text-slate-900">
              {insuranceCoversRepairs ? `Yes (flat ${dollars(insuranceFlatDollars)})` : "No"}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};