// app/ios/user/(protected)/dashboard/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Wrench,
  Calendar,
  Car,
  Shield,
  FileText,
  Clock,
  CheckCircle,
  TriangleAlert,
  HeartHandshake,
  PenLine,
  RefreshCw,
  LogIn,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// ✅ iOS dashboard base routes
const BASE = "/ios/user/dashboard";
const ROUTES = {
  appointments: `${BASE}/appointments`,
  garage: `${BASE}/garage`,
  warranties: `${BASE}/warranties`,
  pay: `${BASE}/pay`,
  eliteBook: `${BASE}/book/elite`,
  login: "/ios/user/login",
};

const ENABLE_3D = process.env.NEXT_PUBLIC_ENABLE_3D !== "false";

/**
 * Bottom tabbar height (your shell likely uses ~72–84px).
 * This powers:
 *  - content padding (so nothing hides under tabs)
 *  - the fade-out “vanish into tabs” effect
 */
const TABBAR_H = 78;

/** Nudge content down (inside page) */
const TOP_OFFSET = 10;

function cn(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function tinyHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.(10);
    }
  } catch {}
}

/* ============================================================
   Types (match your web dashboard types)
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
   Helpers
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
    return { ok: false, status: 0, json: {}, error: e?.message || "Failed to fetch" };
  }
}

function centsToDollars(cents?: number | null) {
  if (typeof cents !== "number") return null;
  return (cents / 100).toFixed(2);
}

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
    cleanName([meta.first_name, meta.last_name].filter(Boolean).join(" ") || null);

  return full;
}

function isSameEmail(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
}

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
    } catch {}
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

function trimTime(t?: string | null) {
  const v = (t ?? "").trim();
  if (!v) return null;
  const m2 = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m2) return v;
  return `${m2[1].padStart(2, "0")}:${m2[2]}`;
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
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "Date TBA";
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return "Date TBA";
  }
}

function getStatusPill(status?: string | null) {
  const key = (status ?? "").toLowerCase();
  const map: Record<string, string> = {
    requested: "border-yellow-400/40 bg-yellow-500/10 text-yellow-100",
    estimating: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    approved: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    scheduled: "border-violet-400/40 bg-violet-500/10 text-violet-100",
    en_route: "border-orange-400/40 bg-orange-500/10 text-orange-100",
    on_site: "border-indigo-400/40 bg-indigo-500/10 text-indigo-100",
    in_progress: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
    completed: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    paid: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    cancelled: "border-slate-500/35 bg-slate-500/10 text-slate-200",
  };
  return map[key] || "border-white/10 bg-white/5 text-cyan-100/85";
}

function isCrackOut(apt: Appointment | null | undefined) {
  if (!apt) return false;
  return apt.crack_out_occurred === true || apt.repair_outcome === "crack_out";
}

/* ============================================================
   Vehicle visuals (same as web)
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

function mapColorToHex(color?: string | null): string {
  if (!color) return "#22d3ee"; // cyan-400-ish

  const c = color.toLowerCase().trim();
  if (c.includes("white")) return "#e5e7eb";
  if (c.includes("black")) return "#020617";
  if (c.includes("silver") || c.includes("grey") || c.includes("gray")) return "#9ca3af";
  if (c.includes("blue")) return "#60a5fa";
  if (c.includes("red")) return "#fb7185";
  if (c.includes("green")) return "#34d399";
  if (c.includes("yellow") || c.includes("gold")) return "#facc15";
  if (c.includes("orange")) return "#fb923c";
  if (c.includes("purple")) return "#c084fc";
  if (c.includes("brown")) return "#a16207";
  return "#94a3b8";
}

function inferBodyStyle(vehicle: Vehicle): BodyStyle {
  if (vehicle.body_type) return vehicle.body_type;

  const name = `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.toLowerCase();

  for (const hint of BODY_HINTS.hybrid) if (name.includes(hint)) return "hybrid";

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

function resolveVehicleForAppointment(apt: Appointment, vehicles: Vehicle[]): Vehicle | null {
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

/* ============================================================
   Elite UI primitives (iOS)
============================================================ */

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "relative w-full max-w-full overflow-hidden rounded-[28px]",
        "border border-white/10 bg-black/75 backdrop-blur-[22px]",
        "shadow-[0_30px_180px_rgba(0,0,0,0.96)]",
        "transform-gpu",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]" />
      <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_15%_20%,rgba(96,220,255,0.18),transparent_55%),radial-gradient(circle_at_85%_85%,rgba(255,110,220,0.14),transparent_55%)]" />
      <div className="relative z-10">{children}</div>
    </Card>
  );
}

