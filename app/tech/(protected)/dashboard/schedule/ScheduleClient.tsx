// app/tech/(protected)/dashboard/schedule/ScheduleClient.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { motion, useReducedMotion } from "framer-motion";

import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";
import DevBanner from "@/components/DevBanner";
import { ensureTechProfile } from "@/lib/ensureTechProfile";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  Calendar as CalendarIcon,
  Calendar,
  Plus,
  Clock,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Route,
  RefreshCw,
  Navigation,
  Shield,
  Wrench,
  Crown,
  ChevronDown,
} from "lucide-react";

/* ---------------- NEW: drop-in page components ---------------- */
import ExecutionQueue, {
  type AppointmentRow,
  type TechAvailabilityRow,
  type StatusKey,
  type ViewMode,
  ExecutionQueueHelpers,
} from "@/components/tech/schedule/page/ExecutionQueue";

import TechScheduleStatsGrid, {
  type TechScheduleStats,
} from "@/components/tech/schedule/page/StatGrid";

import UpcomingNextDays from "@/components/tech/schedule/page/UpcomingNextDays";

/* ✅ NEW: toast component */
import NewJobToast, {
  type QuickToast,
} from "@/components/tech/schedule/page/NewJobToast";

type AnyObj = Record<string, any>;
const TECH_TZ = "America/Los_Angeles";
const TIME_MINUTES_START = 7 * 60; // 7:00 AM
const TIME_MINUTES_END = 20 * 60; // 8:00 PM
const TIME_STEP_MINUTES = 30;

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

