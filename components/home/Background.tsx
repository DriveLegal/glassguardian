"use client";

import * as React from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from "framer-motion";

type Particle = {
  id: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  hue: number;
  opacity: number;
};

const BASE_PARTICLES = 48;

/* ---------- Deterministic RNG so particles stay stable client-side ---------- */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seeded = (rnd: () => number, min: number, max: number) => min + rnd() * (max - min);

export default function Background() {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  // Hydration safety: only consider browser-only features after mount
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Subtle scroll parallax, smoothed
  const scrollParallax = useTransform(scrollY, [0, 1200], [0, -60]);
  const springParallax = reduced
    ? scrollParallax
    : useSpring(scrollParallax, { stiffness: 80, damping: 20 });

  // Pointer-based micro-parallax (desktop)
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  React.useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const onPointer = (e: PointerEvent) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        px.set(e.clientX / window.innerWidth - 0.5);
        py.set(e.clientY / window.innerHeight - 0.5);
      });
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [reduced, px, py]);

  const pxSpring = reduced ? px : useSpring(px, { stiffness: 120, damping: 26 });
  const pySpring = reduced ? py : useSpring(py, { stiffness: 120, damping: 26 });

  // Device capability heuristics (evaluate after mount only to avoid SSR mismatch)
  const { isLowMem, isMidMem, isTouch } = React.useMemo(() => {
    if (!mounted) {
      return { isLowMem: false, isMidMem: false, isTouch: false };
    }
    const dm = (navigator as any)?.deviceMemory ? Math.max(1, (navigator as any).deviceMemory) : 4;
    const low = dm <= 1.5;
    const mid = dm <= 3.5;
    const touch =
      "matchMedia" in window && window.matchMedia("(pointer: coarse)").matches;
    return { isLowMem: low, isMidMem: mid, isTouch: touch };
  }, [mounted]);

  // Tune particle count by device (after mount)
  const particleCount = React.useMemo(() => {
    const base = BASE_PARTICLES;
    if (!mounted) return 0; // render none during SSR/first paint to avoid mismatch
    if (isLowMem) return Math.max(8, Math.round(base * 0.25));
    if (isMidMem) return Math.max(18, Math.round(base * 0.6));
    return Math.round(base * (isTouch ? 0.75 : 1.0));
  }, [mounted, isLowMem, isMidMem, isTouch]);

  // Build stable particles after mount using a deterministic seed
  const particles: Particle[] = React.useMemo(() => {
    if (!mounted || particleCount === 0) return [];
    const SEED = 1337; // make this a prop if you want different pages to vary
    const rnd = mulberry32(SEED);
    const arr: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      arr.push({
        id: `p-${i}`,
        left: Math.round(seeded(rnd, 3, 97)),
        top: Math.round(seeded(rnd, 3, 97)),
        size: Math.round(seeded(rnd, 6, isLowMem ? 28 : 48)),
        delay: Number(seeded(rnd, 0, 6).toFixed(2)),
        hue: Math.round(seeded(rnd, 165, 260)),
        opacity: Number(seeded(rnd, 0.08, 0.34).toFixed(2)),
      });
    }
    return arr;
  }, [mounted, particleCount, isLowMem]);

  // Map pointer/scroll → CSS translate values (MotionValues)
  const driftAX = useTransform(pxSpring, (v) => `${v * 8}%`);
  const driftAY = springParallax; // y parallax by scroll
  const driftBX = useTransform(pxSpring, (v) => `${v * -6}%`);
  const driftBY = useTransform(pxSpring, (v) => `${v * 4}%`);
  const driftCX = useTransform(pySpring, (v) => `${v * 6}%`);
  const driftCY = springParallax;

  // CSS tuning values (responsive)
  const blobBlur = isLowMem ? 64 : isMidMem ? 88 : 110;
  const blobOpacity = isLowMem ? 0.22 : isMidMem ? 0.3 : 0.36;
  const rimOpacity = isLowMem ? 0.5 : 0.72;

  return (
    <>
      {/* base gradient */}
      <div className="gg-bg-outer" aria-hidden />

      {/* volumetric blobs (MotionValues in style; keyframes in animate) */}
      <motion.div
        className="gg-blob layer-a"
        style={{ x: driftAX, y: driftAY, opacity: blobOpacity, filter: `blur(${blobBlur}px) saturate(120%)` }}
        animate={reduced ? undefined : { rotate: [0, 4, -3, 0] }}
        transition={reduced ? undefined : { rotate: { duration: 30, ease: "easeInOut", repeat: Infinity } }}
      />
      <motion.div
        className="gg-blob layer-b"
        style={{ x: driftBX, y: driftBY, opacity: blobOpacity * 0.85, filter: `blur(${blobBlur + 16}px) saturate(120%)` }}
        animate={reduced ? undefined : { rotate: [0, -5, 3, 0] }}
        transition={reduced ? undefined : { rotate: { duration: 36, ease: "easeInOut", repeat: Infinity } }}
      />
      <motion.div
        className="gg-blob layer-c"
        style={{ x: driftCX, y: driftCY, opacity: blobOpacity * 0.9, filter: `blur(${blobBlur + 30}px) saturate(120%)` }}
        animate={reduced ? undefined : { scale: [1, 1.05, 0.98, 1] }}
        transition={reduced ? undefined : { scale: { duration: 40, ease: "easeInOut", repeat: Infinity } }}
      />

      {/* rim to give curvature */}
      <motion.div className="gg-rim" style={{ y: springParallax, opacity: rimOpacity }} />

      {/* particles (client-only to avoid hydration diff) */}
      <div className="gg-particles" aria-hidden suppressHydrationWarning>
        {particles.map((p) => (
          <div
            key={p.id}
            className="gg-p"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              background: `radial-gradient(circle at 30% 30%, hsla(${p.hue}, 78%, 68%, 0.95), rgba(255,255,255,0) 60%)`,
              opacity: p.opacity,
              animationDelay: reduced ? "0s" : `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* stars + grain */}
      <div className="gg-stars" aria-hidden />
      <div className="gg-grain" aria-hidden />

      <style jsx global>{`
        :root {
          --bg-0: #071028;
          --bg-1: #0b1326;
          --accentA: #60a5fa;
          --accentB: #a78bfa;
          --accentC: #34d399;
        }

        .gg-bg-outer {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(1200px 800px at 16% 6%, rgba(124,156,255,0.22), transparent 50%),
            radial-gradient(900px 700px at 92% 18%, rgba(102,227,255,0.16), transparent 50%),
            linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 40%, #061021 100%);
          box-shadow: inset 0 0 240px rgba(0,0,0,0.34);
          will-change: transform;
        }

        .gg-blob {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          mix-blend-mode: screen;
          transform: translateZ(0);
        }

        .gg-blob.layer-a {
          background: radial-gradient(420px 420px at 18% 26%, rgba(120,140,255,0.70), transparent 60%);
        }
        .gg-blob.layer-b {
          background: radial-gradient(520px 520px at 78% 22%, rgba(102,227,255,0.64), transparent 60%);
        }
        .gg-blob.layer-c {
          background: radial-gradient(620px 620px at 52% 82%, rgba(58,209,183,0.60), transparent 60%);
        }

        .gg-rim {
          position: fixed;
          left: -10%;
          top: 68%;
          width: 120%;
          height: 40%;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(60% 40% at 50% 10%, rgba(255,255,255,0.02), transparent 40%),
            linear-gradient(180deg, rgba(255,255,255,0.01), transparent 60%);
          filter: blur(28px) saturate(118%);
          mix-blend-mode: screen;
          transform: translateZ(0);
        }

        .gg-particles {
          position: fixed;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }
        .gg-p {
          position: absolute;
          border-radius: 99px;
          transform: translate(-50%, -50%);
          mix-blend-mode: screen;
          filter: blur(8px) saturate(110%);
          will-change: transform, opacity;
          animation: twinkle 6s ease-in-out infinite;
        }

        @keyframes twinkle {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          40% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
        }

        .gg-stars {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background-image:
            radial-gradient(rgba(255,255,255,0.85) 1px, transparent 1px),
            radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px);
          background-size: 240px 240px, 120px 120px;
          background-position: 12px 20px, 60px 140px;
          opacity: 0.045;
          filter: blur(0.3px);
        }

        .gg-grain {
          position: fixed;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          opacity: 0.03;
          background-image: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 60%);
          background-size: 100% 2px;
        }

        /* Ensure UI sits above */
        main { position: relative; z-index: 10; }
        .gg-header { position: relative; z-index: 20; }

        /* Reduced motion safety */
        @media (prefers-reduced-motion: reduce) {
          .gg-blob { transition: none !important; animation: none !important; opacity: 0.26; filter: blur(80px) saturate(100%); }
          .gg-p { animation: none !important; opacity: 0.18 !important; transform: translate(-50%, -50%) scale(1) !important; }
          .gg-rim { transition: none !important; opacity: 0.55; }
        }

        /* Responsive tuning */
        @media (max-width: 640px) {
          .gg-blob { filter: blur(64px); }
          .gg-rim { top: 72%; height: 32%; filter: blur(22px); }
          .gg-p { filter: blur(6px); }
        }
      `}</style>
    </>
  );
}