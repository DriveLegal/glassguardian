"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

type WindshieldRepair = {
  id?: string;
  cell_id?: string; // e.g. "TOP_L", "MID_C", "MID_R"
  label?: string;
  type?: string | null;
  notes?: string | null;
};

/**
 * Read-only windshield map for users.
 * - No "Mark Damage" button
 * - No "Clear Unsaved"
 * - No "Remove Marker"
 * - Just shows the cells the tech has already marked.
 */
export function UserWindshieldRepairMap(props: {
  repairs: any[] | null | undefined;
}) {
  const repairs: WindshieldRepair[] = Array.isArray(props.repairs)
    ? (props.repairs as WindshieldRepair[])
    : [];

  const gridCells = [
    { id: "TOP_L", label: "Top L" },
    { id: "TOP_C", label: "Top C" },
    { id: "TOP_R", label: "Top R" },
    { id: "MID_L", label: "Mid L" },
    { id: "MID_C", label: "Center" },
    { id: "MID_R", label: "Mid R" },
    { id: "BOT_L", label: "Bot L" },
    { id: "BOT_C", label: "Bot C" },
    { id: "BOT_R", label: "Bot R" },
  ];

  const hasRepairs = repairs.length > 0;

  return (
    <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.9)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-50">
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          Repair Location on Windshield
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-100">
        <p className="text-xs text-slate-400">
          Your technician marked the exact location of the repair on the
          windshield diagram below. This view is read-only – it&apos;s just for
          your records.
        </p>

        {/* 3x3 windshield grid (READ ONLY) */}
        <div className="mx-auto max-w-md rounded-3xl border border-slate-700/80 bg-slate-900/90 px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.8)]">
          <div className="mb-3 text-center text-[11px] uppercase tracking-[0.22em] text-slate-400">
            Windshield Diagram
          </div>
          <div className="grid grid-cols-3 gap-[1px] rounded-2xl bg-slate-800/90 overflow-hidden text-xs">
            {gridCells.map((cell) => {
              const cellMarkers = repairs.filter(
                (r) => (r.cell_id || "").toUpperCase() === cell.id
              );
              const isActive = cellMarkers.length > 0;

              return (
                <div
                  key={cell.id}
                  className={[
                    "h-16 flex flex-col items-center justify-center",
                    "bg-slate-900/90",
                    isActive
                      ? "bg-cyan-500/20 text-cyan-100 font-semibold"
                      : "text-slate-400",
                  ].join(" ")}
                >
                  <span>{cell.label}</span>
                  {isActive && (
                    <span className="mt-1 text-[10px] rounded-full px-2 py-0.5 bg-slate-900/70 border border-cyan-400/60">
                      Marked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Marker details (READ ONLY) */}
        {hasRepairs ? (
          <div className="space-y-2 text-xs">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Tech Notes
            </p>
            <div className="flex flex-wrap gap-2">
              {repairs.map((r, idx) => (
                <div
                  key={r.id ?? `${r.cell_id}-${idx}`}
                  className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 shadow-sm"
                >
                  <span className="text-[11px] font-semibold text-cyan-200">
                    {(r.cell_id || "").replace("_", " ") || "Spot"}
                  </span>
                  {r.type && (
                    <span className="text-[11px] text-slate-200">
                      · {r.type}
                    </span>
                  )}
                  {r.notes && (
                    <span className="text-[11px] text-slate-400">
                      · {r.notes}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            No windshield location was saved on this invoice.
          </p>
        )}
      </CardContent>
    </Card>
  );
}