function StatusStrip() {
  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOutExpo, delay: 0.08 }}
      className="mt-3 flex justify-center px-2"
    >
      <div
        className={cn(
          "w-full max-w-[560px] min-w-0 overflow-hidden",
          "inline-flex items-center gap-2",
          "rounded-full border border-white/12 bg-black/70",
          "px-3 py-1 text-[10px] text-cyan-100/80",
          "backdrop-blur-xl shadow-[0_18px_80px_rgba(0,0,0,0.95)]"
        )}
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-300/40">
          <ShieldCheck className="h-2.5 w-2.5 text-cyan-100" />
        </span>
        <span className="min-w-0 truncate">
          Live status · Waivers · Invoices · Warranties — synced across devices
        </span>
      </div>
    </m.div>
  );
}

/* ============================================================
   Crack-out Apology Dialog (kept 1:1)
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
      <DialogContent className="max-w-lg border border-amber-400/40 bg-black/90 text-slate-50 backdrop-blur-xl shadow-[0_30px_120px_rgba(251,191,36,0.12)]">
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
                  This is rare, but it can happen with pre-stressed glass or certain
                  impact patterns. Either way — we’re sorry for the inconvenience.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-semibold text-slate-100">Here’s what you can expect:</p>
            <ul className="mt-2 space-y-2 text-slate-200/90">
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>Your service is documented clearly so you always know what happened.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>If replacement is required, we’ll guide you through next steps per policy.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>You’ll get honest updates — and we treat your car like it’s ours.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-emerald-100 font-semibold">We’re built for long-term trust.</p>
            <p className="text-emerald-100/80 mt-1">
              We’ll keep you informed, we’ll make it right, and we’ll keep it professional — every time.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Link href={ROUTES.appointments} className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06]"
            >
              View Appointments
            </Button>
          </Link>

          <Link href={`${ROUTES.appointments}/${appointment.id}`} className="w-full sm:w-auto">
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">
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
   Vehicle Status HUD — mobile elite version, same data semantics
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
  const reduce = prefersReducedMotion ?? true;

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

  const plate =
    rawPlate && rawPlate.trim().length > 0 ? rawPlate.toUpperCase() : "PLATE ON FILE";

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
    <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-black/75 backdrop-blur-[22px] shadow-[0_30px_160px_rgba(0,0,0,0.96)] relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_-10%,rgba(96,220,255,0.22),transparent_55%),radial-gradient(circle_at_90%_120%,rgba(255,110,220,0.18),transparent_55%),radial-gradient(circle_at_50%_30%,rgba(0,0,0,0.9),rgba(0,0,0,0.4))]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light bg-[repeating-linear-gradient(to_bottom,rgba(148,163,184,0.16)_0,rgba(148,163,184,0.16)_1px,transparent_1px,transparent_3px)]" />

      <div className="relative z-10 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/65">
              Vehicles in service
            </div>
            <div className="mt-1 text-[13px] font-semibold text-cyan-50 truncate">{name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-cyan-100/70">
              <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tracking-[0.18em] text-cyan-50/90">
                {plate}
              </span>
              <span className="inline-flex items-center rounded-md border border-cyan-300/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">
                Glass health: <span className="ml-1 font-semibold">{glassHealth}</span>
              </span>

              {isCrackOut(primaryAppointment) && (
                <span className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">
                  <TriangleAlert className="w-3.5 h-3.5 mr-1" />
                  Crack-out
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-cyan-100/70">
              <span className="inline-flex items-center gap-1">
                <Car className="w-3.5 h-3.5" />
                {activeCount} active
              </span>
              <span className="inline-flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                {warrantyCount} warranties
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {totalServices} visits
              </span>
            </div>
          </div>

          <Link href={ROUTES.appointments} onClick={() => tinyHaptic()}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-2xl border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06] text-[11px]"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>

        <m.div
          initial={
            reduce ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.98 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative mt-4 w-full h-[150px]"
        >
          <div
            className="absolute inset-[-35%] blur-2xl opacity-85"
            style={{
              background: `radial-gradient(circle at 50% 60%, ${colorHex}, transparent 60%)`,
            }}
            aria-hidden="true"
          />

          <div className="relative h-full w-full rounded-[22px] border border-white/10 bg-black/55 overflow-hidden flex items-center justify-center shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
            <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-white/12 backdrop-blur-sm border border-white/18 text-[10px] font-semibold tracking-[0.14em] text-cyan-50">
              LIVE · IN SERVICE
            </div>

            {primaryVehicle ? (
              <Image
                src={imageSrc}
                alt={`${prettyBody} illustration`}
                fill
                sizes="100vw"
                className="object-contain object-center pointer-events-none select-none"
                priority={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-cyan-100/60 text-xs gap-2">
                <Car className="w-7 h-7" />
                <span>Vehicle details will appear here</span>
              </div>
            )}
          </div>
        </m.div>

        <div className="mt-4 space-y-3 text-xs">
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

            const dayLabel = apt.scheduled_date ? safeDayLabelFromYYYYMMDD(apt.scheduled_date) : "Date TBA";
            const timeLabel = getAppointmentTimeLabel(apt, tz);

            const plateLabel = vehicle?.license_plate ?? vehicle?.plate ?? apt.vehicle_plate ?? null;

            const crackOut = isCrackOut(apt);

            const dayOf = isDayOfAppointment(apt, tz);
            const waiver = waiverForAppointmentId(apt.id);
            const waiverMissing = dayOf && !waiver;

            return (
              <div
                key={apt.id}
                className={cn(
                  "rounded-[18px] border px-3.5 py-3",
                  waiverMissing ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-white/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Car className="w-4 h-4 text-cyan-200" />
                      <span className="font-semibold text-cyan-50 text-[12px] truncate">
                        {vehicleLabel}
                      </span>

                      {crackOut && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 border border-amber-400/45 px-2 py-0.5 text-[10px] font-semibold text-amber-100 shrink-0">
                          <TriangleAlert className="w-3 h-3 mr-1" />
                          Crack-out
                        </span>
                      )}

                      {dayOf && (
                        <span
                          className={cn(
                            "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0",
                            waiver
                              ? "bg-emerald-500/15 border-emerald-400/45 text-emerald-100"
                              : "bg-amber-500/15 border-amber-400/45 text-amber-100"
                          )}
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

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-cyan-100/70">
                      <span>{dayLabel}</span>

                      {timeLabel && <span className="text-cyan-100 font-semibold">{timeLabel}</span>}

                      {plateLabel && (
                        <span className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-50/90">
                          {plateLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div
                      className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border",
                        getStatusPill(apt.status)
                      )}
                    >
                      {statusRaw === "en_route" && <Clock className="w-3.5 h-3.5 mr-1" />}
                      {statusRaw === "completed" && <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                      {displayStatus.toUpperCase()}
                    </div>

                    {dayOf && !waiver && (
                      <Link
                        href={`${ROUTES.appointments}/${apt.id}/waiver`}
                        onClick={() => tinyHaptic()}
                      >
                        <Button
                          size="sm"
                          className="h-8 px-3 rounded-2xl text-[11px] bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        >
                          Sign Waiver
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    )}

                    {dayOf && waiver && (
                      <Link href={`${ROUTES.appointments}/${apt.id}`} onClick={() => tinyHaptic()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 rounded-2xl text-[11px] border-emerald-400/45 text-emerald-100 hover:bg-emerald-500/10 bg-transparent"
                        >
                          View Details
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    )}

                    {!dayOf && (
                      <Link href={`${ROUTES.appointments}/${apt.id}`} onClick={() => tinyHaptic()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 rounded-2xl text-[11px] border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06]"
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
                    const on = idx <= statusIndex;
                    if (idx === TRACK_STAGES.length - 1) {
                      return (
                        <span
                          key={stage}
                          className={cn(
                            "w-2 h-2 rounded-full",
                            on ? "bg-cyan-300" : "bg-white/20"
                          )}
                        />
                      );
                    }
                    return (
                      <React.Fragment key={stage}>
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            on ? "bg-cyan-300" : "bg-white/20"
                          )}
                        />
                        <span
                          className={cn(
                            "h-[2px] flex-1",
                            idx < statusIndex ? "bg-cyan-300/70" : "bg-white/10"
                          )}
                        />
                      </React.Fragment>
                    );
                  })}
                </div>

                {dayOf && !waiver && (
                  <div className="mt-2 rounded-[14px] border border-amber-400/35 bg-amber-500/10 px-3 py-2">
                    <p className="text-[11px] text-amber-100/90">
                      Today is your service day — please sign the waiver before your technician begins work.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {appointments.length > showAppointments.length && (
            <p className="text-[11px] text-cyan-100/55">
              + {appointments.length - showAppointments.length} more in service
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   iOS Dashboard Page
============================================================ */

