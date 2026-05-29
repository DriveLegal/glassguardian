"use client";

import * as React from "react";
import Image from "next/image";
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
  ArrowRight,
  Loader2,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

const LOGIN_ROUTE = "/ios/user/login";
const LOGO_SRC = "/branding/glass-guardian-gold.png";
const INTRO_MS = 1750;

const EASE = [0.22, 1, 0.36, 1] as const;

function cn(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function tinyHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.(10);
    }
  } catch {}
}

function IntroStage({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative flex flex-col items-center justify-center">
      {!reduce && (
        <>
          <m.div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,210,90,0.22) 0%, rgba(255,210,90,0.08) 38%, transparent 72%)",
              filter: "blur(22px)",
            }}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, ease: EASE }}
          />
          <m.div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(96,220,255,0.10), transparent 42%), radial-gradient(circle at 70% 70%, rgba(255,110,220,0.08), transparent 46%)",
              filter: "blur(28px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.08 }}
          />
        </>
      )}

      <m.div
        className="relative"
        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.94 }}
        animate={reduce ? {} : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.58, ease: EASE }}
        style={{ willChange: "transform, opacity" }}
      >
        <div className="relative h-[124px] w-[124px] sm:h-[148px] sm:w-[148px]">
          <div className="absolute inset-0 rounded-full border border-white/10 bg-black/20 backdrop-blur-[8px]" />
          <Image
            src={LOGO_SRC}
            alt="Glass Guardian"
            fill
            priority
            sizes="148px"
            quality={100}
            className="object-contain drop-shadow-[0_18px_48px_rgba(0,0,0,0.9)] select-none"
          />
        </div>
      </m.div>

      <m.div
        className="mt-4 text-center"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={reduce ? {} : { opacity: 1, y: 0 }}
        transition={{ duration: 0.48, ease: EASE, delay: 0.06 }}
      >
        <div className="text-[28px] font-semibold tracking-tight text-white sm:text-[32px]">
          Glass Guardian
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-amber-100/75">
          Prestige windshield protection
        </div>
      </m.div>

      <div className="mt-6 h-[2px] w-[110px] overflow-hidden rounded-full bg-white/10">
        {!reduce && (
          <m.div
            className="h-full w-full bg-gradient-to-r from-cyan-300 via-amber-200 to-pink-300"
            initial={{ x: "-100%" }}
            animate={{ x: "0%" }}
            transition={{ duration: INTRO_MS / 1000, ease: "linear" }}
          />
        )}
      </div>
    </div>
  );
}

function HomeHero({ reduce }: { reduce: boolean }) {
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={reduce ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="mb-6 flex flex-col items-center text-center"
    >
      <div className="relative mb-3 h-[82px] w-[82px]">
        <div className="absolute inset-[-10%] rounded-full bg-[radial-gradient(circle,rgba(255,210,90,0.18),transparent_68%)] blur-[18px]" />
        <Image
          src={LOGO_SRC}
          alt="Glass Guardian"
          fill
          priority
          sizes="82px"
          quality={100}
          className="object-contain drop-shadow-[0_14px_32px_rgba(0,0,0,0.85)] select-none"
        />
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-50/80">
        <Sparkles className="h-3 w-3" />
        <span>Prime entry</span>
      </div>

      <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-white">
        Welcome back
      </h1>

      <p className="mt-1 max-w-[310px] text-[12px] text-cyan-100/70">
        Prestige access to your dashboard, appointments, invoices, and warranty.
      </p>
    </m.div>
  );
}

