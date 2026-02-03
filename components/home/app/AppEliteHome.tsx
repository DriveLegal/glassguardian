// components/home/app/AppEliteHome.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { CosmicScene, usePageVisible } from "@/components/home/app/cosmic";
import {
  CalendarClock,
  ArrowRight,
  Loader2,
  Sparkles,
  ShieldCheck,
  User,
  CalendarDays,
} from "lucide-react";

/**
 * GLASS GUARDIAN · PRIME ENTRY (OLED / NEON · CINEMATIC iOS) — ELITE (SMOOTH)
 * -----------------------------------------------------------------------------------------
 * Updates requested:
 * • Put Login first, then Book
 * • Add "wow" effect (premium glow, shimmer, depth) with performance-safe animation
 * • Keep intro + keep it smooth (no heavy infinite 3D / no complex loops)
 * • Defer ambient loops until idle + only on home phase
 */

const DASHBOARD_ROUTE = "/ios/user/dashboard";
const BOOK_ROUTE = "/ios/book";
const LOGIN_ROUTE = "/ios/user/login";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;
const INTRO_DURATION_MS = 3000;

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

/* =========================================================================================
   LIGHT INTRO — SAME VIBE, LESS GPU
========================================================================================= */

function IntroOrb({ reduce }: { reduce: boolean }) {
  if (reduce) return null;

  return (
    <m.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 grid place-items-center"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
      transition={{ duration: 0.7, ease: easeOutExpo }}
    >
      <div className="relative h-[320px] w-[320px] sm:h-[360px] sm:w-[360px]">
        <m.div
          className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, rgba(96,220,255,0.55), transparent 58%), radial-gradient(circle at 70% 78%, rgba(255,110,220,0.48), transparent 62%)",
            opacity: 0.72,
          }}
          initial={{ scale: 0.72, opacity: 0 }}
          animate={{ scale: [0.72, 1.02, 1], opacity: [0, 0.9, 0.72] }}
          transition={{ duration: 1.5, ease: easeOutExpo, delay: 0.08 }}
        />

        <m.div
          className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.98), rgba(148,234,255,0.18) 38%, rgba(0,0,0,1) 75%)",
            boxShadow:
              "0 0 86px rgba(96,220,255,0.9), 0 0 170px rgba(56,189,248,0.62)",
            maskImage:
              "radial-gradient(circle at 30% 20%, black 0, black 62%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(circle at 30% 20%, black 0, black 62%, transparent 100%)",
          }}
          initial={{ scale: 0.78, opacity: 0 }}
          animate={{ scale: [0.78, 1.04, 1], opacity: 1, rotateZ: [0, 2, 0] }}
          transition={{ duration: 1.45, ease: easeOutExpo }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 10% 20%, rgba(96,220,255,0.52), transparent 58%), radial-gradient(circle at 80% 75%, rgba(255,110,220,0.42), transparent 62%)",
              mixBlendMode: "screen",
              opacity: 0.8,
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 40% 25%, transparent 0, transparent 40%, rgba(0,0,0,0.92) 76%)",
            }}
          />
        </m.div>

        <m.div
          className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/35"
          style={{
            boxShadow:
              "0 0 40px rgba(96,220,255,0.55), inset 0 0 80px rgba(0,0,0,0.92)",
          }}
          initial={{ scale: 0.84, opacity: 0 }}
          animate={{ scale: [0.84, 1.02, 1], opacity: [0, 1, 0.85] }}
          transition={{ duration: 1.1, ease: easeOutExpo, delay: 0.12 }}
        />
      </div>
    </m.div>
  );
}

/* =========================================================================================
   ELITE CARD (wow shimmer) — PERF SAFE
========================================================================================= */

