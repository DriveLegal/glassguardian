// components/Header.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";

/* ===========================
   Navigation items (IDs must exist in DOM)
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
    const onChange = () => setMatches(mql.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener?.(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener?.(onChange);
    };
  }, [query]);
  return matches;
}

export default function Header() {
  const [active, setActive] = useState<string>("overview");

  const headerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const tabRO = useRef<Record<string, ResizeObserver | null>>({});

  const prefersReduced = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 641px)");

  /* ========== Shrink + Rotate (smoothed) ========== */
  const { scrollY } = useScroll();

  // padding: 18 → 6 over the first ~220px
  const padYRaw = useTransform(scrollY, [0, 220], [18, 6]);
  const padY = prefersReduced ? padYRaw : useSpring(padYRaw, { stiffness: 180, damping: 28 });

  // logo scale
  const logoScaleRaw = useTransform(scrollY, [0, 220], [1, 0.86]);
  const logoScale = prefersReduced ? 1 : useSpring(logoScaleRaw, { stiffness: 160, damping: 26 });

  // rotation (desktop only, if motion allowed)
  const rotationMax = isDesktop && !prefersReduced ? 180 : 0;
  const rotateTarget = useTransform(scrollY, [0, 900], [0, rotationMax]);
  const logoRotate = prefersReduced ? 0 : useSpring(rotateTarget, { stiffness: 120, damping: 20 });

  useMotionValueEvent(scrollY, "change", (y) => {
    if (!document?.documentElement) return;
    if (y > 8) document.documentElement.classList.add("gg-scrolled");
    else document.documentElement.classList.remove("gg-scrolled");
  });

  /* ========== header height / scroll-padding sync ========== */
  useEffect(() => {
    const setVar = () => {
      const h =
        (headerRef.current?.getBoundingClientRect().height ??
          innerRef.current?.getBoundingClientRect().height) ?? 72;
      document.documentElement.style.setProperty("--header-h", `${Math.round(h)}px`);
    };
    setVar();
    const ro = new ResizeObserver(setVar);
    if (innerRef.current) ro.observe(innerRef.current);
    else if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener("resize", setVar);
    window.addEventListener("load", setVar);
    const t1 = setTimeout(setVar, 250);
    const t2 = setTimeout(setVar, 1000);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", setVar);
      window.removeEventListener("load", setVar);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  /* ========== subtle background opacity mapping ========== */
  const [bgStr, setBgStr] = useState(
    "linear-gradient(to bottom, rgba(8,12,28,0.98), rgba(8,12,28,0.9), rgba(8,12,28,0.6))"
  );
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const lerp = (t: number, a: number, b: number) => a + (b - a) * t;
  useMotionValueEvent(padY, "change", (py) => {
    const t = clamp((py - 6) / (18 - 6), 0, 1);
    const topAlpha = lerp(t, 0.98, 0.9);
    const midAlpha = lerp(t, 0.9, 0.75);
    setBgStr(
      `linear-gradient(to bottom, rgba(8,12,28, ${topAlpha.toFixed(
        3
      )}), rgba(8,12,28, ${midAlpha.toFixed(3)}), rgba(8,12,28, 0.6))`
    );
  });

  /* ========== ScrollSpy ========== */
  const ioRef = useRef<IntersectionObserver | null>(null);
  const lastSetRef = useRef(0);

  const rebuildIO = useCallback(() => {
    ioRef.current?.disconnect();
    ioRef.current = null;

    const headerH =
      headerRef.current?.getBoundingClientRect().height ??
      (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 72);

    const rootMarginTop = -Math.round(headerH + 8);
    const rootMarginBottom = -Math.round(window.innerHeight * 0.35);
    const thresholds = [0, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1];

    const byId: Record<string, HTMLElement | undefined> = {};
    document.querySelectorAll<HTMLElement>("section[id]").forEach((el) => (byId[el.id] = el));
    const targets = NAV.map((n) => byId[n.id]).filter(Boolean) as HTMLElement[];
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        let bestScore = -Infinity;

        const anchorY = headerH + 8;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const ratio = e.intersectionRatio ?? 0;
          const topDist = Math.abs(e.boundingClientRect.top - anchorY);
          const score = ratio * 1000 - topDist;
          if (score > bestScore) { bestScore = score; best = e; }
        }

        if (!best) return;
        const id = (best.target as HTMLElement).id;
        if (!id) return;

        const now = performance.now();
        if (now - lastSetRef.current < 120) return;
        lastSetRef.current = now;

        // ✅ Only update state; do NOT manipulate history here.
        setActive((prev) => (prev === id ? prev : id));
      },
      { root: null, rootMargin: `${rootMarginTop}px 0px ${rootMarginBottom}px 0px`, threshold: thresholds }
    );

    targets.forEach((el) => observer.observe(el));
    ioRef.current = observer;
  }, []);

  useEffect(() => {
    rebuildIO();
    const onResize = () => rebuildIO();
    const onOrient = () => rebuildIO();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);

    const mo = new MutationObserver(() => rebuildIO());
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    const t1 = setTimeout(rebuildIO, 250);
    const t2 = setTimeout(rebuildIO, 1000);
    document.fonts?.addEventListener?.("loadingdone", rebuildIO as any);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrient);
      mo.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      document.fonts?.removeEventListener?.("loadingdone", rebuildIO as any);
      ioRef.current?.disconnect();
    };
  }, [rebuildIO]);

  // ✅ Sync URL hash after commit (avoids Router update during render)
  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    const current = window.location.hash?.replace(/^#/, "");
    if (current === active) return;

    const url = `${window.location.pathname}${window.location.search}#${active}`;
    const raf = requestAnimationFrame(() => {
      try {
        window.history.replaceState(null, "", url);
      } catch { /* noop */ }
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // respect initial hash
  useEffect(() => {
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }, [prefersReduced]);

  /* ========== Tab underline measurement ========== */
  const setTabRef = useCallback((id: string) => (el: HTMLAnchorElement | null) => {
    tabRO.current[id]?.disconnect?.();
    tabRO.current[id] = null;

    tabRefs.current[id] = el;
    if (!el) return;

    const label = el.querySelector<HTMLElement>(".gg-tab-label");
    if (!label) return;

    const setUnderlineWidth = () => {
      const rect = label.getBoundingClientRect();
      el.style.setProperty("--tab-underline-width", `${Math.round(rect.width) + 6}px`);
    };

    setUnderlineWidth();
    const ro = new ResizeObserver(setUnderlineWidth);
    ro.observe(label);
    tabRO.current[id] = ro;
  }, []);

  useEffect(() => {
    return () => {
      Object.values(tabRO.current).forEach((ro) => { try { ro?.disconnect(); } catch {} });
      tabRO.current = {};
    };
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <motion.header
      className="gg-header"
      ref={headerRef}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 1200,
        background: bgStr,
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        willChange: "transform, background, opacity",
      }}
    >
      <motion.div
        ref={innerRef}
        className="gg-header-inner"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: padY as any,
          paddingBottom: padY as any,
          maxWidth: 1250,
          margin: "0 auto",
          gap: 12,
        }}
      >
        <a
          href="#overview"
          aria-label="Glass Guardian Home"
          className="gg-logo-link"
          onClick={(e) => { e.preventDefault(); scrollTo("overview"); }}
          style={{ display: "flex", alignItems: "center" }}
        >
          <motion.div
            style={{
              scale: logoScale as any,
              rotate: logoRotate as any,
              transformOrigin: "50% 50%",
              willChange: "transform",
            }}
          >
            <LogoBadge />
          </motion.div>
        </a>

        <nav
          ref={navRef}
          className="gg-nav"
          aria-label="Primary"
          style={{
            display: "grid",
            gridAutoFlow: "column",
            justifyContent: "center",
            justifyItems: "center",
            alignItems: "center",
            gap: "2.2vw",
            fontWeight: 600,
            textAlign: "center",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            whiteSpace: "nowrap",
            paddingLeft: 6,
            paddingRight: 6,
          }}
        >
          {NAV.map((n) => {
            const isActive = active === n.id;
            return (
              <a
                key={n.id}
                href={`#${n.id}`}
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); scrollTo(n.id); }}
                onKeyDown={(e) => e.key === "Enter" && scrollTo(n.id)}
                className={`gg-tab ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                ref={setTabRef(n.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "min-content",
                  padding: "6px 8px",
                  position: "relative",
                }}
              >
                <span className="gg-tab-label">{n.label}</span>
                <span className="gg-tab-underline" />
              </a>
            );
          })}
        </nav>

        <div
          className="gg-actions"
          style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}
        >
          {/* Simple, crawlable link straight to user/login */}
          <Link className="gg-btn" href="/user/login">Login</Link>
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: 0.6 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: prefersReduced ? 0 : 0.6, ease: "easeOut" }}
      >
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
          }}
        />
      </motion.div>

      <style jsx>{`
        :root { --tab-underline-width-fallback: 56%; }
        .gg-nav { -ms-overflow-style: none; }
        .gg-nav::-webkit-scrollbar { display: none; height: 6px; }
        .gg-tab {
          cursor: pointer;
          border-radius: 8px;
          transition: background .15s ease, color .15s ease, transform .12s ease;
          position: relative;
          padding-bottom: 10px;
        }
        .gg-tab:focus { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.07); }
        .gg-tab .gg-tab-label { display: inline-block; padding: 2px 6px; white-space: nowrap; font-size: 15px; }
        .gg-tab .gg-tab-underline {
          position: absolute;
          left: 50%;
          bottom: 6px;
          transform: translateX(-50%) scaleX(0);
          transform-origin: center;
          width: var(--tab-underline-width, var(--tab-underline-width-fallback));
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, var(--accentA), var(--accentB), var(--accentC));
          transition: transform .28s ease;
        }
        .gg-tab.active .gg-tab-underline { transform: translateX(-50%) scaleX(1); }
        .gg-tab.active { color: #fff; background: rgba(255,255,255,0.04); }
        @media (max-width: 640px) {
          .gg-nav { display: grid; gridAutoFlow: column; gap: 14px; }
          .gg-tab .gg-tab-label { font-size: 14px; padding: 2px 6px; }
        }
      `}</style>
    </motion.header>
  );
}