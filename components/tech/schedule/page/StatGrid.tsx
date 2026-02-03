// components/tech/schedule/page/StatsGrid.tsx
"use client";

import * as React from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* -----------------------------------------------------------
   Types
----------------------------------------------------------- */

export type TechScheduleStats = {
  total: number;
  completed: number;
  pending: number;
  confirmed: number;
  activeFocus: number;
  unassignedFocus: number;
};

export type TechScheduleStatsGridProps = {
  stats: TechScheduleStats;
  mode: "today" | "week" | "availability";
  weekZoomDay: Date | null;
  GlassPanel: React.ComponentType<{
    children: React.ReactNode;
    className?: string;
    depth?: number;
  }>;
};

/* -----------------------------------------------------------
   Small tile
----------------------------------------------------------- */

function StatTile({
  GlassPanel,
  label,
  value,
  sublabel,
  labelClassName,
}: {
  GlassPanel: TechScheduleStatsGridProps["GlassPanel"];
  label: string;
  value: number | string;
  sublabel: string;
  labelClassName?: string;
}) {
  return (
    <GlassPanel>
      <CardContent className="p-5">
        <p
          className={[
            "text-[11px] uppercase tracking-[0.22em] text-slate-400",
            labelClassName ?? "",
          ].join(" ")}
        >
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{sublabel}</p>
      </CardContent>
    </GlassPanel>
  );
}

/* -----------------------------------------------------------
   Grid (Week Total / Completed / Pending / Confirmed / Focus)
----------------------------------------------------------- */

export default function TechScheduleStatsGrid({
  stats,
  mode,
  weekZoomDay,
  GlassPanel,
}: TechScheduleStatsGridProps) {
  const focusLabel =
    mode === "today" ? "Today" : weekZoomDay ? "Selected day" : "Focus day";

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <StatTile
        GlassPanel={GlassPanel}
        label="Week Total"
        value={stats.total}
        sublabel="Booked this week"
      />

      <StatTile
        GlassPanel={GlassPanel}
        label="Completed"
        value={stats.completed}
        sublabel="Completed / paid"
        labelClassName="text-emerald-200/80"
      />

      <StatTile
        GlassPanel={GlassPanel}
        label="Pending"
        value={stats.pending}
        sublabel="Needs action"
        labelClassName="text-amber-200/80"
      />

      <StatTile
        GlassPanel={GlassPanel}
        label="Confirmed"
        value={stats.confirmed}
        sublabel="Locked-in"
        labelClassName="text-sky-200/80"
      />

      <StatTile
        GlassPanel={GlassPanel}
        label="Active (Focus)"
        value={stats.activeFocus}
        sublabel={focusLabel}
        labelClassName="text-cyan-200/80"
      />

      <StatTile
        GlassPanel={GlassPanel}
        label="Unassigned (Focus)"
        value={stats.unassignedFocus}
        sublabel='Tap “Claim” fast'
        labelClassName="text-violet-200/80"
      />
    </div>
  );
}