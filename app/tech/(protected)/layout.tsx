"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import {
  Gauge,
  FileText,
  CalendarDays,
  Users,
  Car,
  Settings,
  Shield,
} from "lucide-react";

import DevBanner from "@/components/DevBanner";
import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";
import { localISODate } from "@/lib/dateLocal";

const TECH_TZ = "America/Los_Angeles";

/* --------------------------- Shell --------------------------- */

function GlassShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 520px at -12% -10%, rgba(56,189,248,0.24), transparent 58%), radial-gradient(850px 560px at 112% -4%, rgba(20,184,166,0.18), transparent 62%), radial-gradient(760px 460px at 50% 115%, rgba(245,158,11,0.08), transparent 62%), linear-gradient(180deg, #020617 0%, #07111f 46%, #020617 100%)",
          }}
        />

        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency%3D%220.85%22 numOctaves%3D%224%22 stitchTiles%3D%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity%3D%220.35%22/></svg>')",
          }}
        />

        <div className="absolute -top-44 -left-44 h-96 w-96 rounded-full bg-cyan-400/16 blur-3xl" />
        <div className="absolute -right-44 top-10 h-96 w-96 rounded-full bg-teal-400/14 blur-3xl" />
        <div className="absolute -bottom-48 left-1/3 h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-px w-[80vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />
      </div>

      {children}
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
        "relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.055] shadow-[0_24px_90px_rgba(2,6,23,0.78)] backdrop-blur-2xl",
        className,
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.055) 28%, rgba(56,189,248,0.08) 52%, rgba(15,23,42,0.05) 100%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
      />

      <div className="relative">{children}</div>
    </div>
  );
}

/* --------------------------- Tabs --------------------------- */

type TechTab = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const TECH_TABS: TechTab[] = [
  { href: "/tech/dashboard", label: "Dashboard", mobileLabel: "Home", icon: Gauge },
  {
    href: "/tech/dashboard/schedule",
    label: "Schedule",
    mobileLabel: "Jobs",
    icon: CalendarDays,
  },
  {
    href: "/tech/dashboard/invoices",
    label: "Invoices",
    mobileLabel: "Bills",
    icon: FileText,
  },
  { href: "/tech/dashboard/users", label: "Users", mobileLabel: "Users", icon: Users },
  {
    href: "/tech/dashboard/vehicles",
    label: "Vehicles",
    mobileLabel: "Cars",
    icon: Car,
  },
  {
    href: "/tech/dashboard/settings",
    label: "Settings",
    mobileLabel: "Setup",
    icon: Settings,
  },
];

function isTabActive(pathname: string | null, href: string) {
  if (href === "/tech/dashboard") {
    return pathname === "/tech/dashboard" || pathname === "/tech/dashboard/";
  }
  return Boolean(pathname?.startsWith(href));
}

/* --------------------------- Responsive helper --------------------------- */

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);

    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [query]);

  return matches;
}

/* --------------------------- Layout --------------------------- */

