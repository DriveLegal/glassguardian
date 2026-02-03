//components/home/app/cosmic/CosmicScene.tsx
"use client";

import * as React from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";

function cn(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

type ShootingStar = {
  id: string;
  topPct: number;
  leftPct: number;
  angleDeg: number;
  len: number;
  dur: number;
  delay: number;
  opacity: number;
};

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Pause heavy ambient when tab not visible (big perf + battery win) */
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

/** Smooth pointer parallax with damping + scroll pause */
export function useParallax(reduce: boolean | null, enabled: boolean) {
  const shouldReduce = reduce ?? true;
  const [p, setP] = React.useState({ x: 0, y: 0 });
  const target = React.useRef({ x: 0, y: 0 });
  const rafRef = React.useRef<number | null>(null);
  const [isScrolling, setIsScrolling] = React.useState(false);

  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    const onScroll = () => {
      setIsScrolling(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsScrolling(false), 420);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const effectiveEnabled = enabled && !shouldReduce && !isScrolling;

  React.useEffect(() => {
    if (!effectiveEnabled) return;

    const step = () => {
      setP((cur) => {
        const nx = cur.x + (target.current.x - cur.x) * 0.11;
        const ny = cur.y + (target.current.y - cur.y) * 0.11;
        return { x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) };
      });
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [effectiveEnabled]);

  React.useEffect(() => {
    if (!effectiveEnabled) return;

    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w - 0.5) * 2;
      const ny = (e.clientY / h - 0.5) * 2;
      target.current = { x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) };
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [effectiveEnabled]);

  return p;
}

/** Procedural starfield – memoized */
export function buildStarsCSS(seed = 1, count = 24, alpha = 0.9) {
  const rnd = (i: number) => {
    const x = Math.sin(i * 997 + seed * 1337) * 10000;
    return x - Math.floor(x);
  };

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd(i + 1) * 100);
    const y = Math.floor(rnd(i + 71) * 100);

    // Slightly wider range to feel more “HDR”
    const size = 1 + Math.floor(rnd(i + 199) * 2.2); // 1–3px-ish
    const a = (0.22 + rnd(i + 333) * 0.62) * alpha;

    // tiny tint variation (cool ↔ warm) to feel more natural
    const warm = rnd(i + 909);
    const c =
      warm > 0.82
        ? `rgba(255,210,190,${a.toFixed(3)})`
        : warm < 0.18
          ? `rgba(200,240,255,${a.toFixed(3)})`
          : `rgba(255,255,255,${a.toFixed(3)})`;

    parts.push(
      `radial-gradient(${size}px ${size}px at ${x}% ${y}%, ${c}, transparent 68%)`
    );
  }
  return parts.join(", ");
}

/** Ultra-dust (Milky Way) – procedural "space cloud" bands */
function buildDustCSS(seed = 7, alpha = 0.22) {
  const rnd = (i: number) => {
    const x = Math.sin(i * 777 + seed * 2222) * 10000;
    return x - Math.floor(x);
  };

  const parts: string[] = [];

  // cluster “nebula grains”
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rnd(i + 10) * 100);
    const y = Math.floor(rnd(i + 80) * 100);
    const r = 18 + Math.floor(rnd(i + 220) * 64); // 18–82
    const a = (0.08 + rnd(i + 420) * 0.22) * alpha;

    // blue/cyan/pink dust variations
    const t = rnd(i + 666);
    const col =
      t > 0.7
        ? `rgba(255,110,220,${a.toFixed(3)})`
        : t < 0.3
          ? `rgba(96,220,255,${a.toFixed(3)})`
          : `rgba(180,210,255,${a.toFixed(3)})`;

    parts.push(
      `radial-gradient(${r}px ${r}px at ${x}% ${y}%, ${col}, transparent 70%)`
    );
  }

  // soft band sweep (milky way lane)
  parts.push(
    `linear-gradient(120deg,
      rgba(0,0,0,0) 20%,
      rgba(96,220,255,0.10) 34%,
      rgba(255,110,220,0.08) 46%,
      rgba(240,250,255,0.06) 56%,
      rgba(0,0,0,0) 70%)`
  );

  return parts.join(", ");
}

