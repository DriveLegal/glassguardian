// app/tech/(protected)/layout.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Gauge, FileText, CalendarDays, Users, Car } from "lucide-react";

import DevBanner from "@/components/DevBanner";

/* --------------------------- Shell + glass helpers --------------------------- */

function GlassShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient gradient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 480px at -10% -10%, rgba(59,130,246,0.22), transparent 55%), radial-gradient(840px 520px at 110% 0%, rgba(16,185,129,0.18), transparent 60%), linear-gradient(180deg, #020617, #020617 24%, #020617 40%, #020617 100%)",
          }}
        />
        {/* soft texture */}
        <div
          className="absolute inset-0 opacity-[0.09] mix-blend-overlay"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency%3D%220.9%22 numOctaves%3D%224%22 stitchTiles%3D%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity%3D%220.32%22/></svg>')",
          }}
        />
        {/* extra glow */}
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute -bottom-44 -right-44 h-[24rem] w-[24rem] rounded-full bg-emerald-600/22 blur-3xl" />
      </div>

      <main className="px-4 md:px-8 py-5 md:py-7 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}

function GlassPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.85)]",
        className,
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(148,163,184,0.25), rgba(15,23,42,0.1) 40%, transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* --------------------------- Tabs config --------------------------- */

type TechTab = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const TECH_TABS: TechTab[] = [
  { href: "/tech/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/tech/dashboard/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/tech/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/tech/dashboard/users", label: "Users", icon: Users },
  { href: "/tech/dashboard/vehicles", label: "Vehicles", icon: Car },
];

/* --------------------------- Layout --------------------------- */

export default function TechDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const activeTab = React.useMemo(
    () =>
      TECH_TABS.find((tab) => {
        if (tab.href === "/tech/dashboard") {
          return pathname === "/tech/dashboard" || pathname === "/tech/dashboard/";
        }
        return pathname.startsWith(tab.href);
      }) ?? TECH_TABS[0],
    [pathname]
  );

  return (
    <GlassShell>
      {/* Dev banner (shows content only in dev mode internally) */}
      <div className="mb-4">
        <DevBanner />
      </div>

      {/* Sticky header + tabs */}
      <motion.header
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mb-5 sticky top-0 z-40"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="backdrop-blur-xl bg-slate-950/35 rounded-2xl border border-white/10 shadow-[0_22px_80px_rgba(2,6,23,0.7)]">
          <div className="px-4 md:px-5 py-3 md:py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-sky-300/80">
                  TECH CONSOLE
                </p>
                <h1 className="text-xl md:text-2xl font-semibold text-slate-50">
                  {activeTab.label}
                </h1>
                <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                  Manage your route, jobs, money, and customers in one place.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 border border-emerald-400/40 text-emerald-200 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Live route view
                </span>
              </div>
            </div>

            {/* Tabs row: mobile-safe (no cut off) */}
            <GlassPanel className="overflow-hidden">
              <div className="px-2.5 md:px-4 py-2.5">
                <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {TECH_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.href === activeTab.href;

                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className="group relative shrink-0"
                      >
                        <div
                          className={[
                            "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs md:text-sm border backdrop-blur transition-all",
                            isActive
                              ? "border-sky-400/80 bg-sky-500/30 text-sky-50 shadow-[0_10px_35px_rgba(56,189,248,0.55)]"
                              : "border-white/10 bg-slate-900/50 text-slate-200 hover:bg-slate-800/80 hover:border-sky-300/60 hover:text-sky-100",
                          ].join(" ")}
                        >
                          <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                          <span>{tab.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      </motion.header>

      {/* Content area */}
      <motion.section
        key={activeTab.href}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.section>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @media print {
          body { background: #ffffff !important; }
          main { padding: 0 !important; }
          .backdrop-blur-xl { -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </GlassShell>
  );
}