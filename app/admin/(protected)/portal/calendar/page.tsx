// app/admin/(protected)/portal/calendar/page.tsx
"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Filter,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  User,
  Wrench,
  Hash,
} from "lucide-react";

import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addMonths,
  subMonths,
} from "date-fns";

/* ------------------------------- Types ------------------------------- */
type Appointment = {
  id: string;
  status?: string | null;
  scheduled_date?: string | null; // "YYYY-MM-DD"
  scheduled_time_start?: string | null; // "HH:mm" or similar
  service_type?: string | null;
  customer_email?: string | null;
  technician_email?: string | null;
  created_at?: string | null;
};

/* ----------------------------- Data Hook ---------------------------- */
function useAppointments() {
  return useQuery({
    queryKey: ["admin:calendar:appointments"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select(
          [
            "id",
            "status",
            "scheduled_date",
            "scheduled_time_start",
            "service_type",
            "customer_email",
            "technician_email",
            "created_at",
          ].join(",")
        )
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true })
        .limit(2000);

      if (error) throw error;
      return (data ?? []) as unknown as Appointment[];
    },
    staleTime: 15_000,
  });
}

/* ----------------------------- Helpers ------------------------------ */
type StatusTone = "emerald" | "blue" | "amber" | "violet" | "slate" | "rose";

