"use client";

import { motion, useScroll, useTransform, useSpring, useMotionValueEvent } from "framer-motion";
import * as React from "react";

export default function LogoBadge() {
  const { scrollY } = useScroll();

  // Spin with scroll (slower feel)
  const rotateRaw = useTransform(scrollY, (v) => v / 8);
  const rotate = useSpring(rotateRaw, { stiffness: 120, damping: 20 });

  // Snap scale: bigger at top, smaller after first scroll
  const [hasScrolled, setHasScrolled] = React.useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setHasScrolled(v > 2));
  const scale = useSpring(hasScrolled ? 0.92 : 1.06, { stiffness: 200, damping: 22 });

  // Soft inner glow intensity with distance
  const glowMV = useTransform(scrollY, [0, 1000], [0.28, 0.45]);
  const [shadowStr, setShadowStr] = React.useState(
    "0 6px 18px rgba(0,0,0,0.28), inset 0 0 14px rgba(96,165,250, 0.28)"
  );
  useMotionValueEvent(glowMV, "change", (g) => {
    const gg = Math.max(0, Math.min(1, Number.isFinite(g as number) ? (g as number) : 0.3));
    setShadowStr(`0 6px 18px rgba(0,0,0,0.28), inset 0 0 14px rgba(96,165,250, ${gg.toFixed(3)})`);
  });

  return (
    <motion.div
      className="logo-badge"
      style={{ rotate, scale, boxShadow: shadowStr as any }}
      aria-label="Glass Guardian Logo"
      // Subtle breathing; doesn't conflict with scale spring
      animate={{ }}
      transition={{ }}
    >
      <svg width="32" height="32" viewBox="0 0 44 44" fill="none" aria-hidden>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60a5fa"/><stop offset="0.5" stopColor="#a78bfa"/><stop offset="1" stopColor="#34d399"/>
          </linearGradient>
        </defs>
        <path d="M8 14c0-3.314 2.686-6 6-6h16c3.314 0 6 2.686 6 6v16c0 3.314-2.686 6-6 6H14c-3.314 0-6-2.686-6-6V14z" stroke="url(#g1)" strokeWidth="2.5" fill="none"/>
        <path d="M15 22c0-3.866 3.134-7 7-7h7v4h-7a3 3 0 0 0 0 6h3v4h-3c-3.866 0-7-3.134-7-7z" fill="url(#g1)"/>
      </svg>
      <style jsx>{`
        .logo-badge {
          display: inline-grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          will-change: transform, box-shadow;
        }
      `}</style>
    </motion.div>
  );
}