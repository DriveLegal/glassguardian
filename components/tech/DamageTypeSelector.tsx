"use client";

import * as React from "react";

/* tiny cn helper */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export type DamageTypeSelectorProps = {
  selectedType?: string;
  /** Next.js requires *Action suffix for functions in client entry props */
  onSelectTypeAction: (type: string) => void;
  className?: string;
};

const DAMAGE_TYPES = [
  { id: "rock_chip", label: "Rock Chip", emoji: "🪨" },
  { id: "bullseye", label: "Bullseye", emoji: "🎯" },
  { id: "star_break", label: "Star Break", emoji: "✴️" },
  { id: "combo", label: "Combo", emoji: "🧩" },
  { id: "long_crack", label: "Long Crack", emoji: "〰️" },
  { id: "edge_crack", label: "Edge Crack", emoji: "🧵" },
  { id: "surface_pit", label: "Surface Pit", emoji: "🕳️" },
] as const;

export default function DamageTypeSelector({
  selectedType,
  onSelectTypeAction,
  className,
}: DamageTypeSelectorProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {DAMAGE_TYPES.map((t) => {
          const active = selectedType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTypeAction(t.id)}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all",
                "bg-white hover:shadow-md",
                active
                  ? "border-blue-600 ring-2 ring-blue-200"
                  : "border-gray-200"
              )}
            >
              <div className="text-2xl mb-2">{t.emoji}</div>
              <div className="font-semibold text-gray-900">{t.label}</div>
              <div className="text-xs text-gray-500 mt-1">{t.id}</div>
            </button>
          );
        })}
      </div>

      {selectedType && (
        <div className="mt-4 text-sm text-gray-600">
          Selected: <span className="font-semibold">{selectedType.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}