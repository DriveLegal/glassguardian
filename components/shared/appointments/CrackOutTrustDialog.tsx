// components/shared/appointments/CrackOutTrustDialog.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, HeartHandshake, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import type { AnyObj } from "@/lib/appointments/helpers";
import { crackOutSummary } from "@/lib/appointments/helpers";

export function CrackOutTrustDialog({
  appointment,
  open,
  onOpenChange,
  canViewInvoice,
}: {
  appointment: AnyObj;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canViewInvoice: boolean;
}) {
  const { cause, notes, occurredAt } = crackOutSummary(appointment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-amber-400/40 bg-slate-950/95 text-slate-50 backdrop-blur-xl shadow-[0_30px_120px_rgba(251,191,36,0.14)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-100">
            <HeartHandshake className="w-5 h-5 text-amber-300" />
            A quick note from Glass Guardian
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Clear documentation + real accountability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 mt-0.5 text-amber-300" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  A crack-out occurred during your repair
                  {occurredAt ? ` (${occurredAt})` : ""}.
                </p>
                <p className="text-slate-200/90">
                  This can happen with pre-stressed glass or certain impact
                  patterns. Either way — we’re sorry for the inconvenience, and
                  we’re committed to handling it the right way.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-semibold text-slate-100">What happens next:</p>
            <ul className="mt-2 space-y-2 text-slate-200/90">
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  Your documentation is saved to your appointment and invoice.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  If a replacement is needed, we’ll guide the next steps and
                  keep you updated.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  Our goal is long-term trust — honest updates and a fair
                  outcome.
                </span>
              </li>
            </ul>
          </div>

          {(cause || notes) && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold text-slate-200 mb-2">Notes</p>
              <p className="text-xs text-slate-300">
                {cause ? `Cause: ${cause}. ` : ""}
                {notes ? notes : ""}
              </p>
            </div>
          )}

          {appointment?.crack_out_photo_url && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold text-slate-200 mb-2">
                Photo documentation
              </p>
              <div className="relative overflow-hidden rounded-lg border border-slate-700/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(appointment.crack_out_photo_url)}
                  alt="Crack-out documentation"
                  className="w-full max-h-[240px] object-cover"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          {canViewInvoice ? (
            <Link
              href={`/user/dashboard/pay/${appointment.id}`}
              className="w-full sm:w-auto"
            >
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                View Invoice
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              className="w-full sm:w-auto bg-slate-800 text-slate-300 cursor-not-allowed"
              title="Invoice will appear once your technician creates it."
            >
              Invoice not ready
              <ArrowRight className="w-4 h-4 ml-2 opacity-60" />
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full sm:w-auto border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}