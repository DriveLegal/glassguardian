// components/SeasonalLayer.tsx
"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

type SeasonalLayerProps = {
  srcMp4: string;
  poster?: string;
  /** When true, pins a short “bottom bar” video strip; otherwise full-screen back layer */
  bottomBar?: boolean;
  bottomBarHeightPx?: number;
  /** 0..1 dark overlay on the strip for readability */
  darken?: number;
  /** blur in px */
  blurPx?: number;
  /** z-index of the layer (set below main text if you want it behind content) */
  zIndex?: number;
  /** "fill" (stretch), "cover" (crop), or "contain" (letterbox). Default: "cover" */
  fit?: "fill" | "cover" | "contain";

  /** OPTIONAL: blend mode for compositing (e.g. "screen", "lighten", "plus-lighter") */
  blendMode?: React.CSSProperties["mixBlendMode"];
  /** OPTIONAL: any extra inline styles for fine-tuning (e.g. extra filter/opacity) */
  styleOverride?: React.CSSProperties;
};

const SeasonalLayer: React.FC<SeasonalLayerProps> = ({
  srcMp4,
  poster,
  bottomBar = false,                 // default to background mode
  bottomBarHeightPx = 120,
  darken = 0.12,
  blurPx = 0,
  zIndex = 0,                        // behind fades/content by default
  fit = "cover",
  blendMode,                         // NEW
  styleOverride,                     // NEW
}) => {
  const reduce = useReducedMotion();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = React.useState(false);

  // Lazy activate when main is on screen
  React.useEffect(() => {
    const main = document.querySelector("main") || document.body;
    if (!main) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setActive(true);
      },
      { root: null, rootMargin: "200px 0px", threshold: [0, 0.05] }
    );
    io.observe(main);
    return () => io.disconnect();
  }, []);

  // Autoplay attempt with user-gesture fallback
  React.useEffect(() => {
    if (!active || !videoRef.current || reduce) return;
    const v = videoRef.current;
    const tryPlay = async () => { try { await v.play(); } catch {} };
    const onUp = () => tryPlay();
    document.addEventListener("pointerup", onUp, { once: true });
    tryPlay();
    return () => document.removeEventListener("pointerup", onUp);
  }, [active, reduce]);

  const filterStr = `blur(${Math.max(0, blurPx)}px)`;
  const overlay = Math.max(0, Math.min(1, darken));

  if (bottomBar) {
    const h = Math.max(60, bottomBarHeightPx);
    return (
      <div
        className="seasonal-layer-front" // NOTE: not the global ".seasonal-layer"
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: `calc(${h}px + env(safe-area-inset-bottom))`,
          zIndex: Math.max(zIndex, 2), // keep the bar in front if requested
          pointerEvents: "none",
          overflow: "hidden",
          mixBlendMode: blendMode,      // allow blend on the strip too
          ...styleOverride,
        }}
      >
        {/* subtle dark gradient for readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top,
              rgba(6,10,20,${overlay}) 0%,
              rgba(6,10,20,${overlay * 0.7}) 55%,
              rgba(6,10,20,0) 100%)`,
          }}
        />
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          poster={poster}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: "center bottom",
            filter: filterStr,
            opacity: active ? 1 : 0,
            transition: "opacity .35s ease",
          }}
          src={srcMp4}
        />
        {/* top rim for polish */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
            opacity: 0.7,
          }}
        />
      </div>
    );
  }

  // Full-screen background layer (depth)
  return (
    <div
      className="seasonal-free"       // <— custom class, NOT the global ".seasonal-layer"
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex,                        // will honor your prop now
        pointerEvents: "none",
        overflow: "hidden",
        mixBlendMode: blendMode,       // compositing
        ...styleOverride,              // extra user tweaks
      }}
    >
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        poster={poster}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: fit,
          objectPosition: "center bottom",
          filter: filterStr,
          opacity: active ? 1 : 0.0,
          transition: "opacity .45s ease",
        }}
        src={srcMp4}
      />
    </div>
  );
};

export default SeasonalLayer;