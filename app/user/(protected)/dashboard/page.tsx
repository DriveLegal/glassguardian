// app/user/(protected)/dashboard/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  Car,
  Shield,
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  TriangleAlert,
  HeartHandshake,
  Sparkles,
  PenLine,
  ShieldCheck,
  RefreshCw,
  LogIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseClient } from "@/lib/supabaseClient";
import DevBanner from "@/components/DevBanner";

import {
  readDevRoleFromCookie,
  makeDevUser,
  devFetchAppointments,
  devFetchVehicles,
  devFetchWarranties,
  type DevRole,
} from "@/lib/devSim";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ENABLE_3D = process.env.NEXT_PUBLIC_ENABLE_3D !== "false";

/* ============================================================
   Types
============================================================ */

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

type User = {
  id: string;
  email: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role?: DevRole | string | null;
  };
};

type Appointment = {
  [x: string]: any;
  id: string;
  customer_email: string | null;
  service_type: string | null;
  status?: string | null;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  service_address?: string | null;
  eta_minutes?: number | null;

  vehicle_id?: string | null;
  vehicle_plate?: string | null;

  repair_outcome?: "completed" | "crack_out" | null;
  crack_out_occurred?: boolean | null;
  crack_out_cause?: string | null;
  crack_out_notes?: string | null;
  crack_out_photo_url?: string | null;
  crack_out_at?: string | null;
  replacement_required?: boolean | null;

  // sometimes your DB may rely on a single timestamp
  scheduled_at?: string | null;

  created_at?: string | null;
};