function hhmmToMinutes(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToHHMM(total: number) {
  const safe = Math.max(0, Math.min(total, 23 * 60 + 59));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function clampTimeToRange(value: string, min = TIME_MINUTES_START, max = TIME_MINUTES_END) {
  const parsed = hhmmToMinutes(value);
  if (parsed === null) return minutesToHHMM(min);
  return minutesToHHMM(Math.max(min, Math.min(parsed, max)));
}

function generateTimeOptions() {
  const out: Array<{ value: string; label: string; minutes: number }> = [];
  for (let mins = TIME_MINUTES_START; mins <= TIME_MINUTES_END; mins += TIME_STEP_MINUTES) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    out.push({
      value: `${pad2(h24)}:${pad2(m)}`,
      label: `${h12}:${pad2(m)} ${suffix}`,
      minutes: mins,
    });
  }
  return out;
}

const TIME_OPTIONS = generateTimeOptions();

function getEndOptions(startValue: string) {
  const start = hhmmToMinutes(startValue) ?? TIME_MINUTES_START;
  return TIME_OPTIONS.filter((opt) => opt.minutes > start);
}

function getNearestEndTime(startValue: string, fallbackMinutes = 60) {
  const start = hhmmToMinutes(startValue) ?? TIME_MINUTES_START;
  const desired = Math.min(start + fallbackMinutes, TIME_MINUTES_END);
  const firstValid = TIME_OPTIONS.find((opt) => opt.minutes > start);
  const preferred =
    TIME_OPTIONS.find((opt) => opt.minutes >= desired && opt.minutes > start) ?? firstValid;
  return preferred?.value ?? minutesToHHMM(Math.min(start + 30, TIME_MINUTES_END));
}

/* ---------------------------------------------------------------------
   UI helpers (keep here so StatsGrid can reuse GlassPanel)
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
  )}px rgba(0,0,0,0.52)`;

  return (
    <div
      className={`relative rounded-[1.35rem] border border-amber-400/12 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(3,7,18,0.88))] backdrop-blur-xl ${className}`}
      style={{
        boxShadow: outerShadow,
        transform: "translateZ(0)",
        willChange: "transform, box-shadow",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[1.35rem]"
        style={{
          background:
            "linear-gradient(180deg, rgba(251,191,36,0.09), rgba(250,204,21,0.03) 24%, rgba(15,23,42,0.08) 55%, transparent 88%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-amber-200/45 to-transparent"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function GradientFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        className="absolute -inset-[1.5px] rounded-[1.45rem] opacity-90 blur-[6px]"
        style={{
          background:
            "conic-gradient(from 205deg at 50% 50%, rgba(251,191,36,0.60), transparent 18%, rgba(56,189,248,0.26) 42%, transparent 62%, rgba(245,158,11,0.56) 84%, rgba(251,191,36,0.42) 100%)",
          filter: "saturate(135%)",
          zIndex: 0,
        }}
      />
      <div className="relative z-10 rounded-[1.45rem]">{children}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-700/80 bg-slate-900/70 backdrop-blur px-5 py-4">
      <div className="mb-2 h-4 w-40 rounded bg-slate-600/70" />
      <div className="h-3 w-64 rounded bg-slate-700/70" />
    </div>
  );
}

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

function uniqEmails(list: Array<string | null | undefined>) {
  const set = new Set<string>();
  for (const e of list) {
    const v = (e ?? "").trim();
    if (!v) continue;
    set.add(normalizeEmail(v));
  }
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
}

function PremiumField({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-300">
          {label}
        </Label>
        {helper ? <div className="text-[10px] text-slate-400">{helper}</div> : null}
      </div>
      {children}
    </div>
  );
}

function PremiumSelect({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-amber-400/16 bg-[linear-gradient(180deg,rgba(10,15,28,0.96),rgba(7,12,22,0.92))] px-3 pr-10 text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-amber-300/55 focus:ring-2 focus:ring-amber-400/15"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-100">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/75" />
    </div>
  );
}

function PremiumInputClasses() {
  return "mt-0 h-11 rounded-xl border border-amber-400/16 bg-[linear-gradient(180deg,rgba(10,15,28,0.96),rgba(7,12,22,0.92))] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-slate-500 focus-visible:border-amber-300/55 focus-visible:ring-2 focus-visible:ring-amber-400/15";
}

function PremiumTextareaClasses() {
  return "mt-0 min-h-[96px] rounded-xl border border-amber-400/16 bg-transparent text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-slate-500 focus-visible:border-amber-300/55 focus-visible:ring-2 focus-visible:ring-amber-400/15";
}

function PremiumDialogContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogContent
      className={[
        "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full",
        "max-h-[88dvh] overflow-y-auto overflow-x-hidden overscroll-contain",
        "border border-amber-300/18",
        "bg-[linear-gradient(180deg,rgba(4,7,14,0.995),rgba(2,6,12,0.992))]",
        "text-slate-100",
        "shadow-[0_50px_140px_rgba(0,0,0,0.72),0_0_0_1px_rgba(251,191,36,0.05)]",
        "outline outline-1 outline-white/[0.04]",
        "backdrop-blur-none",
        "data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-[8px]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
        "before:bg-[radial-gradient(1200px_380px_at_50%_-18%,rgba(251,191,36,0.13),transparent_52%)]",
        "after:pointer-events-none after:absolute after:-inset-px after:rounded-[inherit]",
        "after:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_16%,transparent_82%,rgba(251,191,36,0.03))]",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      ].join(" ")}
      style={{
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-20 w-[34rem] -translate-x-1/2 bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_68%)] blur-2xl" />
      {children}
    </DialogContent>
  );
}

/* ---------------------------------------------------------------------
   Main Page
--------------------------------------------------------------------- */

export default function TechScheduleClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const [displayName, setDisplayName] = React.useState<string>("Tech");
  const [devActive, setDevActive] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  // ✅ normalized email used everywhere (queries + writes)
  const techEmailNorm = React.useMemo(
    () => (userEmail ? normalizeEmail(userEmail) : null),
    [userEmail]
  );

  const [mode, setMode] = React.useState<ViewMode>("today");
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());

  // ✅ Split “selected day” into two distinct concepts:
  const [weekZoomDay, setWeekZoomDay] = React.useState<Date | null>(null);
  const [focusDateStr, setFocusDateStr] = React.useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [availabilityError, setAvailabilityError] = React.useState<string | null>(
    null
  );

  const [formData, setFormData] = React.useState({
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "08:00",
    end_time: "17:00",
    is_available: true,
    notes: "",
    zone: "",
  });

  const [aptDialogOpen, setAptDialogOpen] = React.useState(false);
  const [aptForm, setAptForm] = React.useState({
    scheduled_date: format(new Date(), "yyyy-MM-dd"),
    scheduled_time_start: "09:00",
    scheduled_time_end: "10:00",
    customer_email: "",
    service_type: "Chip Repair",
    damage_size: "",
    damage_description: "",
    service_address: "",
    location_type: "",
    notes_customer: "",
    vehicle_id: "",
  });

  const [toast, setToast] = React.useState<QuickToast | null>(null);
  const prevIdsRef = React.useRef<Set<string> | null>(null);

  const [search, setSearch] = React.useState("");
  const [showCompleted, setShowCompleted] = React.useState(false);

  const availabilityEndOptions = React.useMemo(
    () => getEndOptions(formData.start_time),
    [formData.start_time]
  );

  const appointmentEndOptions = React.useMemo(
    () => getEndOptions(aptForm.scheduled_time_start),
    [aptForm.scheduled_time_start]
  );

  /* ---------- Auth gate (session + devSim) + ensure tech profile ---------- */
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;

      if (session) {
        const fn =
          (session.user.user_metadata as any)?.full_name ||
          session.user.email?.split("@")[0] ||
          "Tech";

        if (!mounted) return;

        setDisplayName(fn);
        setUserEmail(session.user.email ? normalizeEmail(session.user.email) : null);
        setDevActive(false);

        ensureTechProfile().catch(() => {});
        return;
      }

      const role = readDevRoleFromCookie();
      if (role === "tech") {
        const dev = makeDevUser("tech");
        if (!mounted) return;
        setDisplayName(dev.user_metadata?.full_name || "Dev Tech");
        setUserEmail(dev.email ? normalizeEmail(dev.email) : "dev.tech@example.com");
        setDevActive(true);
        return;
      }

      router.replace(
        `/login?redirect=${encodeURIComponent("/tech/dashboard/schedule")}`
      );
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  React.useEffect(() => {
    setFormData((prev) => {
      const safeStart = clampTimeToRange(prev.start_time);
      const safeEndOptions = getEndOptions(safeStart);
      const startMinutes = hhmmToMinutes(safeStart) ?? TIME_MINUTES_START;
      const safeEnd =
        safeEndOptions.find((opt) => opt.value === prev.end_time && opt.minutes > startMinutes)
          ?.value ?? getNearestEndTime(safeStart);

      if (safeStart === prev.start_time && safeEnd === prev.end_time) return prev;
      return { ...prev, start_time: safeStart, end_time: safeEnd };
    });
  }, [formData.start_time]);

  React.useEffect(() => {
    setAptForm((prev) => {
      const safeStart = clampTimeToRange(prev.scheduled_time_start);
      const safeEndOptions = getEndOptions(safeStart);
      const startMinutes = hhmmToMinutes(safeStart) ?? TIME_MINUTES_START;
      const safeEnd =
        safeEndOptions.find(
          (opt) => opt.value === prev.scheduled_time_end && opt.minutes > startMinutes
        )?.value ?? getNearestEndTime(safeStart);

      if (safeStart === prev.scheduled_time_start && safeEnd === prev.scheduled_time_end)
        return prev;

      return {
        ...prev,
        scheduled_time_start: safeStart,
        scheduled_time_end: safeEnd,
      };
    });
  }, [aptForm.scheduled_time_start]);

  /* -------------------------------------------------------------------
     Date ranges
  ------------------------------------------------------------------- */

  const weekStart = React.useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 0 }),
    [currentDate]
  );
  const weekEnd = React.useMemo(
    () => endOfWeek(currentDate, { weekStartsOn: 0 }),
    [currentDate]
  );

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  const today = React.useMemo(() => new Date(), []);
  const todayStr = format(today, "yyyy-MM-dd");

  const focusDay = React.useMemo(() => {
    try {
      return parseISO(focusDateStr);
    } catch {
      return new Date();
    }
  }, [focusDateStr]);

  const focusDayStr = format(focusDay, "yyyy-MM-dd");
  const focusDayPlus7Str = format(addDays(focusDay, 7), "yyyy-MM-dd");

  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  /* -------------------------------------------------------------------
     Queries
  ------------------------------------------------------------------- */

  const availabilityQ = useQuery({
    queryKey: ["tech-availability", techEmailNorm],
    enabled: !!techEmailNorm,
    queryFn: async (): Promise<TechAvailabilityRow[]> => {
      setAvailabilityError(null);
      if (!techEmailNorm) return [];

      const { data, error } = await supabaseClient
        .from("tech_availability")
        .select("*")
        .eq("technician_email", techEmailNorm)
        .order("date", { ascending: true });

      if (error) {
        if ((error as any)?.code === "42P01") {
          setAvailabilityError(
            "tech_availability table not found. (Optional) You can still run jobs without it."
          );
          return [];
        }
        throw error;
      }
      return (data ?? []) as TechAvailabilityRow[];
    },
    staleTime: 15_000,
  });

  const weekAppointmentsQ = useQuery({
    queryKey: ["tech-appointments-week", techEmailNorm, weekStartStr, weekEndStr],
    enabled: !!techEmailNorm,
    queryFn: async (): Promise<AppointmentRow[]> => {
      if (!techEmailNorm) return [];

      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .or(`technician_email.eq.${techEmailNorm},technician_email.is.null`)
        .gte("scheduled_date", weekStartStr)
        .lte("scheduled_date", weekEndStr)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AppointmentRow[];
    },
    staleTime: 12_000,
  });

  const focusDayQ = useQuery({
    queryKey: ["tech-appointments-day", techEmailNorm, focusDayStr],
    enabled: !!techEmailNorm,
    queryFn: async (): Promise<AppointmentRow[]> => {
      if (!techEmailNorm) return [];

      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .or(`technician_email.eq.${techEmailNorm},technician_email.is.null`)
        .eq("scheduled_date", focusDayStr)
        .order("scheduled_time_start", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AppointmentRow[];
    },
    staleTime: 8_000,
    refetchInterval: 20_000,
  });

  const upcomingQ = useQuery({
    queryKey: [
      "tech-upcoming-appointments-7d",
      techEmailNorm,
      focusDayStr,
      focusDayPlus7Str,
    ],
    enabled: !!techEmailNorm,
    queryFn: async (): Promise<AppointmentRow[]> => {
      if (!techEmailNorm) return [];

      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .or(`technician_email.eq.${techEmailNorm},technician_email.is.null`)
        .gte("scheduled_date", focusDayStr)
        .lte("scheduled_date", focusDayPlus7Str)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AppointmentRow[];
    },
    staleTime: 12_000,
  });

  const jobsAllQ = useQuery({
    queryKey: ["tech-jobs-all", techEmailNorm],
    enabled: !!techEmailNorm,
    queryFn: async (): Promise<AnyObj[]> => {
      if (!techEmailNorm) return [];

      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .or(`technician_email.eq.${techEmailNorm},technician_email.is.null`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 10_000,
    refetchInterval: 25_000,
  });

  const emailSuggestionsQ = useQuery({
    queryKey: ["tech:customer-email-suggestions", techEmailNorm],
    enabled: !!techEmailNorm,
    queryFn: async (): Promise<string[]> => {
      if (!techEmailNorm) return [];

      const emails: string[] = [];

      const { data: appts, error: apptErr } = await supabaseClient
        .from("appointments")
        .select("customer_email, created_at")
        .or(`technician_email.eq.${techEmailNorm},technician_email.is.null`)
        .not("customer_email", "is", null)
        .order("created_at", { ascending: false })
        .limit(250);

      if (!apptErr && appts?.length) {
        for (const r of appts as AnyObj[]) {
          if (r.customer_email) emails.push(String(r.customer_email));
        }
      }

      const { data: invites, error: invErr } = await supabaseClient
        .from("user_invites")
        .select("email, created_at, used_at")
        .eq("created_by_tech_email", techEmailNorm)
        .order("created_at", { ascending: false })
        .limit(250);

      if (!invErr && invites?.length) {
        for (const r of invites as AnyObj[]) {
          if (r.email) emails.push(String(r.email));
        }
      }

      return uniqEmails(emails);
    },
    staleTime: 60_000,
  });

  /* -------------------------------------------------------------------
     Toast: newly routed jobs
  ------------------------------------------------------------------- */

  React.useEffect(() => {
    const jobsAll = jobsAllQ.data ?? [];
    if (jobsAll.length === 0) {
      prevIdsRef.current = new Set();
      return;
    }

    const all = jobsAll as AnyObj[];
    const currentIds = new Set<string>(all.map((j) => String(j.id)));

    if (!prevIdsRef.current) {
      prevIdsRef.current = currentIds;
      return;
    }

    const prev = prevIdsRef.current;
    const newlyAssigned = all.filter((j) => {
      const id = String(j.id);
      const status = String(j.status ?? "").toLowerCase();
      if (prev.has(id)) return false;
      if (status === "completed" || status === "cancelled" || status === "paid")
        return false;
      return true;
    });

    if (newlyAssigned.length > 0) {
      const latest = newlyAssigned[newlyAssigned.length - 1];
      setToast({
        id: String(latest.id),
        title: (latest.service_type ? String(latest.service_type) : "New Job")
          .replace(/_/g, " ")
          .toUpperCase(),
        subtitle: latest.customer_email ?? null,
        date: latest.scheduled_date ?? null,
        time: latest.scheduled_time_start ?? null,
        address: latest.service_address ?? null,
      });
    }

    prevIdsRef.current = currentIds;
  }, [jobsAllQ.data]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  /* -------------------------------------------------------------------
     Mutations
  ------------------------------------------------------------------- */

  const invalidateAllScheduleQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tech-availability", techEmailNorm] });
    queryClient.invalidateQueries({ queryKey: ["tech-appointments-week", techEmailNorm] });
    queryClient.invalidateQueries({ queryKey: ["tech-appointments-day", techEmailNorm] });
    queryClient.invalidateQueries({
      queryKey: ["tech-upcoming-appointments-7d", techEmailNorm],
    });
    queryClient.invalidateQueries({ queryKey: ["tech-jobs-all", techEmailNorm] });
    queryClient.invalidateQueries({
      queryKey: ["tech:customer-email-suggestions", techEmailNorm],
    });
  }, [queryClient, techEmailNorm]);

  const upsertAvailabilityM = useMutation({
    mutationFn: async (payload: AnyObj) => {
      if (!techEmailNorm) throw new Error("Missing technician email");

      const start = clampTimeToRange(payload.start_time);
      const end = clampTimeToRange(payload.end_time);
      const startMin = hhmmToMinutes(start) ?? TIME_MINUTES_START;
      const endMin = hhmmToMinutes(end) ?? TIME_MINUTES_END;

      if (endMin <= startMin) {
        throw new Error("End time must be later than start time.");
      }

      const row = {
        ...payload,
        start_time: start,
        end_time: end,
        technician_email: techEmailNorm,
      };

      const { error } = await supabaseClient.from("tech_availability").upsert(row, {
        onConflict: "technician_email,date",
      });

      if (error) {
        if ((error as any)?.code === "42P01") {
          throw new Error(
            "tech_availability table missing in Supabase. Create it to use availability."
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-availability", techEmailNorm] });
      setDialogOpen(false);
    },
  });

  const createAppointmentM = useMutation({
    mutationFn: async () => {
      if (devActive) {
        throw new Error(
          "Dev Tech mode is active (cookie sim). Log in as a real technician to create appointments."
        );
      }

      const { data: u, error: uErr } = await supabaseClient.auth.getUser();
      if (uErr) throw uErr;

      const authedTechEmail = u.user?.email ? normalizeEmail(u.user.email) : null;
      if (!authedTechEmail) {
        throw new Error("You must be signed in as a technician to create appointments.");
      }

      const customerEmail = normalizeEmail(aptForm.customer_email || "");
      if (!customerEmail) throw new Error("Customer email is required.");

      const start = clampTimeToRange(aptForm.scheduled_time_start);
      const end = clampTimeToRange(aptForm.scheduled_time_end);
      const startMin = hhmmToMinutes(start) ?? TIME_MINUTES_START;
      const endMin = hhmmToMinutes(end) ?? TIME_MINUTES_END;

      if (endMin <= startMin) {
        throw new Error("End time must be later than start time.");
      }

      const insertRow: AnyObj = {
        technician_email: authedTechEmail,
        customer_email: customerEmail,
        service_type: aptForm.service_type.trim() || null,
        damage_size: aptForm.damage_size.trim() || null,
        damage_description: aptForm.damage_description.trim() || null,
        service_address: aptForm.service_address.trim() || null,
        location_type: aptForm.location_type.trim() || null,
        scheduled_date: aptForm.scheduled_date || null,
        scheduled_time_start: start,
        scheduled_time_end: end,
        notes_customer: aptForm.notes_customer.trim() || null,
        vehicle_id: aptForm.vehicle_id || null,
        status: "pending",
      };

      const { error } = await supabaseClient.from("appointments").insert(insertRow);
      if (error) throw error;
    },
    onSuccess: () => {
      setAptDialogOpen(false);
      setAptForm({
        scheduled_date: format(new Date(), "yyyy-MM-dd"),
        scheduled_time_start: "09:00",
        scheduled_time_end: "10:00",
        customer_email: "",
        service_type: "Chip Repair",
        damage_size: "",
        damage_description: "",
        service_address: "",
        location_type: "",
        notes_customer: "",
        vehicle_id: "",
      });

      invalidateAllScheduleQueries();
    },
  });

  const claimJobM = useMutation({
    mutationFn: async (jobId: string) => {
      if (!techEmailNorm) throw new Error("Missing technician email");

      const { data: existing, error: readErr } = await supabaseClient
        .from("appointments")
        .select("id, technician_email")
        .eq("id", jobId)
        .maybeSingle();

      if (readErr) throw readErr;
      const te = (existing as AnyObj | null)?.technician_email ?? null;

      if (te && normalizeEmail(String(te)) !== techEmailNorm) {
        throw new Error("This job is already assigned to another technician.");
      }

      const { error } = await supabaseClient
        .from("appointments")
        .update({ technician_email: techEmailNorm, status: "accepted" })
        .eq("id", jobId);

      if (error) throw error;
    },
    onSuccess: () => invalidateAllScheduleQueries(),
  });

  const unclaimJobM = useMutation({
    mutationFn: async (jobId: string) => {
      if (!techEmailNorm) throw new Error("Missing technician email");

      const { error } = await supabaseClient
        .from("appointments")
        .update({ technician_email: null, status: "pending" })
        .eq("id", jobId)
        .eq("technician_email", techEmailNorm);

      if (error) throw error;
    },
    onSuccess: () => invalidateAllScheduleQueries(),
  });

  const setStatusM = useMutation({
    mutationFn: async (args: { jobId: string; status: StatusKey }) => {
      if (!techEmailNorm) throw new Error("Missing technician email");

      const { data: existing, error: readErr } = await supabaseClient
        .from("appointments")
        .select("id, technician_email")
        .eq("id", args.jobId)
        .maybeSingle();

      if (readErr) throw readErr;
      const te = (existing as AnyObj | null)?.technician_email ?? null;

      if (te && normalizeEmail(String(te)) !== techEmailNorm) {
        throw new Error("You can’t update status on a job assigned to another technician.");
      }

      const { error } = await supabaseClient
        .from("appointments")
        .update({
          status: String(args.status),
          technician_email: te ? te : techEmailNorm,
        })
        .eq("id", args.jobId);

      if (error) throw error;
    },
    onSuccess: () => invalidateAllScheduleQueries(),
  });

  /* -------------------------------------------------------------------
     Derived data (feeds new components)
  ------------------------------------------------------------------- */

  const availability = availabilityQ.data ?? [];
  const weekAppointments = weekAppointmentsQ.data ?? [];
  const focusDayAppointments = (focusDayQ.data ?? [])
    .slice()
    .sort(ExecutionQueueHelpers.sortByTimeThenCreated);

  // ✅ Show anything NOT completed (and not paid/cancelled) in execution queue
  const isNotCompleted = React.useCallback((status?: StatusKey | string | null) => {
    const s = String(status ?? "").trim().toLowerCase();
    if (s === "completed") return false;
    if (s === "paid") return false;
    if (s === "cancelled" || s === "canceled") return false;
    return true;
  }, []);

  const stats: TechScheduleStats = React.useMemo(() => {
    const inWeek = weekAppointments.filter((a) => {
      if (!a.scheduled_date) return false;
      try {
        const d = parseISO(a.scheduled_date);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      } catch {
        try {
          const d = new Date(a.scheduled_date);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        } catch {
          return false;
        }
      }
    });

    const total = inWeek.length;

    const completed = inWeek.filter((a) => {
      const s = String(a.status ?? "").toLowerCase();
      return s === "completed" || s === "paid";
    }).length;

    const pending = inWeek.filter((a) => {
      const s = String(a.status ?? "").toLowerCase();
      return s === "pending" || s === "requested" || s === "estimating";
    }).length;

    const confirmed = inWeek.filter((a) => {
      const s = String(a.status ?? "").toLowerCase();
      return s === "confirmed" || s === "accepted" || s === "approved";
    }).length;

    const activeFocus = focusDayAppointments.filter((j) =>
      isNotCompleted(j?.status as any)
    ).length;

    const unassignedFocus = focusDayAppointments.filter((j) => !j.technician_email).length;

    return { total, completed, pending, confirmed, activeFocus, unassignedFocus };
  }, [weekAppointments, weekStart, weekEnd, focusDayAppointments, isNotCompleted]);

  const todayCount = React.useMemo(() => {
    const all = (jobsAllQ.data ?? []) as AnyObj[];
    const act = all.filter((j) => isNotCompleted(j?.status as any));
    const todays = act.filter((j) => String(j?.scheduled_date ?? "") === todayStr);
    return todays.length;
  }, [jobsAllQ.data, todayStr, isNotCompleted]);

  const getDayAvailability = React.useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return availability.find((a) => a.date === dateStr);
    },
    [availability]
  );

  const getDayAppointments = React.useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return weekAppointments.filter((a) => a.scheduled_date === dateStr);
    },
    [weekAppointments]
  );

  const filteredFocusDay = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return focusDayAppointments
      .filter((j) => (showCompleted ? true : isNotCompleted(j?.status as any)))
      .filter((j) => {
        if (!q) return true;

        const hay = [
          j.service_type ?? "",
          j.customer_email ?? "",
          j.customer_name ?? "",
          j.customer_full_name ?? "",
          j.service_address ?? "",
          j.vehicle_make ?? "",
          j.vehicle_model ?? "",
          j.vehicle_year ?? "",
          j.damage_size ?? "",
          j.damage_description ?? "",
          j.status ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q) || String(j.id).toLowerCase().includes(q);
      });
  }, [focusDayAppointments, search, showCompleted, isNotCompleted]);

  const canCreateAppointment =
    !!aptForm.scheduled_date &&
    !!aptForm.scheduled_time_start &&
    !!aptForm.scheduled_time_end &&
    !!aptForm.customer_email &&
    !createAppointmentM.isPending &&
    !devActive;

  const isLoadingCore =
    availabilityQ.isLoading ||
    weekAppointmentsQ.isLoading ||
    focusDayQ.isLoading ||
    upcomingQ.isLoading;

  const anyError =
    availabilityQ.isError ||
    weekAppointmentsQ.isError ||
    focusDayQ.isError ||
    upcomingQ.isError;

  const anyErrorMessage =
    (availabilityQ.error as any)?.message ||
    (weekAppointmentsQ.error as any)?.message ||
    (focusDayQ.error as any)?.message ||
    (upcomingQ.error as any)?.message ||
    null;

  const handlePrevWeek = () => {
    setCurrentDate((prev) => addDays(prev, -7));
    setWeekZoomDay(null);
  };

  const handleNextWeek = () => {
    setCurrentDate((prev) => addDays(prev, 7));
    setWeekZoomDay(null);
  };

  const handleSubmitAvailability: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    upsertAvailabilityM.mutate(formData);
  };

  const hardRefresh = () => invalidateAllScheduleQueries();

  const emailSuggestions = emailSuggestionsQ.data ?? [];

  const busy =
    claimJobM.isPending ||
    unclaimJobM.isPending ||
    setStatusM.isPending ||
    upsertAvailabilityM.isPending;

  /* -------------------------------------------------------------------
     Render
  ------------------------------------------------------------------- */

  return (
    <div className="relative min-h-screen overflow-hidden">
      <NewJobToast
        toast={toast}
        prefersReducedMotion={!!prefersReducedMotion}
        onClose={() => setToast(null)}
        onViewJob={(jobId) => {
          router.push(`/tech/dashboard/schedule/jobs/${jobId}`);
          setToast(null);
        }}
      />

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 480px at -10% -10%, rgba(56,189,248,0.15), transparent 55%), radial-gradient(900px 540px at 110% 0%, rgba(245,158,11,0.16), transparent 60%), radial-gradient(840px 520px at 50% -10%, rgba(251,191,36,0.10), transparent 62%), linear-gradient(180deg, #020617, #020617 40%, #020617 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.11] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' width='128' height='128' viewBox='0 0 128 128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(#n)' opacity='0.32'/></svg>\")",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        {devActive && <DevBanner />}

        <GradientFrame>
          <GlassPanel depth={40} className="overflow-hidden">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative overflow-hidden rounded-[1.35rem]"
            >
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-amber-500/22 via-amber-300/12 to-sky-400/10 blur-3xl" />
              <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-gradient-to-br from-sky-500/16 via-cyan-400/10 to-amber-500/10 blur-3xl" />

              <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex items-start gap-4">
                  <div
                    className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(250,204,21,0.90),rgba(245,158,11,0.82)_58%,rgba(14,165,233,0.46))] shadow-[0_30px_90px_rgba(245,158,11,0.22)]"
                    style={{ border: "1px solid rgba(253,224,71,0.28)" }}
                  >
                    <Wrench className="h-7 w-7 text-slate-950 drop-shadow-[0_6px_20px_rgba(255,255,255,0.12)]" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                    </div>

                    <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-50 md:text-3xl">
                      Tech Command Center · {displayName}
                    </h1>
                    <p className="text-slate-300">
                      {format(new Date(), "EEEE, MMMM d, yyyy")} · {TECH_TZ} operations
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-sky-400/22 bg-slate-950/70 text-slate-100"
                      >
                        <Calendar className="mr-1 h-3.5 w-3.5 text-sky-200" />
                        {mode === "today"
                          ? "Today view"
                          : mode === "week"
                          ? "Week view"
                          : "Availability"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-amber-300/22 bg-slate-950/70 text-slate-100"
                      >
                        <Clock className="mr-1 h-3.5 w-3.5 text-amber-200" />
                        {todayCount} active today
                      </Badge>

                      {devActive && (
                        <Badge
                          variant="outline"
                          className="border-amber-400/50 bg-amber-950/60 text-amber-100"
                        >
                          DevSim active
                        </Badge>
                      )}
                    </div>

                    {anyError && (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                        <AlertCircle className="h-4 w-4" />
                        <span>{anyErrorMessage ?? "Something failed loading data."}</span>
                      </div>
                    )}

                    {availabilityError && (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-400/70 bg-amber-950/60 px-3 py-2 text-xs text-amber-100">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{availabilityError}</span>
                      </div>
                    )}

                    {devActive && (
                      <div className="mt-3 text-[11px] text-amber-200/90">
                        Dev Tech mode is active (cookie sim). Appointment creation is disabled
                        because Supabase RLS requires real auth.
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full space-y-3 lg:w-auto">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-1 rounded-full border border-amber-300/12 bg-slate-950/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <ModeButton
                        active={mode === "today"}
                        onClick={() => {
                          setMode("today");
                          setWeekZoomDay(null);
                        }}
                        icon={<Navigation className="h-3.5 w-3.5" />}
                        label="Today"
                      />
                      <ModeButton
                        active={mode === "week"}
                        onClick={() => setMode("week")}
                        icon={<CalendarIcon className="h-3.5 w-3.5" />}
                        label="Week"
                      />
                      <ModeButton
                        active={mode === "availability"}
                        onClick={() => setMode("availability")}
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        label="Availability"
                      />
                    </div>

                    {mode === "week" && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="border border-amber-300/12 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-slate-100"
                          onClick={handlePrevWeek}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>

                        <div className="rounded-full border border-amber-300/12 bg-slate-950/90 px-3 py-1 text-xs text-slate-300 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                          Week of{" "}
                          <span className="font-semibold text-amber-100">
                            {format(weekStart, "MMM d")}
                          </span>{" "}
                          –{" "}
                          <span className="font-semibold text-amber-100">
                            {format(weekEnd, "MMM d")}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="border border-amber-300/12 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-slate-100"
                          onClick={handleNextWeek}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        className="border-emerald-400/50 bg-slate-900/70 text-emerald-100 hover:border-emerald-300 hover:bg-emerald-500/15"
                        onClick={() => router.push("/tech/dashboard/schedule/jobs")}
                      >
                        <Route className="mr-2 h-4 w-4" />
                        Job Board
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        className="border-amber-300/15 bg-slate-950/80 text-slate-100 hover:bg-slate-900"
                        onClick={hardRefresh}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>

                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="border border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.96),rgba(245,158,11,0.92))] text-slate-950 shadow-[0_0_28px_rgba(245,158,11,0.22)] hover:brightness-105">
                            <Plus className="mr-2 h-4 w-4" />
                            Set Availability
                          </Button>
                        </DialogTrigger>

                        <PremiumDialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-slate-50">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-200">
                                <Calendar className="h-4 w-4" />
                              </span>
                              Set Availability
                            </DialogTitle>
                            <p className="pt-1 text-sm text-slate-400">
                              Fast time selection, locked to 7:00 AM through 8:00 PM.
                            </p>
                          </DialogHeader>

                          {upsertAvailabilityM.isError && (
                            <div className="mt-3 mb-2 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                              <AlertCircle className="h-4 w-4" />
                              <span>
                                {(upsertAvailabilityM.error as any)?.message ??
                                  "Failed to save availability."}
                              </span>
                            </div>
                          )}

                          <form onSubmit={handleSubmitAvailability} className="mt-4 space-y-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr_1fr]">
                              <PremiumField label="Date">
                                <Input
                                  type="date"
                                  value={formData.date}
                                  onChange={(e) =>
                                    setFormData({ ...formData, date: e.target.value })
                                  }
                                  className={PremiumInputClasses()}
                                />
                              </PremiumField>

                              <PremiumField label="Start time">
                                <PremiumSelect
                                  value={formData.start_time}
                                  onChange={(value) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      start_time: value,
                                      end_time:
                                        hhmmToMinutes(prev.end_time) !== null &&
                                        (hhmmToMinutes(prev.end_time) as number) >
                                          (hhmmToMinutes(value) as number)
                                          ? prev.end_time
                                          : getNearestEndTime(value),
                                    }))
                                  }
                                  options={TIME_OPTIONS}
                                />
                              </PremiumField>

                              <PremiumField label="End time">
                                <PremiumSelect
                                  value={formData.end_time}
                                  onChange={(value) =>
                                    setFormData((prev) => ({ ...prev, end_time: value }))
                                  }
                                  options={availabilityEndOptions}
                                />
                              </PremiumField>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                              <PremiumField label="Zone" helper="optional">
                                <Input
                                  value={formData.zone}
                                  onChange={(e) =>
                                    setFormData({ ...formData, zone: e.target.value })
                                  }
                                  placeholder="Downtown, North Side, East Route"
                                  className={PremiumInputClasses()}
                                />
                              </PremiumField>

                              <div className="rounded-2xl border border-amber-300/12 bg-slate-950/65 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                <Label
                                  htmlFor="avail-switch"
                                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/88"
                                >
                                  Availability
                                </Label>
                                <div className="flex items-center gap-3">
                                  <Switch
                                    id="avail-switch"
                                    checked={formData.is_available}
                                    onCheckedChange={(checked) =>
                                      setFormData({ ...formData, is_available: checked })
                                    }
                                  />
                                  <span className="text-sm font-medium text-slate-200">
                                    {formData.is_available ? "Available" : "Blocked"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <PremiumField label="Notes">
                              <Textarea
                                value={formData.notes}
                                onChange={(e) =>
                                  setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder="Route notes, area limits, supply status, or day-specific details…"
                                rows={3}
                                className={PremiumTextareaClasses()}
                              />
                            </PremiumField>

                            <div className="rounded-2xl border border-amber-300/10 bg-amber-400/[0.04] px-4 py-3 text-[11px] text-slate-300">
                              Quick-select schedule window:{" "}
                              <span className="font-semibold text-amber-100">7:00 AM</span> to{" "}
                              <span className="font-semibold text-amber-100">8:00 PM</span>.
                              End times only show valid choices after the selected start time.
                            </div>

                            <Button
                              type="submit"
                              className="w-full border border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.96),rgba(245,158,11,0.92))] text-slate-950 shadow-[0_0_28px_rgba(245,158,11,0.20)] hover:brightness-105"
                              disabled={upsertAvailabilityM.isPending}
                            >
                              {upsertAvailabilityM.isPending
                                ? "Saving…"
                                : "Save Availability"}
                            </Button>
                          </form>
                        </PremiumDialogContent>
                      </Dialog>

                      <Dialog open={aptDialogOpen} onOpenChange={setAptDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            disabled={devActive}
                            className={[
                              "border border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.96),rgba(245,158,11,0.92))] text-slate-950 shadow-[0_0_28px_rgba(245,158,11,0.22)] hover:brightness-105",
                              devActive ? "cursor-not-allowed opacity-60" : "",
                            ].join(" ")}
                            title={
                              devActive
                                ? "DevSim mode: log in as real tech to create appointments"
                                : undefined
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            New Appointment
                          </Button>
                        </DialogTrigger>

                        <PremiumDialogContent className="sm:max-w-3xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-slate-50">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-200">
                                <Wrench className="h-4 w-4" />
                              </span>
                              Create New Appointment
                            </DialogTitle>
                            <p className="pt-1 text-sm text-slate-400">
                              Faster tech booking flow with locked time windows and clearer field visibility.
                            </p>
                          </DialogHeader>

                          {createAppointmentM.isError && (
                            <div className="mt-3 mb-2 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                              <AlertCircle className="h-4 w-4" />
                              <span>
                                {(createAppointmentM.error as any)?.message ??
                                  "Failed to create appointment."}
                              </span>
                            </div>
                          )}

                          <form
                            className="mt-4 space-y-5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              createAppointmentM.mutate();
                            }}
                          >
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr_1fr]">
                              <PremiumField label="Date">
                                <Input
                                  type="date"
                                  value={aptForm.scheduled_date}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      scheduled_date: e.target.value,
                                    }))
                                  }
                                  className={PremiumInputClasses()}
                                />
                              </PremiumField>

                              <PremiumField label="Start time" helper="7:00 AM – 8:00 PM">
                                <PremiumSelect
                                  value={aptForm.scheduled_time_start}
                                  onChange={(value) =>
                                    setAptForm((prev) => ({
                                      ...prev,
                                      scheduled_time_start: value,
                                      scheduled_time_end:
                                        hhmmToMinutes(prev.scheduled_time_end) !== null &&
                                        (hhmmToMinutes(prev.scheduled_time_end) as number) >
                                          (hhmmToMinutes(value) as number)
                                          ? prev.scheduled_time_end
                                          : getNearestEndTime(value),
                                    }))
                                  }
                                  options={TIME_OPTIONS}
                                />
                              </PremiumField>

                              <PremiumField label="End time">
                                <PremiumSelect
                                  value={aptForm.scheduled_time_end}
                                  onChange={(value) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      scheduled_time_end: value,
                                    }))
                                  }
                                  options={appointmentEndOptions}
                                />
                              </PremiumField>
                            </div>

                            <PremiumField
                              label="Customer email"
                              helper={
                                <>
                                  Suggestions:{" "}
                                  <span className="font-semibold text-amber-100">
                                    {emailSuggestions.length}
                                  </span>
                                </>
                              }
                            >
                              <Input
                                type="email"
                                list="gg-customer-emails"
                                value={aptForm.customer_email}
                                onChange={(e) =>
                                  setAptForm((f) => ({
                                    ...f,
                                    customer_email: e.target.value,
                                  }))
                                }
                                placeholder="Start typing or pick from dropdown…"
                                className={PremiumInputClasses()}
                              />
                              <datalist id="gg-customer-emails">
                                {emailSuggestions.map((email) => (
                                  <option key={email} value={email} />
                                ))}
                              </datalist>
                              <p className="mt-2 text-[10px] text-slate-500">
                                Pulls from past appointments + your{" "}
                                <span className="font-semibold text-slate-300">user_invites</span>.
                              </p>
                            </PremiumField>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <PremiumField label="Service type">
                                <Input
                                  value={aptForm.service_type}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      service_type: e.target.value,
                                    }))
                                  }
                                  placeholder="Chip Repair / Crack Repair / Full Replacement"
                                  className={PremiumInputClasses()}
                                />
                              </PremiumField>

                              <PremiumField label="Damage size">
                                <Input
                                  value={aptForm.damage_size}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      damage_size: e.target.value,
                                    }))
                                  }
                                  placeholder="Quarter size, 6-inch crack, bullseye"
                                  className={PremiumInputClasses()}
                                />
                              </PremiumField>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <PremiumField label="Location type">
                                <Input
                                  value={aptForm.location_type}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      location_type: e.target.value,
                                    }))
                                  }
                                  placeholder="Home, Work, Parking lot"
                                  className={PremiumInputClasses()}
                                />
                              </PremiumField>

                              <PremiumField label="Service address">
                                <Input
                                  value={aptForm.service_address}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      service_address: e.target.value,
                                    }))
                                  }
                                  placeholder="Full address / on-site location"
                                  className={PremiumInputClasses()}
                                />
                              </PremiumField>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <PremiumField label="Damage description">
                                <Textarea
                                  value={aptForm.damage_description}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      damage_description: e.target.value,
                                    }))
                                  }
                                  rows={4}
                                  placeholder="Star crack, bullseye, edge crack, spread, visibility notes…"
                                  className={PremiumTextareaClasses()}
                                />
                              </PremiumField>

                              <PremiumField label="Notes" helper="optional">
                                <Textarea
                                  value={aptForm.notes_customer}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      notes_customer: e.target.value,
                                    }))
                                  }
                                  rows={4}
                                  placeholder="Gate code, parking notes, special glass, or technician-specific instructions…"
                                  className={PremiumTextareaClasses()}
                                />
                              </PremiumField>
                            </div>

                            <div className="rounded-2xl border border-amber-300/10 bg-[linear-gradient(180deg,rgba(251,191,36,0.05),rgba(245,158,11,0.03))] px-4 py-3 text-[11px] text-slate-300">
                              Built for quick tech dispatch: the time picker only shows valid slots,
                              keeps start/end in sync, and removes the hard-to-read white textarea background.
                            </div>

                            <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-amber-300/10 bg-[linear-gradient(180deg,rgba(4,7,14,0.92),rgba(2,6,12,0.98))] pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
  <p className="max-w-[70%] text-[10px] text-slate-500">
    You can create jobs even if the customer doesn&apos;t have an
    account yet — matching can happen later by email.
  </p>
  <div className="flex gap-2">
    <Button
      type="button"
      variant="outline"
      onClick={() => setAptDialogOpen(false)}
      disabled={createAppointmentM.isPending}
      className="border-amber-300/16 bg-slate-900/80 text-slate-100 hover:border-amber-300/28 hover:bg-slate-900"
    >
      Cancel
    </Button>
    <Button
      type="submit"
      disabled={!canCreateAppointment}
      className="border border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.96),rgba(245,158,11,0.92))] text-slate-950 shadow-[0_0_28px_rgba(245,158,11,0.20)] hover:brightness-105 disabled:opacity-60"
    >
      {createAppointmentM.isPending ? "Saving…" : "Create"}
    </Button>
  </div>
