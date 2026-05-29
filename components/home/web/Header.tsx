// components/home/web/Header.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import { Crown } from "lucide-react";

/* ===========================
   Navigation items (must match section IDs in DOM)
   =========================== */
const NAV = [
  { id: "overview", label: "Glass Guardian" },
  { id: "avoid", label: "Avoid" },
  { id: "specialties", label: "Specialties" },
  { id: "about", label: "About repair" },
  { id: "billing", label: "Billing & Insurance" },
  { id: "pricing", label: "Price" },
  { id: "qa", label: "Q&A" },
];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setMatches("matches" in e ? e.matches : mql.matches);

    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange as any);
    else if (typeof (mql as any).addListener === "function") (mql as any).addListener(onChange);

    return () => {
      if (typeof mql.removeEventListener === "function")
        mql.removeEventListener("change", onChange as any);
      else if (typeof (mql as any).removeListener === "function")
        (mql as any).removeListener(onChange);
    };
  }, [query]);

  return matches;
}

export default function Header() {
  const [active, setActive] = useState<string>("overview");

  const headerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // underline measurement refs
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const tabRO = useRef<Record<string, ResizeObserver | null>>({});

  const prefersReduced = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 641px)");
  const allow3D = isDesktop && !prefersReduced;

  // When user clicks a tab we lock active briefly so observers don't fight it
  const clickLockUntilRef = useRef<number>(0);
  const lastActiveRef = useRef<string>("overview");

  /* ---------------------------
     Scroll-based shrink + polish
  --------------------------- */
  const { scrollY } = useScroll();

  const padYRaw = useTransform(scrollY, [0, 220], [18, 6]);
  const padYSpring = useSpring(padYRaw, { stiffness: 180, damping: 30 });
  const padY = prefersReduced ? padYRaw : padYSpring;

  const logoScaleRaw = useTransform(scrollY, [0, 220], [1, 0.86]);
  const logoScaleSpring = useSpring(logoScaleRaw, { stiffness: 160, damping: 28 });
  const logoScale = prefersReduced ? 1 : (logoScaleSpring as any);

  const rotateTargetRaw = useTransform(scrollY, [0, 900], [0, 180]);
  const rotateTarget = useTransform(rotateTargetRaw, (v) => (allow3D ? v : 0));
  const logoRotateSpring = useSpring(rotateTarget, { stiffness: 120, damping: 22 });
  const logoRotate = prefersReduced ? 0 : (logoRotateSpring as any);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (typeof document === "undefined" || !document.documentElement) return;
    document.documentElement.classList.toggle("gg-scrolled", y > 8);
  });

  /* ---------------------------
     Sync header height → CSS var
  --------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHeight = () => {
      const height =
        headerRef.current?.getBoundingClientRect().height ??
        innerRef.current?.getBoundingClientRect().height ??
        72;
      document.documentElement.style.setProperty("--header-h", `${Math.round(height)}px`);
    };

    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    if (innerRef.current) ro.observe(innerRef.current);

    window.addEventListener("resize", updateHeight);

    const t1 = window.setTimeout(updateHeight, 120);
    const t2 = window.setTimeout(updateHeight, 420);

    const fonts = (document as any).fonts;
    const onFonts = () => updateHeight();
    if (fonts?.addEventListener) fonts.addEventListener("loadingdone", onFonts);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (fonts?.removeEventListener) fonts.removeEventListener("loadingdone", onFonts);
    };
  }, []);

  /* ---------------------------
     Background gradient (scroll fade) — graphite+gold
  --------------------------- */
  const [bgStr, setBgStr] = useState(
    "linear-gradient(to bottom, rgba(6,5,4,0.92), rgba(10,8,6,0.84), rgba(10,8,6,0.54))"
  );

  const lerp = (t: number, a: number, b: number) => a + (b - a) * t;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  useMotionValueEvent(padY, "change", (py) => {
    const t = clamp((py - 6) / 12, 0, 1);
    const top = lerp(t, 0.92, 0.86).toFixed(3);
    const mid = lerp(t, 0.84, 0.70).toFixed(3);
    setBgStr(
      `linear-gradient(to bottom, rgba(6,5,4,${top}), rgba(10,8,6,${mid}), rgba(10,8,6,0.52))`
    );
  });

  /* ---------------------------
     Gentle tilt + specular sheen (gold)
     ✅ UPDATE: keep sheen, but avoid blend-mode + 3D compositing tiles on WebKit
  --------------------------- */
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(50);

  const sheen = useMotionTemplate`radial-gradient(900px circle at ${sheenX}% ${sheenY}%, rgba(244,216,139,0.12), rgba(255,255,255,0.00) 60%)`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!allow3D) {
      sheenX.set(50);
      sheenY.set(50);
      return;
    }

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        sheenX.set((e.clientX / w) * 100);
        sheenY.set((e.clientY / h) * 100);
      });
    };

    const onLeave = () => {
      sheenX.set(50);
      sheenY.set(50);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave as any, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove as any);
      window.removeEventListener("pointerleave", onLeave as any);
    };
  }, [allow3D, sheenX, sheenY]);

  /* ---------------------------
     ✅ FIX: Auto active tab (ScrollSpy) without jitter
  --------------------------- */
  const getHeaderHeight = useCallback(() => {
    const h =
      headerRef.current?.getBoundingClientRect().height ??
      (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 72);
    return Math.max(56, Math.round(h));
  }, []);

  const sectionsRef = useRef<HTMLElement[]>([]);

  const computeBestActive = useCallback(() => {
    if (typeof window === "undefined") return;
    if (performance.now() < clickLockUntilRef.current) return;

    const headerH = getHeaderHeight();
    const markerY = headerH + 18;

    const els = sectionsRef.current;
    if (!els.length) return;

    let bestId = els[0]?.id || "overview";
    let bestTop = -Infinity;

    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top <= markerY && r.top > bestTop) {
        bestTop = r.top;
        bestId = el.id;
      }
    }

    if (bestId !== lastActiveRef.current) {
      lastActiveRef.current = bestId;
      setActive(bestId);
    }
  }, [getHeaderHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    sectionsRef.current = els;
    if (!els.length) return;

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        computeBestActive();
      });
    };

    const io = new IntersectionObserver(
      () => schedule(),
      {
        root: null,
        rootMargin: "-120px 0px -65% 0px",
        threshold: [0, 0.01, 0.02],
      }
    );

    els.forEach((el) => io.observe(el));

    const onResize = () => schedule();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const vv = window.visualViewport;
    if (vv?.addEventListener) vv.addEventListener("resize", onResize);

    schedule();

    return () => {
      io.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (vv?.removeEventListener) vv.removeEventListener("resize", onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [computeBestActive]);

  /* ---------------------------
     Optional: on initial hash, scroll there (once)
  --------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) return;

    const el = document.getElementById(hash);
    if (!el) return;

    clickLockUntilRef.current = performance.now() + (prefersReduced ? 120 : 700);
    lastActiveRef.current = hash;
    setActive(hash);

    window.requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
      } catch {
        const headerH = getHeaderHeight();
        const scroller = document.scrollingElement || document.documentElement;
        const top = Math.round(el.getBoundingClientRect().top + scroller.scrollTop - headerH - 12);
        window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
      }
    });
  }, [prefersReduced, getHeaderHeight]);

  /* ---------------------------
     Measure tab label widths for underline
  --------------------------- */
  const setTabRef = useCallback(
    (id: string) => (el: HTMLAnchorElement | null) => {
      try {
        tabRO.current[id]?.disconnect?.();
      } catch {}
      tabRO.current[id] = null;

      tabRefs.current[id] = el;
      if (!el) return;

      const label = el.querySelector<HTMLElement>(".gg-tab-label");
      if (!label) return;

      const updateWidth = () => {
        const w = label.getBoundingClientRect().width;
        el.style.setProperty("--tab-underline-width", `${Math.round(w + 8)}px`);
      };

      updateWidth();

      const ro = new ResizeObserver(updateWidth);
      ro.observe(label);
      tabRO.current[id] = ro;
    },
    []
  );

  useEffect(() => {
    return () => {
      Object.values(tabRO.current).forEach((ro) => {
        try {
          ro?.disconnect();
        } catch {}
      });
      tabRO.current = {};
    };
  }, []);

  /* ---------------------------
     Clicking tabs reliably scrolls
  --------------------------- */
  const scrollTo = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;

      clickLockUntilRef.current = performance.now() + (prefersReduced ? 140 : 800);
      lastActiveRef.current = id;
      setActive(id);

      try {
        const url = `${window.location.pathname}${window.location.search}#${id}`;
        window.history.replaceState(null, "", url);
      } catch {}

      try {
        el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
      } catch {
        const headerH = getHeaderHeight();
        const scroller = document.scrollingElement || document.documentElement;
        const top = Math.round(el.getBoundingClientRect().top + scroller.scrollTop - headerH - 12);
        window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
      }

      window.setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
        } catch {}
      }, prefersReduced ? 0 : 60);
    },
    [prefersReduced, getHeaderHeight]
  );

  return (
    <motion.header
      className="gg-header"
      ref={headerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        background: bgStr,
        borderBottom: "1px solid rgba(244,216,139,0.14)",
        willChange: "transform, background",

        // ✅ UPDATE: prevent WebKit backdrop-filter “tile” rectangles
        overflow: "hidden",
        isolation: "isolate",

        // ✅ UPDATE: remove 3D on the header container to stop the rectangle artifact
        transformStyle: "flat",
        perspective: undefined,
      }}
    >
      {/* ✅ UPDATE: keep sheen but remove mixBlendMode (screen) which can cause compositing blocks */}
      <motion.div
        aria-hidden
        className="gg-header-overlay"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: allow3D ? (sheen as any) : undefined,
          opacity: allow3D ? 1 : 0,
          // ✅ UPDATE:
          mixBlendMode: "normal",
        }}
      />

      <motion.div
        ref={innerRef}
        className="gg-header-inner"
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: 0,

          display: "grid",
          gridTemplateColumns: "minmax(0, max-content) minmax(0, 1fr) minmax(0, max-content)",
          alignItems: "center",

          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 12px)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 12px)",
          paddingTop: padY as any,
          paddingBottom: padY as any,

          columnGap: 16,

          // ✅ UPDATE: remove rotateX/rotateY (major cause of WebKit backdrop snapshot rectangles)
          rotateX: 0 as any,
          rotateY: 0 as any,
          transformStyle: "flat",
          willChange: "transform",
        }}
      >
        {/* Logo */}
        <a
          href="#overview"
          aria-label="Glass Guardian Home"
          onClick={(e) => {
            e.preventDefault();
            scrollTo("overview");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            justifySelf: "start",
            minWidth: 0,
          }}
        >
          <motion.div
            style={{
              scale: logoScale as any,
              rotate: logoRotate as any,
              transformOrigin: "center",

              // ✅ UPDATE: remove translateZ to stop “panel” artifacts
              translateZ: 0,

              willChange: "transform",
            }}
          >
            <LogoBadge />
          </motion.div>
        </a>

        {/* Nav */}
        <nav
          ref={navRef}
          className="gg-nav"
          aria-label="Primary navigation"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            justifySelf: "center",

            gap: "clamp(10px, 2.2vw, 22px)",
            fontWeight: 650,

            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            whiteSpace: "nowrap",

            padding: "0 8px",
            minWidth: 0,
            maxWidth: "100%",

            // ✅ UPDATE: remove translateZ
            transform: undefined,
          }}
        >
          {NAV.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(item.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    scrollTo(item.id);
                  }
                }}
                className={`gg-tab ${isActive ? "active" : ""}`}
                aria-current={isActive ? "location" : undefined}
                ref={setTabRef(item.id)}
                style={{
                  padding: "7px 10px",
                  borderRadius: 12,
                  position: "relative",

                  // ✅ UPDATE: remove translateZ
                  transform: undefined,

                  flex: "0 0 auto",
                }}
              >
                <span className="gg-tab-label">{item.label}</span>
                <span className="gg-tab-underline" />
              </a>
            );
          })}
        </nav>

        {/* Actions */}
        <div
          className="gg-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            justifySelf: "end",
            alignItems: "center",
            minWidth: 0,

            // ✅ UPDATE: remove translateZ (this is the most common place the rectangle appears behind)
            transform: undefined,
          }}
        >
          <Link
            href="/user/login"
            className="user-login-btn relative inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-full border border-amber-200/35 bg-black/35 text-white/90 hover:border-amber-200/65 hover:text-white hover:bg-black/45 shadow-[0_0_26px_rgba(0,0,0,0.75)] transition-all duration-200"
            title="User Login"
            aria-label="User Login"
          >
            <Crown className="h-4 w-4 text-amber-300" />
            <span>User Login</span>
            <span className="btn-shine" aria-hidden />
            <span className="btn-rim" aria-hidden />
          </Link>
        </div>
      </motion.div>

      <div
        aria-hidden
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(244,216,139,0.22), rgba(214,179,90,0.14), transparent)",
          opacity: 0.9,
        }}
      />

      <style jsx>{`
        :root {
          --tab-underline-width-fallback: 60%;
          --gg-gold: #d6b35a;
          --gg-gold-2: #f4d88b;
          --gg-gold-deep: #9a6f25;
          --gg-ink: rgba(255, 255, 255, 0.92);
          --gg-ink-soft: rgba(255, 255, 255, 0.84);
        }

        /* ✅ UPDATE: guardrail for Safari compositing (helps prevent “ghost rectangles”) */
        .gg-header {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .gg-nav {
          -ms-overflow-style: none;
        }
        .gg-nav::-webkit-scrollbar {
          display: none;
        }

        .gg-tab {
          cursor: pointer;
          color: var(--gg-ink-soft);
          position: relative;
          background: transparent;
          border: 1px solid transparent;
          transition: background 160ms ease, transform 160ms ease, color 160ms ease, border-color 160ms ease,
            box-shadow 200ms ease, filter 160ms ease;
          will-change: transform;
        }

        @media (hover: hover) and (pointer: fine) {
          .gg-tab:hover {
            color: rgba(255, 255, 255, 0.96);
            background: linear-gradient(180deg, rgba(244, 216, 139, 0.08), rgba(0, 0, 0, 0.1));
            border-color: rgba(214, 179, 90, 0.2);
            transform: translateY(-1px) perspective(800px) rotateX(4deg);
            box-shadow: 0 14px 34px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
            filter: saturate(1.02) brightness(1.02);
          }
        }

        .gg-tab:active {
          transform: translateY(0px) scale(0.995);
        }

        .gg-tab:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(244, 216, 139, 0.4), 0 0 0 6px rgba(214, 179, 90, 0.14);
          border-color: rgba(244, 216, 139, 0.35);
        }

        .gg-tab .gg-tab-label {
          font-size: 15px;
          letter-spacing: -0.01em;
          padding: 2px 6px;
          display: inline-block;
          white-space: nowrap;
          font-weight: 750;
        }

        .gg-tab.active {
          background: linear-gradient(180deg, rgba(244, 216, 139, 0.96), rgba(214, 179, 90, 0.92));
          border-color: rgba(244, 216, 139, 0.58);
          color: rgba(7, 6, 5, 0.97);
          box-shadow: 0 12px 34px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset,
            0 -10px 18px rgba(154, 111, 37, 0.22) inset, 0 0 34px rgba(214, 179, 90, 0.14);
        }

        .gg-tab.active .gg-tab-label {
          color: rgba(7, 6, 5, 0.98);
          -webkit-text-fill-color: rgba(7, 6, 5, 0.98);
          text-shadow: none;
        }

        .gg-tab .gg-tab-underline {
          position: absolute;
          left: 50%;
          bottom: 6px;
          transform: translateX(-50%) scaleX(0);
          transform-origin: center;
          width: var(--tab-underline-width, var(--tab-underline-width-fallback));
          height: 2.2px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(154, 111, 37, 0),
            rgba(244, 216, 139, 0.95),
            rgba(214, 179, 90, 0.8),
            rgba(154, 111, 37, 0)
          );
          box-shadow: 0 0 16px rgba(214, 179, 90, 0.18);
          transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0.92;
        }

        .gg-tab.active .gg-tab-underline {
          transform: translateX(-50%) scaleX(1);
          animation: ggUnderlineSheen 2.6s ease-in-out infinite;
        }

        @keyframes ggUnderlineSheen {
          0% {
            filter: brightness(1) saturate(1);
            opacity: 0.82;
          }
          50% {
            filter: brightness(1.08) saturate(1.03);
            opacity: 1;
          }
          100% {
            filter: brightness(1) saturate(1);
            opacity: 0.82;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .gg-tab.active .gg-tab-underline {
            animation: none !important;
          }
        }

        .user-login-btn {
          white-space: nowrap;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }
        .user-login-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.42);
        }

        .btn-shine {
          position: absolute;
          inset: -40% -30%;
          background: radial-gradient(circle at 30% 30%, rgba(244, 216, 139, 0.22), rgba(255, 255, 255, 0) 58%);
          transform: rotate(-12deg);
          opacity: 0.72;
          pointer-events: none;
        }
        .btn-rim {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -1px 0 rgba(0, 0, 0, 0.24);
          pointer-events: none;
        }

        @media (max-width: 640px) {
          .gg-tab .gg-tab-label {
            font-size: 14px;
          }
          .user-login-btn {
            padding: 10px 14px;
            font-size: 13px;
          }
        }
      `}</style>
    </motion.header>
  );
}