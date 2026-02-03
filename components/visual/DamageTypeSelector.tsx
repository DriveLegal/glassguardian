// components/visual/DamageTypeSelector.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";

const DAMAGE_TYPES = [
  {
    id: "bullseye",
    label: "BULLSEYE",
    icon: (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <circle cx="30" cy="30" r="25" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="30" cy="30" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="30" cy="30" r="8" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "combo",
    label: "COMBO",
    icon: (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <circle cx="25" cy="30" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
        <line x1="37" y1="25" x2="55" y2="15" stroke="currentColor" strokeWidth="3" />
        <line x1="37" y1="35" x2="55" y2="45" stroke="currentColor" strokeWidth="3" />
      </svg>
    ),
  },
  {
    id: "crack",
    label: "CRACK",
    icon: (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <path d="M 10 30 L 25 25 L 35 35 L 50 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "half_moon",
    label: "HALF MOON",
    icon: (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <path d="M 30 10 Q 50 30, 30 50 Q 20 30, 30 10" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "star",
    label: "STAR",
    icon: (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <circle cx="30" cy="30" r="5" fill="currentColor" />
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <line
            key={i}
            x1="30"
            y1="30"
            x2={30 + 20 * Math.cos((angle * Math.PI) / 180)}
            y2={30 + 20 * Math.sin((angle * Math.PI) / 180)}
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
      </svg>
    ),
  },
  {
    id: "pit",
    label: "PIT",
    icon: (
      <svg viewBox="0 0 60 60" className="w-12 h-12">
        <circle cx="30" cy="30" r="8" fill="currentColor" opacity="0.3" />
        <circle cx="30" cy="30" r="3" fill="currentColor" />
      </svg>
    ),
  },
];

type Props = {
  selectedType?: string | null;
  onSelectType: (id: string) => void;
};

export default function DamageTypeSelector({ selectedType, onSelectType }: Props) {
  return (
    <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
      {DAMAGE_TYPES.map((type, idx) => (
        <motion.button
          key={type.id}
          onClick={() => onSelectType(type.id)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05 }}
          whileHover={{ scale: 1.08, y: -5 }}
          whileTap={{ scale: 0.95 }}
          className={`p-6 rounded-2xl border-3 transition-all shadow-xl ${
            selectedType === type.id
              ? "border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-2xl shadow-blue-500/30 scale-105"
              : "border-gray-300 bg-white hover:border-blue-300 hover:shadow-2xl"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={
                selectedType === type.id
                  ? { rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }
                  : {}
              }
              transition={{ duration: 0.5 }}
              className={`${selectedType === type.id ? "text-blue-600" : "text-gray-600"}`}
            >
              {type.icon}
            </motion.div>
            <span
              className={`text-xs font-extrabold tracking-wide ${
                selectedType === type.id ? "text-blue-700" : "text-gray-700"
              }`}
            >
              {type.label}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}