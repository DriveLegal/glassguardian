"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Star, Car as CarIcon, Shield, Clock, MapPin } from "lucide-react";

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

export type Vehicle = {
  id: string;
  vin?: string | null;
  created_at?: string | number | Date;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  license_plate?: string | null;
  insurance_carrier?: string | null;
  is_default?: boolean;
  body_type?: BodyStyle | null;

  // Keep optional: not required for booking + safe if null
  photo_url?: string | null;

  // Optional extra fields
  mileage?: number | null;
  last_service_date?: string | null;
  location?: string | null;
  warranty_summary?: string | null;
};

/* -------------------------------------------------------
   Image map for each style
------------------------------------------------------- */

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

/* -------------------------------------------------------
   Hint table (extend as needed)
------------------------------------------------------- */

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

/* -------------------------------------------------------
   Color → hex for glow
------------------------------------------------------- */

function mapColorToHex(color?: string | null): string {
  if (!color) return "#2563eb"; // default blue

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

/* -------------------------------------------------------
   Infer body style
------------------------------------------------------- */

function inferBodyStyle(vehicle: Vehicle): BodyStyle {
  if (vehicle.body_type) return vehicle.body_type;

  const name = `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.toLowerCase();

  // hybrid / EV first
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

/* -------------------------------------------------------
   Small helpers
------------------------------------------------------- */

function formatAddedDate(created_at?: string | number | Date) {
  if (!created_at) return null;
  const d = new Date(created_at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function computeServiceMeta(last_service_date?: string | null) {
  if (!last_service_date) {
    return {
      label: "No service recorded",
      due: false,
    };
  }
  const d = new Date(last_service_date);
  if (Number.isNaN(d.getTime())) {
    return {
      label: "No service recorded",
      due: false,
    };
  }
  const now = Date.now();
  const diffDays = (now - d.getTime()) / (1000 * 60 * 60 * 24);
  const label = `Last serviced ${d.toLocaleDateString()}`;
  const due = diffDays > 365; // simple 1-year heuristic
  return { label, due };
}

function safeTrim(v?: string | null) {
  return (v ?? "").trim();
}

/* -------------------------------------------------------
   Inline placeholder (data URI) for image fallback
------------------------------------------------------- */
const PLACEHOLDER_DATAURI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='560' height='360' viewBox='0 0 560 360' fill='none'><rect width='100%' height='100%' rx='18' fill='%230b1220'/><g opacity='0.85' fill='%239aa7b6'><path d='M90 255c24-34 72-62 140-62s116 28 140 62H90z'/></g><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' fill='%236f7a84' font-family='Helvetica,Arial' font-size='20'>No Image</text></svg>`
  );

/* -------------------------------------------------------
   VehicleCard (display-only)
   ✅ Product-ready Ready-to-book glow rule:
      - VIN on file
      - Insurance saved
      - (Plate optional) — if you want plate required, enable the line below
------------------------------------------------------- */

export default function VehicleCard({
  vehicle,
  index = 0,
}: {
  vehicle: Vehicle;
  index?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  const title = `${vehicle.year ?? ""} ${vehicle.make ?? ""}`.trim();
  const bodyStyle = inferBodyStyle(vehicle);
  const defaultIllustration = BODY_STYLE_IMAGE[bodyStyle];
  const colorHex = mapColorToHex(vehicle.color);
  const addedDate = formatAddedDate(vehicle.created_at);

  const prettyBody =
    bodyStyle === "stationwagon"
      ? "Station Wagon"
      : bodyStyle === "pickup"
      ? "Pickup Truck"
      : bodyStyle === "sportscar"
      ? "Sportscar"
      : bodyStyle === "hybrid"
      ? "Hybrid / Electric"
      : bodyStyle.charAt(0).toUpperCase() + bodyStyle.slice(1);

  const hasVin = safeTrim(vehicle.vin).length > 0;
  const hasInsurance = safeTrim(vehicle.insurance_carrier).length > 0;
  const hasPlate = safeTrim(vehicle.license_plate).length > 0;

  // ✅ This is the key fix: Ready-to-book should not depend on photo_url.
  // If you want plate required too, change to: hasVin && hasInsurance && hasPlate
  const readyToBook = hasVin && hasInsurance;

  const { label: serviceLabel, due: serviceDue } = computeServiceMeta(
    vehicle.last_service_date
  );

  const hasLocation = safeTrim(vehicle.location).length > 0;
  const hasWarranty = safeTrim(vehicle.warranty_summary).length > 0;

  // image src state + robust fallback
  const initialSrc =
    safeTrim(vehicle.photo_url).length > 0 ? String(vehicle.photo_url) : defaultIllustration;

  const [src, setSrc] = useState<string>(initialSrc);

  useEffect(() => {
    setSrc(
      safeTrim(vehicle.photo_url).length > 0
        ? String(vehicle.photo_url)
        : defaultIllustration
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.photo_url, defaultIllustration]);

  const readyChipClass = useMemo(() => {
    if (!readyToBook) {
      return "border-slate-700 bg-slate-900/60 text-slate-300";
    }
    // Product-ready glow: subtle + premium
    return [
      "border-emerald-400/70 bg-emerald-500/15 text-emerald-100",
      "shadow-[0_0_18px_rgba(16,185,129,0.55)]",
    ].join(" ");
  }, [readyToBook]);

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: prefersReducedMotion ? 0 : index * 0.06,
        type: "spring",
        stiffness: 160,
        damping: 20,
      }}
      whileHover={prefersReducedMotion ? undefined : { y: -6, scale: 1.01 }}
    >
      <Card className="border border-slate-800/80 bg-slate-950/90 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.95)] overflow-hidden rounded-2xl">
        {/* Header */}
        <CardHeader className="pb-3 border-b border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div
                className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-500 flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.7)]"
                aria-hidden={true}
              >
                <CarIcon className="w-6 h-6 text-white" />
                <div className="absolute inset-0 rounded-2xl border border-white/30 opacity-30" />
              </div>

              <div>
                <CardTitle className="text-base md:text-sm lg:text-base font-semibold text-slate-50">
                  {title || "Unnamed Vehicle"}
                </CardTitle>
                <div className="text-xs md:text-[0.75rem] text-slate-400">
                  {vehicle.model ?? "Model not set"}
                </div>
                {addedDate && (
                  <div className="mt-1 text-[0.7rem] text-slate-500">
                    Added {addedDate}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {vehicle.is_default && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[0.7rem] font-semibold text-amber-200 ring-1 ring-amber-300/30 shadow-[0_0_14px_rgba(251,191,36,0.55)]">
                  <Star className="w-3.5 h-3.5 text-amber-300" />
                  Default
                </span>
              )}
              {hasPlate && (
                <span className="inline-flex items-center rounded-full bg-slate-900/70 px-2 py-0.5 text-[0.65rem] font-medium text-slate-300 border border-slate-700/80">
                  Plate:{" "}
                  <span className="ml-1 tabular-nums tracking-[0.08em] text-slate-100">
                    {String(vehicle.license_plate).toUpperCase()}
                  </span>
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 pb-4 md:pb-5">
          {/* Updating badge above car image (optional) */}
          <div className="flex justify-center mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/60 px-2.5 py-1 text-[0.7rem] font-medium text-amber-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              Updating Images: <span className="font-semibold">Be out soon..</span>
            </span>
          </div>

          {/* Vehicle visual */}
          <div className="relative rounded-xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 overflow-hidden shadow-[0_18px_40px_rgba(15,23,42,0.9)]">
            {/* color glow behind car */}
            <div
              className="absolute inset-[-35%] blur-3xl opacity-90"
              style={{
                background: `radial-gradient(circle at 50% 65%, ${colorHex}, transparent 60%)`,
              }}
              aria-hidden={true}
            />
            <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light bg-[radial-gradient(circle_at_top,#0f172a_0,transparent_55%),radial-gradient(circle_at_bottom,#020617_0,transparent_60%)]" />

            <div className="relative h-32 w-full">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm border border-white/15 text-[0.65rem] font-semibold tracking-wide text-slate-100">
                {prettyBody}
              </div>

              <Image
                src={src}
                alt={
                  safeTrim(vehicle.photo_url).length > 0
                    ? `${title} photo`
                    : `${prettyBody} illustration`
                }
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className={
                  safeTrim(vehicle.photo_url).length > 0
                    ? "object-cover object-center rounded-lg border border-slate-800/80"
                    : "object-contain object-center pointer-events-none select-none"
                }
                onError={() => setSrc(PLACEHOLDER_DATAURI)}
              />
            </div>
          </div>

          {/* Spec block */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/85 px-4 py-3">
            <div className="grid grid-cols-2 gap-2 text-xs md:text-[0.8rem] text-slate-300">
              <div className="text-slate-500">Type</div>
              <div className="font-medium text-slate-100">{prettyBody}</div>

              <div className="text-slate-500">Color</div>
              <div className="font-medium">{vehicle.color ? vehicle.color : "Not set"}</div>

              <div className="text-slate-500">Insurance</div>
              <div className="font-medium">{vehicle.insurance_carrier || "Not added"}</div>

              <div className="text-slate-500">VIN</div>
              <div className="font-medium truncate">
                {hasVin ? (
                  <span className="font-mono text-[0.7rem] tracking-[0.08em]">
                    {String(vehicle.vin).toUpperCase()}
                  </span>
                ) : (
                  "Not on file"
                )}
              </div>

              {typeof vehicle.mileage === "number" && (
                <>
                  <div className="text-slate-500">Mileage</div>
                  <div className="font-medium">{vehicle.mileage.toLocaleString()} mi</div>
                </>
              )}
            </div>
          </div>

          {/* Status + extra widgets */}
          <div className="space-y-2 pt-1">
            {/* Row 1: core status chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] border ${
                  hasVin
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-900/60 text-slate-300"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {hasVin ? "VIN on file" : "VIN missing"}
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] border ${
                  hasInsurance
                    ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                    : "border-slate-700 bg-slate-900/60 text-slate-300"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {hasInsurance ? "Insurance saved" : "Insurance not set"}
              </span>

              {/* ✅ READY TO BOOK: now tied to VIN + insurance, with premium glow */}
              <motion.span
                className={`relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] border ${readyChipClass}`}
                animate={
                  prefersReducedMotion || !readyToBook
                    ? undefined
                    : {
                        boxShadow: [
                          "0 0 12px rgba(16,185,129,0.35)",
                          "0 0 22px rgba(16,185,129,0.60)",
                          "0 0 12px rgba(16,185,129,0.35)",
                        ],
                      }
                }
                transition={
                  prefersReducedMotion || !readyToBook
                    ? undefined
                    : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                }
                aria-label={readyToBook ? "Ready to book" : "Not ready to book yet"}
                title={
                  readyToBook
                    ? "Ready to book"
                    : "Add VIN + Insurance to enable booking"
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    readyToBook ? "bg-emerald-400" : "bg-slate-500"
                  } ${
                    readyToBook
                      ? "shadow-[0_0_10px_rgba(16,185,129,0.9)]"
                      : ""
                  }`}
                />
                Ready to book

                {!prefersReducedMotion && readyToBook && (
                  <span
                    className="pointer-events-none absolute -inset-1 rounded-full opacity-40 blur-md"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.55), transparent 65%)",
                    }}
                    aria-hidden="true"
                  />
                )}
              </motion.span>
            </div>

            {/* Row 2: optional service / location / warranty widgets */}
            {(vehicle.last_service_date || hasLocation || hasWarranty) && (
              <div className="flex flex-wrap items-center gap-2">
                {vehicle.last_service_date && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] border ${
                      serviceDue
                        ? "border-red-500/60 bg-red-500/10 text-red-200"
                        : "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {serviceLabel}
                  </span>
                )}

                {hasLocation && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] border border-slate-700 bg-slate-900/70 text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-sky-300" />
                    {vehicle.location}
                  </span>
                )}

                {hasWarranty && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] border border-indigo-500/60 bg-indigo-500/10 text-indigo-200">
                    <Shield className="w-3.5 h-3.5" />
                    {vehicle.warranty_summary}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}