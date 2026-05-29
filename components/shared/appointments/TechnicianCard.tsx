// components/shared/appointments/TechnicianCard.tsx
"use client";

import * as React from "react";
import { User as UserIcon, ShieldCheck, Star } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TechnicianCard({
  technician,
}: {
  technician: Record<string, any> | null;
}) {
  if (!technician) return null;

  const fullName =
    typeof technician.full_name === "string" && technician.full_name.trim()
      ? technician.full_name.trim()
      : "Assigned Technician";

  const initial = fullName.charAt(0).toUpperCase() || "T";

  const rating =
    technician.tech_rating !== null &&
    technician.tech_rating !== undefined &&
    technician.tech_rating !== ""
      ? Number(technician.tech_rating)
      : null;

  const hasValidRating = rating !== null && Number.isFinite(rating);

  return (
    <Card className="group relative overflow-hidden border border-amber-500/15 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.88))] shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {/* premium background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.10),transparent_24%)]"
      />

      {/* subtle top sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent"
      />

      <CardHeader className="relative pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-50">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <UserIcon className="h-4 w-4" />
          </span>

          <div className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold tracking-[0.01em] text-slate-50">
              Your Technician
            </span>
            <span className="text-xs font-medium text-slate-400">
              Assigned service professional
            </span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="relative pt-0">
        <div className="flex items-center gap-4 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.22),rgba(14,165,233,0.18))] text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
            <span className="text-lg font-bold tracking-[0.02em]">
              {initial}
            </span>

            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_45%)]"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-50">
              {fullName}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>

              {hasValidRating && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/15 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {rating.toFixed(1)} Rating
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}