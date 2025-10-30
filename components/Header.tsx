// components/Header.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import LogoBadge from "@/components/LogoBadge";

// Reordered to: Overview → Avoid → Specialties → About → Billing → Price → Q&A
const NAV = [
  { id: "overview", label: "Glass Guardian" },
  { id: "avoid", label: "Avoid" },
  { id: "specialties", label: "Specialties" },
  { id: "about", label: "About repair" },
  { id: "billing", label: "Billing & Insurance" },
  { id: "pricing", label: "Price" },
  { id: "qa", label: "Q&A" },
];

export default function Header() {
  const [active, setActive] = useState<string>("overview");
  const headerRef = useRef<HTMLDivElement | null>(null);

  // Keep --header-h in sync with actual header height (on load + resize)
  useEffect(() => {
    const setVar = () => {
      const h = headerRef.current?.getBoundingClientRect().height ?? 72;
      document.documentElement.style.setProperty("--header-h", `${Math.round(h)}px`);
    };
    setVar();
    const ro = new ResizeObserver(setVar);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener("load", setVar);
    window.addEventListener("resize", setVar);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", setVar);
      window.removeEventListener("resize", setVar);
    };
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px", threshold: [0.01, 0.2] }
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { scrollY } = useScroll();
  const progress = useTransform(scrollY, [0, 160], [0, 1]);
  const padY = useTransform(progress, [0, 1], [18, 8]);
  const logoScale = useTransform(progress, [0, 1], [1, 0.88]);
  const topAlpha = useTransform(progress, [0, 1], [0.9, 0.98]);
  const midAlpha = useTransform(progress, [0, 1], [0.75, 0.9]);
  const bg = useMotionTemplate`linear-gradient(
    to bottom,
    rgba(8,12,28, ${topAlpha}),
    rgba(8,12,28, ${midAlpha}),
    rgba(8,12,28, 0.6)
  )`;

  return (
    <motion.header
      className="gg-header"
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 100,
        background: bg,
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}
      ref={headerRef}
    >
      <motion.div
        className="gg-header-inner"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: padY,
          paddingBottom: padY,
          maxWidth: 1250,
          margin: "0 auto",
          gap: 16,
        }}
      >
        <a href="#overview" aria-label="Glass Guardian Home" className="gg-logo-link" style={{ display: "flex", alignItems: "center" }}>
          <motion.div style={{ scale: logoScale }}>
            <LogoBadge />
          </motion.div>
        </a>

        <nav
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
          }}
        >
          {NAV.map((n) => {
            const isActive = active === n.id;
            return (
              <a
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => scrollTo(n.id)}
                onKeyDown={(e) => e.key === "Enter" && scrollTo(n.id)}
                className={`gg-tab ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="gg-tab-label">{n.label}</span>
                <span className="gg-tab-underline" />
              </a>
            );
          })}
        </nav>

        <div className="gg-actions" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          <a className="gg-btn" href="/login">Login</a>
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: 0.6 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
          }}
        />
      </motion.div>
    </motion.header>
  );
}