//components/user/dashboard/page/sectioncards.tsx
// components/user/dashboard/page/sectioncards.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, Car, Shield, FileText, ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

function fireMicroHaptic() {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  try {
    navigator.vibrate(7);
  } catch {}
}

function SectionStatCard({
  Icon,
  count,
  label,
  delay,
  href,
  live,
}: {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count: number;
  label: string;
  delay: number;
  href?: string;
  live?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  const content = (
    <motion.div
      initial={
        prefersReducedMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 18, scale: 0.985 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 160, damping: 20 }}
      whileHover={prefersReducedMotion ? undefined : { y: -7, scale: 1.018 }}
      className={`will-change-transform [perspective:900px] ${href ? "cursor-pointer" : ""}`}
      onMouseEnter={fireMicroHaptic}
    >
      <Card className="gg-stat-card border-none text-white overflow-hidden relative bg-transparent">
        <div className="absolute inset-0 gg-stat-graphite-base" />
        <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-slate-300/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.18),transparent_42%)]" />
        <div className="gg-card-particles gg-stat-particles" aria-hidden="true" />

        {live ? (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/16 bg-white/10 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
            <span className="gg-live-dot" />
            Live
          </div>
        ) : null}

        <div className="relative z-10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <motion.div
                animate={live && !prefersReducedMotion ? { scale: [1, 1.055, 1] } : undefined}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className="gg-stat-icon grid h-11 w-11 place-items-center rounded-2xl border border-white/12 bg-white/9"
              >
                <Icon className="w-6 h-6 opacity-95 text-slate-100" />
              </motion.div>

              <motion.span
                className="text-3xl font-bold tabular-nums text-slate-50"
                initial={prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: 0.78, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: delay + 0.25,
                  type: "spring",
                  stiffness: 170,
                  damping: 18,
                }}
              >
                {count}
              </motion.span>
            </div>
          </CardHeader>

          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-xs font-medium text-slate-300">{label}</p>

            {href ? (
              <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-slate-200 transition-transform duration-300 group-hover:translate-x-1">
                Open
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            ) : null}
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="group block focus:outline-none">
      <div className="rounded-2xl focus-visible:ring-2 focus-visible:ring-slate-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
        {content}
      </div>
    </Link>
  );
}

export default function SectionCards({
  activeAppointmentsCount,
  vehiclesCount,
  warrantiesCount,
  totalServicesCount,
}: {
  activeAppointmentsCount: number;
  vehiclesCount: number;
  warrantiesCount: number;
  totalServicesCount: number;
}) {
  return (
    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <SectionStatCard
        Icon={Calendar}
        count={activeAppointmentsCount}
        label="Active Appointments"
        delay={0}
        href="/user/dashboard/appointments"
        live={activeAppointmentsCount > 0}
      />

      <SectionStatCard
        Icon={Car}
        count={vehiclesCount}
        label="Registered Vehicles"
        delay={0.08}
        href="/user/dashboard/garage"
        live={false}
      />

      <SectionStatCard
        Icon={Shield}
        count={warrantiesCount}
        label="Active Warranties"
        delay={0.16}
        href="/user/dashboard/warranties"
        live={warrantiesCount > 0}
      />

      <SectionStatCard
        Icon={FileText}
        count={totalServicesCount}
        label="Total Services"
        delay={0.24}
        live={false}
      />
    </div>
  );
}