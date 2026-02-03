// components/tech/schedule/page/UpcomingNextDays.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Calendar as CalendarIcon,
  Calendar,
  Clock,
  User,
  MapPin,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";

/* ---------------------------------------------------------------------
   Types
--------------------------------------------------------------------- */

export type AppointmentRow = {
  id: string;
  technician_email: string | null;
  customer_email: string | null;
  customer_name?: string | null;
  customer_full_name?: string | null;

  vehicle_id: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | null;

  service_type: string | null;
  damage_size: string | null;
  damage_description: string | null;
  service_address: string | null;
  location_type: string | null;
  scheduled_date: string | null; // yyyy-MM-dd
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  notes_customer: string | null;
  status: string | null;
  estimate_amount: string | null;
  created_at?: string | null;
};

export type StatusKey =
  | "requested"
  | "estimating"
  | "estimate_sent"
  | "approved"
  | "scheduled"
  | "en_route"
  | "on_site"
  | "in_progress"
  | "curing"
  | "completed"
  | "paid"
  | "cancelled"
  | "pending"
  | "confirmed"
  | "accepted"
  | string;

export type UpcomingNextDaysProps = {
  title?: string; // default: "Upcoming · Next 7 Days"
  subtitle?: string; // default: "Date → time"
  maxHeightClassName?: string; // default: "max-h-[640px]"
  userEmail: string | null;

  isLoading: boolean;
  isError: boolean;
  errorMessage?: string | null;

  jobs: AppointmentRow[];

  onOpen: (jobId: string) => void;
  onClaim: (jobId: string) => void;

  busy?: boolean;
};

/* ---------------------------------------------------------------------
   UI wrappers (same look)
--------------------------------------------------------------------- */

function GlassPanel({
  children,
  className = "",
  depth = 28,
}: {
  children: React.ReactNode;
  className?: string;
  depth?: number;
}) {
  const outerShadow = `0 ${Math.round(depth / 4)}px ${Math.round(
    depth * 1.8
  )}px rgba(15,23,42,0.9)`;

  return (
    <div
      className={`relative rounded-2xl border border-slate-700/80 bg-slate-900/80 backdrop-blur-xl ${className}`}
      style={{
        boxShadow: outerShadow,
        transform: "translateZ(0)",
        willChange: "transform, box-shadow",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(148,163,184,0.18), rgba(15,23,42,0.2) 40%, transparent 80%)",
          mixBlendMode: "screen",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function GradientFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        className="absolute -inset-[1.5px] rounded-2xl opacity-80 blur-[4px]"
        style={{
          background:
            "conic-gradient(from 200deg at 50% 50%, rgba(56,189,248,0.8), transparent 18%, rgba(52,211,153,0.75) 48%, transparent 74%, rgba(129,140,248,0.7) 100%)",
          filter: "saturate(130%)",
          zIndex: 0,
        }}
      />
      <div className="relative rounded-2xl z-10">{children}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-700/80 bg-slate-900/70 backdrop-blur px-5 py-4">
      <div className="h-4 w-40 bg-slate-600/70 rounded mb-2" />
      <div className="h-3 w-64 bg-slate-700/70 rounded" />
    </div>
  );
}

/* ---------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------- */

function safeDateLabel(yyyyMMdd?: string | null) {
  if (!yyyyMMdd) return "Date TBA";
  try {
    const d = parseISO(yyyyMMdd);
    return format(d, "EEE, MMM d");
  } catch {
    try {
      return format(new Date(yyyyMMdd), "EEE, MMM d");
    } catch {
      return "Date TBA";
    }
  }
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Time TBA";
  if (!start) return `– ${end ?? ""}`.trim();
  if (!end) return `${start} –`;
  return `${start} – ${end}`;
}

function getStatusPillClasses(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();

  if (s === "completed" || s === "paid") {
    return "bg-emerald-500/25 text-emerald-100 border border-emerald-400/80";
  }
  if (s === "cancelled" || s === "canceled") {
    return "bg-slate-500/25 text-slate-200 border border-slate-400/80";
  }
  if (s === "confirmed" || s === "accepted" || s === "approved") {
    return "bg-sky-500/20 text-sky-200 border border-sky-400/60";
  }
  if (s === "pending" || s === "requested" || s === "estimating") {
    return "bg-amber-500/20 text-amber-100 border border-amber-400/60";
  }
  if (s === "scheduled") {
    return "bg-violet-500/20 text-violet-200 border border-violet-400/60";
  }
  if (s === "en_route") {
    return "bg-orange-500/20 text-orange-200 border border-orange-400/60";
  }
  if (s === "on_site") {
    return "bg-indigo-500/20 text-indigo-200 border border-indigo-400/60";
  }
  if (s === "in_progress") {
    return "bg-cyan-500/20 text-cyan-200 border border-cyan-400/60";
  }
  if (s === "curing") {
    return "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/60";
  }
  return "bg-slate-700/50 text-slate-100 border border-slate-500/70";
}

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

/* ---------------------------------------------------------------------
   Main component
--------------------------------------------------------------------- */

export default function UpcomingNextDays({
  title = "Upcoming · Next 7 Days",
  subtitle = "Date → time",
  maxHeightClassName = "max-h-[640px]",
  userEmail,

  isLoading,
  isError,
  errorMessage,

  jobs,

  onOpen,
  onClaim,

  busy = false,
}: UpcomingNextDaysProps) {
  return (
    <GradientFrame>
      <GlassPanel className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            {title}
            <span className="text-[11px] font-normal text-slate-400">{subtitle}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4">
          {isError && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage ?? "Failed to load upcoming."}</span>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                Loading…
              </div>
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-950/60">
              <CalendarIcon className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              No upcoming appointments.
            </div>
          ) : (
            <div className={`space-y-3 ${maxHeightClassName} overflow-y-auto pr-1`}>
              {jobs.map((job) => (
                <UpcomingMiniCard
                  key={job.id}
                  job={job}
                  userEmail={userEmail}
                  onOpen={() => onOpen(String(job.id))}
                  onClaim={() => onClaim(String(job.id))}
                  busy={busy}
                />
              ))}
            </div>
          )}
        </CardContent>
      </GlassPanel>
    </GradientFrame>
  );
}