</div>
                          </form>
                        </PremiumDialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </GlassPanel>
        </GradientFrame>

        <TechScheduleStatsGrid
          stats={stats}
          mode={mode}
          weekZoomDay={weekZoomDay}
          GlassPanel={GlassPanel}
        />

        {isLoadingCore && (
          <GradientFrame>
            <GlassPanel>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                  Loading…
                </div>
                <SkeletonRow />
                <SkeletonRow />
              </CardContent>
            </GlassPanel>
          </GradientFrame>
        )}

        <section className="grid gap-5 lg:grid-cols-[2.1fr_1.2fr]">
          <ExecutionQueue
            mode={mode}
            focusDateStr={focusDateStr}
            setFocusDateStr={setFocusDateStr}
            search={search}
            setSearch={setSearch}
            showCompleted={showCompleted}
            setShowCompleted={setShowCompleted}
            userEmail={techEmailNorm}
            prefersReducedMotion={!!prefersReducedMotion}
            filteredFocusDay={filteredFocusDay}
            weekDays={weekDays}
            weekStart={weekStart}
            weekEnd={weekEnd}
            weekZoomDay={weekZoomDay}
            setWeekZoomDay={setWeekZoomDay}
            getDayAvailability={getDayAvailability}
            getDayAppointments={getDayAppointments}
            availability={availability}
            onOpenJob={(jobId) => router.push(`/tech/dashboard/schedule/jobs/${jobId}`)}
            onClaimJob={(jobId) => claimJobM.mutate(jobId)}
            onUnclaimJob={(jobId) => unclaimJobM.mutate(jobId)}
            onSetStatus={(jobId, status) => setStatusM.mutate({ jobId, status })}
            busy={busy}
          />

          <UpcomingNextDays
            userEmail={techEmailNorm}
            isLoading={upcomingQ.isLoading}
            isError={upcomingQ.isError}
            errorMessage={(upcomingQ.error as any)?.message ?? null}
            jobs={(upcomingQ.data ?? []) as AppointmentRow[]}
            onOpen={(jobId) => router.push(`/tech/dashboard/schedule/jobs/${jobId}`)}
            onClaim={(jobId) => claimJobM.mutate(jobId)}
            busy={claimJobM.isPending || setStatusM.isPending}
          />
        </section>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Tiny local component
--------------------------------------------------------------------- */

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold transition",
        active
          ? "border-amber-300/35 bg-amber-400/12 text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.14)]"
          : "border-transparent bg-transparent text-slate-300 hover:border-amber-300/10 hover:bg-slate-900/60",
      ].join(" ")}
    >
      <span className={active ? "text-amber-200" : "text-slate-400"}>{icon}</span>
      {label}
    </button>
  );
}