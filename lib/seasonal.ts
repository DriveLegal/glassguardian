// /lib/seasonal.ts
type Layer = {
  src: string;
  kind?: "video" | "image" | "auto";
  opacity?: number;
  fit?: "cover" | "contain" | "fill";
  position?: string;
  blurPx?: number;
  blendMode?: string;
  yDriftPx?: number;
  driftSec?: number;
  zOffset?: number;
  poster?: string;
};

type SeasonalConfig = {
  active: "aurora" | "glasswave" | "plainGradient" | "none";
  accents?: {
    accentA?: string;
    accentB?: string;
    accentC?: string;
  };
  /** legacy single overlay (ignored when layers exist) */
  overlayImage?: string;
  overlayOpacity?: number | string;
  /** preferred */
  layers?: Layer[];
};

const PRESETS: Record<SeasonalConfig["active"], SeasonalConfig> = {
  /* ----------------------------------------------------------
   * 1) Aurora (soft, premium, subtle motion)
   * -------------------------------------------------------- */
  aurora: {
    active: "aurora",
    accents: {
      // GlassGuardian-friendly tasteful blues/teals/purples
      accentA: "#66E3FF",
      accentB: "#7C9CFF",
      accentC: "#3AD1B7",
    },
    // Tip: place the assets listed below into /public/assets/bg/aurora/*
    layers: [
      // Base ultra-soft gradient (static)
      {
        src: "/assets/bg/aurora/base-gradient.webp",
        kind: "image",
        opacity: 0.55,
        fit: "cover",
        position: "center center",
        blurPx: 2,
        blendMode: "normal",
        yDriftPx: 10,
        driftSec: 22,
      },
      // Aurora light ribbon (subtle video)
      {
        src: "/assets/bg/aurora/aurora-ribbons.webm",
        poster: "/assets/bg/aurora/aurora-ribbons.jpg",
        kind: "video",
        opacity: 0.28,
        fit: "cover",
        position: "center 35%",
        blurPx: 0,
        blendMode: "screen",
        yDriftPx: 22,
        driftSec: 18,
      },
      // Soft bokeh highlights (image)
      {
        src: "/assets/bg/aurora/bokeh-soft.webp",
        kind: "image",
        opacity: 0.18,
        fit: "cover",
        position: "center center",
        blurPx: 0,
        blendMode: "overlay",
        yDriftPx: 12,
        driftSec: 26,
      },
      // Very faint noise to avoid banding (image)
      {
        src: "/assets/bg/shared/fine-noise.png",
        kind: "image",
        opacity: 0.06,
        fit: "cover",
        position: "center center",
        blurPx: 0,
        blendMode: "soft-light",
        yDriftPx: 8,
        driftSec: 20,
      },
    ],
  },

  /* ----------------------------------------------------------
   * 2) GlassWave (sleek glassy waves; no video)
   * -------------------------------------------------------- */
  glasswave: {
    active: "glasswave",
    accents: {
      accentA: "#7BC9FF",
      accentB: "#A094FF",
      accentC: "#5BE4C5",
    },
    layers: [
      {
        src: "/assets/bg/glasswave/glasswave-gradient.webp",
        kind: "image",
        opacity: 0.6,
        fit: "cover",
        position: "center center",
        blurPx: 1,
        blendMode: "normal",
        yDriftPx: 8,
        driftSec: 24,
      },
      {
        src: "/assets/bg/glasswave/glass-waves.svg",
        kind: "image",
        opacity: 0.22,
        fit: "cover",
        position: "center 40%",
        blurPx: 0,
        blendMode: "overlay",
        yDriftPx: 14,
        driftSec: 20,
      },
      {
        src: "/assets/bg/shared/fine-noise.png",
        kind: "image",
        opacity: 0.05,
        fit: "cover",
        position: "center center",
        blendMode: "soft-light",
        yDriftPx: 6,
        driftSec: 22,
      },
    ],
  },

  /* ----------------------------------------------------------
   * 3) Plain Gradient (ultra-lightweight, zero images ok)
   *    Uses a single static image; lowest CPU/GPU impact.
   * -------------------------------------------------------- */
  plainGradient: {
    active: "plainGradient",
    accents: {
      accentA: "#7BC9FF",
      accentB: "#9F8CFF",
      accentC: "#4FD8C0",
    },
    layers: [
      // You can also swap this for a CSS-only gradient via a tiny PNG/WebP
      {
        src: "/assets/bg/plain/soft-gradient.webp",
        kind: "image",
        opacity: 0.58,
        fit: "cover",
        position: "center center",
        blurPx: 0,
        blendMode: "normal",
        yDriftPx: 6,
        driftSec: 28,
      },
    ],
  },

  /* off */
  none: {
    active: "none",
    layers: [],
  },
};

/** Choose your active preset here */
export const seasonalConfig: SeasonalConfig = PRESETS.aurora;