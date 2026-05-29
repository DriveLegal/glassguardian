"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import VehicleServiceHUD, {
  type VehicleServiceAppointment,
  type VehicleServiceVehicle,
  type VehicleServiceWarranty,
  type VehicleServiceWaiverRow,
} from "@/components/user/dashboard/page/vehicleservice";

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

export default function DashboardHero({
  displayName,
  loadingAppUserName,
  showPersonalizing,
  enableVehicleHud,
  activeAppointments,
  vehicles,
  warranties,
  totalServices,
  waiverForAppointmentIdAction,
}: {
  displayName: string;
  loadingAppUserName: boolean;
  showPersonalizing: boolean;
  enableVehicleHud: boolean;
  activeAppointments: VehicleServiceAppointment[];
  vehicles: VehicleServiceVehicle[];
  warranties: VehicleServiceWarranty[];
  totalServices: number;
  waiverForAppointmentIdAction: (appointmentId: string) => VehicleServiceWaiverRow | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <GlassCard className="mb-8" glow="graphite">
      <div className="relative p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.46, ease: [0.22, 1, 0.36, 1] }}
          className="mb-2"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.055] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-200">
            <Sparkles className="h-3.5 w-3.5" />
            Glass Guardian Command Center
          </div>

          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-50 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Welcome back, {displayName}! 👋
          </h1>

          <p className="text-sm md:text-base text-slate-300 mt-2">
            Your Windshield Repair Command Center — track repairs, manage your garage, and keep every
            warranty at your fingertips.
          </p>

          {showPersonalizing && loadingAppUserName && (
            <p className="mt-2 text-[0.7rem] text-slate-400">Personalizing your dashboard…</p>
          )}
        </motion.div>

        {enableVehicleHud && activeAppointments.length > 0 && (
          <VehicleServiceHUD
            appointments={activeAppointments}
            vehicles={vehicles}
            warranties={warranties}
            totalServices={totalServices}
            waiverForAppointmentIdAction={waiverForAppointmentIdAction}
          />
        )}
      </div>
    </GlassCard>
  );
}