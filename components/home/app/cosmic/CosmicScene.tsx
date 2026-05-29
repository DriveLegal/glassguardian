"use client";

import * as React from "react";
import { m, useReducedMotion } from "framer-motion";

function cn(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export function usePageVisible() {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis, { passive: true });
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return visible;
}

function buildStars(seed = 1, count = 24, alpha = 0.85) {
  const rnd = (i: number) => {
    const x = Math.sin(i * 999 + seed * 1337) * 10000;
    return x - Math.floor(x);
  };

  const parts: string[] = [];

  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd(i + 1) * 100);
    const y = Math.floor(rnd(i + 51) * 100);
    const size = 1 + Math.floor(rnd(i + 91) * 2);
    const a = (0.2 + rnd(i + 121) * 0.6) * alpha;

    const col =
      rnd(i + 211) > 0.82
        ? `rgba(255,220,190,${a.toFixed(3)})`
        : rnd(i + 311) < 0.2
          ? `rgba(200,240,255,${a.toFixed(3)})`
          : `rgba(255,255,255,${a.toFixed(3)})`;

    parts.push(
      `radial-gradient(${size}px ${size}px at ${x}% ${y}%, ${col}, transparent 68%)`
    );
  }

  return parts.join(", ");
}

export function CosmicScene({
  className,
  intensity = "lite",
  animated = true,
}: {
  className?: string;
  intensity?: "lite" | "rich";
  animated?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion ?? true;

  const STAR_A = React.useMemo(
    () => buildStars(3, intensity === "rich" ? 34 : 24, 0.9),
    [intensity]
  );
  const STAR_B = React.useMemo(
    () => buildStars(11, intensity === "rich" ? 18 : 12, 0.62),
    [intensity]
  );

  const animateOK = animated && !reduce;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #000000 0%, #02030b 45%, #000000 100%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% -10%, rgba(35,45,95,0.22), transparent 46%), radial-gradient(circle at 18% 12%, rgba(96,220,255,0.08), transparent 24%), radial-gradient(circle at 82% 74%, rgba(255,110,220,0.06), transparent 28%)",
        }}
      />

      <m.div
        className="absolute -top-[24%] left-[-10%] h-[640px] w-[640px] rounded-full"
        style={{
          background: "rgba(96,220,255,0.08)",
          filter: "blur(110px)",
          willChange: animateOK ? "opacity" : undefined,
        }}
        animate={animateOK ? { opacity: [0.32, 0.48, 0.34] } : { opacity: 0.34 }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <m.div
        className="absolute bottom-[-24%] right-[-14%] h-[640px] w-[640px] rounded-full"
        style={{
          background: "rgba(255,110,220,0.06)",
          filter: "blur(120px)",
          willChange: animateOK ? "opacity" : undefined,
        }}
        animate={animateOK ? { opacity: [0.2, 0.34, 0.24] } : { opacity: 0.24 }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: STAR_A,
          backgroundSize: "900px 900px",
          filter: "drop-shadow(0 0 8px rgba(180,240,255,0.08))",
          opacity: 0.9,
        }}
      />

      <m.div
        className="absolute inset-0"
        style={{
          backgroundImage: STAR_B,
          backgroundSize: "620px 620px",
          opacity: 0.38,
          mixBlendMode: "screen",
          willChange: animateOK ? "opacity" : undefined,
        }}
        animate={animateOK ? { opacity: [0.26, 0.42, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute left-1/2 top-[78%] h-[520px] w-[520px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 22%, rgba(110,240,255,0.10), transparent 34%), radial-gradient(circle at 50% 60%, rgba(0,0,0,0.98), #000 76%)",
          boxShadow: "0 -50px 120px rgba(8,14,32,0.78)",
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
    </div>
  );
}

export default CosmicScene;