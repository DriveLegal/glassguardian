//components/home/web/WebHome.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import StickyBookingCTA from "@/components/home/StickyBookingCTA";
import { Sparkles, ShieldCheck, Zap, Clock, Crown, PhoneCall, MapPin } from "lucide-react";

/* ✅ Defer background module load so logo can win first paint */
const AfterSunsetStarfield = dynamic(
  () => import("@/components/home/web/backgrounds/AfterSunsetStarfield"),
  { ssr: false, loading: () => null }
);

/* -------------------- tiny responsive helpers -------------------- */
function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") mql.addEventListener("change", handler);
    else if (typeof (mql as any).addListener === "function") (mql as any).addListener(handler);

    return () => {
      if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", handler);
      else if (typeof (mql as any).removeListener === "function") (mql as any).removeListener(handler);
    };
  }, [query]);

  return matches;
}

/** Desktop = wide screen + precise pointer (mouse/trackpad) */
function useIsDesktop() {
  const wide = useMediaQuery("(min-width: 1024px)");
  const fine = useMediaQuery("(pointer: fine)");
  return wide && fine;
}

/**
 * Your new logo lives at:
 * public/branding/glass-guardian-gold.png
 */
const LOGO_SRC = "/branding/glass-guardian-gold.png";

/**
 * Review assets:
 * public/reviews/review1.jpg ... review12.jpg
 */
const REVIEW_IMAGES = [
  "/reviews/review1.jpg",
  "/reviews/review2.jpg",
  "/reviews/review3.jpg",
  "/reviews/review4.jpg",
  "/reviews/review5.jpg",
  "/reviews/review6.jpg",
  "/reviews/review7.jpg",
  "/reviews/review8.jpg",
  "/reviews/review9.jpg",
  "/reviews/review10.jpg",
  "/reviews/review11.jpg",
  "/reviews/review12.jpg",
];

const REVIEW_TRACK = [...REVIEW_IMAGES, ...REVIEW_IMAGES];

/**
 * Mark the reviews that include photos so they can render wider.
 * Adjust these numbers any time you swap review images around.
 */
const WIDE_REVIEW_NUMBERS = new Set([2, 4, 7, 9, 11, 12]);

