// app/user/(protected)/UserProtectedShell.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Car,
  CalendarClock,
  Settings,
  Gift,
  ReceiptText,
  Shield,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import UserLayoutTopDiamond from "@/components/user/dashboard/layout/TopDiamond";

// ✅ Security badge (now NOT fixed; sits truly at bottom)
import SecurityRail from "@/components/user/security/SecurityRail";

/* -----------------------------------------------------------
   Tiny responsive helpers (shared mobile/desktop logic)
----------------------------------------------------------- */

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;

    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
    } else if (typeof (mql as any).addListener === "function") {
      (mql as any).addListener(handler);
    }

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handler);
      } else if (typeof (mql as any).removeListener === "function") {
        (mql as any).removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}

function useIsDesktop() {
  const wide = useMediaQuery("(min-width: 1024px)");
  const fine = useMediaQuery("(pointer: fine)");
  return wide && fine;
}

function useIsLandscape() {
  return useMediaQuery("(orientation: landscape)");
}

/* -----------------------------------------------------------
   Name helpers (NO email-derived names)
----------------------------------------------------------- */

function cleanName(s?: string | null) {
  const v = (s ?? "").trim();
  if (!v) return null;
  const collapsed = v.replace(/\s+/g, " ");
  return collapsed.length > 0 ? collapsed : null;
}

function buildNameFromMetadata(meta: any): string | null {
  if (!meta) return null;

  const full =
    cleanName(meta.full_name) ||
    cleanName(meta.name) ||
    cleanName([meta.first_name, meta.last_name].filter(Boolean).join(" ") || null);

  return full ?? null;
}

/* -----------------------------------------------------------
   Types & Nav config
----------------------------------------------------------- */

type NavTab = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const TABS: NavTab[] = [
  { href: "/user/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/user/dashboard/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/user/dashboard/garage", label: "Garage", icon: Car },
  { href: "/user/dashboard/pay", label: "Invoices", icon: ReceiptText },
  { href: "/user/dashboard/warranties", label: "Warranties", icon: Shield },
  { href: "/user/dashboard/referrals", label: "Referrals", icon: Gift },
  { href: "/user/dashboard/settings", label: "Settings", icon: Settings },
];

function isActiveTab(pathname: string, href: string) {
  const p = pathname.replace(/\/+$/, "");
  const h = href.replace(/\/+$/, "");

  if (h === "/user/dashboard") {
    return p === "/user/dashboard" || p === "/user";
  }

  return p === h || p.startsWith(h + "/");
}

/* -----------------------------------------------------------
   Background FX
----------------------------------------------------------- */

function RadiantBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0">
      <div className="absolute -top-40 -left-40 h-[26rem] w-[26rem] rounded-full bg-sky-500/18 blur-3xl" />
      <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-emerald-400/14 blur-3xl" />
      <div className="absolute bottom-[-8rem] left-1/4 h-[24rem] w-[24rem] rounded-full bg-indigo-500/18 blur-3xl" />

      <div className="absolute inset-0 opacity-40 mix-blend-soft-light bg-[radial-gradient(circle_at_top,#1e293b_0,transparent_55%),radial-gradient(circle_at_bottom,#020617_0,transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(220deg,rgba(148,163,184,0.09)_1px,transparent_1px)] bg-[length:120px_120px]" />

      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')",
        }}
      />
    </div>
  );
}

/* -----------------------------------------------------------
   Client shell
----------------------------------------------------------- */

