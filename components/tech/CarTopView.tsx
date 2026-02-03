"use client";

import * as React from "react";

/* tiny cn helper */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export type CarTopViewProps = {
  /** Hex color to lightly theme the car body/windshield outline */
  color?: string;
  /** Current selected quadrant id */
  selectedQuadrant?: string;
  /** Called with quadrant id when user clicks (Next.js requires *Action suffix) */
  onSelectQuadrantAction: (quadrant: string) => void;
  className?: string;
};

/** Quadrant ids match your invoice page expectations */
const QUADS = [
  { id: "driver_upper", label: "Driver Upper" },
  { id: "passenger_upper", label: "Passenger Upper" },
  { id: "driver_lower", label: "Driver Lower" },
  { id: "passenger_lower", label: "Passenger Lower" },
] as const;

export default function CarTopView({
  color = "#E5E7EB",
  selectedQuadrant,
  onSelectQuadrantAction,
  className,
}: CarTopViewProps) {
  return (
    <div className={cn("w-full max-w-xl mx-auto", className)}>
      <div className="text-center mb-3 text-sm text-gray-600">
        Tap a windshield quadrant
      </div>

      <div className="relative mx-auto aspect-[2/1] w-full rounded-2xl p-4 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 shadow">
        {/* Car body */}
        <div
          className="absolute inset-2 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.06))",
            boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.05)",
          }}
        />

        {/* Windshield container */}
        <div className="absolute inset-6 rounded-xl">
          <div
            className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 rounded-xl border"
            style={{
              width: "78%",
              height: "70%",
              background:
                "linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))",
              borderColor: "rgba(59,130,246,0.35)",
              boxShadow:
                "inset 0 0 0 2px rgba(59,130,246,0.08), 0 8px 24px rgba(0,0,0,0.06)",
            }}
          >
            {/* Divider lines */}
            <div className="absolute inset-0">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-blue-200/70" />
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-blue-200/70" />
            </div>

            {/* Clickable quadrants */}
            <button
              type="button"
              onClick={() => onSelectQuadrantAction("driver_upper")}
              className={cn(
                "absolute left-0 top-0 w-1/2 h-1/2",
                "focus:outline-none",
                selectedQuadrant === "driver_upper"
                  ? "bg-blue-500/15 ring-2 ring-blue-500"
                  : "hover:bg-blue-500/10"
              )}
              aria-label="Driver Upper"
            />
            <button
              type="button"
              onClick={() => onSelectQuadrantAction("passenger_upper")}
              className={cn(
                "absolute right-0 top-0 w-1/2 h-1/2",
                "focus:outline-none",
                selectedQuadrant === "passenger_upper"
                  ? "bg-blue-500/15 ring-2 ring-blue-500"
                  : "hover:bg-blue-500/10"
              )}
              aria-label="Passenger Upper"
            />
            <button
              type="button"
              onClick={() => onSelectQuadrantAction("driver_lower")}
              className={cn(
                "absolute left-0 bottom-0 w-1/2 h-1/2",
                "focus:outline-none",
                selectedQuadrant === "driver_lower"
                  ? "bg-blue-500/15 ring-2 ring-blue-500"
                  : "hover:bg-blue-500/10"
              )}
              aria-label="Driver Lower"
            />
            <button
              type="button"
              onClick={() => onSelectQuadrantAction("passenger_lower")}
              className={cn(
                "absolute right-0 bottom-0 w-1/2 h-1/2",
                "focus:outline-none",
                selectedQuadrant === "passenger_lower"
                  ? "bg-blue-500/15 ring-2 ring-blue-500"
                  : "hover:bg-blue-500/10"
              )}
              aria-label="Passenger Lower"
            />
          </div>
        </div>

        {/* Color swatch */}
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <span className="text-xs text-gray-500">Vehicle color</span>
          <span
            className="inline-block w-5 h-5 rounded ring-1 ring-gray-300"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-600">
        {QUADS.map((q) => (
          <div key={q.id} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block w-2.5 h-2.5 rounded-sm",
                selectedQuadrant === q.id ? "bg-blue-600" : "bg-blue-300"
              )}
            />
            {q.label}
          </div>
        ))}
      </div>
    </div>
  );
}