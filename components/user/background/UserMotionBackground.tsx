"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

type Props = {
  /** e.g. "/user-background.mp4" (must be in /public) */
  srcMp4: string;
  /** optional: "/user-background.webm" */
  srcWebm?: string;

  /** optional poster image in /public */
  poster?: string;

  /** base video opacity 0..1 */
  opacity?: number;

  /** blur video layer (costly on mobile); keep 0 for perf */
  blurPx?: number;

  /** When user is typing/focused in inputs, dim background for readability */
  dimWhenTyping?: boolean;

  /** Dim amount added on top of base overlay when typing (0..0.6 typical) */
  typingDimStrength?: number;

  /** enable subtle drift */
  enableDrift?: boolean;

  /** drift intensity in px (desktop only) */
  driftPx?: number;

  className?: string;
};

function isLikelyIOS() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS on Safari reports as Mac sometimes
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);

  return iOS;
}

function prefersCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
}

/**
 * Fullscreen motion video background with:
 * - subtle parallax drift (desktop only by default)
 * - typing dim mode
 * - iOS GPU reduction (turns off drift + keeps filters minimal)
 */
export default function UserMotionBackground({
  srcMp4,
  srcWebm,
  poster,
  opacity = 0.55,
  blurPx = 0,
  dimWhenTyping = false,
  typingDimStrength = 0.22,
  enableDrift = true,
  driftPx = 10,
  className = "",
}: Props) {
  const reduceMotion = useReducedMotion();

  // Respect reduced motion: no moving background.
  if (reduceMotion) return null;

  const [isIOS, setIsIOS] = React.useState(false);
  const [coarse, setCoarse] = React.useState(false);

  React.useEffect(() => {
    setIsIOS(isLikelyIOS());
    setCoarse(prefersCoarsePointer());
  }, []);

  // Reduce GPU cost on iOS/coarse pointer:
  // - disable drift
  // - avoid blur filters
  const allowDrift = enableDrift && !isIOS && !coarse;
  const effectiveBlur = !isIOS && !coarse ? blurPx : 0;

  // Drift state
  const [drift, setDrift] = React.useState({ x: 0, y: 0 });
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!allowDrift) {
      setDrift({ x: 0, y: 0 });
      return;
    }

    const prefersReduce = reduceMotion;
    if (prefersReduce) return;

    startRef.current = performance.now();

    const tick = (t: number) => {
      // slow, subtle, non-distracting
      const dt = (t - startRef.current) / 1000;
      const x = Math.sin(dt * 0.12) * driftPx; // very slow
      const y = Math.cos(dt * 0.10) * (driftPx * 0.75);

      setDrift({ x, y });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [allowDrift, driftPx, reduceMotion]);

  const videoStyle: React.CSSProperties = {
    opacity,
    transform: `translate3d(${drift.x}px, ${drift.y}px, 0) scale(1.04)`,
    willChange: allowDrift ? "transform" : undefined,
    backfaceVisibility: "hidden",
  };

  if (effectiveBlur > 0) {
    // blur is expensive; we already zeroed it on iOS/coarse pointer
    videoStyle.filter = `blur(${effectiveBlur}px)`;
  }

  // Base overlay to keep text readable; typing adds extra dim on top
  const typingDim = dimWhenTyping ? typingDimStrength : 0;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        style={videoStyle}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster={poster}
      >
        {srcWebm ? <source src={srcWebm} type="video/webm" /> : null}
        <source src={srcMp4} type="video/mp4" />
      </video>

      {/* Readability overlays (kept cheap) */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/35 to-slate-950/70" />

      {/* Extra dim while typing (smooth fade) */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: "rgba(2,6,23,1)", opacity: typingDim }}
      />

      {/* Accent glow overlay (still cheap) */}
      <div className="absolute inset-0 [background:radial-gradient(900px_500px_at_20%_10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(16,185,129,0.12),transparent_60%)]" />
    </div>
  );
}