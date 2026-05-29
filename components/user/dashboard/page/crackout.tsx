//components/user/dashboard/page/crackout.tsx
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

export type CrackOutAppointment = {
  id: string;
  service_type: string | null;
  status?: string | null;
  scheduled_date?: string | null;
  repair_outcome?: "completed" | "crack_out" | string | null;
  crack_out_occurred?: boolean | null;
};

export function isCrackOut(appointment: CrackOutAppointment | null | undefined) {
  if (!appointment) return false;
  return appointment.crack_out_occurred === true || appointment.repair_outcome === "crack_out";
}

export function findCrackOutAppointment<T extends CrackOutAppointment>(appointments: T[]) {
  if (!appointments || appointments.length === 0) return null;

  return (
    appointments.find(
      (appointment) =>
        isCrackOut(appointment) &&
        ["completed", "paid"].includes((appointment.status ?? "").toLowerCase())
    ) ??
    appointments.find((appointment) => isCrackOut(appointment)) ??
    null
  );
}

export function CrackOutBadge({
  compact = false,
}: {
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-white/[0.06] border border-white/14 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-200">
        <TriangleAlert className="w-3 h-3 mr-1" />
        Crack-out
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md bg-white/[0.055] border border-white/14 px-2 py-0.5 text-[0.7rem] text-slate-200">
      <TriangleAlert className="w-3.5 h-3.5 mr-1" />
      Crack-out reported
    </span>
  );
}

export function CrackOutApologyDialog({
  appointment,
  open,
  onOpenChangeAction,
}: {
  appointment: CrackOutAppointment;
  open: boolean;
  onOpenChangeAction: (value: boolean) => void;
}) {
  const serviceLabel = (appointment.service_type ?? "windshield service")
    .replace(/_/g, " ")
    .toUpperCase();

  const when =
    appointment.scheduled_date && appointment.scheduled_date.length > 0
      ? appointment.scheduled_date
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-lg border border-slate-400/30 bg-slate-950/95 text-slate-50 backdrop-blur-xl shadow-[0_30px_120px_rgba(15,23,42,0.7)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <HeartHandshake className="w-5 h-5 text-slate-300" />
            A quick note from Glass Guardian
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            We want to be transparent and respectful of your time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-slate-400/25 bg-white/[0.055] p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 mt-0.5 text-slate-200" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-100">
                  During your {serviceLabel}
                  {when ? ` on ${when}` : ""}, a crack-out occurred.
                </p>
                <p className="text-slate-200/90">
                  This is rare, but it can happen with pre-stressed glass or certain impact patterns.
                  Either way — we’re sorry for the inconvenience.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-semibold text-slate-100">Here’s what you can expect:</p>
            <ul className="mt-2 space-y-2 text-slate-200/90">
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span>Your service is documented clearly so you always know what happened.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span>If replacement is required, we’ll guide you through next steps per policy.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span>You’ll get honest updates — and we treat your car like it’s ours.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-400/20 bg-white/[0.045] p-4">
            <p className="text-slate-100 font-semibold">We’re built for long-term trust.</p>
            <p className="text-slate-300 mt-1">
              We’ll keep you informed, we’ll make it right, and we’ll keep it professional — every time.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Link href="/user/dashboard/appointments" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
            >
              View Appointments
            </Button>
          </Link>

          <Link href={`/user/dashboard/appointments/${appointment.id}`} className="w-full sm:w-auto">
            <Button className="w-full bg-slate-100 hover:bg-white text-slate-950 font-semibold">
              Open Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}