function PrimaryLoginCard({
  onClick,
  reduce,
  enableAmbient,
}: {
  onClick: () => void;
  reduce: boolean;
  enableAmbient: boolean;
}) {
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={reduce ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.04 }}
      className="relative"
      style={{ willChange: "transform, opacity" }}
    >
      <div className="relative overflow-hidden rounded-[30px] border border-cyan-300/30 bg-black/60 backdrop-blur-[16px] shadow-[0_24px_90px_rgba(0,0,0,0.82)]">
        <div className="absolute inset-0 rounded-[30px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
        <div className="absolute -inset-20 bg-[radial-gradient(circle_at_20%_18%,rgba(255,210,90,0.14),transparent_34%),radial-gradient(circle_at_30%_28%,rgba(96,220,255,0.16),transparent_42%),radial-gradient(circle_at_76%_74%,rgba(255,110,220,0.14),transparent_48%)]" />

        {enableAmbient && !reduce && (
          <m.div
            aria-hidden
            className="pointer-events-none absolute -inset-3"
            style={{
              background:
                "linear-gradient(112deg, transparent 22%, rgba(255,255,255,0.04) 34%, rgba(96,220,255,0.10) 42%, rgba(255,210,90,0.10) 47%, transparent 58%)",
              filter: "blur(4px)",
            }}
            animate={{ x: ["-70%", "160%"] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 1.3,
            }}
          />
        )}

        <div className="relative px-4 py-4">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/35 bg-cyan-400/10">
              <User className="h-5 w-5 text-cyan-50" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-white">User login</div>
              <div className="mt-0.5 text-[11px] text-cyan-100/72">
                Secure access for account and service history.
              </div>
            </div>

            <Button
              type="button"
              onClick={onClick}
              className="h-10 rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-100 to-pink-300 px-4 text-[12px] font-semibold text-black shadow-[0_10px_28px_rgba(96,220,255,0.38)] hover:from-cyan-200 hover:via-white hover:to-pink-200"
            >
              Login
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
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

  React.useEffect(() => {
    const t = window.setTimeout(() => setPhase("home"), INTRO_MS);
    return () => window.clearTimeout(t);
  }, []);

  React.useEffect(() => {
    try {
      router.prefetch?.(LOGIN_ROUTE);
    } catch {}
  }, [router]);

  const enableAmbient = !reduce && pageVisible && !routingOut && phase === "home";

  const goLogin = React.useCallback(() => {
    tinyHaptic();
    setRoutingOut(true);
    window.setTimeout(() => router.push(LOGIN_ROUTE), 140);
  }, [router]);

  return (
    <LazyMotion features={domAnimation} strict>
      <main
        className="relative min-h-screen overflow-hidden bg-black text-white"
        aria-label="Glass Guardian iOS entry"
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <CosmicScene intensity="lite" animated={enableAmbient} />

        <div className="pointer-events-none absolute inset-0 z-[1]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.03),transparent_32%),radial-gradient(circle_at_20%_25%,rgba(96,220,255,0.06),transparent_26%),radial-gradient(circle_at_80%_70%,rgba(255,110,220,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.10),rgba(0,0,0,0.22)_42%,rgba(0,0,0,0.58))]" />
        </div>

        <AnimatePresence>
          {routingOut && (
            <m.div
              key="route-out"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute inset-0 z-50 grid place-items-center"
            >
              <div className="rounded-[24px] border border-cyan-300/30 bg-black/70 px-5 py-4 backdrop-blur-[18px] shadow-[0_22px_80px_rgba(0,0,0,0.85)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/35 bg-cyan-400/10">
                    <ShieldCheck className="h-4.5 w-4.5 text-cyan-50" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Opening secure access</div>
                    <div className="text-[11px] text-cyan-100/72">Please wait</div>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-100/85" />
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {phase === "intro" && !routingOut && (
            <m.section
              key="intro"
              className="relative z-10 grid min-h-screen place-items-center px-6"
              initial={reduce ? false : { opacity: 0 }}
              animate={reduce ? {} : { opacity: 1 }}
              exit={reduce ? {} : { opacity: 0 }}
              transition={{ duration: 0.28 }}
            >
              <IntroStage reduce={reduce} />
            </m.section>
          )}

          {phase === "home" && !routingOut && (
            <m.section
              key="home"
              className={cn(
                "relative z-10 mx-auto w-full max-w-[520px]",
                "px-4 pb-12 pt-10 sm:px-5 sm:pt-12"
              )}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={reduce ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: EASE }}
            >
              <div className="mb-3 flex justify-center">
                <div className="h-1.5 w-12 rounded-full bg-white/12" />
              </div>

              <HomeHero reduce={reduce} />

              <PrimaryLoginCard
                onClick={goLogin}
                reduce={reduce}
                enableAmbient={enableAmbient}
              />

              <m.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={reduce ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.08 }}
                className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-cyan-100/64"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Prestige entry
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure account access
                </span>
              </m.div>
            </m.section>
          )}
        </AnimatePresence>
      </main>
    </LazyMotion>
  );
}