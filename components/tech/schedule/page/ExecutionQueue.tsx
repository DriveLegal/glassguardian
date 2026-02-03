// components/tech/schedule/page/ExecutionQueue.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  MapPin,
  User as UserIcon,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

/* ---------------------------------------------------------------------
   Types
--------------------------------------------------------------------- */

export type AnyObj = Record<string, any>;

export type TechAvailabilityRow = {
  id: string;
  technician_email: string;
  date: string; // yyyy-MM-dd
  start_time: string;
  end_time: string;
  is_available: boolean;
  zone: string | null;
  notes: string | null;
};

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

export type ViewMode = "today" | "week" | "availability";

/* ---------------------------------------------------------------------
   Small frame helpers (kept local so this component is drop-in)
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

/* ---------------------------------------------------------------------
   Helpers (date/time/status)
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

function isDoneStatus(status?: StatusKey) {
  const s = (status ?? "").toLowerCase();
  return (
    s === "completed" ||
    s === "paid" ||
    s === "cancelled" ||
    s === "canceled"
  );
}

function isActiveStatus(status?: StatusKey | null) {
  return !isDoneStatus(status ?? undefined);
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

function getStatusLabel(status?: StatusKey) {
  const map: Record<string, string> = {
    requested: "Requested",
    estimating: "Estimating",
    estimate_sent: "Quote Sent",
    approved: "Approved",
    scheduled: "Scheduled",
    en_route: "En Route",
    on_site: "On Site",
    in_progress: "Repairing",
    curing: "Curing",
    completed: "Completed",
    paid: "Paid",
    cancelled: "Cancelled",
    pending: "Pending",
    confirmed: "Confirmed",
    accepted: "Accepted",
  };
  const key = (status ?? "").toLowerCase();
  return map[key] ?? (status ?? "").replace(/_/g, " ");
}

function normalizeEmail(s: string) {
  return String(s ?? "").trim().toLowerCase();
}

function mapHrefForAddress(address?: string | null) {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address
  )}`;
}

function minutesFromTimeHHmm(t?: string | null) {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function sortByTimeThenCreated(a: AppointmentRow, b: AppointmentRow) {
  const am = minutesFromTimeHHmm(a.scheduled_time_start) ?? 9999;
  const bm = minutesFromTimeHHmm(b.scheduled_time_start) ?? 9999;
  if (am !== bm) return am - bm;
  const ac = a.created_at ? Date.parse(a.created_at) : 0;
  const bc = b.created_at ? Date.parse(b.created_at) : 0;
  return ac - bc;
}

/* ---------------------------------------------------------------------
   ✅ Needed update:
   Ensure the module exports the SAME named exports your page imports.
   - The previous build error happens when this file had no exports
     (or was empty/misnamed) OR when named exports were missing.
   - Here we explicitly export types + ExecutionQueueHelpers (already present).
--------------------------------------------------------------------- */

export type { AppointmentRow as ExecutionAppointmentRow };
export type { TechAvailabilityRow as ExecutionTechAvailabilityRow };
export type { StatusKey as ExecutionStatusKey };
export type { ViewMode as ExecutionViewMode };

/* ---------------------------------------------------------------------
   Component
--------------------------------------------------------------------- */

export type ExecutionQueueProps = {
  mode: ViewMode;

  // Today view controls
  focusDateStr: string;
  setFocusDateStr: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  showCompleted: boolean;
  setShowCompleted: (v: boolean) => void;

  // Data
  userEmail: string | null;
  prefersReducedMotion: boolean;

  filteredFocusDay: AppointmentRow[];

  // Week view
  weekDays: Date[];
  weekStart: Date;
  weekEnd: Date;
  weekZoomDay: Date | null;
  setWeekZoomDay: (d: Date | null) => void;

  getDayAvailability: (d: Date) => TechAvailabilityRow | undefined;
  getDayAppointments: (d: Date) => AppointmentRow[];

  // Availability view
  availability: TechAvailabilityRow[];

  // Actions
  onOpenJob: (jobId: string) => void;
  onClaimJob: (jobId: string) => void;
  onUnclaimJob: (jobId: string) => void;
  onSetStatus: (jobId: string, status: StatusKey) => void;

  busy: boolean;
};

