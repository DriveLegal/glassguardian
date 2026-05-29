// components/user/dashboard/page/vehicleservice.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  Car,
  CheckCircle,
  Clock,
  FileText,
  PenLine,
  Shield,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CrackOutBadge, isCrackOut } from "@/components/user/dashboard/page/crackout";

export type BodyStyle =
  | "suv"
  | "crossover"
  | "sedan"
  | "pickup"
  | "coupe"
  | "luxury"
  | "convertible"
  | "hatchback"
  | "hybrid"
  | "minivan"
  | "sportscar"
  | "stationwagon";

export type VehicleServiceAppointment = {
  [x: string]: any;
  id: string;
  customer_email: string | null;
  service_type: string | null;
  status?: string | null;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  vehicle_id?: string | null;
  vehicle_plate?: string | null;
  repair_outcome?: "completed" | "crack_out" | null;
  crack_out_occurred?: boolean | null;
  scheduled_at?: string | null;
};

export type VehicleServiceVehicle = {
  id: string;
  owner_email: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  license_plate?: string | null;
  plate?: string | null;
  color?: string | null;
  body_type?: BodyStyle | null;
};

export type VehicleServiceWarranty = {
  id: string;
  customer_email: string | null;
  warranty_number: string;
  status: "active" | "expired" | "void";
  expiration_date: string;
};

export type VehicleServiceWaiverRow = {
  id: string;
  appointment_id: string;
  signer_role: string | null;
  signer_name: string | null;
  signer_email: string | null;
  initials: string | null;
  signature_name: string | null;
  waiver_version: string | null;
  waiver_text: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  signed_at: string | null;
  created_at: string | null;
};

const TRACK_STAGES = ["requested", "scheduled", "en_route", "on_site", "in_progress", "completed"];

const BODY_STYLE_IMAGE: Record<BodyStyle, string> = {
  suv: "/assets/vehicles/suv.png",
  crossover: "/assets/vehicles/crossover.png",
  sedan: "/assets/vehicles/sedan.png",
  pickup: "/assets/vehicles/pickup.png",
  coupe: "/assets/vehicles/coupe.png",
  luxury: "/assets/vehicles/luxury.png",
  convertible: "/assets/vehicles/convertible.png",
  hatchback: "/assets/vehicles/hatchback.png",
  hybrid: "/assets/vehicles/hybrid.png",
  minivan: "/assets/vehicles/minivan.png",
  sportscar: "/assets/vehicles/sportscar.png",
  stationwagon: "/assets/vehicles/stationwagon.png",
};

const BODY_HINTS: Record<BodyStyle, string[]> = {
  sedan: ["camry", "corolla", "accord", "civic", "elantra", "sonata", "altima"],
  suv: ["highlander", "4runner", "grand cherokee", "durango", "tahoe", "explorer"],
  crossover: ["rav4", "rav 4", "rogue", "sportage", "cx-5", "cx5", "escape"],
  pickup: ["tacoma", "tundra", "f-150", "f150", "silverado", "ram 1500", "ranger"],
  coupe: ["mustang", "challenger", "camaro", "brz", "gr86"],
  luxury: ["bmw", "mercedes", "amg", "audi", "lexus", "infiniti", "acura"],
  convertible: ["convertible", "miata", "boxster", "spyder"],
  hatchback: ["golf", "gti", "mazda3 hatch", "impreza hatch"],
  hybrid: ["prius", "hybrid", "phev", "plug-in", "bolt ev", "leaf", "model 3", "tesla"],
  minivan: ["sienna", "odyssey", "grand caravan", "pacifica", "carnival"],
  sportscar: ["supra", "gtr", "corvette", "911", "cayman"],
  stationwagon: ["outback", "v60", "alltrack", "a4 allroad"],
};

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

function getAppointmentDayISO(apt: VehicleServiceAppointment, tz = "America/Los_Angeles") {
  const scheduledAt = apt?.scheduled_at ?? null;
  const scheduledDate = apt?.scheduled_date ?? null;

  if (scheduledAt) {
    try {
      return isoDateInTZ(new Date(scheduledAt), tz);
    } catch {}
  }

  if (scheduledDate) return String(scheduledDate).slice(0, 10);
  return null;
}