function normStatus(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function statusTone(statusRaw: any): StatusTone {
  const s = normStatus(statusRaw);
  if (["completed", "paid"].includes(s)) return "emerald";
  if (["on_site", "in_progress"].includes(s)) return "blue";
  if (["en_route"].includes(s)) return "amber";
  if (["scheduled", "requested", "estimate_sent", "estimating"].includes(s))
    return "violet";
  if (["canceled", "cancelled", "denied", "no_show"].includes(s)) return "rose";
  return "slate";
}

function toneClasses(t: StatusTone) {
  switch (t) {
    case "emerald":
      return {
        chip: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25",
        border: "border-emerald-400/30",
        left: "#10b981",
        glow: "shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_12px_60px_-30px_rgba(16,185,129,0.55)]",
      };
    case "blue":
      return {
        chip: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25",
        border: "border-sky-400/30",
        left: "#38bdf8",
        glow: "shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_12px_60px_-30px_rgba(56,189,248,0.55)]",
      };
    case "amber":
      return {
        chip: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25",
        border: "border-amber-400/30",
        left: "#f59e0b",
        glow: "shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_12px_60px_-30px_rgba(245,158,11,0.55)]",
      };
    case "violet":
      return {
        chip: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/25",
        border: "border-violet-400/30",
        left: "#8b5cf6",
        glow: "shadow-[0_0_0_1px_rgba(139,92,246,0.22),0_12px_60px_-30px_rgba(139,92,246,0.55)]",
      };
    case "rose":
      return {
        chip: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25",
        border: "border-rose-400/30",
        left: "#fb7185",
        glow: "shadow-[0_0_0_1px_rgba(251,113,133,0.22),0_12px_60px_-30px_rgba(251,113,133,0.55)]",
      };
    default:
      return {
        chip: "bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/25",
        border: "border-slate-400/25",
        left: "#94a3b8",
        glow: "shadow-[0_0_0_1px_rgba(148,163,184,0.18),0_12px_60px_-30px_rgba(148,163,184,0.35)]",
      };
  }
}

function prettyServiceType(s?: string | null) {
  const v = String(s ?? "").trim();
  if (!v) return "SERVICE";
  return v.replace(/_/g, " ").toUpperCase();
}

function safeInitial(email?: string | null) {
  const v = String(email ?? "").trim();
  if (!v) return "?";
  return v[0]?.toUpperCase() ?? "?";
}

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function aptDate(apt: Appointment): Date | null {
  if (!apt.scheduled_date) return null;
  // Interpret date-only as local date at 00:00
  return parseISO(apt.scheduled_date);
}

function aptTimeLabel(apt: Appointment) {
  const t = String(apt.scheduled_time_start ?? "").trim();
  return t || "TBD";
}

/* ------------------------------- Page ------------------------------- */
export default function AdminCalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "scheduled" | "in_progress" | "completed" | "canceled"
  >("all");

  const [selected, setSelected] = useState<Appointment | null>(null);

  const {
    data: appointments = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useAppointments();

  const inWeekInterval = useMemo(() => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return { start, end };
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    const total =
      Math.max(28, Math.min(42, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)) || 42;

    return Array.from({ length: total }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const filteredAppointments = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sf = statusFilter;

    return appointments.filter((apt) => {
      const status = normStatus(apt.status);

      const matchesStatus =
        sf === "all"
          ? true
          : sf === "scheduled"
          ? ["scheduled", "requested", "estimating", "estimate_sent"].includes(status)
          : sf === "in_progress"
          ? ["en_route", "on_site", "in_progress"].includes(status)
          : sf === "completed"
          ? ["completed", "paid"].includes(status)
          : sf === "canceled"
          ? ["canceled", "cancelled", "denied", "no_show"].includes(status)
          : true;

      if (!matchesStatus) return false;

      if (!q) return true;

      const hay = [
        apt.id,
        apt.status,
        apt.scheduled_date,
        apt.scheduled_time_start,
        apt.service_type,
        apt.customer_email,
        apt.technician_email,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");

      return hay.includes(q);
    });
  }, [appointments, query, statusFilter]);

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of filteredAppointments) {
      if (!apt.scheduled_date) continue;
      const list = map.get(apt.scheduled_date) ?? [];
      list.push(apt);
      map.set(apt.scheduled_date, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) =>
        (a.scheduled_time_start || "").localeCompare(b.scheduled_time_start || "")
      );
      map.set(k, list);
    }
    return map;
  }, [filteredAppointments]);

  const getDayAppointments = useCallback(
    (date: Date) => {
      const k = dayKey(date);
      return byDate.get(k) ?? [];
    },
    [byDate]
  );

  const thisWeekCount = useMemo(() => {
    const { start, end } = inWeekInterval;
    return filteredAppointments.filter((apt) => {
      const d = aptDate(apt);
      if (!d) return false;
      return isWithinInterval(d, {
        start: startOfDay(start),
        end: endOfDay(end),
      });
    }).length;
  }, [filteredAppointments, inWeekInterval]);

  const statCounts = useMemo(() => {
    const all = filteredAppointments;
    const scheduled = all.filter((a) =>
      ["scheduled", "requested", "estimating", "estimate_sent"].includes(normStatus(a.status))
    ).length;
    const inProgress = all.filter((a) =>
      ["en_route", "on_site", "in_progress"].includes(normStatus(a.status))
    ).length;
    const completed = all.filter((a) =>
      ["completed", "paid"].includes(normStatus(a.status))
    ).length;
    const canceled = all.filter((a) =>
      ["canceled", "cancelled", "denied", "no_show"].includes(normStatus(a.status))
    ).length;

    return { scheduled, inProgress, completed, canceled };
  }, [filteredAppointments]);

  const rangeLabel = useMemo(() => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy");
    const { start, end } = inWeekInterval;
    const sameMonth = format(start, "MMM") === format(end, "MMM");
    const sameYear = format(start, "yyyy") === format(end, "yyyy");
    if (sameMonth && sameYear) return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
    if (!sameMonth && sameYear) return `${format(start, "MMM d")}–${format(end, "MMM d, yyyy")}`;
    return `${format(start, "MMM d, yyyy")}–${format(end, "MMM d, yyyy")}`;
  }, [currentDate, viewMode, inWeekInterval]);

  const gridDays = viewMode === "week" ? weekDays : monthDays;

  const goPrev = () => {
    setCurrentDate((d) => (viewMode === "month" ? subMonths(d, 1) : addDays(d, -7)));
  };
  const goNext = () => {
    setCurrentDate((d) => (viewMode === "month" ? addMonths(d, 1) : addDays(d, 7)));
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      {/* Background: deep navy gradient + starfield + glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(900px_520px_at_80%_20%,rgba(139,92,246,0.18),transparent_55%),radial-gradient(900px_520px_at_60%_90%,rgba(16,185,129,0.14),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.35] bg-[linear-gradient(to_bottom,rgba(2,6,23,0.92),rgba(2,6,23,0.96))]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:radial-gradient(rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-violet-500/15 blur-3xl" />
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header / Controls */}
          <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-4 backdrop-blur-xl bg-slate-950/55 border-b border-white/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-sky-200" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    Appointment Calendar
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-slate-200">
                      <Sparkles className="h-3.5 w-3.5 text-violet-200" />
                      Admin
                    </span>
                  </h1>
                  <p className="text-slate-300/80 mt-1">{rangeLabel}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goPrev}
                    aria-label={viewMode === "month" ? "Previous month" : "Previous week"}
                    className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setCurrentDate(new Date())}
                    className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  >
                    Today
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goNext}
                    aria-label={viewMode === "month" ? "Next month" : "Next week"}
                    className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <div className="w-px h-8 bg-white/10 mx-1" />

                  <div className="flex items-center rounded-xl bg-white/5 ring-1 ring-white/10 p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewMode("week")}
                      className={`h-8 px-3 rounded-lg ${
                        viewMode === "week"
                          ? "bg-white/10 text-white"
                          : "text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      Week
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewMode("month")}
                      className={`h-8 px-3 rounded-lg ${
                        viewMode === "month"
                          ? "bg-white/10 text-white"
                          : "text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      Month
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetch()}
                    aria-label="Refresh"
                    className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-[520px]">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by customer, tech, service, status, id…"
                      className="pl-9 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-2 text-xs text-slate-300/80">
                      <Filter className="w-4 h-4" />
                      Filter:
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["all", "All"],
                          ["scheduled", "Scheduled"],
                          ["in_progress", "In Progress"],
                          ["completed", "Completed"],
                          ["canceled", "Canceled"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setStatusFilter(key)}
                          className={[
                            "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                            "ring-1 ring-white/10 bg-white/5 hover:bg-white/10",
                            statusFilter === key
                              ? "bg-white/12 ring-white/20 text-white"
                              : "text-slate-200",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {isError ? (
                  <div className="flex items-center gap-2 text-sm text-rose-200 bg-rose-500/10 ring-1 ring-rose-400/20 px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4" />
                    Couldn’t load appointments. Tap refresh.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Loading skeleton */}
          {isLoading ? (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 rounded-2xl bg-white/5 ring-1 ring-white/10 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="mt-6">
                {/* Day labels */}
                <div className="grid grid-cols-7 gap-3 mb-3 text-xs uppercase tracking-wider text-slate-400 px-1">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = addDays(startOfWeek(new Date()), i);
                    return (
                      <div key={i} className="text-center">
                        {format(d, "EEE")}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {gridDays.map((day, idx) => {
                    const dayAppointments = getDayAppointments(day);
                    const isToday = isSameDay(day, new Date());
                    const inCurrentMonth = format(day, "MM") === format(currentDate, "MM");

                    const cap = viewMode === "month" ? 3 : 5;
                    const visible = dayAppointments.slice(0, cap);
                    const hidden = Math.max(0, dayAppointments.length - visible.length);

                    return (
                      <Card
                        key={`${idx}-${format(day, "yyyyMMdd")}`}
                        className={[
                          "border-none rounded-2xl overflow-hidden",
                          "bg-white/5 ring-1 ring-white/10 backdrop-blur-xl",
                          "shadow-[0_20px_90px_-60px_rgba(0,0,0,0.8)]",
                          isToday ? "ring-2 ring-sky-400/60" : "",
                        ].join(" ")}
                      >
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={[
                                  "h-9 w-9 rounded-xl flex items-center justify-center",
                                  isToday
                                    ? "bg-sky-500/15 ring-1 ring-sky-400/25"
                                    : "bg-white/5 ring-1 ring-white/10",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "text-base font-bold",
                                    isToday ? "text-sky-200" : "text-slate-100",
                                    !inCurrentMonth ? "opacity-60" : "",
                                  ].join(" ")}
                                >
                                  {format(day, "d")}
                                </span>
                              </div>
                              <div className="leading-tight">
                                <div className="text-sm font-semibold text-slate-100">
                                  {format(day, "EEE")}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {format(day, "MMM")}
                                </div>
                              </div>
                            </div>

                            <Badge className="bg-white/5 text-slate-200 ring-1 ring-white/10">
                              {dayAppointments.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>

                        <CardContent className="p-3 pt-2 space-y-2">
                          {dayAppointments.length === 0 ? (
                            <div className="rounded-xl bg-black/10 ring-1 ring-white/10 px-3 py-6 text-center">
                              <p className="text-xs text-slate-400">No appointments</p>
                            </div>
                          ) : (
                            <>
                              <AnimatePresence initial={false}>
                                {visible.map((apt) => {
                                  const tone = statusTone(apt.status);
                                  const cls = toneClasses(tone);

                                  return (
                                    <motion.button
                                      key={apt.id}
                                      layout
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 6 }}
                                      transition={{ duration: 0.16 }}
                                      type="button"
                                      onClick={() => setSelected(apt)}
                                      className={[
                                        "w-full text-left rounded-xl px-3 py-2",
                                        "bg-black/10 hover:bg-white/5 transition",
                                        "ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
                                        cls.glow,
                                      ].join(" ")}
                                      style={{
                                        borderLeft: `4px solid ${cls.left}`,
                                      }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="text-xs font-semibold text-slate-200 shrink-0">
                                            {aptTimeLabel(apt)}
                                          </span>

                                          <span
                                            className={[
                                              "text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap",
                                              cls.chip,
                                            ].join(" ")}
                                          >
                                            {normStatus(apt.status) || "unknown"}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mt-1 text-xs font-bold text-slate-100 truncate">
                                        {prettyServiceType(apt.service_type)}
                                      </div>

                                      <div className="mt-1 flex items-center justify-between gap-2">
                                        <div className="text-xs text-slate-300/90 truncate">
                                          {apt.customer_email || "No customer email"}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          {apt.technician_email ? (
                                            <div className="flex items-center gap-2">
                                              <span className="text-[11px] text-sky-200/90">
                                                Tech
                                              </span>
                                              <div className="h-6 w-6 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-[11px] font-bold text-slate-100">
                                                {safeInitial(apt.technician_email)}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-[11px] text-slate-400">
                                              Unassigned
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </motion.button>
                                  );
                                })}
                              </AnimatePresence>

                              {hidden > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // For month view, jump to week view centered on this day
                                    setCurrentDate(day);
                                    setViewMode("week");
                                  }}
                                  className="w-full text-center text-xs font-semibold rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-slate-200 transition"
                                >
                                  +{hidden} more (open week)
                                </button>
                              ) : null}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-8">
                <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <p className="text-xs text-slate-400 mb-1">This Week (filtered)</p>
                    <p className="text-3xl font-extrabold text-sky-200">{thisWeekCount}</p>
                  </CardContent>
                </Card>

                <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <p className="text-xs text-slate-400 mb-1">Scheduled</p>
                    <p className="text-3xl font-extrabold text-violet-200">
                      {statCounts.scheduled}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <p className="text-xs text-slate-400 mb-1">In Progress</p>
                    <p className="text-3xl font-extrabold text-amber-200">
                      {statCounts.inProgress}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <p className="text-xs text-slate-400 mb-1">Completed</p>
                    <p className="text-3xl font-extrabold text-emerald-200">
                      {statCounts.completed}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <p className="text-xs text-slate-400 mb-1">Canceled</p>
                    <p className="text-3xl font-extrabold text-rose-200">
                      {statCounts.canceled}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selected} onOpenChange={(v) => (!v ? setSelected(null) : null)}>
        <DialogContent className="max-w-2xl bg-slate-950/85 border-white/10 text-slate-100 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                <Hash className="h-5 w-5 text-slate-200" />
              </div>
              Appointment Details
            </DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-400">Appointment ID</div>
                    <div className="font-mono text-sm text-slate-200 break-all">
                      {selected.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const t = statusTone(selected.status);
                      const cls = toneClasses(t);
                      return (
                        <span
                          className={[
                            "text-xs font-semibold px-2.5 py-1 rounded-full",
                            cls.chip,
                          ].join(" ")}
                        >
                          {normStatus(selected.status) || "unknown"}
                        </span>
                      );
                    })()}
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-slate-200">
                      {prettyServiceType(selected.service_type)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                    <div className="flex items-center gap-2 text-slate-200">
                      <CalendarIcon className="h-4 w-4 text-sky-200" />
                      <div className="text-sm font-semibold">Scheduled</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {selected.scheduled_date
                        ? `${selected.scheduled_date} • ${aptTimeLabel(selected)}`
                        : "Not scheduled"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Clock className="h-4 w-4 text-amber-200" />
                      <div className="text-sm font-semibold">Created</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {selected.created_at ? format(new Date(selected.created_at), "PPp") : "—"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                    <div className="flex items-center gap-2 text-slate-200">
                      <User className="h-4 w-4 text-emerald-200" />
                      <div className="text-sm font-semibold">Customer</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300 break-all">
                      {selected.customer_email || "—"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Wrench className="h-4 w-4 text-sky-200" />
                      <div className="text-sm font-semibold">Technician</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300 break-all">
                      {selected.technician_email || "Unassigned"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelected(null)}
                  className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}