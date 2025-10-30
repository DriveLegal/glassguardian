// components/LogoBadge.tsx
"use client";

import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";

export default function LogoBadge() {
  const { scrollY } = useScroll();

  // Rotate with scroll (tune divisor for speed)
  const rotate = useTransform(scrollY, (v) => v / 8);

  // Reactive inner glow with scroll distance
  const glow = useTransform(scrollY, [0, 1000], [0.28, 0.45]);
  const boxShadow = useMotionTemplate`
    0 6px 18px rgba(0,0,0,0.28),
    inset 0 0 14px rgba(96,165,250, ${glow})
  `;

  return (
    <motion.div
      className="logo-badge"
      style={{ rotate, boxShadow }}
      aria-label="Glass Guardian Logo"
      // Soft breathing loop (does NOT fight rotation)
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
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
    </motion.div>
  );
}