export default function TechDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const [displayName, setDisplayName] = React.useState("Tech");
  const [techEmail, setTechEmail] = React.useState<string | null>(null);

  const todayISO = React.useMemo(() => localISODate(TECH_TZ), []);

  const activeTab = React.useMemo(
    () => TECH_TABS.find((tab) => isTabActive(pathname, tab.href)) ?? TECH_TABS[0],
    [pathname]
  );

  const useLeftRail = useMediaQuery("(min-width: 768px) and (max-width: 1100px)");

  React.useEffect(() => {
    let mounted = true;

    async function loadTechIdentity() {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;

      if (session) {
        const name =
          (session.user.user_metadata as any)?.full_name ||
          session.user.email?.split("@")[0] ||
          "Tech";

        if (!mounted) return;

        setDisplayName(name);
        setTechEmail(session.user.email ?? null);
        return;
      }

      const role = readDevRoleFromCookie();

      if (role === "tech") {
        const dev = makeDevUser("tech");

        if (!mounted) return;

        setDisplayName(dev.user_metadata?.full_name || "Dev Tech");
        setTechEmail(dev.email || "dev.tech@example.com");
      }
    }

    loadTechIdentity();

    return () => {
      mounted = false;
    };
  }, []);

  const { data: todayJobs = [] } = useQuery({
    queryKey: ["tech:layout-today-jobs", techEmail, todayISO],
    enabled: !!techEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("id,status,scheduled_date,scheduled_time_start")
        .eq("technician_email", techEmail)
        .eq("scheduled_date", todayISO)
        .order("scheduled_time_start", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  return (
    <GlassShell>
      {/* Fixed desktop/tablet header (clean + prestige) */}
      <motion.header
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="tech-fixed fixed inset-x-0 top-0 z-[100] hidden md:block"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-7xl px-8 pt-4">
          <div className="mb-3">
            <DevBanner />
          </div>

          <div className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-slate-950/70 shadow-[0_26px_110px_rgba(2,6,23,0.86)] backdrop-blur-2xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 36%, rgba(56,189,248,0.06) 62%, rgba(2,6,23,0.0) 100%)",
              }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
            />

            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl"
            />

            <div className="relative px-6 py-5">
              <div className="flex items-center justify-between gap-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_0_0_1px_rgba(56,189,248,0.10),0_18px_55px_rgba(0,0,0,0.55)]">
                    <Shield className="h-5 w-5 text-slate-50" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/80">
                        TECH CONSOLE
                      </p>
                    </div>

                    <h1 className="mt-1 truncate text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-50">
                      {displayName}
                    </h1>

                    <p className="mt-0.5 truncate text-sm text-slate-400">
                      {format(new Date(), "EEEE, MMMM d , yyyy")} • Stay sharp. 
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-inner">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Jobs Today
                    </p>
                    <div className="mt-1 flex items-baseline justify-end gap-2">
                      <p className="text-3xl font-bold leading-none tracking-tight text-slate-50">
                        {todayJobs.length}
                      </p>
                      <p className="text-xs font-medium text-slate-400">total</p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                aria-hidden
                className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
              />

              {!useLeftRail && (
                <div className="mt-4">
                  <GlassPanel className="rounded-[1.35rem] border-white/10 bg-white/[0.045] shadow-[0_20px_70px_rgba(2,6,23,0.55)]">
                    <div className="px-3 py-2.5">
                      <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
                        {TECH_TABS.map((tab) => {
                          const Icon = tab.icon;
                          const isActive = tab.href === activeTab.href;

                          return (
                            <Link
                              key={tab.href}
                              href={tab.href}
                              aria-current={isActive ? "page" : undefined}
                              className="group relative shrink-0"
                            >
                              <div
                                className={[
                                  "relative inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium backdrop-blur-xl transition-all",
                                  isActive
                                    ? "border-sky-200/60 bg-sky-400/18 text-slate-50 shadow-[0_12px_40px_rgba(56,189,248,0.30)]"
                                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/18 hover:bg-white/[0.06] hover:text-slate-50",
                                ].join(" ")}
                              >
                                {isActive && (
                                  <motion.span
                                    layoutId="tech-active-tab-desktop"
                                    className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-sky-300/16 via-cyan-200/8 to-emerald-300/10"
                                    transition={{
                                      duration: prefersReducedMotion ? 0 : 0.22,
                                      ease: "easeOut",
                                    }}
                                  />
                                )}

                                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                                <span>{tab.label}</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </GlassPanel>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Fixed mobile mini header */}
      <motion.header
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="tech-fixed fixed inset-x-0 top-0 z-[100] md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 pt-3">
          <div className="mb-2">
            <DevBanner />
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/74 px-4 py-3 shadow-[0_18px_70px_rgba(2,6,23,0.84)] backdrop-blur-2xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
            />

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">
                  TECH CONSOLE
                </p>

                <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-slate-50">
                  {displayName}
                </h1>

                <p className="truncate text-[11px] text-slate-400">
                  {format(new Date(), "EEE, MMM d, yyyy")}
                </p>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Jobs
                </p>
                <p className="text-xl font-bold leading-none text-slate-50">
                  {todayJobs.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Left rail */}
      <motion.aside
        aria-label="Tech desktop side navigation"
        className="tech-fixed fixed bottom-0 top-0 z-[95] hidden md:block"
        style={{
          left: "max(0px, env(safe-area-inset-left))",
          paddingTop: "calc(env(safe-area-inset-top) + 214px)",
          paddingBottom: "1.25rem",
          width: useLeftRail ? 96 : 0,
          pointerEvents: useLeftRail ? "auto" : "none",
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : {
                opacity: useLeftRail ? 1 : 0,
                x: useLeftRail ? 0 : -18,
              }
        }
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="h-full pl-3">
          <div className="h-full w-[78px] overflow-hidden rounded-[1.45rem] border border-white/10 bg-slate-950/68 shadow-[0_26px_110px_rgba(2,6,23,0.80)] backdrop-blur-2xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
            <div className="relative flex h-full flex-col items-center gap-2 px-2 py-3">
              {TECH_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.href === activeTab.href;

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "relative grid w-full place-items-center rounded-2xl border px-2 py-2.5 transition",
                      isActive
                        ? "border-sky-200/55 bg-sky-400/16 text-slate-50 shadow-[0_0_28px_rgba(56,189,248,0.22)]"
                        : "border-transparent text-slate-300 hover:bg-white/[0.06] hover:text-slate-50",
                    ].join(" ")}
                    title={tab.label}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="tech-active-tab-rail"
                        className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-sky-300/16 via-cyan-200/8 to-emerald-300/10"
                        transition={{
                          duration: prefersReducedMotion ? 0 : 0.22,
                          ease: "easeOut",
                        }}
                      />
                    )}
                    <Icon className="h-[18px] w-[18px] opacity-95" />
                    <span className="mt-1 w-full truncate text-center text-[10px] font-medium">
                      {tab.mobileLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* FADE OVERLAY: makes content look like it fades under the header */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[90]"
        style={{
          height: "260px",
          paddingTop: "env(safe-area-inset-top)",
          background:
            "linear-gradient(to bottom, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.65) 35%, rgba(2,6,23,0.25) 70%, rgba(2,6,23,0) 100%)",
        }}
      />

      {/* CONTENT REVEAL: premium fade-in from bottom feel WITHOUT transforms */}
      <motion.div
        initial={
          prefersReducedMotion
            ? false
            : {
                opacity: 0,
                clipPath: "inset(10% 0% 0% 0% round 24px)",
              }
        }
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                clipPath: "inset(0% 0% 0% 0% round 24px)",
                transition: {
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                },
              }
        }
        className={[
          "mx-auto max-w-7xl px-4 md:px-8",
          "pt-[124px] md:pt-[214px]",
          "pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:pb-8",
          useLeftRail ? "md:pl-[120px]" : "",
        ].join(" ")}
        style={{
          WebkitMaskImage: "-webkit-radial-gradient(white, black)",
        }}
      >
        <motion.section
          key={activeTab.href}
          initial={prefersReducedMotion ? undefined : { opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.section>
      </motion.div>

      {/* Mobile bottom dock */}
      <nav
        className="tech-fixed fixed inset-x-0 bottom-0 z-[110] border-t border-white/10 bg-slate-950/80 px-2 pt-2 shadow-[0_-18px_60px_rgba(2,6,23,0.86)] backdrop-blur-2xl md:hidden"
        aria-label="Tech mobile navigation"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)",
        }}
      >
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="mx-auto grid max-w-md grid-cols-6 gap-1"
        >
          {TECH_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.href === activeTab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border px-1 py-2 text-[10px] font-medium transition",
                  isActive
                    ? "border-sky-200/55 bg-sky-400/14 text-slate-50 shadow-[0_0_28px_rgba(56,189,248,0.22)]"
                    : "border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
                ].join(" ")}
              >
                {isActive && (
                  <motion.span
                    layoutId="tech-active-tab-mobile"
                    className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-sky-300/14 via-cyan-200/7 to-emerald-300/9"
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.22,
                      ease: "easeOut",
                    }}
                  />
                )}

                <Icon className="h-4 w-4 shrink-0 opacity-95" />
                <span className="max-w-full truncate">{tab.mobileLabel}</span>
              </Link>
            );
          })}
        </motion.div>
      </nav>

      <style>{`
        html,
        body {
          overflow-x: hidden;
        }

        .tech-fixed {
          transform: translate3d(0, 0, 0);
          -webkit-transform: translate3d(0, 0, 0);
          will-change: transform;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @supports (-webkit-touch-callout: none) {
          .tech-fixed {
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }
        }

        @media print {
          header,
          nav,
          aside {
            display: none !important;
          }
        }
      `}</style>
    </GlassShell>
  );
}