/** Constellation – sharper, brighter, still light */
export const ConstellationSVG = React.memo(function ConstellationSVG({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 900 650"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="primeLine" x1="0" y1="0" x2="900" y2="650">
          <stop offset="0" stopColor="rgba(96,220,255,0.00)" />
          <stop offset="0.35" stopColor="rgba(96,220,255,0.52)" />
          <stop offset="0.72" stopColor="rgba(255,110,220,0.42)" />
          <stop offset="1" stopColor="rgba(255,110,220,0.00)" />
        </linearGradient>

        <radialGradient id="primeNode" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(255,255,255,0.98)" />
          <stop offset="1" stopColor="rgba(96,220,255,0.00)" />
        </radialGradient>

        <filter id="primeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.35" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0"
          />
        </filter>
      </defs>

      <g opacity="0.62" filter="url(#primeGlow)">
        <path
          d="M90 130 L210 80 L345 155 L440 120 L560 210 L690 175"
          stroke="url(#primeLine)"
          strokeWidth="0.9"
        />
        <path
          d="M230 440 L350 350 L470 392 L610 330 L760 360"
          stroke="url(#primeLine)"
          strokeWidth="0.9"
        />
        <path
          d="M710 545 L615 455 L520 520 L420 470 L280 540"
          stroke="url(#primeLine)"
          strokeWidth="0.9"
        />
      </g>

      <g opacity="0.98">
        {[
          [90, 130, 4.2],
          [210, 80, 5.3],
          [345, 155, 4.2],
          [440, 120, 4.8],
          [560, 210, 5.2],
          [690, 175, 4.2],
          [230, 440, 4.7],
          [350, 350, 5.1],
          [470, 392, 4.2],
          [610, 330, 5.2],
          [760, 360, 4.7],
          [710, 545, 5.2],
          [615, 455, 4.2],
          [520, 520, 4.8],
          [420, 470, 4.2],
          [280, 540, 4.7],
        ].map(([x, y, r], idx) => (
          <circle key={idx} cx={x} cy={y} r={r} fill="url(#primeNode)" />
        ))}
      </g>
    </svg>
  );
});

/** Planet limb – richer limb glow + crisper shadows (still safe) */
const PlanetLimb = React.memo(function PlanetLimb({
  px,
  py,
  reduce,
}: {
  px: number;
  py: number;
  reduce: boolean;
}) {
  const tx = reduce ? 0 : px * 18;
  const ty = reduce ? 0 : py * 13;

  return (
    <m.div
      aria-hidden
      className="absolute -bottom-[380px] left-1/2 h-[920px] w-[920px] -translate-x-1/2 rounded-full transform-gpu will-change-transform"
      style={{
        transform: `translate3d(calc(-50% + ${tx}px), ${ty}px, 0)`,
        background:
          "radial-gradient(circle at 50% 24%, rgba(120,240,255,0.18), transparent 50%), radial-gradient(circle at 50% 56%, rgba(0,0,0,0.985), #000000 78%)",
        boxShadow:
          "0 -130px 260px rgba(6,18,48,0.95), inset 0 120px 240px rgba(0,0,0,0.94)",
        willChange: "transform, opacity",
      }}
      initial={reduce ? false : { opacity: 0, y: 30 }}
      animate={reduce ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 1.0, ease: "easeOut", delay: 0.05 }}
    >
      {/* limb chroma */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "0 -14px 96px rgba(96,220,255,0.52), 0 -5px 44px rgba(255,110,220,0.40)",
          maskImage: "linear-gradient(to top, transparent 58%, black 88%)",
          WebkitMaskImage: "linear-gradient(to top, transparent 58%, black 88%)",
        }}
      />
      {/* thin atmosphere glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 7%, rgba(180,250,255,0.26), transparent 60%)",
          filter: "blur(3.2px)",
          opacity: 0.92,
          maskImage: "linear-gradient(to top, transparent 54%, black 88%)",
          WebkitMaskImage: "linear-gradient(to top, transparent 54%, black 88%)",
        }}
      />
    </m.div>
  );
});

/** Shooting star – sharper head + HDR trail */
const ShootingStarItem = React.memo(function ShootingStarItem({
  s,
  reduce,
}: {
  s: ShootingStar;
  reduce: boolean;
}) {
  const style: React.CSSProperties = {
    top: `${s.topPct}%`,
    left: `${s.leftPct}%`,
    width: `${s.len}px`,
    height: "1.6px",
    opacity: s.opacity,
    transform: `translateZ(0) rotate(${s.angleDeg}deg)`,
    transformOrigin: "left center",
    filter:
      "drop-shadow(0 0 14px rgba(160,230,255,0.75)) drop-shadow(0 0 18px rgba(255,110,220,0.22))",
    willChange: "transform, opacity",
  };

  return (
    <m.div
      aria-hidden
      className="absolute transform-gpu"
      style={style}
      initial={reduce ? false : { x: -50, opacity: 0 }}
      animate={reduce ? {} : { x: [0, 420], opacity: [0, s.opacity, 0] }}
      transition={{
        duration: s.dur,
        delay: s.delay,
        ease: "easeOut",
      }}
    >
      <div
        className="h-full w-full rounded-full"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0), rgba(225,250,255,0.95), rgba(255,110,220,0.18), rgba(0,0,0,0))",
        }}
      />
      <div
        className="absolute left-[72%] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.98), rgba(96,220,255,0.25) 45%, rgba(96,220,255,0.0) 78%)",
          opacity: 0.95,
        }}
      />
    </m.div>
  );
});