export default function WebHome() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useIsDesktop();

  // Desktop-view forcing toggle (for mobile only, session-only)
  const [forceDesktop, setForceDesktop] = React.useState(false);

  /**
   * ✅ BOOT SPLASH:
   * - Show ONLY logo for 2 seconds
   * - Do NOT mount starfield or heavy visuals until after this
   */
  const [bootDone, setBootDone] = React.useState(prefersReducedMotion ? true : false);

  /**
   * ✅ Defer starfield mount slightly *after* boot to avoid a main-thread spike.
   * This helps the “small lag” you’re feeling.
   */
  const [bgReady, setBgReady] = React.useState(prefersReducedMotion ? true : false);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setBootDone(true);
      setBgReady(true);
      return;
    }

    const t = window.setTimeout(() => setBootDone(true), 2000);
    return () => window.clearTimeout(t);
  }, [prefersReducedMotion]);

  React.useEffect(() => {
    if (!bootDone) return;

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      setBgReady(true);
    };

    // Schedule background mount when browser is idle (or near-idle)
    // @ts-ignore
    const ric: any = typeof window !== "undefined" ? (window as any).requestIdleCallback : null;

    let id: any = null;
    if (ric) {
      // @ts-ignore
      id = ric(run, { timeout: 450 });
    } else {
      id = window.setTimeout(run, 40);
    }

    return () => {
      cancelled = true;
      // @ts-ignore
      const cic: any = typeof window !== "undefined" ? (window as any).cancelIdleCallback : null;
      if (cic && ric && id) cic(id);
      else if (id) window.clearTimeout(id);
    };
  }, [bootDone]);

  /**
   * ✅ BOOT VIEWPORT LOCK (fixes iOS/Chrome address-bar resize “drop”)
   * We drive boot layout from a CSS var that uses visualViewport height where available.
   */
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (bootDone) return;

    const root = document.documentElement;

    const setBootVh = () => {
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      const h = Math.round((vv?.height ?? window.innerHeight) || 0);
      if (h > 0) root.style.setProperty("--boot-vh", `${h}px`);
    };

    setBootVh();

    const vv = (window as any).visualViewport as VisualViewport | undefined;

    // iOS fires a few changes right after paint; do a short “settle” loop.
    const rafs: number[] = [];
    rafs.push(window.requestAnimationFrame(setBootVh));
    rafs.push(window.requestAnimationFrame(() => window.requestAnimationFrame(setBootVh)));

    const t1 = window.setTimeout(setBootVh, 60);
    const t2 = window.setTimeout(setBootVh, 160);
    const t3 = window.setTimeout(setBootVh, 320);

    window.addEventListener("resize", setBootVh);
    window.addEventListener("orientationchange", setBootVh);
    if (vv) vv.addEventListener("resize", setBootVh);
    if (vv) vv.addEventListener("scroll", setBootVh);

    return () => {
      rafs.forEach((id) => window.cancelAnimationFrame(id));
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);

      window.removeEventListener("resize", setBootVh);
      window.removeEventListener("orientationchange", setBootVh);
      if (vv) vv.removeEventListener("resize", setBootVh);
      if (vv) vv.removeEventListener("scroll", setBootVh);

      root.style.removeProperty("--boot-vh");
    };
  }, [bootDone]);

  /**
   * ✅ MOBILE INTRO CENTERING FIX
   * Force the page to the very top on mobile so the fixed boot intro
   * always starts centered in the phone viewport.
   */
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDesktop) return;

    const previousRestoration = window.history.scrollRestoration;

    try {
      window.history.scrollRestoration = "manual";
    } catch {}

    const snapTop = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch {}
    };

    snapTop();

    const raf1 = window.requestAnimationFrame(() => {
      snapTop();

      const raf2 = window.requestAnimationFrame(() => {
        snapTop();
      });

      const t = window.setTimeout(() => snapTop(), 120);

      return () => {
        window.cancelAnimationFrame(raf2);
        window.clearTimeout(t);
      };
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      try {
        window.history.scrollRestoration = previousRestoration;
      } catch {}
    };
  }, [isDesktop]);

  /**
   * ✅ While boot splash is active, prevent scrolling without re-positioning body.
   * This avoids the "logo jumps high / low" issue caused by body position changes.
   */
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (bootDone) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevOverscroll = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      document.documentElement.style.overscrollBehavior = prevOverscroll;
    };
  }, [bootDone]);

  // open StickyBookingCTA panel (handled in StickyBookingCTA via window event)
  const openBookingPanel = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("gg:open-booking"));
  }, []);

  /* -------------------- viewport/meta policy -------------------- */
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

  return (
    <main className="relative min-h-screen min-h-[100svh] min-h-[100dvh] overflow-hidden text-slate-50">
      {/* ✅ SINGLE Background instance ONLY */}
      {bgReady && (
        <AfterSunsetStarfield
          className="z-0"
          density={1}
          intensity={1}
          disableComet={false}
          showHorizonTitan={true}
        />
      )}

      {/* ✅ Depth overlays */}
      {bgReady && (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <div className="gg-depth-vignette" />
          <div className="gg-skyglow" />
          <div className="gg-grain" />
        </div>
      )}

      {/* ✅ LOGO-FIRST BOOT SPLASH */}
      <AnimatePresence>
        {!bootDone && (
          <motion.div
            key="gg-boot"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.42, ease: "easeInOut" } }}
            className="fixed inset-0 z-50 overflow-hidden"
            aria-label="Loading Glass Guardian"
          >
            <div className="absolute inset-0 bg-black" />
            <div className="absolute inset-0 boot-haze" aria-hidden="true" />

            <motion.div
              initial={{ opacity: 0, scale: 0.985, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="boot-stage"
            >
              <div className="boot-centerViewport">
                <div className="boot-logoAnchor">
                  <div className="boot-logoWrap">
                    <div className="boot-glow" aria-hidden="true" />
                    <Image
                      src={LOGO_SRC}
                      alt="Glass Guardian"
                      fill
                      priority
                      sizes="100vw"
                      quality={100}
                      className="boot-logo object-contain select-none"
                    />
                  </div>

                  <div className="boot-sub">◆ Prestige protection ◆</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        className="relative z-10"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? {} : bootDone ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.02 }}
        aria-hidden={!bootDone}
        style={!bootDone ? { pointerEvents: "none", userSelect: "none" } : undefined}
      >
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-3 sm:px-6 md:pb-24 md:pt-7 lg:px-8">
          <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {/* LEFT: Hero copy + CTAs */}
            <div className="space-y-7">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.02 }}
                className="flex items-center gap-4"
              >
                <div className="brand-mark relative shrink-0">
                  <div className="brand-markHalo" aria-hidden="true" />
                  <div className="relative h-[72px] w-[72px] sm:h-[84px] sm:w-[84px]">
                    <Image
                      src={LOGO_SRC}
                      alt="Glass Guardian"
                      fill
                      sizes="84px"
                      quality={100}
                      className="object-contain select-none"
                      priority
                    />
                  </div>
                </div>

                <div className="min-w-0 leading-tight">
                  <div className="brand-overline">
                    <span className="brand-dot" aria-hidden="true" />
                    Prestige Windshield Care
                    <span className="brand-dot" aria-hidden="true" />
                  </div>

                  <div className="brand-titleWrap">
                    <span className="brand-title">Glass Guardian</span>
                    <span className="brand-titleGlow" aria-hidden="true" />
                  </div>

                  <div className="brand-subWrap flex justify-center">
                    <span className="brand-sub">Chip &amp; Crack Repair</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-black/55 px-3 py-1 text-xs font-medium text-amber-50/90 shadow-[0_0_24px_rgba(251,191,36,0.18)] backdrop-blur-md"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                <span className="tracking-[0.18em] uppercase">Same-day chip &amp; crack repair</span>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.7, ease: "easeOut" }}
                className="space-y-4"
              >
                <p className="max-w-xl text-sm text-slate-200/90 sm:text-base md:text-lg">
                  We restore clarity, reinforce your glass, and back it with real warranty protection; Giving you the
                  confidence to drive without worry.
                </p>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12 }}
                className="grid max-w-xl gap-3 text-xs md:text-[13px] sm:grid-cols-3"
              >
                <div className="flex items-center gap-2 text-slate-200/95">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/55 bg-amber-500/10 text-amber-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-snug">
                    Warranty-backed repair
                    <br />
                    on the treated spot
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-200/95">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/55 bg-amber-500/10 text-amber-200">
                    <PhoneCall className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-snug">
                    Mobile service,
                    <br />
                    we come to you
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-200/95">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/55 bg-amber-500/10 text-amber-200">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-snug">
                    Typical repair time:
                    <br />
                    15–30 minutes
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.7, ease: "easeOut" }}
                className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <Button
                  onClick={() => router.push("/home")}
                  className="crack-btn relative inline-flex items-center justify-center rounded-full border border-amber-100/60 bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_0_38px_rgba(251,191,36,0.28)] transition-shadow duration-200 hover:shadow-[0_0_52px_rgba(251,191,36,0.38)]"
                >
                  <span className="relative z-10 flex items-center gap-2">🚪 Enter</span>
                </Button>

                <Button
                  type="button"
                  onClick={openBookingPanel}
                  className="book-btn relative inline-flex items-center justify-center rounded-full border border-amber-200/40 bg-black/55 px-6 py-3.5 text-sm font-semibold text-amber-50/90 shadow-[0_0_28px_rgba(0,0,0,0.65)] backdrop-blur hover:border-amber-200/70 hover:bg-black/70 hover:text-amber-50"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-200" />
                    Book repair
                  </span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => router.push("/user/login")}
                  className="user-login-btn relative inline-flex items-center justify-center rounded-full border border-slate-500/70 bg-black/45 px-6 py-3.5 text-sm font-semibold text-slate-100 shadow-[0_0_24px_rgba(0,0,0,0.7)] backdrop-blur hover:border-amber-200/60 hover:bg-black/65 hover:text-amber-50"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-200" />
                    User Login
                  </span>
                </Button>
              </motion.div>
            </div>

            {/* RIGHT: HUD windshield card */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="relative mx-auto w-full max-w-md md:mx-0"
            >
              <div className="absolute -inset-6 rounded-[2.25rem] bg-gradient-to-br from-amber-300/12 via-yellow-200/6 to-sky-300/10 blur-3xl" />

              <div className="image-3d relative overflow-hidden rounded-[24px] border border-slate-700/60 bg-gradient-to-br from-slate-950/85 via-black/70 to-black/85 shadow-[0_26px_90px_rgba(0,0,0,0.75)]">
                <div className="h-1 w-full bg-gradient-to-r from-amber-200/65 via-yellow-200/55 to-sky-300/45 opacity-80" />

                <div className="space-y-4 p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-yellow-200 to-amber-300 shadow-[0_0_34px_rgba(251,191,36,0.22)]">
                        <ShieldCheck className="h-5 w-5 text-slate-950" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Live example</p>
                        <p className="text-sm font-medium text-slate-50">Glass Guardian repair snapshot</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-black/55 px-2 py-1 text-[10px] text-slate-300 backdrop-blur">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.65)]" />
                      Mobile tech online
                    </div>
                  </div>

                  <div className="relative mt-1 rounded-[18px] border border-amber-200/25 bg-gradient-to-b from-black/50 via-black/60 to-black/75 px-4 py-5 shadow-[0_18px_55px_rgba(0,0,0,0.78)]">
                    <div className="pointer-events-none absolute -top-3 left-1/2 h-6 w-[80%] -translate-x-1/2 rounded-full border border-amber-100/35 border-b-0 bg-gradient-to-b from-amber-100/18 via-yellow-200/10 to-transparent opacity-90" />

                    <div className="relative mt-2 grid h-[150px] grid-cols-3 overflow-hidden rounded-xl border border-slate-700/70 bg-black/55 text-[11px] text-slate-300">
                      {["Top L", "Top C", "Top R", "Mid L", "Center", "Mid R", "Bot L", "Bot C", "Bot R"].map(
                        (label, idx) => {
                          const isHit = label === "Top R";
                          return (
                            <div
                              key={label}
                              className={[
                                "relative flex items-center justify-center border-slate-800/80",
                                idx < 6 ? "border-b" : "",
                                idx % 3 !== 2 ? "border-r" : "",
                                isHit ? "bg-sky-400/10 text-sky-100" : "bg-black/35",
                              ].join(" ")}
                            >
                              <span className="relative z-10">{label}</span>
                              {isHit && (
                                <>
                                  <span className="pointer-events-none absolute text-3xl text-sky-200 drop-shadow-[0_0_16px_rgba(56,189,248,0.95)]">
                                    ✕
                                  </span>
                                  <span className="pointer-events-none absolute h-10 w-10 rounded-full bg-sky-400/22 blur-xl" />
                                </>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-sky-300" />
                        <span>
                          Impact locked: <span className="text-sky-200">Upper driver side</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                        <span>1-yr spread warranty active</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 text-[11px] text-slate-300 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-700/70 bg-black/45 px-3 py-2.5 backdrop-blur">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Today&apos;s slots</p>
                      <p className="mt-1 text-sm font-semibold text-sky-200">Available</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">Same-day in most areas</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/70 bg-black/45 px-3 py-2.5 backdrop-blur">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Average time</p>
                      <p className="mt-1 text-sm font-semibold text-amber-200">15-30 minutes</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">Quick service guaranteed</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/70 bg-black/45 px-3 py-2.5 backdrop-blur">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Coverage</p>
                      <p className="mt-1 text-sm font-semibold text-amber-200">Warranty-backed</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">Documentation included</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.7, ease: "easeOut" }}
            className="mt-14 grid gap-4 sm:grid-cols-3"
          >
            <div className="rounded-2xl border border-slate-700/70 bg-black/45 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur">
              <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">Chips saved</p>
              <p className="text-2xl font-semibold text-slate-50">
                10,000<span className="text-amber-200/90">+</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                Each one mapped and warrantied instead of turning into a full replacement.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-black/45 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur">
              <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">Average repair time</p>
              <p className="text-2xl font-semibold text-slate-50">
                15-30<span className="ml-1 text-sm text-slate-300">minutes</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-400">In and out at your convenience, not a half-day at a shop.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-black/45 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur">
              <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">Warranty coverage</p>
              <p className="text-2xl font-semibold text-slate-50">1 year warranty</p>
              <p className="mt-1.5 text-xs text-slate-400">
                If your damage spreads at that same impact point, you&apos;re covered.
              </p>
            </div>
          </motion.div>

          {/* ✅ FLOATING REVIEWS ONLY */}
          <motion.section
            initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.75, ease: "easeOut" }}
            className="mt-14 sm:mt-18"
            aria-label="Customer reviews"
          >
            <div className="reviews-shell">
              <div className="reviews-fade reviews-fade-left" aria-hidden="true" />
              <div className="reviews-fade reviews-fade-right" aria-hidden="true" />

              <div className={prefersReducedMotion ? "reviews-track reviews-track-static" : "reviews-track"}>
                {REVIEW_TRACK.map((src, idx) => {
                  const reviewNumber = (idx % REVIEW_IMAGES.length) + 1;
                  const isWide = WIDE_REVIEW_NUMBERS.has(reviewNumber);

                  return (
                    <div
                      key={`${src}-${idx}`}
                      className={`review-card ${isWide ? "review-card-wide" : "review-card-compact"}`}
                      aria-hidden={idx >= REVIEW_IMAGES.length ? true : undefined}
                    >
                      <div className="review-cardInner">
                        <Image
                          src={src}
                          alt={`Glass Guardian customer review ${reviewNumber}`}
                          width={1600}
                          height={900}
                          sizes={
                            isWide
                              ? "(max-width: 640px) 92vw, (max-width: 1024px) 72vw, 760px"
                              : "(max-width: 640px) 78vw, (max-width: 1024px) 52vw, 460px"
                          }
                          className="review-image"
                          priority={idx < 3}
                          quality={100}
                        />
                      </div>
                      <div className="review-bridge" aria-hidden="true" />
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        </div>

        <StickyBookingCTA
          revealOffset={0}
          hideOverFooter={false}
          message="Chip just hit? We can repair it before it spreads."
          ctaLabel="Book repair"
          subLabel="Mobile • Insurance-friendly • 1-yr warranty"
          showBar={false}
        />

        {!isDesktop && (
          <div className="desktop-toggle-inline">
            <button
              type="button"
              className="desktop-toggle-link"
              onClick={() => setForceDesktop((s) => !s)}
              aria-pressed={forceDesktop}
            >
              {forceDesktop ? "Back to mobile view" : "View desktop layout"}
            </button>
          </div>
        )}
      </motion.div>

      <style jsx>{`
        /* ---------- BOOT (TRUE viewport centered + locked) ---------- */
        .boot-haze {
          background:
            radial-gradient(1100px 640px at 50% 38%, rgba(251, 191, 36, 0.1), rgba(0, 0, 0, 0) 55%),
            radial-gradient(900px 520px at 20% 55%, rgba(251, 191, 36, 0.06), rgba(0, 0, 0, 0) 60%),
            radial-gradient(1200px 900px at 85% 60%, rgba(154, 111, 37, 0.05), rgba(0, 0, 0, 0) 62%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.88), rgba(0, 0, 0, 0.86));
          opacity: 1;
        }

        .boot-stage {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        /* ✅ Uses --boot-vh (visualViewport height) while boot is active */
        .boot-centerViewport {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          padding:
            max(20px, env(safe-area-inset-top))
            max(16px, env(safe-area-inset-right))
            max(20px, env(safe-area-inset-bottom))
            max(16px, env(safe-area-inset-left));
          box-sizing: border-box;

          height: var(--boot-vh, 100vh);
          min-height: var(--boot-vh, 100vh);
        }

        .boot-logoAnchor {
          position: relative;
          width: min(96vw, 980px);
          /* Use the locked height var instead of dvh to prevent the “drop” */
          height: min(calc(var(--boot-vh, 100vh) * 0.58), 640px);
          max-width: 980px;
          max-height: 640px;
          isolation: isolate;
          transform: translateZ(0);
        }

        .boot-logoWrap {
          position: absolute;
          inset: 0;
          transform: translateZ(0);
        }

        .boot-glow {
          position: absolute;
          inset: -12%;
          border-radius: 999px;
          pointer-events: none;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(251, 191, 36, 0.32),
            rgba(251, 191, 36, 0.14) 40%,
            transparent 72%
          );
          filter: blur(46px) saturate(1.1);
          mix-blend-mode: screen;
          opacity: 0.95;
        }

        .boot-logo {
          filter: brightness(1.06) contrast(1.08) saturate(1.1)
            drop-shadow(0 44px 140px rgba(0, 0, 0, 0.92));
          image-rendering: -webkit-optimize-contrast;
        }

        .boot-sub {
          position: absolute;
          left: 50%;
          bottom: -28px;
          transform: translateX(-50%);
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(254, 243, 199, 0.9);
          text-shadow: 0 10px 30px rgba(0, 0, 0, 0.65);
          padding: 0 12px;
          width: 100%;
          max-width: 92vw;
          pointer-events: none;
        }

        @media (max-width: 767px) {
          .boot-centerViewport {
            padding:
              max(14px, env(safe-area-inset-top))
              max(12px, env(safe-area-inset-right))
              max(14px, env(safe-area-inset-bottom))
              max(12px, env(safe-area-inset-left));
          }

          .boot-logoAnchor {
            width: min(94vw, 640px);
            height: min(calc(var(--boot-vh, 100vh) * 0.42), 360px);
            max-width: 640px;
            max-height: 360px;
          }

          .boot-sub {
            bottom: -24px;
            font-size: 10px;
            letter-spacing: 0.24em;
            max-width: 94vw;
          }
        }

        /* =========================
           PREMIUM BRAND LOCKUP
           ========================= */
        .brand-mark {
          position: relative;
          isolation: isolate;
          border-radius: 999px;
        }

        .brand-markHalo {
          position: absolute;
          inset: -14px;
          border-radius: 999px;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(251, 191, 36, 0.3),
            rgba(251, 191, 36, 0.14) 42%,
            transparent 72%
          );
          filter: blur(18px) saturate(1.18);
          mix-blend-mode: screen;
          opacity: 0.95;
          z-index: 0;
          pointer-events: none;
        }

        .brand-overline {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
          white-space: nowrap;
          font-size: 10px;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: rgba(226, 232, 240, 0.72);
          text-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
        }

        .brand-dot {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(251, 191, 36, 0.9);
          box-shadow: 0 0 18px rgba(251, 191, 36, 0.45);
        }

        .brand-titleWrap {
          position: relative;
          display: inline-block;
        }

        .brand-title {
          display: inline-block;
          font-size: clamp(30px, 3.7vw, 56px);
          font-weight: 750;
          letter-spacing: -0.035em;
          line-height: 1.02;
          color: rgba(248, 250, 252, 0.98);
          text-shadow:
            0 14px 48px rgba(0, 0, 0, 0.68),
            0 0 28px rgba(251, 191, 36, 0.16),
            0 0 66px rgba(251, 191, 36, 0.1);
        }

        .brand-titleGlow {
          position: absolute;
          inset: -14px -18px -12px -18px;
          z-index: -1;
          border-radius: 22px;
          background: radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.18), transparent 62%);
          filter: blur(16px);
          opacity: 0.9;
          pointer-events: none;
        }

        .brand-subWrap {
          position: relative;
          display: inline-block;
          margin-top: 6px;
        }

        .brand-sub {
          display: inline-block;
          font-size: clamp(12px, 1.35vw, 16px);
          font-weight: 650;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(254, 243, 199, 0.92);
          text-shadow:
            0 12px 34px rgba(0, 0, 0, 0.6),
            0 0 20px rgba(251, 191, 36, 0.18);
        }

        @media (max-width: 420px) {
          .brand-overline {
            display: none;
          }
        }

        /* ---------- Depth overlays ---------- */
        .gg-depth-vignette {
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.032), transparent 55%),
            radial-gradient(circle at 70% 18%, rgba(255, 255, 255, 0.024), transparent 58%),
            radial-gradient(circle at 50% 75%, rgba(0, 0, 0, 0.22), transparent 62%);
          opacity: 1;
          filter: blur(2px);
        }

        .gg-skyglow {
          position: absolute;
          inset: -35%;
          background:
            radial-gradient(circle at 22% 22%, rgba(56, 189, 248, 0.06), transparent 54%),
            radial-gradient(circle at 78% 28%, rgba(251, 191, 36, 0.06), transparent 58%),
            radial-gradient(circle at 52% 60%, rgba(167, 139, 250, 0.05), transparent 62%);
          filter: blur(28px);
          opacity: 0.85;
          transform: none;
          mix-blend-mode: screen;
        }

        .gg-grain {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E");
          opacity: 0.18;
          mix-blend-mode: overlay;
          pointer-events: none;
        }

        /* ---------- REVIEWS MARQUEE ---------- */
        .reviews-shell {
          position: relative;
          width: 100%;
          overflow: hidden;
          padding: 6px 0;
          background: transparent;
          border: 0;
          outline: 0;
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          isolation: isolate;
        }

        .reviews-track {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 22px;
          width: max-content;
          will-change: transform;
          animation: reviews-marquee 108s linear infinite;
          padding-inline: 0;
        }

        .reviews-track-static {
          animation: none;
          width: auto;
          overflow-x: auto;
          padding-bottom: 6px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .reviews-track-static::-webkit-scrollbar {
          display: none;
        }

        .review-card {
          position: relative;
          flex: 0 0 auto;
          border-radius: 24px;
          transition: transform 220ms ease;
        }

        .review-card:hover {
          transform: translateY(-2px);
        }

        .review-card-compact {
          width: clamp(270px, 28vw, 420px);
        }

        .review-card-wide {
          width: clamp(360px, 42vw, 760px);
        }

        .review-cardInner {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          border: 0;
          outline: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }

        .review-cardInner::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          background: radial-gradient(circle at center, rgba(0, 0, 0, 0) 72%, rgba(20, 16, 40, 0.16) 100%);
          mix-blend-mode: multiply;
        }

        .review-cardInner::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
          background: radial-gradient(circle at center, rgba(251, 191, 36, 0) 72%, rgba(251, 191, 36, 0.018) 100%);
          mix-blend-mode: screen;
        }

        .review-image {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
          transform: translateZ(0);
          filter: brightness(0.99) contrast(0.99) saturate(0.99);
        }

        .review-bridge {
          position: absolute;
          top: 50%;
          right: -12px;
          transform: translateY(-50%);
          width: 20px;
          height: 64%;
          pointer-events: none;
          z-index: 4;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(251, 191, 36, 0.016) 40%,
            rgba(255, 255, 255, 0.012) 50%,
            rgba(251, 191, 36, 0.016) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          filter: blur(5px);
          opacity: 0.22;
          mix-blend-mode: screen;
        }

        .reviews-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 56px;
          z-index: 5;
          pointer-events: none;
        }

        .reviews-fade-left {
          left: 0;
          background: linear-gradient(90deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0.06) 35%, rgba(0, 0, 0, 0) 100%);
        }

        .reviews-fade-right {
          right: 0;
          background: linear-gradient(270deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0.06) 35%, rgba(0, 0, 0, 0) 100%);
        }

        @keyframes reviews-marquee {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(calc(-50% - 11px), 0, 0);
          }
        }

        @media (max-width: 767px) {
          .reviews-track {
            gap: 16px;
            animation-duration: 92s;
          }

          .review-card-compact {
            width: min(74vw, 330px);
          }

          .review-card-wide {
            width: min(90vw, 500px);
          }

          .review-cardInner {
            border-radius: 20px;
          }

          .review-bridge {
            right: -8px;
            width: 14px;
            height: 58%;
            filter: blur(4px);
            opacity: 0.18;
          }

          .reviews-fade {
            width: 34px;
          }
        }

        /* ---------- Mobile desktop-toggle ---------- */
        .desktop-toggle-inline {
          width: 100%;
          max-width: 1100px;
          margin: 8px auto 16px;
          text-align: center;
          font-size: 12px;
          color: rgba(148, 163, 184, 0.85);
        }

        .desktop-toggle-link {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          font: inherit;
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
          opacity: 0.95;
        }

        .desktop-toggle-link:focus-visible {
          outline: 2px solid rgba(251, 191, 36, 0.45);
          outline-offset: 2px;
        }

        @media (min-width: 1024px) and (pointer: fine) {
          .desktop-toggle-inline {
            display: none;
          }
        }
        `}</style>
      </main>
    );
  }