type Vehicle = {
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

type Warranty = {
  id: string;
  customer_email: string | null;
  warranty_number: string;
  status: "active" | "expired" | "void";
  expiration_date: string;
};

/**
 * ✅ FIXED: matches your actual appointment_waivers columns
 * (no more `full_name` references)
 */
type WaiverRow = {
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

/**
 * ✅ FIXED: tech_invoices has NO user_id — filter by customer_email or appointment_id
 */
type TechInvoice = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  created_at: string | null;
  invoice_date: string | null;

  appointment_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  service_address: string | null;

  subtotal_cents: number | null;
  total_cents: number | null;
  final_paid_cents: number | null;

  paid_at: string | null;
  payment_method: string | null;

  crack_out_occurred: boolean | null;
  repair_outcome: string | null;
};

/* ============================================================
   Waiver helpers
============================================================ */

function isoDateInTZ(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getAppointmentDayISO(apt: Appointment, tz = "America/Los_Angeles") {
  const scheduledAt = apt?.scheduled_at ?? null;
  const scheduledDate = apt?.scheduled_date ?? null;

  if (scheduledAt) {
    try {
      return isoDateInTZ(new Date(scheduledAt), tz);
    } catch {
      // fall through
    }
  }
  if (scheduledDate) return String(scheduledDate).slice(0, 10);

  return null;
}

function isDayOfAppointment(apt: Appointment, tz = "America/Los_Angeles") {
  const day = getAppointmentDayISO(apt, tz);
  if (!day) return false;
  const today = isoDateInTZ(new Date(), tz);
  return today === day;
}

function isSameEmail(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
}

/* ============================================================
   ✅ Time helpers
============================================================ */

function trimTime(t?: string | null) {
  const v = (t ?? "").trim();
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return v;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
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

function getAppointmentTimeLabel(apt: Appointment, tz = "America/Los_Angeles") {
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
  const v = (yyyyMMdd ?? "").slice(0, 10);
  if (!v) return "Date TBA";
  try {
    return format(parseISO(v), "EEE, MMM d");
  } catch {
    try {
      return format(new Date(v), "EEE, MMM d");
    } catch {
      return "Date TBA";
    }
  }
}

/* ============================================================
   Name helpers
============================================================ */

function cleanName(s?: string | null) {
  const v = (s ?? "").trim();
  if (!v) return null;
  const collapsed = v.replace(/\s+/g, " ");
  return collapsed.length > 0 ? collapsed : null;
}

function buildNameFromMetadata(meta?: User["user_metadata"]) {
  if (!meta) return null;

  const full =
    cleanName(meta.full_name) ||
    cleanName(meta.name) ||
    cleanName(
      [meta.first_name, meta.last_name].filter(Boolean).join(" ") || null
    );

  return full;
}

/* ============================================================
   Image + body-style helpers
============================================================ */

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
  suv: [
    "highlander",
    "4runner",
    "grand cherokee",
    "durango",
    "tahoe",
    "explorer",
  ],
  crossover: ["rav4", "rav 4", "rogue", "sportage", "cx-5", "cx5", "escape"],
  pickup: [
    "tacoma",
    "tundra",
    "f-150",
    "f150",
    "silverado",
    "ram 1500",
    "ranger",
  ],
  coupe: ["mustang", "challenger", "camaro", "brz", "gr86"],
  luxury: ["bmw", "mercedes", "amg", "audi", "lexus", "infiniti", "acura"],
  convertible: ["convertible", "miata", "boxster", "spyder"],
  hatchback: ["golf", "gti", "mazda3 hatch", "impreza hatch"],
  hybrid: [
    "prius",
    "hybrid",
    "phev",
    "plug-in",
    "bolt ev",
    "leaf",
    "model 3",
    "tesla",
  ],
  minivan: ["sienna", "odyssey", "grand caravan", "pacifica", "carnival"],
  sportscar: ["supra", "gtr", "corvette", "911", "cayman"],
  stationwagon: ["outback", "v60", "alltrack", "a4 allroad"],
};

function mapColorToHex(color?: string | null): string {
  if (!color) return "#2563eb";

  const c = color.toLowerCase().trim();

  if (c.includes("white")) return "#e5e7eb";
  if (c.includes("black")) return "#020617";
  if (c.includes("silver") || c.includes("grey") || c.includes("gray"))
    return "#9ca3af";
  if (c.includes("blue")) return "#2563eb";
  if (c.includes("red")) return "#ef4444";
  if (c.includes("green")) return "#22c55e";
  if (c.includes("yellow") || c.includes("gold")) return "#facc15";
  if (c.includes("orange")) return "#f97316";
  if (c.includes("purple")) return "#a855f7";
  if (c.includes("brown")) return "#92400e";

  return "#4b5563";
}

function inferBodyStyle(vehicle: Vehicle): BodyStyle {
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

/* ============================================================
   Status chip helper
============================================================ */
function getStatusColor(status?: string | null) {
  const colors: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
    estimating: "bg-blue-100 text-blue-800 border-blue-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    scheduled: "bg-purple-100 text-purple-800 border-purple-200",
    en_route: "bg-orange-100 text-orange-800 border-orange-200",
    on_site: "bg-indigo-100 text-indigo-800 border-indigo-200",
    in_progress: "bg-cyan-100 text-cyan-800 border-cyan-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  };
  const key = (status ?? "").toLowerCase();
  return colors[key] || "bg-gray-100 text-gray-800 border-gray-200";
}

/* ============================================================
   Helpers – resolve vehicle for an appointment
============================================================ */
function resolveVehicleForAppointment(
  apt: Appointment,
  vehicles: Vehicle[]
): Vehicle | null {
  if (!vehicles || vehicles.length === 0) return null;

  if (apt.vehicle_id) {
    const byId = vehicles.find((v) => v.id === apt.vehicle_id);
    if (byId) return byId;
  }

  const aptPlate = apt.vehicle_plate?.toLowerCase().trim();
  if (aptPlate) {
    const byPlate = vehicles.find((v) => {
      const plate = (v.license_plate || v.plate || "").toLowerCase().trim();
      return plate && plate === aptPlate;
    });
    if (byPlate) return byPlate;
  }

  if (vehicles.length === 1) return vehicles[0];

  return null;
}

function isCrackOut(apt: Appointment | null | undefined) {
  if (!apt) return false;
  return apt.crack_out_occurred === true || apt.repair_outcome === "crack_out";
}

/* ============================================================
   UI Helpers – GlassCard & StatCard
============================================================ */
function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={prefersReducedMotion ? undefined : { y: -6, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 210, damping: 22 }}
      className={`
        relative overflow-hidden rounded-2xl border border-slate-800
        bg-gradient-to-br from-white/5 to-white/10
        bg-slate-950/70 bg-clip-padding
        backdrop-blur-xl shadow-[0_20px_45px_rgba(2,6,23,0.6)]
        ${className}
      `}
      role="region"
    >
      <div className="pointer-events-none absolute -inset-x-8 -top-24 h-44 bg-gradient-to-tr from-white/20 to-transparent opacity-20 blur-2xl" />
      <div className="relative z-10 p-4 md:p-6">{children}</div>
    </motion.article>
  );
}

function StatCard({
  Icon,
  count,
  label,
  delay,
  gradient,
  href,
}: {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count: number;
  label: string;
  delay: number;
  gradient: string;
  href?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  const content = (
    <motion.div
      initial={
        prefersReducedMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 18, scale: 0.98 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay }}
      whileHover={prefersReducedMotion ? undefined : { y: -6, scale: 1.03 }}
      className={`
        will-change-transform [perspective:900px]
        ${href ? "cursor-pointer" : ""}
      `}
    >
      <Card className="border-none shadow-xl text-white overflow-hidden relative bg-transparent">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/12 blur-2xl" />

        <div className="relative z-10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Icon className="w-8 h-8 opacity-90" />
              <motion.span
                className="text-3xl font-bold tabular-nums"
                initial={
                  prefersReducedMotion
                    ? { scale: 1, opacity: 1 }
                    : { scale: 0.75, opacity: 0 }
                }
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: delay + 0.25,
                  type: "spring",
                  stiffness: 160,
                }}
              >
                {count}
              </motion.span>
            </div>
          </CardHeader>

          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-xs font-medium opacity-90">{label}</p>

            {href ? (
              <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-white/95">
                Open
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            ) : null}
          </CardContent>
        </div>

        {href ? (
          <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
        ) : null}
      </Card>
    </motion.div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block focus:outline-none">
      <div className="rounded-2xl focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
        {content}
      </div>
    </Link>
  );
}

