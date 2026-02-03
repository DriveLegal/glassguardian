// components/visual/WindshieldDiagram.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";

const QUADRANTS = [
  { id: "ws", label: "WS", x: "50%", y: "20%", desc: "Windshield" },
  { id: "lfd", label: "LFD", x: "18%", y: "35%", desc: "Left Front Door" },
  { id: "rfd", label: "RFD", x: "82%", y: "35%", desc: "Right Front Door" },
  { id: "lrd", label: "LRD", x: "18%", y: "60%", desc: "Left Rear Door" },
  { id: "sr", label: "SR", x: "50%", y: "50%", desc: "Sunroof" },
  { id: "rrd", label: "RRD", x: "82%", y: "60%", desc: "Right Rear Door" },
  { id: "lq", label: "LQ", x: "18%", y: "80%", desc: "Left Quarter" },
  { id: "bg", label: "BG", x: "50%", y: "85%", desc: "Back Glass" },
  { id: "rq", label: "RQ", x: "82%", y: "80%", desc: "Right Quarter" },
];

type Props = {
  selectedQuadrant?: string | null;
  onSelectQuadrant: (id: string) => void;
};

export default function WindshieldDiagram({ selectedQuadrant, onSelectQuadrant }: Props) {
  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] p-8">
      <svg viewBox="0 0 300 420" className="w-full h-full drop-shadow-2xl">
        <defs>
          <linearGradient id="glassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.5" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Windshield outline */}
        <path
          d="M 60 60 Q 150 35, 240 60 L 240 360 Q 150 385, 60 360 Z"
          fill="url(#glassGradient)"
          stroke="#1e40af"
          strokeWidth="4"
          filter="url(#glow)"
        />

        {/* Grid lines */}
        <line x1="60" y1="160" x2="240" y2="160" stroke="#3b82f6" strokeWidth="2.5" opacity="0.4" />
        <line x1="60" y1="260" x2="240" y2="260" stroke="#3b82f6" strokeWidth="2.5" opacity="0.4" />
        <line x1="115" y1="60" x2="115" y2="360" stroke="#3b82f6" strokeWidth="2.5" opacity="0.4" />
        <line x1="185" y1="60" x2="185" y2="360" stroke="#3b82f6" strokeWidth="2.5" opacity="0.4" />
      </svg>

      {/* Quadrants */}
      {QUADRANTS.map((q, idx) => (
        <motion.button
          key={q.id}
          onClick={() => onSelectQuadrant(q.id)}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className={`absolute w-16 h-16 rounded-2xl font-bold text-base transition-all duration-300 ${
            selectedQuadrant === q.id
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-4 border-blue-400 shadow-2xl shadow-blue-500/50 scale-110 z-20"
              : "bg-white text-gray-700 border-3 border-gray-400 hover:border-blue-400 shadow-xl hover:shadow-2xl"
          }`}
          style={{
            left: q.x,
            top: q.y,
            transform: `translate(-50%, -50%) ${selectedQuadrant === q.id ? "scale(1.1)" : ""}`,
          }}
          title={q.desc}
        >
          {q.label}
        </motion.button>
      ))}
    </div>
  );
}