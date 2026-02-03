// components/tech/schedule/tenstep/ServiceProgress.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  Calendar,
  Loader2,
} from "lucide-react";

/* ----------------------------------------------
   10-step Status timeline (mirrors user)
-----------------------------------------------*/

export const SERVICE_STATUS_STEPS = [
  { key: "requested", label: "Requested", icon: FileText },
  { key: "estimating", label: "Estimating", icon: DollarSign },
  { key: "estimate_sent", label: "Quote Sent", icon: DollarSign },
  { key: "approved", label: "Approved", icon: CheckCircle },
  { key: "scheduled", label: "Scheduled", icon: Calendar },
  { key: "en_route", label: "En Route", icon: Clock },
  { key: "on_site", label: "On Site", icon: MapPin },
  { key: "in_progress", label: "Repairing", icon: Clock },
  { key: "curing", label: "Curing", icon: Clock },
  { key: "completed", label: "Completed", icon: CheckCircle },
] as const;

export type ServiceStatusKey = (typeof SERVICE_STATUS_STEPS)[number]["key"];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getStatusIndex(current?: string | null) {
  return SERVICE_STATUS_STEPS.findIndex((s) => s.key === (current ?? ""));
}

function getStatusTimeline(current?: string | null) {
  const currentIndex = getStatusIndex(current);
  return SERVICE_STATUS_STEPS.map((s, idx) => ({
    ...s,
    completed: currentIndex >= 0 ? idx <= currentIndex : false,
    current: currentIndex === idx,
    currentIndex,
  }));
}

/* ----------------------------------------------
   Component
-----------------------------------------------*/

export default function ServiceProgress(props: {
  status: string | null | undefined;
  onStatusClickAction: (next: ServiceStatusKey) => void;
  className?: string;

  // optional: disable interactions while mutation pending
  busy?: boolean;

  // optional lock per-step
  isStatusLockedAction?: (next: ServiceStatusKey) => boolean;

  // explicit read-only mode (use this for user portal)
  readOnly?: boolean;
}) {
  const busy = props.busy ?? false;
  const readOnly = props.readOnly ?? false;

  /**
   * ✅ Sticky local status (TECH side only)
   * - For interactive tech UI: instant + sticky feedback while server status catches up.
   * - For read-only UI: DO NOT keep local sticky state (prevents stale UI).
   */
  const [localStatus, setLocalStatus] = React.useState<string | null>(
    readOnly ? null : props.status ?? null
  );

  React.useEffect(() => {
    if (readOnly) return;
    if (typeof props.status === "string" && props.status.length > 0) {
      setLocalStatus(props.status);
    }
  }, [props.status, readOnly]);

  const effectiveStatus = readOnly
    ? props.status ?? null
    : localStatus ?? props.status ?? null;

  const statusTimeline = React.useMemo(
    () => getStatusTimeline(effectiveStatus),
    [effectiveStatus]
  );

  const progressIndex = statusTimeline[0]?.currentIndex ?? -1;
  const clampedIndex = Math.max(0, progressIndex);
  const progressPct =
    statusTimeline.length > 1
      ? (clampedIndex / (statusTimeline.length - 1)) * 100
      : 0;

  const canClick = !busy && !readOnly;

  return (
    <Card
      className={cx(
        "mb-6 border border-slate-700/80 bg-slate-950/95 shadow-2xl text-slate-50",
        props.className
      )}
    >
      <CardHeader className="pb-3 border-b border-slate-800/90 bg-slate-950/95">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">Service Progress</p>

          {!readOnly && (
  <Badge className="bg-slate-800 text-slate-200 border border-slate-600">
    {busy ? (
      <span className="inline-flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Updating…
      </span>
    ) : (
      "Tap a step to update"
    )}
  </Badge>
)}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="relative px-1">
          <div className="absolute left-0 right-0 top-7 h-[2px] bg-slate-700/80" />
          <div
            className="absolute left-0 top-7 h-[2px] bg-gradient-to-r from-sky-400 via-sky-300 to-emerald-300 shadow-[0_0_16px_rgba(56,189,248,0.75)] transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />

          <div className="relative flex justify-between gap-2 overflow-x-auto pb-2">
            {statusTimeline.map((status) => {
              const Icon = status.icon;

              const locked = props.isStatusLockedAction
                ? Boolean(props.isStatusLockedAction(status.key as ServiceStatusKey))
                : false;

              const disabled = !canClick || locked;

              return (
                <button
                  key={status.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;

                    // ✅ Instant + STICKY UI update (tech side)
                    setLocalStatus(status.key);

                    // ✅ Parent mutation
                    props.onStatusClickAction(status.key as ServiceStatusKey);
                  }}
                  className={cx(
                    "flex flex-col items-center gap-2 min-w-[92px] focus:outline-none group",
                    disabled && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="relative">
                    {status.current && (
                      <span className="absolute -inset-2 rounded-full bg-sky-400/25 blur-md animate-pulse" />
                    )}

                    <div
                      className={[
                        "relative flex items-center justify-center w-12 h-12 rounded-full border-[3px] text-xs transition-all duration-300",
                        status.current
                          ? "bg-sky-500 border-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.9)]"
                          : status.completed
                          ? "bg-emerald-500 border-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.8)]"
                          : "bg-slate-950 border-slate-600 group-hover:border-slate-300",
                      ].join(" ")}
                    >
                      {status.completed && !status.current ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : (
                        <Icon
                          className={cx(
                            "w-6 h-6 transition-colors",
                            status.current || status.completed
                              ? "text-white"
                              : "text-slate-400"
                          )}
                        />
                      )}
                    </div>
                  </div>

                  <p
                    className={cx(
                      "text-[11px] text-center font-medium leading-tight px-1",
                      status.completed || status.current
                        ? "text-slate-100"
                        : "text-slate-400"
                    )}
                  >
                    {status.label}
                  </p>

                  {/* ✅ Only show Locked/Current chips when NOT read-only */}
                  {!readOnly && locked ? (
                    <span className="mt-0.5 inline-flex items-center rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-950 shadow-sm">
                      Locked
                    </span>
                  ) : !readOnly && status.current ? (
                    <span className="mt-0.5 inline-flex items-center rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Current
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}