function EliteActionCard({
  title,
  subtitle,
  icon,
  cta,
  onClick,
  primary,
  reduce,
  enableAmbient,
  delay = 0,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  cta: string;
  onClick: () => void;
  primary?: boolean;
  reduce: boolean;
  enableAmbient: boolean;
  delay?: number;
}) {
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(10px)" }}
      animate={reduce ? {} : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: easeOutExpo, delay }}
      className="relative"
      style={{ willChange: "transform, opacity, filter" }}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[28px] border backdrop-blur-[20px] transform-gpu",
          primary
            ? "border-cyan-300/40 bg-black/72 shadow-[0_38px_190px_rgba(0,0,0,0.98)]"
            : "border-white/12 bg-black/68 shadow-[0_28px_150px_rgba(0,0,0,0.96)]"
        )}
      >
        {/* inner stroke */}
        <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />

        {/* soft color field */}
        <div
          className={cn(
            "pointer-events-none absolute -inset-36",
            primary
              ? "bg-[radial-gradient(circle_at_22%_18%,rgba(96,220,255,0.26),transparent_48%),radial-gradient(circle_at_78%_72%,rgba(255,110,220,0.22),transparent_56%)]"
              : "bg-[radial-gradient(circle_at_22%_18%,rgba(96,220,255,0.16),transparent_52%),radial-gradient(circle_at_78%_72%,rgba(255,110,220,0.12),transparent_58%)]"
          )}
        />

        {/* premium shimmer sweep (only if ambient enabled) */}
        {enableAmbient && !reduce && (
          <m.div
            aria-hidden
            className="pointer-events-none absolute -inset-2"
            style={{
              background:
                "linear-gradient(110deg, transparent 22%, rgba(255,255,255,0.12) 34%, rgba(96,220,255,0.22) 42%, transparent 58%)",
              opacity: primary ? 0.36 : 0.26,
              filter: "blur(3px)",
              willChange: "transform",
            }}
            animate={{ x: ["-70%", "170%"] }}
            transition={{
              duration: primary ? 2.8 : 3.2,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: primary ? 1.25 : 1.55,
            }}
          />
        )}

        {/* subtle float (super light) */}
        <m.div
          animate={enableAmbient && !reduce ? { y: [0, -3, 0] } : {}}
          transition={
            enableAmbient && !reduce
              ? { duration: 10, repeat: Infinity, ease: "easeInOut" }
              : {}
          }
          style={{ willChange: enableAmbient && !reduce ? "transform" : undefined }}
          className="relative px-4 py-4"
        >
          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                "grid h-11 w-11 place-items-center rounded-2xl border",
                primary
                  ? "border-cyan-300/45 bg-cyan-500/10"
                  : "border-white/12 bg-white/[0.04]"
              )}
            >
              {icon}
            </div>

            <div className="flex-1">
              <div className="text-[13px] font-semibold text-cyan-50">{title}</div>
              <div className="mt-0.5 text-[11px] text-cyan-100/75">{subtitle}</div>
            </div>

            <m.div whileTap={reduce ? {} : { scale: 0.97 }}>
              <Button
                type="button"
                onClick={onClick}
                variant={primary ? "default" : "outline"}
                className={cn(
                  "h-9 rounded-2xl px-3.5 text-[12px] transform-gpu",
                  primary
                    ? "bg-gradient-to-r from-cyan-300 via-cyan-100 to-pink-300 text-black font-semibold hover:from-cyan-200 hover:via-cyan-50 hover:to-pink-200 shadow-[0_10px_30px_rgba(96,220,255,0.72)]"
                    : "border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                )}
              >
                {cta}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </m.div>
          </div>

          {/* micro “glow underline” */}
          <div className="mt-3 h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </m.div>
      </div>
    </m.div>
  );
}