/* ============================================================
   Crack-out Apology Dialog
============================================================ */
function CrackOutApologyDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const serviceLabel = (appointment.service_type ?? "windshield service")
    .replace(/_/g, " ")
    .toUpperCase();

  const when =
    appointment.scheduled_date && appointment.scheduled_date.length > 0
      ? appointment.scheduled_date
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-amber-400/40 bg-slate-950/95 text-slate-50 backdrop-blur-xl shadow-[0_30px_120px_rgba(251,191,36,0.12)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-100">
            <HeartHandshake className="w-5 h-5 text-amber-300" />
            A quick note from Glass Guardian
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            We want to be transparent and respectful of your time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 mt-0.5 text-amber-300" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  During your {serviceLabel}
                  {when ? ` on ${when}` : ""}, a crack-out occurred.
                </p>
                <p className="text-slate-200/90">
                  This is rare, but it can happen with pre-stressed glass or
                  certain impact patterns. Either way — we’re sorry for the
                  inconvenience.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-semibold text-slate-100">
              Here’s what you can expect:
            </p>
            <ul className="mt-2 space-y-2 text-slate-200/90">
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  Your service is documented clearly so you always know what
                  happened.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  If replacement is required, we’ll guide you through next steps
                  per policy.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  You’ll get honest updates — and we treat your car like it’s
                  ours.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-emerald-100 font-semibold">
              We’re built for long-term trust.
            </p>
            <p className="text-emerald-100/80 mt-1">
              We’ll keep you informed, we’ll make it right, and we’ll keep it
              professional — every time.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Link href={`/user/dashboard/appointments`} className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
            >
              View Appointments
            </Button>
          </Link>

          <Link
            href={`/user/dashboard/appointments/${appointment.id}`}
            className="w-full sm:w-auto"
          >
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
              Open Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Vehicle Status HUD
============================================================ */

const TRACK_STAGES = [
  "requested",
  "scheduled",
  "en_route",
  "on_site",
  "in_progress",
  "completed",
];

function VehicleStatusHUD({
  appointments,
  vehicles,
  warranties,
  totalServices,
  waiverForAppointmentId,
}: {
  appointments: Appointment[];
  vehicles: Vehicle[];
  warranties: Warranty[];
  totalServices: number;
  waiverForAppointmentId: (appointmentId: string) => WaiverRow | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (!appointments || appointments.length === 0) return null;

  const primaryAppointment = appointments[0];
  const primaryVehicle = resolveVehicleForAppointment(primaryAppointment, vehicles);

  const activeCount = appointments.length;
  const warrantyCount = warranties.length;

  const name =
    primaryVehicle &&
    (primaryVehicle.make || primaryVehicle.model || primaryVehicle.year)
      ? `${primaryVehicle.year ? `${primaryVehicle.year} ` : ""}${
          primaryVehicle.make ?? ""
        } ${primaryVehicle.model ?? ""}`.trim()
      : "Vehicle in service";

  const rawPlate =
    primaryVehicle?.license_plate ??
    primaryVehicle?.plate ??
    primaryAppointment.vehicle_plate ??
    undefined;

  const plate =
    rawPlate && rawPlate.trim().length > 0
      ? rawPlate.toUpperCase()
      : "Plate on file";

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
    <div className="mt-6 rounded-2xl border border-slate-700/80 overflow-hidden bg-gradient-to-br from-slate-950/90 via-slate-900/70 to-sky-900/40 relative min-h-[260px] md:min-h-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_-10%,rgba(96,165,250,0.45),transparent_55%),radial-gradient(circle_at_90%_120%,rgba(45,212,191,0.5),transparent_55%),radial-gradient(circle_at_50%_30%,rgba(15,23,42,0.9),rgba(15,23,42,0.4))]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-soft-light bg-[repeating-linear-gradient(to_bottom,rgba(148,163,184,0.18)_0,rgba(148,163,184,0.18)_1px,transparent_1px,transparent_3px)]" />

      <div className="relative z-10 flex h-full flex-col md:flex-row">
        <div className="flex-1 flex flex-col justify-center items-center md:items-start px-5 py-4 md:px-7">
          <div className="mb-3 text-[0.7rem] uppercase tracking-[0.2em] text-slate-400">
            Vehicles In Service
          </div>

          <div className="mb-1 text-sm font-semibold text-slate-100">{name}</div>
          <div className="mb-1 text-[0.7rem] text-slate-300/90">
            {primaryVehicle ? prettyBody : "Active vehicle"}
          </div>

          <div className="mb-2 text-xs text-slate-300/90 flex flex-wrap items-center gap-2">
            <span>
              Plate{" "}
              <span className="inline-flex items-center rounded-md bg-slate-900/70 px-2 py-0.5 text-[0.7rem] tracking-[0.15em] text-slate-100 border border-slate-600/70">
                {plate}
              </span>
            </span>
            <span className="inline-flex items-center rounded-md bg-cyan-500/10 border border-cyan-400/50 px-2 py-0.5 text-[0.7rem] text-cyan-100">
              Glass health: <span className="ml-1 font-semibold">{glassHealth}</span>
            </span>

            {isCrackOut(primaryAppointment) && (
              <span className="inline-flex items-center rounded-md bg-amber-500/15 border border-amber-400/50 px-2 py-0.5 text-[0.7rem] text-amber-100">
                <TriangleAlert className="w-3.5 h-3.5 mr-1" />
                Crack-out reported
              </span>
            )}
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
              prefersReducedMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 10, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mt-2 w-[260px] max-w-full h-[130px]"
          >
            <div
              className="absolute inset-[-30%] blur-2xl opacity-80"
              style={{
                background: `radial-gradient(circle at 50% 60%, ${colorHex}, transparent 60%)`,
              }}
              aria-hidden="true"
            />

            <div className="relative h-full w-full rounded-2xl border border-slate-700/80 bg-slate-900/80 overflow-hidden flex items-center justify-center shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-white/15 backdrop-blur-sm border border-white/20 text-[0.65rem] font-semibold tracking-wide text-black shadow-[0_0_10px_rgba(0,0,0,0.25)]">
                LIVE · In Service
              </div>

              {primaryVehicle ? (
                <Image
                  src={imageSrc}
                  alt={`${prettyBody} illustration`}
                  fill
                  sizes="(min-width: 1024px) 320px, 100vw"
                  className="object-contain object-center pointer-events-none select-none"
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

        <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-700/60 bg-slate-950/40 px-5 py-4 md:px-6 md:py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                Current vehicle tracker
              </div>
              <div className="text-xs text-slate-300">
                Live status on your open services
              </div>
            </div>

            <Link href="/user/dashboard/appointments">
              <Button
                variant="ghost"
                size="sm"
                className="text-[0.7rem] text-slate-100 hover:text-slate-100 border border-slate-600/70 hover:bg-slate-900/60"
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
                  : (apt.service_type ?? "Windshield service")
                      .replace(/_/g, " ")
                      .toUpperCase();

              const statusRaw = (apt.status || "").toLowerCase();
              const statusIndex =
                TRACK_STAGES.indexOf(statusRaw) === -1
                  ? 0
                  : TRACK_STAGES.indexOf(statusRaw);
              const displayStatus =
                (apt.status ?? "").replace(/_/g, " ") || "requested";

              const dayLabel = apt.scheduled_date
                ? safeDayLabelFromYYYYMMDD(apt.scheduled_date)
                : "Date TBA";

              const timeLabel = getAppointmentTimeLabel(apt, tz);

              const plateLabel =
                vehicle?.license_plate ??
                vehicle?.plate ??
                apt.vehicle_plate ??
                null;

              const crackOut = isCrackOut(apt);

              const dayOf = isDayOfAppointment(apt, tz);
              const waiver = waiverForAppointmentId(apt.id);
              const waiverMissing = dayOf && !waiver;

              return (
                <div
                  key={apt.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    waiverMissing
                      ? "border-amber-400/70 bg-amber-500/10"
                      : "border-slate-700/70 bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-sky-300" />
                        <span className="font-medium text-slate-50 text-[0.78rem]">
                          {vehicleLabel}
                        </span>

                        {crackOut && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 border border-amber-400/50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-100">
                            <TriangleAlert className="w-3 h-3 mr-1" />
                            Crack-out
                          </span>
                        )}

                        {dayOf && (
                          <span
                            className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border ${
                              waiver
                                ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-100"
                                : "bg-amber-500/15 border-amber-400/50 text-amber-100"
                            }`}
                          >
                            {waiver ? (
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

                        {timeLabel && (
                          <span className="text-sky-300 font-medium">
                            {timeLabel}
                          </span>
                        )}

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
                        {statusRaw === "en_route" && (
                          <Clock className="w-3.5 h-3.5 mr-1" />
                        )}
                        {statusRaw === "completed" && (
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        )}
                        {displayStatus}
                      </div>

                      {dayOf && !waiver && (
                        <Link
                          href={`/user/dashboard/appointments/${apt.id}/waiver`}
                        >
                          <Button
                            size="sm"
                            className="h-8 px-3 text-[0.72rem] bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                          >
                            Sign Waiver
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </Link>
                      )}

                      {dayOf && waiver && (
                        <Link href={`/user/dashboard/appointments/${apt.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-[0.72rem] border-emerald-400/50 text-emerald-100 hover:bg-emerald-500/10"
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
                            className="h-8 px-3 text-[0.72rem] border-slate-600/70 bg-slate-950/40 text-slate-100 hover:bg-slate-900/60"
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
                              idx <= statusIndex ? "bg-cyan-400" : "bg-slate-600"
                            }`}
                          />
                        );
                      }

                      return (
                        <React.Fragment key={stage}>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              idx <= statusIndex ? "bg-cyan-400" : "bg-slate-600"
                            }`}
                          />
                          <span
                            className={`h-[2px] flex-1 ${
                              idx < statusIndex ? "bg-cyan-400/80" : "bg-slate-700"
                            }`}
                          />
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {dayOf && !waiver && (
                    <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2">
                      <p className="text-[0.7rem] text-amber-100/90">
                        Today is your service day — please sign the waiver before
                        your technician begins work.
                      </p>
                    </div>
                  )}
                </div>
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
  );
}

/* ============================================================
   small fetch helper
============================================================ */

async function safeFetchJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
  try {
    const r = await fetch(url, init);
    const text = await r.text().catch(() => "");
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return { ok: r.ok, status: r.status, json };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      json: {},
      error: e?.message || "Failed to fetch",
    };
  }
}

function centsToDollars(cents?: number | null) {
  if (typeof cents !== "number") return null;
  return (cents / 100).toFixed(2);
}

/* ============================================================
   PAGE COMPONENT
============================================================ */
export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion();

  const [user, setUser] = React.useState<User | null>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);
  const [sessionMissing, setSessionMissing] = React.useState(false);

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [warranties, setWarranties] = React.useState<Warranty[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  const [devActive, setDevActive] = React.useState<DevRole | null>(null);

  const [appUserName, setAppUserName] = React.useState<string | null>(null);
  const [loadingAppUserName, setLoadingAppUserName] = React.useState(false);

  const [apologyOpen, setApologyOpen] = React.useState(false);
  const [apologyApt, setApologyApt] = React.useState<Appointment | null>(null);

  const [waiversByAppointmentId, setWaiversByAppointmentId] = React.useState<
    Record<string, WaiverRow>
  >({});
  const [loadingWaivers, setLoadingWaivers] = React.useState(false);

  // ✅ invoices (FIXED: no tech_invoices.user_id)
  const [invoices, setInvoices] = React.useState<TechInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = React.useState(false);

  const hardRefresh = React.useCallback(() => {
    try {
      window.location.reload();
    } catch {}
  }, []);

  /* ============================================================
     AUTH HYDRATION (NO CLIENT REDIRECTS)
  ============================================================ */
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u1 = await supabaseClient.auth
          .getUser()
          .catch(() => ({ data: { user: null } as any }));
        const authedUser = u1?.data?.user ?? null;

        if (!mounted) return;

        if (authedUser) {
          setUser({
            id: authedUser.id,
            email: authedUser.email ?? null,
            user_metadata: authedUser.user_metadata as any,
          });
          setDevActive(null);
          setSessionMissing(false);
          setLoadingUser(false);
          return;
        }

        const devRole = readDevRoleFromCookie();
        if (devRole) {
          const mock = makeDevUser(devRole);
          setUser({
            id: mock.id,
            email: mock.email,
            user_metadata: {
              full_name: mock.user_metadata?.full_name ?? "Dev",
              role: devRole,
            },
          });
          setDevActive(devRole);
          setSessionMissing(false);
          setLoadingUser(false);
          return;
        }

        const { data: sub } = supabaseClient.auth.onAuthStateChange(
          (_event, s) => {
            if (!mounted) return;
            if (!s?.user) return;

            setUser({
              id: s.user.id,
              email: s.user.email ?? null,
              user_metadata: s.user.user_metadata as any,
            });
            setDevActive(null);
            setSessionMissing(false);
            setLoadingUser(false);
          }
        );

        const t = setTimeout(async () => {
          if (!mounted) return;

          const u2 = await supabaseClient.auth
            .getUser()
            .catch(() => ({ data: { user: null } as any }));
          const u = u2?.data?.user ?? null;

          if (u) {
            setUser({
              id: u.id,
              email: u.email ?? null,
              user_metadata: u.user_metadata as any,
            });
            setDevActive(null);
            setSessionMissing(false);
          } else {
            setSessionMissing(true);
          }
          setLoadingUser(false);
        }, 900);

        return () => {
          clearTimeout(t);
          sub?.subscription?.unsubscribe?.();
        };
      } catch {
        if (!mounted) return;
        setSessionMissing(true);
        setLoadingUser(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ============================================================
     OPTIONAL: bootstrap (best-effort)
  ============================================================ */
  React.useEffect(() => {
    if (!user?.id) return;
    if (devActive) return;

    let cancelled = false;

    (async () => {
      const res = await safeFetchJson("/api/user/bootstrap", { method: "POST" });
      if (!cancelled) void res;
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, devActive]);

  /* ============================================================
     LOAD app_users.full_name (match by email)
  ============================================================ */
  React.useEffect(() => {
    if (!user?.email) return;

    if (devActive) {
      setAppUserName(buildNameFromMetadata(user.user_metadata) ?? "Dev");
      return;
    }

    let cancelled = false;

    (async () => {
      const metaName = buildNameFromMetadata(user.user_metadata);
      if (metaName) {
        setAppUserName(metaName);
        return;
      }

      setLoadingAppUserName(true);
      try {
        const { data, error } = await supabaseClient
          .from("app_users")
          .select("full_name")
          .eq("email", user.email)
          .maybeSingle();

        if (error) {
          if ((error as any)?.code === "PGRST205") {
            if (!cancelled) setAppUserName(null);
            return;
          }
          if (!cancelled) setAppUserName(null);
          return;
        }

        const picked = cleanName((data as any)?.full_name ?? null);
        if (!cancelled) setAppUserName(picked ?? null);
      } finally {
        if (!cancelled) setLoadingAppUserName(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, devActive]);

  /* ============================================================
     LOAD DATA
     ✅ FIX: case-insensitive customer_email match so users always see tech-created appointments
  ============================================================ */
  React.useEffect(() => {
    if (!user?.email) return;
    let stop = false;

    (async () => {
      setLoadingData(true);

      if (devActive) {
        const email = user.email!;
        const [a, v, w] = await Promise.all([
          devFetchAppointments(email),
          devFetchVehicles(email),
          devFetchWarranties(email),
        ]);

        if (stop) return;
        setAppointments((a as any) || []);
        setVehicles((v as any) || []);
        setWarranties((w as any) || []);
        setLoadingData(false);
        return;
      }

      const email = (user.email ?? "").trim().toLowerCase();

      if (!email) {
        if (stop) return;
        setAppointments([]);
        setVehicles([]);
        setWarranties([]);
        setLoadingData(false);
        return;
      }

      const [aptRes, vehRes, warRes] = await Promise.all([
        supabaseClient
          .from("appointments")
          .select("*")
          .ilike("customer_email", email)
          .order("created_at", { ascending: false })
          .limit(10),

        supabaseClient.from("vehicles").select("*").ilike("owner_email", email),

        supabaseClient
          .from("warranties")
          .select("*")
          .ilike("customer_email", email)
          .eq("status", "active"),
      ]);

      if (stop) return;

      setAppointments((aptRes.data as Appointment[]) || []);
      setVehicles((vehRes.data as Vehicle[]) || []);
      setWarranties((warRes.data as Warranty[]) || []);
      setLoadingData(false);
    })();

    return () => {
      stop = true;
    };
  }, [user?.email, devActive]);

  /* ============================================================
     Load waivers for today’s appointments
     ✅ FIX: select real columns (no full_name)
  ============================================================ */
  React.useEffect(() => {
    if (!user?.email) return;
    if (!appointments || appointments.length === 0) return;

    const tz = "America/Los_Angeles";
    const dayOfAppointments = appointments.filter(
      (a) => isSameEmail(a.customer_email, user.email) && isDayOfAppointment(a, tz)
    );
    if (dayOfAppointments.length === 0) return;

    let cancelled = false;

    (async () => {
      setLoadingWaivers(true);
      try {
        const ids = dayOfAppointments.map((a) => a.id);

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
          if ((error as any)?.code === "PGRST205") {
            if (!cancelled) setWaiversByAppointmentId({});
            return;
          }
          throw error;
        }

        const map: Record<string, WaiverRow> = {};
        for (const row of (data ?? []) as any[]) {
          map[row.appointment_id] = row as WaiverRow;
        }
        if (!cancelled) setWaiversByAppointmentId(map);
      } catch {
        if (!cancelled) setWaiversByAppointmentId({});
      } finally {
        if (!cancelled) setLoadingWaivers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appointments, user?.email]);

  const waiverForAppointmentId = React.useCallback(
    (appointmentId: string) => {
      return waiversByAppointmentId[appointmentId] ?? null;
    },
    [waiversByAppointmentId]
  );

  /* ============================================================
     Load customer invoices (tech_invoices)
     ✅ FIX: no user_id column, filter by customer_email (ilike)
  ============================================================ */
  React.useEffect(() => {
    if (!user?.email) return;
    if (devActive) {
      setInvoices([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const email = (user.email ?? "").trim().toLowerCase();
      if (!email) {
        if (!cancelled) setInvoices([]);
        return;
      }

      setLoadingInvoices(true);
      try {
        const { data, error } = await supabaseClient
          .from("tech_invoices")
          .select(
            [
              "id",
              "invoice_number",
              "status",
              "created_at",
              "invoice_date",
              "appointment_id",
              "customer_email",
              "customer_name",
              "service_address",
              "subtotal_cents",
              "total_cents",
              "final_paid_cents",
              "paid_at",
              "payment_method",
              "crack_out_occurred",
              "repair_outcome",
            ].join(",")
          )
          .ilike("customer_email", email) // ✅ correct ownership
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) throw error;

        if (!cancelled) setInvoices((data as unknown as TechInvoice[]) || []);
      } catch {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, devActive]);

  const tz = "America/Los_Angeles";
  const waiverDueAppointment = React.useMemo(() => {
    if (!user?.email) return null;

    const dayOf = appointments.filter(
      (a) => isSameEmail(a.customer_email, user.email) && isDayOfAppointment(a, tz)
    );
    if (dayOf.length === 0) return null;

    const due = dayOf.find((a) => !waiverForAppointmentId(a.id)) ?? null;
    return due;
  }, [appointments, user?.email, waiverForAppointmentId]);

  React.useEffect(() => {
    if (!waiverDueAppointment) return;
    if (loadingData || loadingWaivers) return;

    try {
      window.location.href = `/user/dashboard/appointments/${waiverDueAppointment.id}/waiver`;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiverDueAppointment, loadingData, loadingWaivers]);

  React.useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    const candidate =
      appointments.find(
        (a) =>
          isCrackOut(a) &&
          ["completed", "paid"].includes((a.status ?? "").toLowerCase())
      ) ??
      appointments.find((a) => isCrackOut(a)) ??
      null;

    if (!candidate) return;

    const key = `gg_ack_crackout_${candidate.id}`;
    try {
      const alreadyAck = window.localStorage.getItem(key) === "1";
      if (alreadyAck) return;

      setApologyApt(candidate);
      setApologyOpen(true);
      window.localStorage.setItem(key, "1");
    } catch {
      setApologyApt(candidate);
      setApologyOpen(true);
    }
  }, [appointments]);

  const activeAppointments = appointments.filter((a) => {
    const s = (a.status ?? "").toLowerCase();
    return !["completed", "cancelled", "paid"].includes(s);
  });

  const hasCompletedJob = appointments.some((a) => {
    const s = (a.status ?? "").toLowerCase();
    return s === "completed" || s === "paid";
  });

  const showPostCompleteMessage =
    hasCompletedJob && activeAppointments.length === 0 && warranties.length === 0;

  const displayName = appUserName || buildNameFromMetadata(user?.user_metadata) || "there";

  /* ============================================================
     PAGE LOADING
  ============================================================ */
  if (loadingUser) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400" />
      </div>
    );
  }

  /* ============================================================
     SESSION MISSING PANEL (NO LOOP)
  ============================================================ */
  if (sessionMissing && !devActive) {
    return (
      <div className="min-h-[70vh] grid place-items-center px-4">
        <div className="w-full max-w-lg">
          <GlassCard>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <TriangleAlert className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-slate-50">
                  Session not detected in the browser
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  The server allowed this page, but your browser client couldn’t read the Supabase session cookie yet.
                  This can happen during local dev cookie settings or refresh-token hydration.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={hardRefresh}
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>

                  <Link href="/user/login?redirect=/user/dashboard">
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Go to login
                    </Button>
                  </Link>
                </div>

                <p className="mt-3 text-[0.7rem] text-slate-400">
                  If Refresh fixes it, you’re good — no more auto-redirect loops.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  /* ============================================================
     MAIN PAGE CONTENT
  ============================================================ */
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative flex-1 w-full max-w-7xl mx-auto py-8 px-4"
    >
      {devActive && (
        <div className="mb-4">
          <DevBanner />
        </div>
      )}

      {apologyApt && (
        <CrackOutApologyDialog
          appointment={apologyApt}
          open={apologyOpen}
          onOpenChange={setApologyOpen}
        />
      )}

      {waiverDueAppointment && (
        <GlassCard className="mb-6">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <PenLine className="w-5 h-5 text-amber-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-amber-100 flex items-center gap-2">
                Waiver required today
                <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-100">
                  Priority
                </span>
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Today is your appointment day — please sign the waiver before your technician begins work.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/user/dashboard/appointments/${waiverDueAppointment.id}/waiver`}>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                    Sign Waiver Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href={`/user/dashboard/appointments/${waiverDueAppointment.id}`}>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
                  >
                    View Appointment
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard className="mb-8">
        <div className="relative p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
            className="mb-2"
          >
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">
              Welcome back, {displayName}! 👋
            </h1>
            <p className="text-sm md:text-base text-slate-300 mt-2">
              Your Windshield Repair Command Center — track repairs, manage your garage, and keep every warranty at your
              fingertips.
            </p>

            {!devActive && !appUserName && loadingAppUserName && (
              <p className="mt-2 text-[0.7rem] text-slate-400">
                Personalizing your dashboard…
              </p>
            )}
          </motion.div>

          {ENABLE_3D && activeAppointments.length > 0 && (
            <VehicleStatusHUD
              appointments={activeAppointments}
              vehicles={vehicles}
              warranties={warranties}
              totalServices={appointments.length}
              waiverForAppointmentId={waiverForAppointmentId}
            />
          )}
        </div>
      </GlassCard>

      {showPostCompleteMessage && (
        <GlassCard className="mb-8">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-emerald-100 flex items-center gap-2">
                Job complete! 🎉
              </h2>
              <p className="mt-1 text-xs text-emerald-100/80">
                Your service has been marked complete. Please check your invoices to see if any payment is still due.
                Your warranties will show here after they&apos;re issued.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ✅ Quick invoices panel (FIXED query) */}
      {!devActive && (
        <GlassCard className="mb-8">
          <Card className="border-none bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm text-sky-200">
                <FileText className="w-4 h-4 text-sky-300" />
                Recent Invoices
              </CardTitle>

              <Link href="/user/dashboard/pay">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[0.7rem] text-slate-100 hover:text-slate-100 border border-slate-600/70 hover:bg-slate-900/60"
                >
                  View all
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              {loadingInvoices ? (
                <div className="text-slate-400">Loading invoices…</div>
              ) : invoices.length === 0 ? (
                <div className="text-slate-400">No invoices found yet.</div>
              ) : (
                invoices.slice(0, 5).map((inv) => {
                  const total = centsToDollars(inv.total_cents);
                  const paid = centsToDollars(inv.final_paid_cents);
                  const status = (inv.status ?? "unknown").replace(/_/g, " ");
                  const isPaid = (inv.status ?? "").toLowerCase() === "paid";

                  return (
                    <Link
                      key={inv.id}
                      href={`/user/dashboard/pay/${inv.id}`}
                      className="block focus:outline-none"
                      aria-label={`Open invoice ${inv.invoice_number ?? inv.id}`}
                    >
                      <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 hover:bg-slate-900/75 transition px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-slate-50 font-semibold text-[0.78rem] truncate">
                              {inv.invoice_number ? `Invoice ${inv.invoice_number}` : "Invoice"}
                            </div>
                            <div className="mt-1 text-[0.7rem] text-slate-300">
                              {inv.invoice_date
                                ? format(new Date(inv.invoice_date), "MMM d, yyyy")
                                : inv.created_at
                                ? format(new Date(inv.created_at), "MMM d, yyyy")
                                : "Date"}
                              {inv.service_address ? (
                                <span className="text-slate-400"> · {inv.service_address}</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <div className="text-slate-50 font-semibold tabular-nums">
                              {total ? `$${total}` : "—"}
                            </div>
                            <div
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${
                                isPaid
                                  ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-100"
                                  : "bg-sky-500/10 border-sky-400/30 text-sky-100"
                              }`}
                            >
                              {status.toUpperCase()}
                            </div>
                            {paid && isPaid ? (
                              <div className="text-[0.65rem] text-emerald-200/90">
                                Paid ${paid}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </GlassCard>
      )}

      {/* Stat cards */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            Icon: Calendar,
            count: activeAppointments.length,
            label: "Active Appointments",
            gradient: "from-sky-500 to-sky-600",
            delay: 0,
            href: "/user/dashboard/appointments",
          },
          {
            Icon: Car,
            count: vehicles.length,
            label: "Registered Vehicles",
            gradient: "from-violet-500 to-violet-600",
            delay: 0.08,
            href: "/user/dashboard/garage",
          },
          {
            Icon: Shield,
            count: warranties.length,
            label: "Active Warranties",
            gradient: "from-emerald-500 to-emerald-600",
            delay: 0.16,
            href: "/user/dashboard/warranties",
          },
          {
            Icon: FileText,
            count: appointments.length,
            label: "Total Services",
            gradient: "from-amber-500 to-amber-600",
            delay: 0.24,
          },
        ].map((s, i) => (
          <StatCard key={i} {...s} />
        ))}
      </div>

      {(loadingData || loadingWaivers || loadingInvoices) && (
        <div className="mt-6 text-center text-xs text-slate-400">
          Syncing your latest updates…
        </div>
      )}
    </motion.div>
  );
}