export default function UserProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/user/dashboard";
  const prefersReducedMotion = useReducedMotion();

  const isDesktop = useIsDesktop();
  const isLandscape = useIsLandscape();
  const [forceDesktop, setForceDesktop] = React.useState(false);

  const [hasOpenInvoice, setHasOpenInvoice] = React.useState(false);
  const [hasActiveAppointment, setHasActiveAppointment] = React.useState(false);

  const [userName, setUserName] = React.useState<string | null>(null);

  /* ---------------------- hydrate forceDesktop ---------------------- */
  React.useEffect(() => {
    if (isDesktop) return;
    try {
      const saved = localStorage.getItem("gg_forceDesktop");
      if (saved === "1") setForceDesktop(true);
    } catch {}
  }, [isDesktop]);

  /* ---------------------- viewport / scaling logic ---------------------- */
  React.useEffect(() => {
    function ensureViewportMeta(): HTMLMetaElement | null {
      try {
        let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = "viewport";
          document.head.appendChild(meta);
        }
        return meta;
      } catch {
        return null;
      }
    }

    const setViewport = () => {
      const meta = ensureViewportMeta();
      if (!meta) return;

      if (isDesktop) {
        meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
        try {
          localStorage.removeItem("gg_forceDesktop");
        } catch {}
        document.documentElement.classList.remove("force-desktop");
        return;
      }

      const desktopWidth = 1100;

      if (forceDesktop) {
        const deviceW = Math.max(window.innerWidth, document.documentElement.clientWidth || 0);
        const scale = Math.max(0.25, Math.min(1, deviceW / desktopWidth));
        meta.setAttribute("content", `width=${desktopWidth}, initial-scale=${scale}, viewport-fit=cover`);
        document.documentElement.classList.add("force-desktop");
      } else {
        meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
        document.documentElement.classList.remove("force-desktop");
      }
    };

    try {
      if (!isDesktop) localStorage.setItem("gg_forceDesktop", forceDesktop ? "1" : "0");
    } catch {}

    setViewport();

    if (!isDesktop && forceDesktop) {
      const onResize = () => setViewport();
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
      };
    }
  }, [isDesktop, forceDesktop]);

  /* ---------------------- hydrate name + badges (best-effort) ---------------------- */
  React.useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const { data } = await supabaseClient.auth.getUser();
        const user = data?.user ?? null;
        if (!user || !mounted) return;

        const meta = user.user_metadata as any;
        const nameFromMeta = buildNameFromMetadata(meta);

        let resolvedName = nameFromMeta;

        // Fetch app_users row once so we can use app_users.id (client_id)
        let appUserId: string | null = null;

        if (user.email) {
          try {
            const { data: row, error } = await supabaseClient
              .from("app_users")
              .select("id, full_name")
              .ilike("email", user.email)
              .maybeSingle();

            if (!error && row) {
              appUserId = (row as any).id ?? null;
              if (!resolvedName) resolvedName = cleanName((row as any)?.full_name ?? null);
            }
          } catch {}
        }

        if (mounted) setUserName(resolvedName ?? null);

        const [invoiceRes, aptRes] = await Promise.all([
          // ✅ tech_invoices uses client_id (app_users.id), not user_id (auth.users.id)
          appUserId
            ? supabaseClient
                .from("tech_invoices")
                .select("id, status, client_id")
                .eq("client_id", appUserId)
                .eq("status", "sent")
                .limit(1)
            : Promise.resolve({ data: [], error: null } as any),

          user.email
            ? supabaseClient
                .from("appointments")
                .select("id, status, customer_email")
                .eq("customer_email", user.email)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (!mounted) return;

        if (!invoiceRes.error && invoiceRes.data) setHasOpenInvoice(invoiceRes.data.length > 0);

        if (!aptRes.error && aptRes.data) {
          const active = aptRes.data.some((a: any) => {
            const s = (a.status ?? "").toLowerCase();
            return !["completed", "cancelled", "paid"].includes(s);
          });
          setHasActiveAppointment(active);
        }
      } catch {}
    }

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const personalizedMessage = React.useMemo(() => {
    const nameVal = userName || "there";

    const baseA: Array<(n: string) => string> = [
      (n) => `From first crack to final shine — we’ve got you, ${n}.`,
      (n) => `Windshield worries off your mind, ${n}. Drive, we’ll handle the glass.`,
      (n) => `${n}, your glass is today’s main character.`,
      (n) => `Chips, cracks, road rash — we keep your glass ready, ${n}.`,
      (n) => `Park easy, ${n} — we’re on glass watch.`,
      (n) => `Glass stress down, road confidence up, ${n}.`,
      (n) => `${n}, every drive should look day-one fresh.`,
    ];

    const baseB: Array<(n: string) => string> = [
      (n) => `Heads up, ${n} — your invoices live under Invoices whenever you’re ready.`,
      (n) => `${n}, your billing trail is tucked neatly in Invoices.`,
    ];

    const baseC: Array<(n: string) => string> = [
      (n) => `${n}, your appointments update in real time — no guessing, just progress.`,
      (n) => `We’ll keep your appointment status crystal clear, ${n}.`,
    ];

    const baseD: Array<(n: string) => string> = [
      (n) => `${n}, consider this your personal glass command center.`,
      (n) => `Welcome back, ${n}. Your glass, your data, one cockpit.`,
    ];

    const pool = [...baseA, baseA[0], baseB[0], baseC[0], baseD[0]];

    const key = nameVal.toLowerCase();
    const seed =
      key.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
      (hasOpenInvoice ? 7 : 0) +
      (hasActiveAppointment ? 13 : 0);

    const pick = pool[Math.abs(seed) % pool.length] ?? baseA[0];
    let msg = pick(nameVal);

    const extras: string[] = [];
    if (hasOpenInvoice) extras.push("You’ve got a repair invoice waiting under Invoices.");
    if (hasActiveAppointment) extras.push("We’ll keep your appointment tracker updated step by step.");
    if (extras.length > 0) msg = `${msg} ${extras.join(" ")}`;

    return msg;
  }, [userName, hasOpenInvoice, hasActiveAppointment]);

  return (
    <div className="relative min-h-[100dvh] bg-slate-950 text-slate-50 overflow-x-visible">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 rounded bg-sky-500 px-3 py-2 text-sm font-medium"
      >
        Skip to content
      </a>

      <RadiantBackdrop />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl gap-6 px-4 py-6 lg:px-8 lg:py-8">
        {/* Sidebar (desktop) */}
        <aside
          className="sticky top-6 hidden md:flex md:h-[calc(100dvh-3rem)] md:flex-col md:items-start"
          aria-label="Primary navigation"
        >
          <div className="group relative flex h-full items-center">
            <motion.div
              whileHover={prefersReducedMotion ? undefined : { rotateY: -2 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="flex h-auto max-h-[520px] w-14 flex-col justify-between overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/80 bg-clip-padding p-2 shadow-[0_18px_45px_rgba(15,23,42,0.85)] backdrop-blur-2xl transition-[width,box-shadow] duration-300 group-hover:w-56 group-focus-within:w-56 group-hover:shadow-[0_24px_60px_rgba(15,23,42,0.98)]"
              role="navigation"
              aria-label="Sidebar"
              tabIndex={-1}
            >
              <div className="mb-4 flex items-center justify-center gap-2 px-1">
                <UserLayoutTopDiamond />
                <div
                  className="
                    ml-1 hidden w-0 flex-col text-xs font-semibold tracking-wide 
                    text-slate-100 opacity-0 translate-x-1
                    transition-all duration-200
                    group-hover:flex group-hover:w-auto group-hover:opacity-100 group-hover:translate-x-0
                    group-focus-within:flex group-focus-within:w-auto group-focus-within:opacity-100 group-focus-within:translate-x-0
                  "
                >
                  <span className="uppercase leading-3">Glass Guardian</span>
                  <span className="text-[0.65rem] uppercase text-slate-300/90">User Dashboard</span>
                  <span className="mt-1 text-[0.68rem] font-normal text-slate-300/90 leading-snug max-w-[210px]">
                    {personalizedMessage}
                  </span>
                </div>
              </div>

              <nav className="flex flex-1 flex-col gap-1" aria-label="User navigation">
                {TABS.map((tab) => {
                  const active = isActiveTab(pathname, tab.href);
                  const Icon = tab.icon;
                  const urgent = tab.href === "/user/dashboard/pay" && hasOpenInvoice;

                  const baseClasses =
                    "group/nav relative flex w-full items-center rounded-2xl text-sm transition-all duration-200 focus-visible:outline-none";
                  const layoutClasses =
                    "gap-0 justify-center px-0 py-2 group-hover:px-2 group-focus-within:px-2 group-hover:justify-between group-focus-within:justify-between";
                  const stateClasses = active
                    ? "bg-gradient-to-br from-sky-700/18 to-slate-800/30 text-sky-200 ring-1 ring-sky-500/15 shadow-[0_8px_30px_rgba(14,165,233,0.06)]"
                    : "text-slate-200/80 hover:bg-slate-800/50 hover:text-slate-50";
                  const iconWrapperClasses = [
                    "inline-flex shrink-0 h-8 w-8 items-center justify-center rounded-2xl border text-[0.9rem]",
                    active ? "border-sky-500/30 bg-sky-600/8" : "border-slate-700/70 bg-slate-900/80",
                  ].join(" ");
                  const labelClasses = [
                    "pointer-events-none max-w-0 overflow-hidden whitespace-nowrap text-[0.83rem] font-medium tracking-wide opacity-0 translate-x-1 transition-all duration-200",
                    active ? "text-sky-100" : "text-slate-50",
                    "group-hover:max-w-[190px] group-hover:opacity-100 group-hover:translate-x-0 group-hover:ml-2",
                    "group-focus-within:max-w-[190px] group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:ml-2",
                  ].join(" ");

                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      title={tab.label}
                      className={[baseClasses, layoutClasses, stateClasses].join(" ")}
                    >
                      <span className={iconWrapperClasses} aria-hidden>
                        <Icon className={active ? "h-4 w-4 text-sky-200" : "h-4 w-4 text-slate-100"} />
                        {urgent && (
                          <span className="relative ml-[-0.1rem] mt-[-0.25rem] inline-flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/80 opacity-80" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
                          </span>
                        )}
                      </span>
                      <span className={labelClasses} aria-hidden={!active}>
                        {tab.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              <div
                className="
                  mt-3 hidden w-0 items-center gap-2 rounded-2xl bg-slate-900/85 px-2 py-2 
                  text-[0.7rem] text-slate-400/85 transition-all duration-200
                  group-hover:flex group-hover:w-auto
                  group-focus-within:flex group-focus-within:w-auto
                "
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[0.65rem]">
                  v1
                </span>
                <span className="leading-tight">
                  Glass Guardian user hub
                  <br />
                  Built for clarity.
                </span>
              </div>
            </motion.div>
          </div>
        </aside>

        {/* Main content */}
        <main id="content" className="flex-1">
          {/* Mobile nav */}
          <header className="mb-4 md:hidden">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.8)]">
              {/* ... (rest of your component stays unchanged) */}
              {/* Keeping your existing mobile nav + rest of JSX exactly as-is */}
              <nav
                role="tablist"
                aria-label="Mobile navigation"
                className={[
                  "flex gap-3",
                  isLandscape
                    ? "flex-row overflow-x-auto pl-3 pr-3 py-3 items-center"
                    : "flex-col gap-2 max-h-[50vh] overflow-y-auto px-3 py-3 touch-auto",
                ].join(" ")}
              >
                {TABS.map((tab, idx) => {
                  const active = isActiveTab(pathname, tab.href);
                  const Icon = tab.icon;
                  const urgent = tab.href === "/user/dashboard/pay" && hasOpenInvoice;

                  const baseBtn =
                    "relative inline-flex items-center gap-3 text-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60";

                  const portraitBtn =
                    "w-full rounded-xl px-3 py-3 justify-start text-left bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800";

                  const landscapeBtn =
                    "rounded-full px-3 py-2 whitespace-nowrap bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800 flex-shrink-0";

                  const activeClasses = active
                    ? "bg-sky-500 text-slate-950 border-sky-400 shadow-[0_6px_18px_rgba(56,189,248,0.18)]"
                    : "";

                  const finalClass = [
                    baseBtn,
                    isLandscape ? landscapeBtn : portraitBtn,
                    activeClasses,
                    isLandscape && idx === TABS.length - 1 ? "mr-2" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={finalClass}
                      title={tab.label}
                      aria-current={active ? "page" : undefined}
                      role="tab"
                      tabIndex={0}
                    >
                      <Icon className={isLandscape ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
                      <span className={isLandscape ? "text-xs font-semibold" : "text-sm font-medium"}>
                        {tab.label}
                      </span>
                      {urgent && (
                        <span className="relative ml-2 inline-flex h-2.5 w-2.5" aria-hidden>
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/80 opacity-80" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>

          <div className="max-w-7xl">
            {children}

            {/* ✅ TRUE bottom-of-page security badge (NOT fixed, NOT overlay) */}
            <SecurityRail />
          </div>
        </main>
      </div>

      {!isDesktop && (
        <div className="w-full flex justify-center pb-6">
          <button
            type="button"
            onClick={() => setForceDesktop((s) => !s)}
            aria-pressed={forceDesktop}
            aria-label={forceDesktop ? "Exit desktop view" : "Switch to desktop view"}
            className="
              inline-flex items-center justify-center
              px-4 py-2 rounded-full
              text-xs font-semibold tracking-wide
              border border-slate-600/80
              bg-slate-950/90 text-slate-100
              shadow-[0_6px_16px_rgba(0,0,0,0.4)]
            "
          >
            {forceDesktop ? "Exit desktop view" : "Desktop view"}
          </button>
        </div>
      )}
    </div>
  );
}