export default function AppEliteHome() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion ?? true;
  const pageVisible = usePageVisible();

  const [phase, setPhase] = React.useState<"intro" | "home">("intro");
  const [routingOut, setRoutingOut] = React.useState(false);
  const [ambientReady, setAmbientReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      setAmbientReady(true);
    };

    const ric = (window as any).requestIdleCallback?.(go, { timeout: 1100 });
    const t = window.setTimeout(go, 820);

    return () => {
      cancelled = true;
      try {
        (window as any).cancelIdleCallback?.(ric);
      } catch {}
      window.clearTimeout(t);
    };
  }, []);

  const enableAmbient =
    !reduce && pageVisible && !routingOut && ambientReady && phase === "home";

  React.useEffect(() => {
    const t = window.setTimeout(() => setPhase("home"), INTRO_DURATION_MS);
    return () => window.clearTimeout(t);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const prefetch = () => {
      if (cancelled) return;
      try {
        router.prefetch?.(DASHBOARD_ROUTE);
        router.prefetch?.(BOOK_ROUTE);
        router.prefetch?.(LOGIN_ROUTE);
      } catch {}
    };

    const ric = (window as any).requestIdleCallback?.(prefetch, { timeout: 1400 });
    const t = window.setTimeout(prefetch, 1000);

    return () => {
      cancelled = true;
      try {
        (window as any).cancelIdleCallback?.(ric);
      } catch {}
      window.clearTimeout(t);
    };
  }, [router]);

  const goLogin = React.useCallback(() => {
    tinyHaptic();
    setRoutingOut(true);
    window.setTimeout(() => router.push(LOGIN_ROUTE), 180);
  }, [router]);

  const goBook = React.useCallback(() => {
    tinyHaptic();
    setRoutingOut(true);
    window.setTimeout(() => router.push(BOOK_ROUTE), 180);
  }, [router]);

  return (
    <LazyMotion features={domAnimation} strict>
      <main
        className="relative min-h-screen overflow-hidden bg-black text-white"
        role="main"
        aria-label="Glass Guardian cosmic entry"
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <CosmicScene
          variant="prime"
          enableParallax={enableAmbient}
          enableMeteors={enableAmbient}
          enableConstellation={enableAmbient}
        />

        {/* Routing overlay */}
        <AnimatePresence>
          {routingOut && (
            <m.div
              key="routingOut"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-50 grid place-items-center"
              style={{ willChange: "opacity" }}
            >
              <div className="relative rounded-[26px] border border-cyan-300/35 bg-black/70 px-6 py-4 backdrop-blur-[22px] shadow-[0_36px_160px_rgba(0,0,0,0.98)]">
                <div className="pointer-events-none absolute -inset-24 rounded-[32px] bg-[radial-gradient(circle_at_30%_20%,rgba(96,220,255,0.18),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(255,110,220,0.14),transparent_60%)]" />
                <div className="relative flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/55 bg-cyan-500/10">
                    <Sparkles className="h-5 w-5 text-cyan-50" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-cyan-50">Loading…</div>
                    <div className="text-xs text-cyan-100/75">One moment</div>
                  </div>
                  <Loader2 className="ml-1 h-4 w-4 animate-spin text-cyan-100/80" />
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* INTRO */}
          {phase === "intro" && !routingOut && (
            <m.section
              key="intro"
              initial={reduce ? false : { opacity: 0, scale: 0.992, filter: "blur(10px)" }}
              animate={reduce ? {} : { opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? {} : { opacity: 0, scale: 1.01, filter: "blur(12px)" }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className="relative z-10 grid min-h-screen place-items-center px-6"
              style={{ willChange: "transform, opacity, filter" }}
            >
              <IntroOrb reduce={reduce} />

              <div className="relative">
                <m.div
                  initial={reduce ? false : { y: 16, opacity: 0, scale: 0.95 }}
                  animate={reduce ? {} : { y: 0, opacity: 1, scale: [0.95, 1.02, 1] }}
                  transition={{ duration: 0.95, ease: easeOutExpo }}
                  className="relative flex flex-col items-center gap-5 transform-gpu"
                  style={{ willChange: "transform, opacity" }}
                >
                  <m.div
                    className="h-20 w-20 rounded-[26px] bg-black/70 backdrop-blur-3xl border border-cyan-300/45 shadow-[0_28px_110px_rgba(0,0,0,0.98)] flex items-center justify-center transform-gpu"
                    initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                    animate={reduce ? {} : { opacity: 1, scale: 1 }}
                    transition={{ delay: 0.06, duration: 0.6, ease: easeOutExpo }}
                    style={{ willChange: "transform, opacity" }}
                  >
                    <div className="relative h-14 w-14 rounded-[20px] bg-gradient-to-br from-cyan-300 via-cyan-50 to-pink-300 shadow-[0_0_38px_rgba(96,220,255,0.85)] flex items-center justify-center">
                      <ShieldCheck className="h-7 w-7 text-black/90" />
                      <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.9),transparent_55%)] opacity-65" />
                    </div>
                  </m.div>

                  <m.div
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={reduce ? {} : { opacity: 1, y: 0 }}
                    transition={{ delay: 0.16, duration: 0.7, ease: easeOutExpo }}
                    className="text-center"
                  >
                    <div className="text-[28px] sm:text-[30px] font-semibold tracking-tight text-cyan-50">
                      Glass Guardian
                    </div>
                    <div className="mt-1 text-[12px] text-cyan-100/80">
                      Fast booking. Secure dashboard.
                    </div>
                  </m.div>
                </m.div>

                <div className="mx-auto mt-8 h-[2px] w-[120px] overflow-hidden rounded-full bg-cyan-500/20">
                  {!reduce && (
                    <m.div
                      className="h-full w-full bg-gradient-to-r from-cyan-300 via-cyan-50 to-pink-300"
                      initial={{ x: "-100%" }}
                      animate={{ x: "0%" }}
                      transition={{ duration: INTRO_DURATION_MS / 1000, ease: "linear" }}
                    />
                  )}
                </div>
              </div>
            </m.section>
          )}

          {/* HOME */}
          {phase === "home" && !routingOut && (
            <m.section
              key="home"
              initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(10px)", scale: 0.995 }}
              animate={reduce ? {} : { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
              transition={{ duration: 0.7, ease: easeOutExpo }}
              className={cn(
                "relative z-10 mx-auto w-full max-w-[540px]",
                "px-4 pb-12 pt-8 sm:px-5 sm:pt-12"
              )}
              style={{ willChange: "transform, opacity, filter" }}
            >
              <div className="flex justify-center mb-3">
                <div className="h-1.5 w-12 rounded-full bg-white/12 backdrop-blur-sm" />
              </div>

              <div className="mb-6 text-center">
                <m.div
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={reduce ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: easeOutExpo }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-50/80"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Prime access</span>
                </m.div>

                <m.h1
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.06 }}
                  className="mt-3 text-[22px] font-semibold text-cyan-50"
                >
                  Welcome back
                </m.h1>

                <m.p
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.1 }}
                  className="mt-1 text-[12px] text-cyan-100/70"
                >
                  Login for your dashboard, or book instantly.
                </m.p>
              </div>

              {/* ACTIONS (Login first, then Book) */}
              <div className="grid gap-4">
                <EliteActionCard
                  title="User login"
                  subtitle="Appointments, invoices, warranty — synced."
                  icon={<User className="h-5 w-5 text-cyan-50" />}
                  cta="Login"
                  onClick={goLogin}
                  primary
                  reduce={reduce}
                  enableAmbient={enableAmbient}
                  delay={0.0}
                />

                <EliteActionCard
                  title="Quick booking"
                  subtitle="No login needed — book in seconds."
                  icon={<CalendarClock className="h-5 w-5 text-cyan-50" />}
                  cta="Book"
                  onClick={goBook}
                  reduce={reduce}
                  enableAmbient={enableAmbient}
                  delay={0.08}
                />
              </div>

              {/* trust strip */}
              <m.div
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={reduce ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.16 }}
                className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[11px] text-cyan-100/65"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Fast scheduling
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ultra clean
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Warranty-backed
                </span>
              </m.div>

              {/* micro status pill */}
              <div className="mt-6 flex justify-center">
                <div className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-[10px] text-cyan-100/70 border border-white/5 backdrop-blur-sm">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(96,220,255,0.8)]" />
                  Orbit stable • Ready
                </div>
              </div>
            </m.section>
          )}
        </AnimatePresence>
      </main>
    </LazyMotion>
  );
}