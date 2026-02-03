// components/visual/CarTopView.tsx
"use client";

import * as React from "react";

type Props = {
  color?: string;
  onClick?: () => void;
  className?: string;
};

export default function CarTopView({ color = "#FFFFFF", onClick, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 300 500"
      className={`w-full h-full max-h-[400px] mx-auto ${className}`}
      onClick={onClick}
    >
      <defs>
        <linearGradient id="carGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.7 }} />
        </linearGradient>
        <filter id="carShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Car Body - Top View */}
      <g filter="url(#carShadow)">
        {/* Hood */}
        <path
          d="M 90 80 Q 150 60, 210 80 L 210 160 L 90 160 Z"
          fill="url(#carGradient)"
          stroke="#1f2937"
          strokeWidth="2"
        />

        {/* Windshield (WS) */}
        <path
          d="M 90 160 L 85 190 Q 150 175, 215 190 L 210 160 Z"
          fill="#333333"
          fillOpacity="0.6"
          stroke="#1f2937"
          strokeWidth="2"
        />

        {/* Roof */}
        <rect x="85" y="190" width="130" height="120" fill="url(#carGradient)" stroke="#1f2937" strokeWidth="2" rx="5" />

        {/* Doors */}
        <rect x="50" y="180" width="35" height="55" fill="url(#carGradient)" stroke="#1f2937" strokeWidth="2" rx="3" />
        <rect x="50" y="245" width="35" height="55" fill="url(#carGradient)" stroke="#1f2937" strokeWidth="2" rx="3" />

        <rect x="215" y="180" width="35" height="55" fill="url(#carGradient)" stroke="#1f2937" strokeWidth="2" rx="3" />
        <rect x="215" y="245" width="35" height="55" fill="url(#carGradient)" stroke="#1f2937" strokeWidth="2" rx="3" />

        {/* Rear Window & Trunk */}
        <path
          d="M 85 310 L 90 340 Q 150 355, 210 340 L 215 310 Z"
          fill="#333333"
          fillOpacity="0.6"
          stroke="#1f2937"
          strokeWidth="2"
        />
        <path
          d="M 90 340 L 95 420 Q 150 430, 205 420 L 210 340 Z"
          fill="url(#carGradient)"
          stroke="#1f2937"
          strokeWidth="2"
        />
      </g>

      {/* Glass Quadrant Labels */}
      <g className="pointer-events-none">
        <circle cx="150" cy="175" r="25" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="3" />
        <text x="150" y="180" textAnchor="middle" className="text-sm font-bold" fill="#1f2937">WS</text>

        <circle cx="67" cy="207" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="67" y="212" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">LFD</text>

        <circle cx="233" cy="207" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="233" y="212" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">RFD</text>

        <circle cx="67" cy="272" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="67" y="277" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">LRD</text>

        <circle cx="150" cy="250" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="150" y="255" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">SR</text>

        <circle cx="233" cy="272" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="233" y="277" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">RRD</text>

        <circle cx="67" cy="325" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="67" y="330" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">LQ</text>

        <circle cx="150" cy="325" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="150" y="330" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">BG</text>

        <circle cx="233" cy="325" r="20" fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth="2" />
        <text x="233" y="330" textAnchor="middle" className="text-xs font-bold" fill="#1f2937">RQ</text>
      </g>
    </svg>
  );
}