function isDayOfAppointment(apt: VehicleServiceAppointment, tz = "America/Los_Angeles") {
  const day = getAppointmentDayISO(apt, tz);
  if (!day) return false;

  const today = isoDateInTZ(new Date(), tz);
  return today === day;
}

function isWaiverSigned(row: VehicleServiceWaiverRow | null | undefined) {
  if (!row) return false;

  return Boolean(
    (row.signed_at && String(row.signed_at).trim()) ||
      (row.signature_name && String(row.signature_name).trim()) ||
      (row.initials && String(row.initials).trim())
  );
}

function trimTime(t?: string | null) {
  const value = (t ?? "").trim();
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function timeInTZLabel(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function getAppointmentTimeLabel(apt: VehicleServiceAppointment, tz = "America/Los_Angeles") {
  const startRaw = trimTime(apt.scheduled_time_start);
  const endRaw = trimTime(apt.scheduled_time_end);

  if (startRaw) return endRaw ? `${startRaw} – ${endRaw}` : startRaw;

  if (apt.scheduled_at) {
    const start = timeInTZLabel(apt.scheduled_at, tz);
    if (start) return start;
  }

  return null;
}

function safeDayLabelFromYYYYMMDD(yyyyMMdd?: string | null) {
  const value = (yyyyMMdd ?? "").slice(0, 10);
  if (!value) return "Date TBA";

  try {
    return format(parseISO(value), "EEE, MMM d");
  } catch {
    try {
      return format(new Date(value), "EEE, MMM d");
    } catch {
      return "Date TBA";
    }
  }
}

function mapColorToHex(color?: string | null): string {
  if (!color) return "#cbd5e1";

  const c = color.toLowerCase().trim();

  if (c.includes("white")) return "#e5e7eb";
  if (c.includes("black")) return "#111827";
  if (c.includes("silver") || c.includes("grey") || c.includes("gray")) return "#9ca3af";
  if (c.includes("blue")) return "#94a3b8";
  if (c.includes("red")) return "#a1a1aa";
  if (c.includes("green")) return "#a3a3a3";
  if (c.includes("yellow") || c.includes("gold")) return "#d4d4d8";
  if (c.includes("orange")) return "#a8a29e";
  if (c.includes("purple")) return "#a1a1aa";
  if (c.includes("brown")) return "#78716c";

  return "#64748b";
}

function inferBodyStyle(vehicle: VehicleServiceVehicle): BodyStyle {
  if (vehicle.body_type) return vehicle.body_type;

  const name = `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.toLowerCase();

  for (const hint of BODY_HINTS.hybrid) {
    if (name.includes(hint)) return "hybrid";
  }

  const order: BodyStyle[] = [
    "pickup",
    "minivan",
    "suv",
    "crossover",
    "stationwagon",
    "hatchback",
    "sportscar",
    "convertible",
    "coupe",
    "luxury",
    "sedan",
  ];

  for (const style of order) {
    for (const hint of BODY_HINTS[style]) {
      if (name.includes(hint)) return style;
    }
  }

  return "sedan";
}

function prettyBodyLabel(style: BodyStyle): string {
  if (style === "stationwagon") return "Station Wagon";
  if (style === "pickup") return "Pickup Truck";
  if (style === "sportscar") return "Sportscar";
  if (style === "hybrid") return "Hybrid / Electric";
  return style.charAt(0).toUpperCase() + style.slice(1);
}

function getStatusColor(status?: string | null) {
  const colors: Record<string, string> = {
    requested: "bg-slate-100 text-slate-800 border-slate-200",
    estimating: "bg-slate-100 text-slate-800 border-slate-200",
    approved: "bg-slate-100 text-slate-800 border-slate-200",
    scheduled: "bg-slate-100 text-slate-800 border-slate-200",
    en_route: "bg-slate-100 text-slate-800 border-slate-200",
    on_site: "bg-slate-100 text-slate-800 border-slate-200",
    in_progress: "bg-slate-100 text-slate-800 border-slate-200",
    completed: "bg-slate-100 text-slate-800 border-slate-200",
    paid: "bg-slate-100 text-slate-800 border-slate-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const key = (status ?? "").toLowerCase();
  return colors[key] || "bg-gray-100 text-gray-800 border-gray-200";
}

function getStatusGlowClass(status?: string | null, danger = false) {
  if (danger) return "gg-status-warm";
  return "gg-status-graphite";
}

function resolveVehicleForAppointment(
  apt: VehicleServiceAppointment,
  vehicles: VehicleServiceVehicle[]
): VehicleServiceVehicle | null {
  if (!vehicles || vehicles.length === 0) return null;

  if (apt.vehicle_id) {
    const byId = vehicles.find((vehicle) => vehicle.id === apt.vehicle_id);
    if (byId) return byId;
  }

  const aptPlate = apt.vehicle_plate?.toLowerCase().trim();
  if (aptPlate) {
    const byPlate = vehicles.find((vehicle) => {
      const plate = (vehicle.license_plate || vehicle.plate || "").toLowerCase().trim();
      return plate && plate === aptPlate;
    });

    if (byPlate) return byPlate;
  }

  if (vehicles.length === 1) return vehicles[0];

  return null;
}

function fireMicroHaptic() {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  try {
    navigator.vibrate(7);
  } catch {}
}

function TiltWrap({
  children,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-5, 5]);

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || prefersReducedMotion) return;

    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left) / rect.width - 0.5);
    y.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={onMouseMove}
      onMouseEnter={fireMicroHaptic}
      onMouseLeave={onMouseLeave}
      style={
        prefersReducedMotion || disabled
          ? undefined
          : {
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
            }
      }
      transition={{ type: "spring", stiffness: 180, damping: 24, mass: 0.7 }}
      className={`gg-tilt-wrap ${className}`}
    >
      {children}
    </motion.div>
  );
}

export default function VehicleServiceHUD({
  appointments,
  vehicles,
  warranties,
  totalServices,
  waiverForAppointmentIdAction,
}: {
  appointments: VehicleServiceAppointment[];
  vehicles: VehicleServiceVehicle[];
  warranties: VehicleServiceWarranty[];
  totalServices: number;
  waiverForAppointmentIdAction: (appointmentId: string) => VehicleServiceWaiverRow | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (!appointments || appointments.length === 0) return null;

  const primaryAppointment = appointments[0];
  const primaryVehicle = resolveVehicleForAppointment(primaryAppointment, vehicles);

  const activeCount = appointments.length;
  const warrantyCount = warranties.length;

  const name =
    primaryVehicle && (primaryVehicle.make || primaryVehicle.model || primaryVehicle.year)
      ? `${primaryVehicle.year ? `${primaryVehicle.year} ` : ""}${primaryVehicle.make ?? ""} ${
          primaryVehicle.model ?? ""
        }`.trim()
      : "Vehicle in service";

  const rawPlate =
    primaryVehicle?.license_plate ??
    primaryVehicle?.plate ??
    primaryAppointment.vehicle_plate ??
    undefined;

  const plate = rawPlate && rawPlate.trim().length > 0 ? rawPlate.toUpperCase() : "Plate on file";

  const bodyStyle: BodyStyle = primaryVehicle ? inferBodyStyle(primaryVehicle) : "sedan";
  const prettyBody = prettyBodyLabel(bodyStyle);
  const imageSrc = BODY_STYLE_IMAGE[bodyStyle];
  const colorHex = mapColorToHex(primaryVehicle?.color);

  let glassHealth = "Waiting";
  if (primaryVehicle) {
    if (activeCount > 0) glassHealth = "In progress";
    else if (warrantyCount > 0 || totalServices > 0) glassHealth = "Optimized";
    else glassHealth = "Monitor";
  }

  const showAppointments = appointments.slice(0, 3);
  const tz = "America/Los_Angeles";

  return (
    <TiltWrap disabled={!!prefersReducedMotion}>
      <div className="gg-hud-card mt-6 relative min-h-[260px] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/65 md:min-h-[240px]">
        <div className="gg-card-particles" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_-10%,rgba(255,255,255,0.13),transparent_55%),radial-gradient(circle_at_90%_120%,rgba(226,232,240,0.10),transparent_55%),linear-gradient(135deg,rgba(30,41,59,0.92),rgba(2,6,23,0.72))]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light bg-[repeating-linear-gradient(to_bottom,rgba(226,232,240,0.14)_0,rgba(226,232,240,0.14)_1px,transparent_1px,transparent_3px)]" />

        <div className="relative z-10 flex h-full flex-col md:flex-row">
          <div className="flex flex-1 flex-col items-center justify-center px-5 py-4 md:items-start md:px-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.055] px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-slate-200">
              <span className="gg-live-dot" />
              Vehicles In Service
            </div>

            <div className="mb-1 text-sm font-semibold text-slate-100">{name}</div>

            <div className="mb-1 text-[0.7rem] text-slate-300/90">
              {primaryVehicle ? prettyBody : "Active vehicle"}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-300/90">
              <span>
                Plate{" "}
                <span className="inline-flex items-center rounded-md bg-slate-950/70 px-2 py-0.5 text-[0.7rem] tracking-[0.15em] text-slate-100 border border-slate-600/70">
                  {plate}
                </span>
              </span>

              <span className="inline-flex items-center rounded-md bg-white/[0.055] border border-white/14 px-2 py-0.5 text-[0.7rem] text-slate-200">
                Glass health: <span className="ml-1 font-semibold">{glassHealth}</span>
              </span>

              {isCrackOut(primaryAppointment) && <CrackOutBadge />}
            </div>

            <div className="mb-3 flex flex-wrap gap-3 text-[0.7rem] text-slate-300/90">
              <span className="inline-flex items-center gap-1">
                <Car className="w-3 h-3" />
                {activeCount} active {activeCount === 1 ? "vehicle" : "vehicles"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {warrantyCount} warranties
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {totalServices} total visits
              </span>
            </div>

            <motion.div
              initial={
                prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.97 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 1, y: [0, -3, 0], scale: 1 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : {
                      opacity: { duration: 0.45 },
                      y: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                    }
              }
              className="relative mt-2 h-[130px] w-[260px] max-w-full"
            >
              <div
                className="absolute inset-[-30%] blur-2xl opacity-60"
                style={{
                  background: `radial-gradient(circle at 50% 60%, ${colorHex}, transparent 60%)`,
                }}
                aria-hidden="true"
              />

              <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/75 flex items-center justify-center shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
                <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-white/12 backdrop-blur-sm border border-white/16 text-[0.65rem] font-semibold tracking-wide text-white shadow-[0_0_10px_rgba(0,0,0,0.25)]">
                  LIVE · In Service
                </div>

                {primaryVehicle ? (
                  <Image
                    src={imageSrc}
                    alt={`${prettyBody} illustration`}
                    fill
                    priority
                    sizes="(min-width: 1024px) 320px, 100vw"
                    className="pointer-events-none select-none object-contain object-center scale-105 contrast-110 brightness-105 drop-shadow-[0_22px_28px_rgba(0,0,0,0.45)]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                    <Car className="w-7 h-7" />
                    <span>Vehicle details will appear here</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="flex flex-1 flex-col gap-4 border-t border-slate-700/60 bg-slate-950/35 px-5 py-4 md:border-l md:border-t-0 md:px-6 md:py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                  Current vehicle tracker
                </div>
                <div className="text-xs text-slate-300">Live status on your open services</div>
              </div>

              <Link href="/user/dashboard/appointments">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[0.7rem] text-slate-100 hover:text-slate-100 border border-slate-600/70 hover:bg-slate-900/60 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                >
                  View all
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>

            <div className="space-y-3 text-xs">
              {showAppointments.map((apt) => {
                const vehicle = resolveVehicleForAppointment(apt, vehicles);

                const vehicleLabel =
                  vehicle && (vehicle.make || vehicle.model || vehicle.year)
                    ? `${vehicle.year ? `${vehicle.year} ` : ""}${vehicle.make ?? ""} ${
                        vehicle.model ?? ""
                      }`.trim()
                    : (apt.service_type ?? "Windshield service").replace(/_/g, " ").toUpperCase();

                const statusRaw = (apt.status || "").toLowerCase();
                const statusIndex =
                  TRACK_STAGES.indexOf(statusRaw) === -1 ? 0 : TRACK_STAGES.indexOf(statusRaw);

                const displayStatus = (apt.status ?? "").replace(/_/g, " ") || "requested";

                const dayLabel = apt.scheduled_date
                  ? safeDayLabelFromYYYYMMDD(apt.scheduled_date)
                  : "Date TBA";

                const timeLabel = getAppointmentTimeLabel(apt, tz);

                const plateLabel = vehicle?.license_plate ?? vehicle?.plate ?? apt.vehicle_plate ?? null;

                const crackOut = isCrackOut(apt);
                const dayOf = isDayOfAppointment(apt, tz);
                const waiverRow = waiverForAppointmentIdAction(apt.id);
                const waiverSigned = isWaiverSigned(waiverRow);
                const waiverMissing = dayOf && !waiverSigned;
                const glowClass = getStatusGlowClass(apt.status, waiverMissing || crackOut);

                return (
                  <motion.div
                    key={apt.id}
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 160, damping: 20 }}
                    className={`gg-status-card ${glowClass} rounded-xl border px-3 py-2.5 ${
                      waiverMissing ? "border-slate-400/50 bg-white/[0.055]" : "border-slate-700/70 bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Car className="w-3.5 h-3.5 text-slate-300" />

                          <span className="font-medium text-slate-50 text-[0.78rem]">
                            {vehicleLabel}
                          </span>

                          {crackOut && <CrackOutBadge compact />}

                          {dayOf && (
                            <span
                              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border ${
                                waiverSigned
                                  ? "bg-white/[0.055] border-white/14 text-slate-200"
                                  : "bg-white/[0.065] border-white/18 text-slate-100"
                              }`}
                            >
                              {waiverSigned ? (
                                <>
                                  <ShieldCheck className="w-3 h-3 mr-1" />
                                  Waiver signed
                                </>
                              ) : (
                                <>
                                  <PenLine className="w-3 h-3 mr-1" />
                                  Waiver required
                                </>
                              )}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-300">
                          <span>{dayLabel}</span>

                          {timeLabel && <span className="text-slate-100 font-medium">{timeLabel}</span>}

                          {plateLabel && (
                            <span className="inline-flex items-center rounded-md border border-slate-600 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-slate-200">
                              {plateLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.68rem] font-medium border ${getStatusColor(
                            apt.status
                          )}`}
                        >
                          {statusRaw === "en_route" && <Clock className="w-3.5 h-3.5 mr-1" />}
                          {statusRaw === "completed" && <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                          {displayStatus}
                        </div>

                        {dayOf && !waiverSigned && (
                          <Link href={`/user/dashboard/appointments/${apt.id}/waiver`}>
                            <Button
                              size="sm"
                              className="h-8 px-3 text-[0.72rem] bg-slate-100 hover:bg-white text-slate-950 font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                            >
                              Sign Waiver
                              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                          </Link>
                        )}

                        {dayOf && waiverSigned && (
                          <Link href={`/user/dashboard/appointments/${apt.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-[0.72rem] border-slate-500/60 text-slate-100 hover:bg-white/[0.055] transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                            >
                              View Details
                              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                          </Link>
                        )}

                        {!dayOf && (
                          <Link href={`/user/dashboard/appointments/${apt.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-[0.72rem] border-slate-600/70 bg-slate-950/40 text-slate-100 hover:bg-slate-900/60 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                            >
                              Open
                              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-1">
                      {TRACK_STAGES.map((stage, idx) => {
                        if (idx === TRACK_STAGES.length - 1) {
                          return (
                            <span
                              key={stage}
                              className={`w-2 h-2 rounded-full ${
                                idx <= statusIndex
                                  ? "bg-slate-200 shadow-[0_0_14px_rgba(226,232,240,0.55)]"
                                  : "bg-slate-600"
                              }`}
                            />
                          );
                        }

                        return (
                          <React.Fragment key={stage}>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                idx <= statusIndex
                                  ? "bg-slate-200 shadow-[0_0_14px_rgba(226,232,240,0.55)]"
                                  : "bg-slate-600"
                              }`}
                            />
                            <span
                              className={`h-[2px] flex-1 ${
                                idx < statusIndex
                                  ? "bg-slate-300/80 shadow-[0_0_10px_rgba(226,232,240,0.35)]"
                                  : "bg-slate-700"
                              }`}
                            />
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {dayOf && !waiverSigned && (
                      <div className="mt-2 rounded-lg border border-slate-400/30 bg-white/[0.055] px-3 py-2">
                        <p className="text-[0.7rem] text-slate-200">
                          Today is your service day — please sign the waiver before your technician begins work.
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {appointments.length > showAppointments.length && (
                <p className="text-[0.7rem] text-slate-400">
                  + {appointments.length - showAppointments.length} more in service
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </TiltWrap>
  );
}