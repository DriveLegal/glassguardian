// components/VehicleImageDisplay.tsx
"use client";

import * as React from "react";

/* tiny cn helper */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

type Props = {
  make: string;
  model: string;
  year?: number | string;
  /** Any valid CSS color: #hex, rgb(), hsl(), or named */
  color?: string;
  className?: string;
  /** Show text caption under the image (defaults to true) */
  caption?: boolean;
};

/** Minimal inline badges for a few popular makes (optional) */
const BADGES: Record<string, React.ReactNode> = {
  tesla: (
    <svg viewBox="0 0 256 256" className="h-5 w-5" aria-hidden>
      <path
        d="M128 26c32 0 62 6 99 18-7 8-17 11-28 9-26-5-49-8-71-8s-45 3-71 8c-11 2-21-1-28-9 37-12 67-18 99-18Zm0 33c17 0 36 2 57 6-17 5-30 9-39 13-6 2-9 6-10 13v104l-8 15-8-15V91c-1-7-4-11-10-13-9-4-22-8-39-13 21-4 40-6 57-6Z"
        fill="currentColor"
      />
    </svg>
  ),
  toyota: (
    <svg viewBox="0 0 256 256" className="h-5 w-5" aria-hidden>
      <ellipse cx="128" cy="128" rx="96" ry="72" stroke="currentColor" fill="none" strokeWidth="12"/>
      <ellipse cx="128" cy="128" rx="44" ry="72" stroke="currentColor" fill="none" strokeWidth="12"/>
      <ellipse cx="128" cy="128" rx="96" ry="28" stroke="currentColor" fill="none" strokeWidth="12"/>
    </svg>
  ),
  ford: (
    <svg viewBox="0 0 256 256" className="h-5 w-5" aria-hidden>
      <rect x="36" y="96" width="184" height="64" rx="32" stroke="currentColor" fill="none" strokeWidth="12"/>
      <text x="128" y="138" textAnchor="middle" fontSize="28" fontWeight="700" fill="currentColor">Ford</text>
    </svg>
  ),
};

function normalizeMake(make?: string) {
  return (make || "").trim().toLowerCase();
}

/**
 * VehicleImageDisplay
 * - High-res SVG silhouette with gloss & shadow
 * - Tinted body (props.color)
 * - Optional OEM badge for a few makes
 */
export default function VehicleImageDisplay({
  make,
  model,
  year,
  color = "#3b82f6",
  className,
  caption = false,
}: Props) {
  const makeKey = normalizeMake(make);
  const badge = BADGES[makeKey];

  // Derive contrasting stroke for windows/lines
  const isDark = React.useMemo(() => {
    // crude luminance check for hex/rgb – defaults dark if unknown
    try {
      const c = color.trim();
      let r = 0, g = 0, b = 0;
      if (c.startsWith("#")) {
        const hex = c.slice(1);
        const v =
          hex.length === 3
            ? hex.split("").map((h) => h + h).join("")
            : hex.padEnd(6, "0");
        r = parseInt(v.slice(0, 2), 16);
        g = parseInt(v.slice(2, 4), 16);
        b = parseInt(v.slice(4, 6), 16);
      } else if (c.startsWith("rgb")) {
        const nums = c.replace(/[^\d.,]/g, "").split(",").map(Number);
        [r, g, b] = nums;
      }
      // relative luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return lum < 140;
    } catch {
      return true;
    }
  }, [color]);

  const line = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)";
  const windowTint = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)";

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full h-full">
        {/* Canvas */}
        <svg
          viewBox="0 0 900 360"
          className="w-full h-full"
          role="img"
          aria-label={`${year ?? ""} ${make} ${model} illustration`.trim()}
        >
          {/* Drop shadow */}
          <ellipse cx="450" cy="310" rx="280" ry="28" fill="rgba(0,0,0,0.18)" />

          {/* Body paint */}
          <defs>
            <linearGradient id="paintGloss" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
            </linearGradient>
            <linearGradient id="noseShade" x1="0" x2="1">
              <stop offset="0%" stopColor="rgba(0,0,0,0.12)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
            </linearGradient>
          </defs>

          {/* Main silhouette */}
          <path
            d="
              M130,240
              C170,170 260,120 360,120
              L600,120
              C690,120 780,160 820,210
              L820,240
              C805,255 780,265 750,268
              L180,268
              C155,265 140,255 130,240 Z
            "
            fill={color}
            stroke={line}
            strokeWidth={3}
          />

          {/* Hood nose shade */}
          <path
            d="M360,120 L520,120 C520,150 470,165 420,165 C370,165 330,150 360,120 Z"
            fill="url(#noseShade)"
          />

          {/* Windows */}
          <path
            d="
              M390,125 L575,125
              C630,125 680,150 700,175
              L510,175 L390,155 Z
            "
            fill={windowTint}
            stroke={line}
            strokeWidth={2}
          />
          <path
            d="M220,185 L390,155 L390,175 L235,200 Z"
            fill={windowTint}
            stroke={line}
            strokeWidth={2}
          />

          {/* Doors seam */}
          <path d="M500,125 L500,240" stroke={line} strokeWidth={2} opacity={0.75} />

          {/* Handles */}
          <rect x="470" y="180" width="40" height="6" rx="3" fill={line} opacity={0.6} />
          <rect x="310" y="185" width="38" height="6" rx="3" fill={line} opacity={0.6} />

          {/* Wheels */}
          <g>
            <circle cx="285" cy="270" r="48" fill="#111" />
            <circle cx="615" cy="270" r="48" fill="#111" />
            <circle cx="285" cy="270" r="28" fill={isDark ? "#d1d5db" : "#374151"} />
            <circle cx="615" cy="270" r="28" fill={isDark ? "#d1d5db" : "#374151"} />
          </g>

          {/* Chrome line */}
          <path d="M160,225 L760,225" stroke={line} strokeWidth={2} opacity={0.5} />

          {/* Gloss highlight */}
          <path
            d="
              M150,205
              C260,135 430,120 600,120
              C710,120 760,150 790,175
              C640,150 470,160 260,210 Z
            "
            fill="url(#paintGloss)"
            opacity="0.8"
          />
        </svg>

        {/* Badge + label overlay */}
        <div className="absolute left-3 top-3 flex items-center gap-2 text-gray-700">
          {badge ? <span className="text-gray-700">{badge}</span> : null}
          <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {make}
          </span>
        </div>
      </div>

      {caption !== false && (
        <div className="mt-2 text-center">
          <div className="text-sm font-semibold text-gray-900">
            {year ? `${year} ` : ""}{make} {model}
          </div>
          <div className="text-xs text-gray-500">Preview • Color {color}</div>
        </div>
      )}
    </div>
  );
}