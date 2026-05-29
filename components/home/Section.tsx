// components/home/Section.tsx
"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  id: string;
  index: number; // used to stagger slightly
  className?: string;
  children: React.ReactNode;
};

/**
 * ✅ Fixes:
 * - Removes heavy whileInView + blur + scale animation that causes scroll “fight” + lag + back/forth.
 * - Ensures the SECTION is the real anchor target (id sits on the actual block).
 * - Uses a light, one-time reveal (or disables motion if prefers-reduced-motion).
 * - Adds stable padding + maxWidth wrapper so section boundaries are consistent for scroll spy.
 */
export default function Section({ id, index, className = "", children }: Props) {
  const reduce = useReducedMotion();

  return (
    <section
      id={id}
      data-gg-section="true"
      data-gg-index={String(index)}
      className={`gg-section ${className}`.trim()}
      style={{
        position: "relative",
        width: "100%",
        zIndex: 5,
        scrollMarginTop: "var(--header-h, 72px)",
        padding: "clamp(42px, 6vw, 72px) 16px",
      }}
    >
      <motion.div
        // ✅ much lighter reveal (no blur filters)
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{
          // ✅ “once: true” prevents the animation from re-triggering and fighting scroll
          once: true,
          // ✅ small amount avoids jitter
          amount: 0.18,
          // ✅ preload a bit so it feels smooth
          margin: "0px 0px -10% 0px",
        }}
        transition={{
          duration: 0.45,
          ease: "easeOut",
          delay: Math.min(index * 0.02, 0.08),
        }}
        style={{
          willChange: reduce ? "auto" : "transform, opacity",
        }}
      >
        <div
          className="section-inner section-anchor"
          style={{
            width: "100%",
            maxWidth: 1100,
            margin: "0 auto",
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </motion.div>
    </section>
  );
}