export default function IOSUserDashboardPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion ?? true;

  const [user, setUser] = React.useState<User | null>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);
  const [sessionMissing, setSessionMissing] = React.useState(false);

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [warranties, setWarranties] = React.useState<Warranty[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  const [appUserName, setAppUserName] = React.useState<string | null>(null);
  const [loadingAppUserName, setLoadingAppUserName] = React.useState(false);

  const [waiversByAppointmentId, setWaiversByAppointmentId] = React.useState<Record<string, WaiverRow>>({});
  const [loadingWaivers, setLoadingWaivers] = React.useState(false);

  const [invoices, setInvoices] = React.useState<TechInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = React.useState(false);

  const [apologyOpen, setApologyOpen] = React.useState(false);
  const [apologyApt, setApologyApt] = React.useState<Appointment | null>(null);

  const hardRefresh = React.useCallback(() => {
    try {
      window.location.reload();
    } catch {}
  }, []);

  /* ============================================================
     AUTH HYDRATION (iOS protected shell may already gate, but keep robust)
  ============================================================ */
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u1 = await supabaseClient.auth.getUser().catch(() => ({ data: { user: null } as any }));
        const authedUser = u1?.data?.user ?? null;

        if (!mounted) return;

        if (authedUser) {
          setUser({
            id: authedUser.id,
            email: authedUser.email ?? null,
            user_metadata: authedUser.user_metadata as any,
          });
          setSessionMissing(false);
          setLoadingUser(false);
          return;
        }

        // wait briefly for cookie hydration
        const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, s) => {
          if (!mounted) return;
          if (!s?.user) return;

          setUser({
            id: s.user.id,
            email: s.user.email ?? null,
            user_metadata: s.user.user_metadata as any,
          });
          setSessionMissing(false);
          setLoadingUser(false);
        });

        const t = setTimeout(async () => {
          if (!mounted) return;

          const u2 = await supabaseClient.auth.getUser().catch(() => ({ data: { user: null } as any }));
          const u = u2?.data?.user ?? null;

          if (u) {
            setUser({
              id: u.id,
              email: u.email ?? null,
              user_metadata: u.user_metadata as any,
            });
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

    let cancelled = false;
    (async () => {
      const res = await safeFetchJson("/api/user/bootstrap", { method: "POST" });
      if (!cancelled) void res;
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /* ============================================================
     Load app_users.full_name (match by email)
  ============================================================ */
  React.useEffect(() => {
    if (!user?.email) return;

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
  }, [user?.email]);

  /* ============================================================
     Load core data (appointments/vehicles/warranties)
     ✅ FIX: case-insensitive customer_email match
  ============================================================ */
  React.useEffect(() => {
    if (!user?.email) return;
    let stop = false;

    (async () => {
      setLoadingData(true);

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
  }, [user?.email]);

  /* ============================================================
     Load waivers for today’s appointments
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
    (appointmentId: string) => waiversByAppointmentId[appointmentId] ?? null,
    [waiversByAppointmentId]
  );

  /* ============================================================
     Load customer invoices (tech_invoices) — filter by customer_email
  ============================================================ */
  React.useEffect(() => {
    if (!user?.email) return;

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
          .ilike("customer_email", email)
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
  }, [user?.email]);

  /* ============================================================
     Waiver gating (iOS route)
  ============================================================ */
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
      router.replace(`${ROUTES.appointments}/${waiverDueAppointment.id}/waiver`);
      router.refresh?.();
    } catch {
      try {
        window.location.href = `${ROUTES.appointments}/${waiverDueAppointment.id}/waiver`;
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiverDueAppointment, loadingData, loadingWaivers]);

  /* ============================================================
     Crack-out dialog (same behavior)
  ============================================================ */
  React.useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    const candidate =
      appointments.find(
        (a) => isCrackOut(a) && ["completed", "paid"].includes((a.status ?? "").toLowerCase())
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
     Page: Loading / Session missing
  ============================================================ */
  if (loadingUser) {
    return (
      <LazyMotion features={domAnimation} strict>
        <div className="min-h-[70vh] grid place-items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-300" />
        </div>
      </LazyMotion>
    );
  }

  if (sessionMissing) {
    return (
      <LazyMotion features={domAnimation} strict>
        <div className="min-h-[70vh] grid place-items-center px-4">
          <div className="w-full max-w-lg">
            <GlassCard>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <TriangleAlert className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-cyan-50">
                      Session not detected yet
                    </h2>
                    <p className="mt-1 text-xs text-cyan-100/70">
                      Your device hasn’t hydrated the Supabase session cookie yet. A refresh usually fixes it.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          tinyHaptic();
                          hardRefresh();
                        }}
                        className="bg-gradient-to-r from-cyan-300 via-cyan-100 to-pink-300 text-black font-semibold"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>

                      <Link href={`${ROUTES.login}?redirect=${encodeURIComponent(BASE)}`}>
                        <Button
                          variant="outline"
                          className="border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                        >
                          <LogIn className="w-4 h-4 mr-2" />
                          Go to login
                        </Button>
                      </Link>
                    </div>

                    <p className="mt-3 text-[11px] text-cyan-100/55">
                      If Refresh fixes it, you’re good — no redirect loops.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </LazyMotion>
    );
  }

  /* ============================================================
     Main iOS dashboard layout — mobile elite (1:1 content)
  ============================================================ */
  return (
    <LazyMotion features={domAnimation} strict>
      <div
        className={cn("relative w-full max-w-full overflow-x-hidden")}
        style={
          {
            ["--tabbar-h" as any]: `${TABBAR_H}px`,
          } as React.CSSProperties
        }
      >
        {/* MAIN CONTENT */}
        <m.div
          initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(10px)" }}
          animate={reduce ? {} : { opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: easeOutExpo }}
          className="space-y-4 w-full max-w-full"
          style={{
            willChange: "transform, opacity, filter",
            paddingTop: `calc(${TOP_OFFSET}px)`,
            paddingBottom: "calc(var(--tabbar-h, 78px) + env(safe-area-inset-bottom) + 18px)",
          }}
        >
          {/* HERO — mirrors website content but iOS glass */}
          <GlassCard className="px-5 py-5">
            <div className="relative flex items-start justify-between gap-4 min-w-0">
              <div className="min-w-0">
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-50/80 shadow-[0_10px_40px_rgba(0,0,0,0.9)] min-w-0">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 truncate">Your command center</span>
                </div>

                <div className="mt-3 text-[18px] sm:text-[19px] font-semibold text-cyan-50">
                  Welcome back, {displayName} 👋
                </div>
                <div className="mt-1 text-[12px] text-cyan-100/75 break-words">
                  Track repairs, manage your garage, and keep every warranty and invoice at your fingertips.
                </div>

                {!appUserName && loadingAppUserName && (
                  <div className="mt-2 text-[11px] text-cyan-100/55">
                    Personalizing your dashboard…
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => tinyHaptic()}
                    asChild
                    className="h-10 rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-100 to-pink-300 text-black font-semibold text-[12px] shadow-[0_14px_40px_rgba(96,220,255,0.7)] hover:from-cyan-200 hover:via-cyan-50 hover:to-pink-200"
                  >
                    <Link href={ROUTES.eliteBook} className="min-w-0">
                      <span className="truncate">Quick Elite Book</span>
                      <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => tinyHaptic()}
                    asChild
                    className="h-10 rounded-2xl border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  >
                    <Link href={ROUTES.appointments} className="min-w-0 truncate">
                      View appointments
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[22px] border border-cyan-300/35 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_60%)] bg-cyan-500/10 shadow-[0_0_22px_rgba(96,220,255,0.9)]">
                <Wrench className="h-5 w-5 text-cyan-50" />
              </div>
            </div>
          </GlassCard>

          <StatusStrip />

          {/* Crack-out dialog */}
          {apologyApt && (
            <CrackOutApologyDialog
              appointment={apologyApt}
              open={apologyOpen}
              onOpenChange={setApologyOpen}
            />
          )}

          {/* Post-complete message (1:1 logic) */}
          {showPostCompleteMessage && (
            <GlassCard className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <CheckCircle className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-emerald-100">
                    Job complete! 🎉
                  </div>
                  <div className="mt-1 text-[12px] text-emerald-100/80">
                    Your service has been marked complete. Check invoices if any payment is still due. Warranties will show here after they’re issued.
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Vehicle tracker HUD (same idea as web) */}
          {ENABLE_3D && activeAppointments.length > 0 && (
            <VehicleStatusHUD
              appointments={activeAppointments}
              vehicles={vehicles}
              warranties={warranties}
              totalServices={appointments.length}
              waiverForAppointmentId={waiverForAppointmentId}
            />
          )}

          {/* Invoices (mobile elite, same content) */}
          <GlassCard className="px-0 py-0">
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-cyan-50">
                    <FileText className="w-4 h-4 text-cyan-200" />
                    Recent Invoices
                  </div>
                  <div className="mt-1 text-[11px] text-cyan-100/60">
                    Quick access to payments & receipts.
                  </div>
                </div>

                <Link href={ROUTES.pay} onClick={() => tinyHaptic()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-2xl border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06] text-[11px]"
                  >
                    View all
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>

              <div className="mt-3 space-y-2">
                {loadingInvoices ? (
                  <div className="text-[11px] text-cyan-100/55">Loading invoices…</div>
                ) : invoices.length === 0 ? (
                  <div className="text-[11px] text-cyan-100/55">No invoices found yet.</div>
                ) : (
                  invoices.slice(0, 5).map((inv) => {
                    const total = centsToDollars(inv.total_cents);
                    const paid = centsToDollars(inv.final_paid_cents);
                    const status = (inv.status ?? "unknown").replace(/_/g, " ");
                    const isPaid = (inv.status ?? "").toLowerCase() === "paid";

                    const dateLabel = inv.invoice_date
                      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
                          new Date(inv.invoice_date)
                        )
                      : inv.created_at
                        ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
                            new Date(inv.created_at)
                          )
                        : "Date";

                    return (
                      <Link
                        key={inv.id}
                        href={`${ROUTES.pay}/${inv.id}`}
                        onClick={() => tinyHaptic()}
                        className="block focus:outline-none"
                        aria-label={`Open invoice ${inv.invoice_number ?? inv.id}`}
                      >
                        <div className="rounded-[18px] border border-white/10 bg-white/5 hover:bg-white/[0.07] transition px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-cyan-50 font-semibold text-[12px] truncate">
                                {inv.invoice_number ? `Invoice ${inv.invoice_number}` : "Invoice"}
                              </div>
                              <div className="mt-1 text-[11px] text-cyan-100/60">
                                {dateLabel}
                                {inv.service_address ? (
                                  <span className="text-cyan-100/45"> · {inv.service_address}</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div className="text-cyan-50 font-semibold tabular-nums text-[12px]">
                                {total ? `$${total}` : "—"}
                              </div>
                              <div
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                  isPaid
                                    ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-100"
                                    : "bg-cyan-500/10 border-cyan-400/30 text-cyan-100"
                                )}
                              >
                                {status.toUpperCase()}
                              </div>
                              {paid && isPaid ? (
                                <div className="text-[10px] text-emerald-200/90">
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
              </div>
            </div>
          </GlassCard>

          {/* Stats grid (iOS: 2x2, mirrors web counts/targets) */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: Calendar,
                count: activeAppointments.length,
                label: "Active",
                href: ROUTES.appointments,
                grad:
                  "bg-[radial-gradient(circle_at_20%_20%,rgba(96,220,255,0.22),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(255,110,220,0.16),transparent_55%)]",
              },
              {
                icon: Car,
                count: vehicles.length,
                label: "Garage",
                href: ROUTES.garage,
                grad:
                  "bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.20),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(96,220,255,0.16),transparent_55%)]",
              },
              {
                icon: Shield,
                count: warranties.length,
                label: "Warranties",
                href: ROUTES.warranties,
                grad:
                  "bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(96,220,255,0.16),transparent_55%)]",
              },
              {
                icon: FileText,
                count: appointments.length,
                label: "Total",
                href: undefined,
                grad:
                  "bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.18),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(255,110,220,0.14),transparent_55%)]",
              },
            ].map((s, idx) => {
              const Icon = s.icon;

              const card = (
                <m.div
                  key={idx}
                  initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                  animate={reduce ? {} : { opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: easeOutExpo, delay: 0.06 + idx * 0.05 }}
                  whileTap={reduce ? {} : { scale: 0.98 }}
                  className="w-full"
                >
                  <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black/70 backdrop-blur-[18px] shadow-[0_22px_120px_rgba(0,0,0,0.94)] px-4 py-4">
                    <div className={cn("pointer-events-none absolute inset-0", s.grad)} />
                    <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_0_0,rgba(255,255,255,0.55),transparent_55%)]" />
                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <div className="grid h-10 w-10 place-items-center rounded-[18px] border border-white/10 bg-white/5">
                          <Icon className="h-5 w-5 text-cyan-50" />
                        </div>
                        <div className="text-[22px] font-bold text-cyan-50 tabular-nums">
                          {s.count}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold text-cyan-100/80">
                          {s.label}
                        </div>
                        {s.href ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/90">
                            Open
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="text-[10px] text-cyan-100/55">Summary</span>
                        )}
                      </div>
                    </div>
                  </div>
                </m.div>
              );

              if (!s.href) return card;

              return (
                <Link key={idx} href={s.href} onClick={() => tinyHaptic()} className="block">
                  {card}
                </Link>
              );
            })}
          </div>

          {(loadingData || loadingWaivers || loadingInvoices) && (
            <div className="text-center text-[11px] text-cyan-100/55 pt-2">
              Syncing your latest updates…
            </div>
          )}
        </m.div>

        {/* “Vanish into tabs” fade + glass lip */}
        <div
          aria-hidden
          className={cn("pointer-events-none fixed inset-x-0 z-[60]", "bottom-[var(--tabbar-h,78px)]")}
          style={{
            bottom: "calc(var(--tabbar-h,78px) + env(safe-area-inset-bottom))",
          }}
        >
          <div className="h-24 bg-gradient-to-t from-black via-black/65 to-transparent" />
          <div className="h-10 border-t border-white/10 bg-black/30 backdrop-blur-[18px] shadow-[0_-20px_60px_rgba(0,0,0,0.65)]" />
        </div>
      </div>
    </LazyMotion>
  );
}