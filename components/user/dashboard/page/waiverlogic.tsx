// components/user/dashboard/page/waiverlogic.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, PenLine, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  type VehicleServiceAppointment,
  type VehicleServiceWaiverRow,
} from "@/components/user/dashboard/page/vehicleservice";

export type WaiverLogicAppointment = VehicleServiceAppointment;
export type WaiverLogicRow = VehicleServiceWaiverRow;

function fireMicroHaptic() {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  try {
    navigator.vibrate(7);
  } catch {}
}

function GlassCard({
  children,
  className = "",
  glow = "graphite",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "graphite" | "warm";
}) {
  const prefersReducedMotion = useReducedMotion();
  const glowClass = glow === "warm" ? "gg-card-warm" : "gg-card-graphite";

  return (
    <motion.article
      whileHover={prefersReducedMotion ? undefined : { y: -5, scale: 1.006 }}
      transition={{ type: "spring", stiffness: 230, damping: 26, mass: 0.8 }}
      className={`gg-glass-card ${glowClass} ${className}`}
      role="region"
      onMouseEnter={fireMicroHaptic}
    >
      <div className="gg-card-particles" aria-hidden="true" />
      <div className="pointer-events-none absolute -inset-x-8 -top-24 h-44 bg-gradient-to-tr from-white/16 to-transparent opacity-18 blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.12),transparent_34%),radial-gradient(circle_at_90%_90%,rgba(226,232,240,0.08),transparent_38%)]" />
      <div className="relative z-10 p-4 md:p-6">{children}</div>
    </motion.article>
  );
}

function isoDateInTZ(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getAppointmentDayISO(
  appointment: WaiverLogicAppointment,
  tz = "America/Los_Angeles"
) {
  const scheduledAt = appointment?.scheduled_at ?? null;
  const scheduledDate = appointment?.scheduled_date ?? null;

  if (scheduledAt) {
    try {
      return isoDateInTZ(new Date(scheduledAt), tz);
    } catch {}
  }

  if (scheduledDate) return String(scheduledDate).slice(0, 10);
  return null;
}

export function isDayOfAppointment(
  appointment: WaiverLogicAppointment,
  tz = "America/Los_Angeles"
) {
  const day = getAppointmentDayISO(appointment, tz);
  if (!day) return false;

  const today = isoDateInTZ(new Date(), tz);
  return today === day;
}

export function isSameEmail(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
}

export function isWaiverSigned(row: WaiverLogicRow | null | undefined) {
  if (!row) return false;

  return Boolean(
    (row.signed_at && String(row.signed_at).trim()) ||
      (row.signature_name && String(row.signature_name).trim()) ||
      (row.initials && String(row.initials).trim())
  );
}

export function useDashboardWaiverLogic({
  appointments,
  userEmail,
  timezone = "America/Los_Angeles",
}: {
  appointments: WaiverLogicAppointment[];
  userEmail?: string | null;
  timezone?: string;
}) {
  const [waiversByAppointmentId, setWaiversByAppointmentId] = React.useState<
    Record<string, WaiverLogicRow>
  >({});
  const [loadingWaivers, setLoadingWaivers] = React.useState(false);

  const dayOfAppointments = React.useMemo(() => {
    if (!userEmail) return [];

    return appointments.filter(
      (appointment) =>
        isSameEmail(appointment.customer_email, userEmail) &&
        isDayOfAppointment(appointment, timezone)
    );
  }, [appointments, userEmail, timezone]);

  const waiverForAppointmentIdAction = React.useCallback(
    (appointmentId: string) => {
      return waiversByAppointmentId[appointmentId] ?? null;
    },
    [waiversByAppointmentId]
  );

  const refreshWaiversAction = React.useCallback(async () => {
    if (!userEmail) return;
    if (!dayOfAppointments || dayOfAppointments.length === 0) return;

    setLoadingWaivers(true);

    try {
      const ids = dayOfAppointments.map((appointment) => appointment.id);

      const { data, error } = await supabaseClient
        .from("appointment_waivers")
        .select(
          [
            "id",
            "appointment_id",
            "signer_role",
            "signer_name",
            "signer_email",
            "initials",
            "signature_name",
            "waiver_version",
            "waiver_text",
            "signed_ip",
            "signed_user_agent",
            "signed_at",
            "created_at",
          ].join(",")
        )
        .in("appointment_id", ids);

      if (error) {
        setWaiversByAppointmentId({});
        return;
      }

      const map: Record<string, WaiverLogicRow> = {};

      for (const row of (data ?? []) as any[]) {
        map[row.appointment_id] = row as WaiverLogicRow;
      }

      setWaiversByAppointmentId(map);
    } catch {
      setWaiversByAppointmentId({});
    } finally {
      setLoadingWaivers(false);
    }
  }, [userEmail, dayOfAppointments]);

  React.useEffect(() => {
    if (!userEmail) return;
    if (!dayOfAppointments || dayOfAppointments.length === 0) return;

    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await refreshWaiversAction();
    })();

    return () => {
      cancelled = true;
    };
  }, [userEmail, dayOfAppointments, refreshWaiversAction]);

  React.useEffect(() => {
    const onFocus = () => void refreshWaiversAction();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshWaiversAction();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshWaiversAction]);

  const waiverDueAppointment = React.useMemo(() => {
    if (!userEmail) return null;
    if (!dayOfAppointments || dayOfAppointments.length === 0) return null;

    return (
      dayOfAppointments.find(
        (appointment) => !isWaiverSigned(waiverForAppointmentIdAction(appointment.id))
      ) ?? null
    );
  }, [userEmail, dayOfAppointments, waiverForAppointmentIdAction]);

  return {
    dayOfAppointments,
    waiverDueAppointment,
    waiversByAppointmentId,
    loadingWaivers,
    refreshWaiversAction,
    waiverForAppointmentIdAction,
  };
}

export default function WaiverLogic({
  waiverDueAppointment,
  refreshWaiversAction,
}: {
  waiverDueAppointment: WaiverLogicAppointment | null;
  refreshWaiversAction: () => void | Promise<void>;
}) {
  if (!waiverDueAppointment) return null;

  return (
    <GlassCard className="mb-6" glow="graphite">
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <PenLine className="w-5 h-5 text-slate-200" />
        </div>

        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            Waiver required today
            <span className="inline-flex items-center rounded-full bg-white/[0.055] border border-white/14 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-200">
              Priority
            </span>
          </h2>

          <p className="mt-1 text-xs text-slate-300">
            Today is your appointment day — please sign the waiver before your technician begins work.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/user/dashboard/appointments/${waiverDueAppointment.id}/waiver`}>
              <Button className="bg-slate-100 hover:bg-white text-slate-950 font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]">
                Sign Waiver Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <Link href={`/user/dashboard/appointments/${waiverDueAppointment.id}`}>
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
              >
                View Appointment
              </Button>
            </Link>
          </div>

          <p className="mt-2 text-[0.7rem] text-slate-400">
            If you just signed, this will clear automatically when the page refreshes.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}