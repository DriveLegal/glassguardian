// components/home/web/WebHome.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import StickyBookingCTA from "@/components/home/StickyBookingCTA";
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Zap,
  Clock,
  Crown,
  PhoneCall,
  MapPin,
} from "lucide-react";

/* -------------------- tiny responsive helpers -------------------- */
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
    } else if (typeof mql.addListener === "function") {
      mql.addListener(handler);
    }

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handler);
      } else if (typeof mql.removeListener === "function") {
        mql.removeListener(handler);
      }
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

export default function WebHome() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const isDesktop = useIsDesktop();

  // Desktop-view forcing toggle (for *mobile only*, session-only)
  const [forceDesktop, setForceDesktop] = React.useState(false);

  // open StickyBookingCTA panel (handled in StickyBookingCTA via window event)
  const openBookingPanel = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("gg:open-booking"));
  }, []);

  /* -------------------- viewport/meta policy -------------------- */
  React.useEffect(() => {
    function ensureViewportMeta(): HTMLMetaElement | null {
      try {
        let meta = document.querySelector(
          'meta[name="viewport"]'
        ) as HTMLMetaElement | null;
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

      // True desktop devices: always use normal responsive viewport
      if (isDesktop) {
        meta.setAttribute(
          "content",
          "width=device-width, initial-scale=1, viewport-fit=cover"
        );
        document.documentElement.classList.remove("force-desktop");
        return;
      }

      // Mobile / tablet: optionally "fake" desktop width when toggle is ON
      const desktopWidth = 1100;
      if (forceDesktop) {
        const deviceW = Math.max(
          window.innerWidth,
          document.documentElement.clientWidth || 0
        );
        const scale = Math.max(0.25, Math.min(1, deviceW / desktopWidth));
        meta.setAttribute(
          "content",
          `width=${desktopWidth}, initial-scale=${scale}, viewport-fit=cover`
        );
        document.documentElement.classList.add("force-desktop");
      } else {
        meta.setAttribute(
          "content",
          "width=device-width, initial-scale=1, viewport-fit=cover"
        );
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
    <main className="relative min-h-screen text-slate-50 overflow-hidden">
      {/* Background glows (stacked over your global body gradient) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-40 -left-32 h-96 w-96 rounded-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.9), transparent 60%)",
          }}
        />
        <div
          className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(circle at 70% 70%, rgba(59,130,246,0.9), transparent 60%)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.9),rgba(15,23,42,0.95))]" />
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(to_right,rgba(148,163,184,0.25)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:80px_80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-24">
          <div className="grid gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center">
            {/* LEFT: Hero copy + CTAs */}
            <div className="space-y-8">
              {/* Badge */}
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-950/70 px-3 py-1 text-xs font-medium text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.55)] backdrop-blur-md"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                <span className="tracking-[0.18em] uppercase">
                  Same-day chip &amp; crack repair
                </span>
              </motion.div>

              {/* Heading */}
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.7, ease: "easeOut" }}
                className="space-y-4"
              >
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
                  Glass Guardian
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300">
                    Chip &amp; Crack Repair
                  </span>
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-slate-200 max-w-xl">
                  We restore clarity, reinforce your glass, document every
                  repair, and back it with real warranty protection — giving you
                  the confidence to drive without worry.
                </p>
              </motion.div>

              {/* Key points */}
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12 }}
                className="grid gap-3 sm:grid-cols-3 max-w-xl text-xs md:text-[13px]"
              >
                <div className="flex items-center gap-2 text-slate-200/95">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-400/60 text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-snug">
                    Warranty-backed repair
                    <br />
                    on the treated spot
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-200/95">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 border border-sky-400/60 text-sky-300">
                    <PhoneCall className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-snug">
                    Mobile service —
                    <br />
                    we come to you
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-200/95">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-400/60 text-indigo-300">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-snug">
                    Typical repair time:
                    <br />
                    ~15–30 minutes
                  </span>
                </div>
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.7, ease: "easeOut" }}
                className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center"
              >
                {/* Enter app */}
                <Button
                  onClick={() => router.push("/home")}
                  className="crack-btn relative inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.85)] hover:shadow-[0_0_55px_rgba(56,189,248,0.95)] transition-shadow duration-200 border border-cyan-200/70"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Enter Glass Guardian
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>

                {/* Book repair (opens StickyBookingCTA drawer) */}
                <Button
                  type="button"
                  onClick={openBookingPanel}
                  className="book-btn relative inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold rounded-full border border-cyan-300/80 bg-slate-900/80 text-cyan-50 hover:border-emerald-300 hover:text-emerald-50 hover:bg-slate-900/95 shadow-[0_0_32px_rgba(8,47,73,0.9)]"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-cyan-300" />
                    Book repair
                  </span>
                </Button>

                {/* User login */}
                <Button
                  variant="outline"
                  onClick={() => router.push("/user/login")}
                  className="user-login-btn relative inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold rounded-full border border-slate-500/80 bg-slate-900/70 text-slate-100 hover:border-cyan-300 hover:text-cyan-50 hover:bg-slate-900/90 shadow-[0_0_26px_rgba(15,23,42,0.9)]"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-300" />
                    User Login
                  </span>
                </Button>
              </motion.div>
            </div>

            {/* RIGHT: HUD windshield card */}
            <motion.div
              initial={
                prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }
              }
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="relative max-w-md w-full mx-auto md:mx-0"
            >
              {/* floating halo */}
              <div className="absolute -inset-6 rounded-[2.25rem] bg-gradient-to-br from-cyan-400/15 via-sky-500/8 to-emerald-400/18 blur-3xl" />

              <div className="relative rounded-[24px] border border-slate-700/60 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/95 shadow-[0_26px_90px_rgba(15,23,42,0.95)] overflow-hidden image-3d">
                {/* subtle top gradient edge */}
                <div className="h-1 w-full bg-gradient-to-r from-cyan-300/70 via-sky-400/70 to-emerald-300/70 opacity-80" />

                {/* Glass windshield HUD mock */}
                <div className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/90 via-sky-500 to-emerald-400 shadow-[0_0_40px_rgba(56,189,248,0.9)]">
                        <ShieldCheck className="h-5 w-5 text-slate-950" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Live example
                        </p>
                        <p className="text-sm font-medium text-slate-50">
                          Glass Guardian repair snapshot
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Mobile tech online
                    </div>
                  </div>

                  {/* “Windshield” */}
                  <div className="relative mt-1 rounded-[18px] border border-cyan-300/50 bg-gradient-to-b from-slate-900/80 via-slate-950/80 to-black/90 px-4 py-5 shadow-[0_18px_55px_rgba(8,47,73,0.95)]">
                    {/* arc */}
                    <div className="pointer-events-none absolute -top-3 left-1/2 h-6 w-[80%] -translate-x-1/2 rounded-full border border-cyan-100/60 border-b-0 bg-gradient-to-b from-cyan-100/60 via-sky-200/20 to-transparent opacity-80" />

                    {/* grid */}
                    <div className="relative mt-2 grid h-[150px] grid-cols-3 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/80 text-[11px] text-slate-300">
                      {[
                        "Top L",
                        "Top C",
                        "Top R",
                        "Mid L",
                        "Center",
                        "Mid R",
                        "Bot L",
                        "Bot C",
                        "Bot R",
                      ].map((label, idx) => {
                        // Demo hit moved from "Center" to "Top R"
                        const isHit = label === "Top R";
                        return (
                          <div
                            key={label}
                            className={[
                              "relative flex items-center justify-center border-slate-800/80",
                              idx < 6 ? "border-b" : "",
                              idx % 3 !== 2 ? "border-r" : "",
                              isHit
                                ? "bg-emerald-400/10 text-emerald-100"
                                : "bg-slate-900/60",
                            ].join(" ")}
                          >
                            <span className="relative z-10">{label}</span>
                            {isHit && (
                              <>
                                {/* glowing crack marker */}
                                <span className="pointer-events-none absolute text-3xl text-emerald-300 drop-shadow-[0_0_14px_rgba(16,185,129,0.95)]">
                                  ✕
                                </span>
                                <span className="pointer-events-none absolute h-10 w-10 rounded-full bg-emerald-400/25 blur-xl" />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* bottom row info */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                        <span>
                          Impact locked:{" "}
                          <span className="text-emerald-200">
                            Upper passenger side
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                        <span>1-yr spread warranty active</span>
                      </div>
                    </div>
                  </div>

                  {/* mini stats */}
                  <div className="grid gap-3 sm:grid-cols-3 text-[11px] text-slate-300">
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        Today&apos;s slots
                      </p>
                      <p className="mt-1 text-sm text-emerald-300 font-semibold">
                        Available
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Same-day in most areas
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        Average time
                      </p>
                      <p className="mt-1 text-sm text-sky-300 font-semibold">
                        ~15-30 minutes
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        You keep the keys
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        Coverage
                      </p>
                      <p className="mt-1 text-sm text-cyan-300 font-semibold">
                        Warranty-backed
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Documentation included
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Lower stats strip */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.7, ease: "easeOut" }}
            className="mt-14 grid gap-4 sm:grid-cols-3"
          >
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.95)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-1">
                Chips saved
              </p>
              <p className="text-2xl font-semibold text-slate-50">
                1,000<span className="text-cyan-300/90">+</span>
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                Each one mapped and warrantied instead of turning into a full
                replacement.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.95)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-1">
                Average repair time
              </p>
              <p className="text-2xl font-semibold text-slate-50">
                ~15-30
                <span className="text-sm text-slate-300 ml-1">minutes</span>
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                In and out at your convenience, not a half-day at a shop.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.95)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-1">
                Warranty coverage
              </p>
              <p className="text-2xl font-semibold text-slate-50">
                1 year warranty
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                If your damage spreads at that same impact point, you&apos;re
                covered.
              </p>
            </div>
          </motion.div>
        </div>

        {/* StickyBookingCTA mounted with NO footer bar, panel only */}
        <StickyBookingCTA
          revealOffset={0}
          hideOverFooter={false}
          message="Chip just hit? We can repair it before it spreads."
          ctaLabel="Book repair"
          subLabel="Mobile • Insurance-friendly • 1-yr warranty"
          showBar={false} // no sticky footer on /page
        />

        {/* Desktop view toggle — inline text at very bottom on mobile/tablet */}
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
      </div>

      {/* Crack hover + login glow + book button styles + desktop toggle styles */}
      <style jsx>{`
        .crack-btn {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        .crack-btn::before {
          content: "";
          position: absolute;
          inset: -120%;
          background-image:
            radial-gradient(circle at 15% 20%, rgba(15, 23, 42, 0.1) 0, transparent 55%),
            radial-gradient(circle at 40% 40%, rgba(15, 23, 42, 0.26) 0, transparent 60%),
            radial-gradient(circle at 60% 30%, rgba(15, 23, 42, 0.3) 0, transparent 62%),
            radial-gradient(circle at 80% 50%, rgba(15, 23, 42, 0.2) 0, transparent 60%);
          opacity: 0;
          transform: scale(0.9) rotate(1deg);
          transition:
            opacity 220ms ease-out,
            transform 220ms ease-out;
          mix-blend-mode: soft-light;
        }

        .crack-btn::after {
          content: "";
          position: absolute;
          inset: -30%;
          background-image:
            radial-gradient(circle at 35% 45%, rgba(248, 250, 252, 0.24) 0, transparent 55%),
            radial-gradient(circle at 70% 60%, rgba(248, 250, 252, 0.16) 0, transparent 55%);
          opacity: 0;
          transform: scale(0.85);
          transition:
            opacity 260ms ease-out,
            transform 260ms ease-out;
          pointer-events: none;
        }

        .crack-btn:hover::before,
        .crack-btn:focus-visible::before {
          opacity: 1;
          transform: scale(1) rotate(0deg);
        }

        .crack-btn:hover::after,
        .crack-btn:focus-visible::after {
          opacity: 1;
          transform: scale(1);
        }

        .book-btn {
          position: relative;
          overflow: hidden;
        }

        .book-btn::before {
          content: "";
          position: absolute;
          inset: -40%;
          border-radius: inherit;
          background:
            radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.35), transparent 60%),
            radial-gradient(circle at 100% 100%, rgba(52, 211, 153, 0.35), transparent 60%);
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 220ms ease-out, transform 220ms ease-out;
          mix-blend-mode: screen;
        }

        .book-btn:hover::before,
        .book-btn:focus-visible::before {
          opacity: 1;
          transform: scale(1);
        }

        .user-login-btn {
          position: relative;
          overflow: hidden;
        }

        .user-login-btn::before {
          content: "";
          position: absolute;
          inset: -40%;
          opacity: 0;
          background: conic-gradient(
            from 220deg,
            rgba(56, 189, 248, 0.4),
            transparent,
            rgba(52, 211, 153, 0.4),
            transparent,
            rgba(251, 191, 36, 0.45),
            transparent,
            rgba(56, 189, 248, 0.4)
          );
          transition: opacity 260ms ease-out, transform 260ms ease-out;
          transform: rotate(8deg) scale(0.96);
          mix-blend-mode: soft-light;
        }

        .user-login-btn:hover::before,
        .user-login-btn:focus-visible::before {
          opacity: 1;
          transform: rotate(0deg) scale(1);
        }

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
          outline: 2px solid rgba(56, 189, 248, 0.6);
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