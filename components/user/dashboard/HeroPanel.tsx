// components/dashboard/HeroPanel.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

const Lazy3DVisual = dynamic(
  () => import("./Hero3DPlaceholder").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-gradient-to-br from-slate-800/30 to-slate-900/40 rounded-xl animate-pulse" />
    ),
  }
);

type HeroPanelProps = {
  upcoming?: any | null;
  onBook?: () => void;
};

/**
 * HeroPanel - shows next appointment (if any) plus CTA and visual.
 */
export default function HeroPanel({ upcoming, onBook }: HeroPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full flex flex-col md:flex-row gap-4 items-stretch">
      {/* Left: content */}
      <div className="flex-1 min-h-[150px]">
        {/* KPI + CTA row */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-sm text-slate-300">Next Service</div>
            <div className="mt-1 text-xl font-extrabold text-slate-50">
              {upcoming ? (
                <>
                  {(upcoming.service_type ?? "Service")
                    .replace(/_/g, " ")
                    .toUpperCase()}
                  <span className="ml-3 text-sm font-medium text-slate-300">
                    • {upcoming?.status}
                  </span>
                </>
              ) : (
                <>No upcoming service</>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBook}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md hover:bg-sky-600"
            >
              Book a service
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Appointment summary or empty-state */}
        {upcoming ? (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4"
            role="group"
            aria-label="Upcoming appointment"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-sky-300" />
                  <div className="text-sm text-slate-200 font-medium">
                    {upcoming.scheduled_date
                      ? new Date(
                          upcoming.scheduled_date
                        ).toLocaleString()
                      : "TBD"}
                  </div>
                </div>

                {upcoming.service_address && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="w-4 h-4" />
                    <div>{upcoming.service_address}</div>
                  </div>
                )}

                <div className="mt-3 text-xs text-slate-400">
                  {upcoming.eta_minutes && upcoming.status === "en_route" ? (
                    <>
                      <Clock className="inline-block w-3.5 h-3.5 mr-2 text-orange-400" />
                      Technician arriving in {upcoming.eta_minutes} min
                    </>
                  ) : (
                    "Open details for more info"
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-2">
                <Link
                  href={`/user/dashboard/appointments/${upcoming.id}`}
                  className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-sm text-slate-100 hover:bg-white/15"
                >
                  View details
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 text-center">
            <div className="text-sm text-slate-300 mb-3">
              You don&apos;t have any upcoming bookings.
            </div>
            <button
              onClick={onBook}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md hover:bg-sky-600"
            >
              Book your first service
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Right: visual / placeholder */}
      <div className="w-full md:w-1/3 min-h-[150px] rounded-xl overflow-hidden border border-slate-800/60 bg-gradient-to-br from-slate-800/40 to-slate-900/50">
        <Lazy3DVisual />
      </div>
    </div>
  );
}