type CosmicVariant = "prime" | "quiet";

const VARIANT = {
  prime: {
    // more “space” depth + higher chroma, still OLED-safe
    bloomA: "rgba(110,240,255,0.32)",
    bloomB: "rgba(255,120,235,0.28)",
    bloomC: "rgba(140,120,255,0.18)",
    nebA: "rgba(96,220,255,0.18)",
    nebB: "rgba(255,110,220,0.20)",
    nebC: "rgba(140,120,255,0.16)",
    haze: "rgba(255,255,255,0.06)",
  },
  quiet: {
    bloomA: "rgba(96,220,255,0.22)",
    bloomB: "rgba(255,110,220,0.18)",
    bloomC: "rgba(140,120,255,0.12)",
    nebA: "rgba(96,220,255,0.12)",
    nebB: "rgba(255,110,220,0.14)",
    nebC: "rgba(140,120,255,0.10)",
    haze: "rgba(255,255,255,0.045)",
  },
} as const;

export function CosmicScene({
  className,
  variant = "prime",
  enableParallax = true,
  enableMeteors = true,
  enableConstellation = true,
}: {
  className?: string;
  variant?: CosmicVariant;
  enableParallax?: boolean;
  enableMeteors?: boolean;
  enableConstellation?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion ?? true;
  const pageVisible = usePageVisible();

  const v = VARIANT[variant];
  const par = useParallax(reduce, enableParallax && pageVisible);

  // Meteors – keep light pool
  const [stars, setStars] = React.useState<ShootingStar[]>([]);

  React.useEffect(() => {
    if (reduce || !pageVisible || !enableMeteors) return;

    let alive = true;
    const MAX_STARS = 2;
    const chance = 0.16;

    const spawn = () => {
      if (!alive) return;
      if (Math.random() >= chance) return;

      const topPct = 6 + Math.random() * 42;
      const leftPct = -18 + Math.random() * 58;
      const angleDeg = 8 + Math.random() * 20;
      const len = 170 + Math.floor(Math.random() * 170);
      const dur = 1.05 + Math.random() * 0.75;
      const opacity = 0.58 + Math.random() * 0.18;

      const s: ShootingStar = {
        id: makeId(),
        topPct,
        leftPct,
        angleDeg,
        len,
        dur,
        delay: 0,
        opacity,
      };

      setStars((prev) => {
        const next = prev.length >= MAX_STARS ? prev.slice(1) : prev;
        return [...next, s];
      });

      setTimeout(() => {
        if (!alive) return;
        setStars((prev) => prev.filter((x) => x.id !== s.id));
      }, Math.ceil(dur * 1000) + 1400);
    };

    const interval = setInterval(spawn, 8800 + Math.random() * 3200);
    const t0 = setTimeout(spawn, 2400);

    return () => {
      alive = false;
      clearInterval(interval);
      clearTimeout(t0);
    };
  }, [reduce, pageVisible, enableMeteors]);

  // High-res star layers (more points, more depth)
  const STAR_A = React.useMemo(() => buildStarsCSS(3, 34, 0.92), []);
  const STAR_B = React.useMemo(() => buildStarsCSS(11, 22, 0.78), []);
  const STAR_C = React.useMemo(() => buildStarsCSS(19, 14, 0.62), []);
  const STAR_D = React.useMemo(() => buildStarsCSS(31, 10, 0.52), []);
  const DUST = React.useMemo(() => buildDustCSS(7, variant === "prime" ? 0.26 : 0.18), [variant]);

  const p1 = reduce ? undefined : `translate3d(${par.x * 7}px, ${par.y * 5}px, 0)`;
  const p2 = reduce ? undefined : `translate3d(${par.x * 12}px, ${par.y * 9}px, 0)`;
  const p3 = reduce ? undefined : `translate3d(${par.x * 18}px, ${par.y * 13}px, 0)`;

  const animateOK = !reduce && pageVisible;

  // subtle twinkle (perf-safe: opacity only)
  const twinkleA = animateOK ? { opacity: [0.55, 0.74, 0.6] } : {};
  const twinkleB = animateOK ? { opacity: [0.4, 0.62, 0.46] } : {};
  const twinkleC = animateOK ? { opacity: [0.25, 0.44, 0.3] } : {};

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden [contain:strict] [content-visibility:auto]",
          className
        )}
      >
        {/* Deep OLED base + space gradient (crisp) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% -10%, rgba(20,24,60,0.55), transparent 55%), radial-gradient(circle at 22% 10%, rgba(0,0,0,0), rgba(0,0,0,0.25) 35%, rgba(0,0,0,1) 78%), linear-gradient(180deg, #000000 0%, #01010a 35%, #000000 100%)",
          }}
        />

        {/* Multi-bloom “space lighting” */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 14% -12%, ${v.bloomA}, transparent 58%),
                         radial-gradient(circle at 90% 112%, ${v.bloomB}, transparent 58%),
                         radial-gradient(circle at 70% 10%, ${v.bloomC}, transparent 64%)`,
            mixBlendMode: "screen",
            opacity: variant === "prime" ? 0.92 : 0.72,
          }}
        />

        {/* Depth falloff */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020316] to-black" />

        {/* Nebula volumes — richer + sharper (still blurred) */}
        <m.div
          className="absolute -top-[40%] left-[-8%] h-[980px] w-[980px] rounded-full blur-[210px] transform-gpu"
          style={{ background: v.nebA, transform: p1, willChange: "transform, opacity" }}
          animate={animateOK ? { opacity: [0.52, 0.72, 0.58] } : { opacity: 0 }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        />
        <m.div
          className="absolute top-[10%] right-[-30%] h-[980px] w-[980px] rounded-full blur-[205px] transform-gpu"
          style={{ background: v.nebB, transform: p2, willChange: "transform, opacity" }}
          animate={animateOK ? { opacity: [0.46, 0.66, 0.5] } : { opacity: 0 }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        />
        <m.div
          className="absolute bottom-[-44%] left-[10%] h-[980px] w-[980px] rounded-full blur-[225px] transform-gpu"
          style={{ background: v.nebC, transform: p3, willChange: "transform, opacity" }}
          animate={animateOK ? { opacity: [0.44, 0.64, 0.48] } : { opacity: 0 }}
          transition={{ duration: 21, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Milky Way dust band (procedural) */}
        <m.div
          className="absolute inset-0 transform-gpu"
          style={{
            backgroundImage: DUST,
            backgroundSize: "1200px 1200px",
            transform: p2,
            mixBlendMode: "screen",
            opacity: variant === "prime" ? 0.56 : 0.42,
            filter: "blur(0.3px)",
          }}
          animate={animateOK ? { backgroundPositionX: ["0%", "35%"] } : {}}
          transition={{ duration: 200, repeat: Infinity, ease: "linear" }}
        />

        {/* Planet limb */}
        <PlanetLimb px={par.x} py={par.y} reduce={reduce} />

        {/* Stars: more layers, higher “resolution” feel */}
        <m.div
          className="absolute inset-0 transform-gpu"
          style={{
            backgroundImage: STAR_A,
            backgroundSize: "940px 940px",
            transform: p1,
            filter: "drop-shadow(0 0 10px rgba(180,240,255,0.12))",
          }}
          animate={animateOK ? { backgroundPositionY: ["0%", "100%"], ...twinkleA } : {}}
          transition={{
            backgroundPositionY: { duration: 320, repeat: Infinity, ease: "linear" },
            opacity: { duration: 10.5, repeat: Infinity, ease: "easeInOut" },
          }}
        />
        <m.div
          className="absolute inset-0 transform-gpu"
          style={{
            backgroundImage: STAR_B,
            backgroundSize: "760px 760px",
            transform: p2,
            filter:
              "drop-shadow(0 0 14px rgba(96,220,255,0.12)) drop-shadow(0 0 12px rgba(255,110,220,0.05))",
            mixBlendMode: "screen",
            opacity: 0.78,
          }}
          animate={animateOK ? { backgroundPositionY: ["0%", "-100%"], ...twinkleB } : {}}
          transition={{
            backgroundPositionY: { duration: 240, repeat: Infinity, ease: "linear" },
            opacity: { duration: 12.5, repeat: Infinity, ease: "easeInOut" },
          }}
        />
        <m.div
          className="absolute inset-0 transform-gpu"
          style={{
            backgroundImage: STAR_C,
            backgroundSize: "560px 560px",
            transform: p3,
            opacity: 0.45,
          }}
          animate={animateOK ? twinkleC : {}}
          transition={{ duration: 11.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <m.div
          className="absolute inset-0 transform-gpu"
          style={{
            backgroundImage: STAR_D,
            backgroundSize: "420px 420px",
            transform: p3,
            opacity: 0.24,
            mixBlendMode: "screen",
          }}
          animate={animateOK ? { opacity: [0.16, 0.28, 0.2] } : {}}
          transition={{ duration: 9.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Constellation */}
        {animateOK && enableConstellation && (
          <m.div
            className="absolute inset-0 transform-gpu"
            style={{
              transform: p2,
              mixBlendMode: "screen",
              opacity: variant === "prime" ? 0.22 : 0.16,
              filter: "drop-shadow(0 0 10px rgba(96,220,255,0.10))",
            }}
            animate={{ opacity: [0.14, variant === "prime" ? 0.26 : 0.2, 0.16] }}
            transition={{ duration: 13.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ConstellationSVG className="h-full w-full" />
          </m.div>
        )}

        {/* Meteors */}
        {animateOK && enableMeteors && (
          <div className="absolute inset-0">
            {stars.map((s) => (
              <ShootingStarItem key={s.id} s={s} reduce={reduce} />
            ))}
          </div>
        )}

        {/* HDR “haze” + vignette + ultra-light grain */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 18%, ${v.haze}, transparent 58%)`,
            mixBlendMode: "screen",
            opacity: variant === "prime" ? 0.55 : 0.42,
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_72%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/85" />
        <div
          className="absolute inset-0 opacity-[0.065]"
          style={{
            backgroundImage:
              "radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.16),transparent_25%),radial-gradient(circle_at_60%_75%,rgba(255,255,255,0.16),transparent_28%)",
          }}
        />
      </div>
    </LazyMotion>
  );
}

export default CosmicScene;