export default function ExecutionQueue(props: ExecutionQueueProps) {
  const {
    mode,
    focusDateStr,
    setFocusDateStr,
    search,
    setSearch,
    showCompleted,
    setShowCompleted,
    userEmail,
    prefersReducedMotion,
    filteredFocusDay,
    weekDays,
    weekStart,
    weekEnd,
    weekZoomDay,
    setWeekZoomDay,
    getDayAvailability,
    getDayAppointments,
    availability,
    onOpenJob,
    onClaimJob,
    onUnclaimJob,
    onSetStatus,
    busy,
  } = props;

  const focusDayLabel = safeDateLabel(focusDateStr);

  return (
    <GradientFrame>
      <GlassPanel className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              {mode === "today"
                ? `Execution Queue · ${focusDayLabel}`
                : mode === "week"
                ? weekZoomDay
                  ? `Day Zoom · ${format(weekZoomDay, "EEEE, MMM d")}`
                  : `Week View · ${format(weekStart, "MMM d")}–${format(
                      weekEnd,
                      "MMM d"
                    )}`
                : "Availability Manager"}
              <span className="text-[11px] font-normal text-slate-400">
                {mode === "today"
                  ? "Claim • Navigate • Status updates"
                  : mode === "week"
                  ? weekZoomDay
                    ? "Full job list + actions"
                    : "Tap a day to zoom"
                  : "Optional—only if you want it"}
              </span>
            </CardTitle>

            {/* Today controls */}
            {mode === "today" && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-slate-400">Date</Label>
                  <Input
                    type="date"
                    value={focusDateStr}
                    onChange={(e) => setFocusDateStr(e.target.value)}
                    className="h-9 w-[170px] bg-slate-950/80 border-slate-700 text-slate-100"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search jobs…"
                    className="h-9 w-full sm:w-[240px] bg-slate-950/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2">
                    <Label className="text-[11px] text-slate-300">
                      Show done
                    </Label>
                    <Switch
                      checked={showCompleted}
                      onCheckedChange={setShowCompleted}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* TODAY */}
          {mode === "today" && (
            <div className="space-y-3">
              {filteredFocusDay.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center">
                  <CalendarIcon className="w-7 h-7 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm text-slate-200 font-semibold">
                    No jobs found.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Try turning on “Show done” or clearing search.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFocusDay.map((job) => (
                    <ExecutionRow
                      key={job.id}
                      job={job}
                      userEmail={userEmail}
                      onOpen={() => onOpenJob(String(job.id))}
                      onClaim={() => onClaimJob(String(job.id))}
                      onUnclaim={() => onUnclaimJob(String(job.id))}
                      onSetStatus={(s) => onSetStatus(String(job.id), s)}
                      busy={busy}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WEEK (GRID) */}
          {mode === "week" && !weekZoomDay && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-[11px]">
              {weekDays.map((day, idx) => {
                const dayAvail = getDayAvailability(day);
                const dayJobs = getDayAppointments(day);
                const isToday =
                  format(day, "yyyy-MM-dd") ===
                  format(new Date(), "yyyy-MM-dd");

                return (
                  <motion.button
                    type="button"
                    key={idx}
                    onClick={() => setWeekZoomDay(day)}
                    initial={
                      prefersReducedMotion ? undefined : { opacity: 0, y: 6 }
                    }
                    animate={
                      prefersReducedMotion
                        ? { opacity: 1 }
                        : { opacity: 1, y: 0 }
                    }
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className={[
                      "relative text-left rounded-xl border px-3 py-3 flex flex-col gap-2 min-h-[170px] focus:outline-none focus:ring-2 focus:ring-cyan-400/70",
                      isToday
                        ? "border-cyan-400/80 bg-slate-900/95 shadow-[0_0_25px_rgba(34,211,238,0.45)]"
                        : "border-slate-800 bg-slate-900/90 hover:border-cyan-300/60 hover:bg-slate-900",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                          {format(day, "EEE")}
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            isToday ? "text-cyan-300" : "text-slate-100"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400">
                        {dayJobs.length ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
                            {dayJobs.length}
                          </span>
                        ) : (
                          <span className="opacity-70">—</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {dayAvail ? (
                        <div
                          className={[
                            "flex flex-col gap-0.5 px-2 py-1 rounded-lg text-[10px]",
                            dayAvail.is_available
                              ? "bg-emerald-900/60 border border-emerald-500/70 text-emerald-100"
                              : "bg-rose-900/60 border border-rose-500/70 text-rose-100",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5">
                              {dayAvail.is_available ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span className="font-semibold">
                                {dayAvail.is_available ? "Available" : "Off"}
                              </span>
                            </div>
                            {dayAvail.zone && (
                              <span className="text-[9px] opacity-80 truncate max-w-[80px]">
                                {dayAvail.zone}
                              </span>
                            )}
                          </div>
                          {dayAvail.is_available && (
                            <div className="flex items-center gap-1 text-[9px] opacity-90">
                              <Clock className="w-3 h-3" />
                              <span>
                                {dayAvail.start_time} – {dayAvail.end_time}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-[10px] text-slate-400">
                          No availability set
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 flex-1 overflow-y-auto pr-0.5">
                      {dayJobs.length === 0 ? (
                        <p className="text-[10px] text-slate-500 text-center mt-3">
                          No jobs
                        </p>
                      ) : (
                        dayJobs.slice(0, 6).map((job) => {
                          const timeLabel = formatTimeRange(
                            job.scheduled_time_start,
                            job.scheduled_time_end
                          );
                          const status = String(job.status ?? "").toLowerCase();
                          const dot =
                            status === "completed" || status === "paid"
                              ? "bg-emerald-400 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                              : status === "confirmed" ||
                                status === "accepted" ||
                                status === "approved"
                              ? "bg-sky-400 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.9)]"
                              : status === "pending" || status === "requested"
                              ? "bg-amber-400 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
                              : "bg-slate-400 border-slate-300";

                          return (
                            <div
                              key={job.id}
                              className="flex items-center gap-2 text-[10px] text-slate-300"
                            >
                              <span
                                className={[
                                  "h-2.5 w-2.5 rounded-full border",
                                  dot,
                                ].join(" ")}
                              />
                              <span className="truncate text-slate-400">
                                {timeLabel}
                              </span>
                              <span className="truncate text-slate-500">
                                {job.customer_email ?? "Customer"}
                              </span>
                            </div>
                          );
                        })
                      )}

                      {dayJobs.length > 6 && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          +{dayJobs.length - 6} more
                        </p>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* WEEK (DAY ZOOM) */}
          {mode === "week" && weekZoomDay && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
                  onClick={() => setWeekZoomDay(null)}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Week
                </Button>

                <div className="text-xs text-slate-400">
                  {safeDateLabel(format(weekZoomDay, "yyyy-MM-dd"))}
                </div>
              </div>

              {(getDayAppointments(weekZoomDay) ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center">
                  <CalendarIcon className="w-7 h-7 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm text-slate-200 font-semibold">
                    No jobs on this day.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getDayAppointments(weekZoomDay)
                    .slice()
                    .sort(sortByTimeThenCreated)
                    .map((job) => (
                      <ExecutionRow
                        key={job.id}
                        job={job}
                        userEmail={userEmail}
                        onOpen={() => onOpenJob(String(job.id))}
                        onClaim={() => onClaimJob(String(job.id))}
                        onUnclaim={() => onUnclaimJob(String(job.id))}
                        onSetStatus={(s) => onSetStatus(String(job.id), s)}
                        busy={busy}
                        prefersReducedMotion={prefersReducedMotion}
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {/* AVAILABILITY */}
          {mode === "availability" && (
            <div className="space-y-3">
              {availability.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center">
                  <CheckCircle className="w-7 h-7 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm text-slate-200 font-semibold">
                    No availability rows yet.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hit “Set Availability” if you want scheduling constraints.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availability.slice(0, 60).map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100">
                          {safeDateLabel(a.date)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {a.is_available
                            ? `${a.start_time} – ${a.end_time}`
                            : "Off"}
                          {a.zone ? ` · ${a.zone}` : ""}
                          {a.notes ? ` · ${a.notes}` : ""}
                        </p>
                      </div>
                      <Badge
                        className={[
                          "border text-[10px]",
                          a.is_available
                            ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/60"
                            : "bg-rose-500/15 text-rose-200 border-rose-400/60",
                        ].join(" ")}
                      >
                        {a.is_available ? "AVAILABLE" : "OFF"}
                      </Badge>
                    </div>
                  ))}

                  {availability.length > 60 && (
                    <p className="text-[11px] text-slate-500">
                      Showing first 60 rows. (Keeps page fast.)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </GlassPanel>
    </GradientFrame>
  );
}

/* ---------------------------------------------------------------------
   Internal row components (kept with ExecutionQueue so page stays clean)
--------------------------------------------------------------------- */

function ExecutionRow({
  job,
  userEmail,
  onOpen,
  onClaim,
  onUnclaim,
  onSetStatus,
  busy,
  prefersReducedMotion,
}: {
  job: AppointmentRow;
  userEmail: string | null;
  onOpen: () => void;
  onClaim: () => void;
  onUnclaim: () => void;
  onSetStatus: (s: StatusKey) => void;
  busy: boolean;
  prefersReducedMotion: boolean;
}) {
  const status: StatusKey = (job.status ?? "pending") as StatusKey;

  const assignedToMe =
    !!userEmail &&
    !!job.technician_email &&
    normalizeEmail(String(job.technician_email)) ===
      normalizeEmail(String(userEmail));

  const unassigned = !job.technician_email;

  const scheduled = job.scheduled_date
    ? safeDateLabel(job.scheduled_date)
    : "Date TBA";
  const time = formatTimeRange(job.scheduled_time_start, job.scheduled_time_end);

  const customer =
    job.customer_name ||
    job.customer_full_name ||
    job.customer_email ||
    "Customer";

  const serviceTitle = (job.service_type ?? "SERVICE")
    .replace(/_/g, " ")
    .toUpperCase();

  const addressHref = mapHrefForAddress(job.service_address);

  const vehicleLabel = (() => {
    if (job.vehicle_year || job.vehicle_make || job.vehicle_model) {
      const label =
        `${job.vehicle_year ?? ""} ${job.vehicle_make ?? ""} ${
          job.vehicle_model ?? ""
        }`.trim();
      return label || "Vehicle details pending";
    }
    if (job.vehicle_id) return `Vehicle #${String(job.vehicle_id).slice(0, 6)}`;
    return "Vehicle details pending";
  })();

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl border border-slate-800/90 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-slate-950/95 shadow-[0_18px_45px_rgba(15,23,42,0.9)] hover:shadow-[0_20px_60px_rgba(56,189,248,0.35)] hover:border-sky-500/70 transition-all"
    >
      <div className="p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={[
                  "border text-[10px] px-2 py-0.5",
                  getStatusPillClasses(String(status)),
                ].join(" ")}
              >
                {getStatusLabel(status)}
              </Badge>

              <span className="text-[11px] text-slate-500 uppercase tracking-wide">
                #{String(job.id).slice(0, 8)}
              </span>

              {unassigned && (
                <Badge className="border text-[10px] px-2 py-0.5 bg-violet-500/15 text-violet-200 border-violet-400/60">
                  Unassigned
                </Badge>
              )}

              {assignedToMe && (
                <Badge className="border text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-200 border-emerald-400/60">
                  Mine
                </Badge>
              )}
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-100 truncate">
              {serviceTitle}
            </p>

            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{customer}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate">{vehicleLabel}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-slate-300 text-right">
              <div className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{scheduled}</span>
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unassigned ? (
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 text-white"
                  onClick={onClaim}
                  disabled={busy}
                >
                  Claim
                </Button>
              ) : assignedToMe ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-900"
                  onClick={onUnclaim}
                  disabled={busy}
                >
                  Unclaim
                </Button>
              ) : (
                <Badge className="border text-[10px] px-2 py-0.5 bg-slate-700/40 text-slate-200 border-slate-500/80">
                  Assigned
                </Badge>
              )}

              <Button
                size="sm"
                variant="outline"
                className="border-sky-500/80 bg-slate-900/80 text-sky-200 hover:bg-sky-500 hover:text-slate-950 hover:border-sky-400"
                onClick={onOpen}
              >
                View
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {job.service_address && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <div className="flex items-start gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-sky-400" />
              <p className="text-xs text-slate-300 line-clamp-2">
                {job.service_address}
              </p>
            </div>

            {addressHref && (
              <a
                href={addressHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-200 hover:text-sky-100 whitespace-nowrap"
                title="Open in Google Maps"
              >
                Navigate
              </a>
            )}
          </div>
        )}

        {/* Quick status actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <QuickStatusButton
            label="En Route"
            active={String(status).toLowerCase() === "en_route"}
            onClick={() => onSetStatus("en_route")}
            disabled={busy}
          />
          <QuickStatusButton
            label="On Site"
            active={String(status).toLowerCase() === "on_site"}
            onClick={() => onSetStatus("on_site")}
            disabled={busy}
          />
          <QuickStatusButton
            label="In Progress"
            active={String(status).toLowerCase() === "in_progress"}
            onClick={() => onSetStatus("in_progress")}
            disabled={busy}
          />
          <QuickStatusButton
            label="Curing"
            active={String(status).toLowerCase() === "curing"}
            onClick={() => onSetStatus("curing")}
            disabled={busy}
          />
          <QuickStatusButton
            label="Complete"
            active={String(status).toLowerCase() === "completed"}
            onClick={() => onSetStatus("completed")}
            disabled={busy}
            tone="emerald"
          />

          {job.notes_customer && (
            <div className="ml-auto text-[11px] text-slate-500 line-clamp-1 max-w-[520px]">
              Notes:{" "}
              <span className="text-slate-400">{job.notes_customer}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function QuickStatusButton({
  label,
  active,
  onClick,
  disabled,
  tone = "sky",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  tone?: "sky" | "emerald";
}) {
  const base =
    "h-8 px-3 rounded-full text-[11px] font-semibold border transition disabled:opacity-60 disabled:cursor-not-allowed";

  const styles = active
    ? tone === "emerald"
      ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/70 shadow-[0_0_24px_rgba(52,211,153,0.18)]"
      : "bg-sky-500/20 text-sky-100 border-sky-400/70 shadow-[0_0_24px_rgba(56,189,248,0.18)]"
    : "bg-slate-950/40 text-slate-300 border-slate-700 hover:bg-slate-900/70 hover:border-slate-600";

  return (
    <button
      type="button"
      className={[base, styles].join(" ")}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

/* ---------------------------------------------------------------------
   ✅ REQUIRED named export your schedule page expects
--------------------------------------------------------------------- */

export const ExecutionQueueHelpers = {
  safeDateLabel,
  formatTimeRange,
  isActiveStatus,
  getStatusPillClasses,
  getStatusLabel,
  normalizeEmail,
  sortByTimeThenCreated,
};