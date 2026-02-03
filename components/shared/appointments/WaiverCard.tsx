// components/shared/appointments/WaiverCard.tsx
"use client";

import * as React from "react";
import { ArrowRight, CheckCircle, ShieldCheck, TriangleAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function WaiverCard({
  requiresWaiver,
  waiverSigned,
  waiverRulesReason,
  onOpenWaiver,
  signerName,
  initials,
}: {
  requiresWaiver: boolean;
  waiverSigned: boolean;
  waiverRulesReason?: string | null;
  onOpenWaiver: () => void;
  signerName?: string | null;
  initials?: string | null;
}) {
  if (!requiresWaiver) return null;

  return (
    <Card className="border border-slate-800 bg-slate-950/80 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-slate-50">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-300" />
            Service Waiver
          </span>

          {waiverSigned ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-emerald-500/15 border border-emerald-400/40 text-emerald-100">
              Signed
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-amber-500/10 border border-amber-400/40 text-amber-100">
              Required
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {waiverSigned ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-slate-100">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-300 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Signed</p>
                <p className="text-xs text-slate-300">
                  {signerName ? `Name: ${signerName}` : ""}
                  {initials ? ` • Initials: ${initials}` : ""}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">
            <div className="flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-300 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Waiver must be signed day-of</p>
                <p className="text-xs text-amber-100/90">
                  You can review now. Signing opens on the day of service (local time).
                </p>
              </div>
            </div>
          </div>
        )}

        {!waiverSigned && waiverRulesReason ? (
          <p className="text-xs text-slate-400">{waiverRulesReason}</p>
        ) : null}

        <Button
          variant="outline"
          className="w-full border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
          onClick={onOpenWaiver}
        >
          {waiverSigned ? "View Signed Waiver" : "Review / Sign Waiver"}
          <ArrowRight className="w-4 h-4 ml-2 opacity-80" />
        </Button>
      </CardContent>
    </Card>
  );
}