/* ---------------------------------------------------------------------
   Subcomponent
--------------------------------------------------------------------- */

function UpcomingMiniCard({
  job,
  userEmail,
  onOpen,
  onClaim,
  busy,
}: {
  job: AppointmentRow;
  userEmail: string | null;
  onOpen: () => void;
  onClaim: () => void;
  busy: boolean;
}) {
  const dateLabel = job.scheduled_date ? safeDateLabel(job.scheduled_date) : "Date TBA";
  const status: StatusKey = (job.status ?? "pending") as StatusKey;
  const unassigned = !job.technician_email;

  const customer =
    job.customer_name || job.customer_full_name || job.customer_email || "Customer";

  const assignedToMe =
    !!userEmail &&
    !!job.technician_email &&
    normalizeEmail(String(job.technician_email)) === normalizeEmail(String(userEmail));

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/95 px-3 py-3 text-[11px] space-y-1.5 hover:border-cyan-400/60 hover:bg-slate-900 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-slate-200">
            <span className="font-semibold truncate">{job.service_type || "Glass Repair"}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>{dateLabel}</span>
            <span className="mx-1 text-slate-600">•</span>
            <Clock className="w-3 h-3" />
            <span>{formatTimeRange(job.scheduled_time_start, job.scheduled_time_end)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className={[
              "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border",
              getStatusPillClasses(String(status)),
            ].join(" ")}
          >
            {String(status).toUpperCase()}
          </span>

          {!unassigned && (
            <span className="inline-flex items-center gap-1 text-[9px] text-slate-500">
              {assignedToMe ? (
                <>
                  <CheckCircle className="w-3 h-3 text-emerald-300" />
                  Assigned (you)
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 text-slate-500" />
                  Assigned
                </>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
        <User className="w-3 h-3 text-slate-500" />
        <span className="truncate">{customer}</span>
      </div>

      {job.service_address && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <MapPin className="w-3 h-3 text-slate-600" />
          <span className="truncate">{job.service_address}</span>
        </div>
      )}

      <div className="pt-2 flex items-center justify-between gap-2">
        {unassigned ? (
          <Button
            size="sm"
            className="h-8 bg-violet-600 hover:bg-violet-500 text-white"
            onClick={onClaim}
            disabled={busy}
          >
            Claim
          </Button>
        ) : (
          <span className="text-[10px] text-slate-500">
            Assigned {assignedToMe ? "(you)" : ""}
          </span>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-8 border-sky-500/80 bg-slate-900/80 text-sky-200 hover:bg-sky-500 hover:text-slate-950 hover:border-sky-400"
          onClick={onOpen}
        >
          View
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {job.notes_customer && (
        <div className="pt-1 text-[10px] text-slate-500 line-clamp-2">
          Notes: <span className="text-slate-400">{job.notes_customer}</span>
        </div>
      )}
    </div>
  );
}