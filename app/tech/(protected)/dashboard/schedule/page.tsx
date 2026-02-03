// app/tech/(protected)/dashboard/schedule/page.tsx
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

/* ---------------------------------------------------------------------
   Main Page
--------------------------------------------------------------------- */

export default function TechSchedulePage() {
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

      const row = { ...payload, technician_email: techEmailNorm };

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

  // ✅ CRITICAL FIX remains:
  // - uses real Supabase auth email for INSERT
  // - normalizes emails
  // - blocks in devSim (RLS)
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

      const insertRow: AnyObj = {
        technician_email: authedTechEmail,
        customer_email: customerEmail,
        service_type: aptForm.service_type.trim() || null,
        damage_size: aptForm.damage_size.trim() || null,
        damage_description: aptForm.damage_description.trim() || null,
        service_address: aptForm.service_address.trim() || null,
        location_type: aptForm.location_type.trim() || null,
        scheduled_date: aptForm.scheduled_date || null,
        scheduled_time_start: aptForm.scheduled_time_start || null,
        scheduled_time_end: aptForm.scheduled_time_end || null,
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
      ExecutionQueueHelpers.isActiveStatus(
        (j?.status ?? undefined) as StatusKey | undefined
      )
    ).length;

    const unassignedFocus = focusDayAppointments.filter((j) => !j.technician_email).length;

    return { total, completed, pending, confirmed, activeFocus, unassignedFocus };
  }, [weekAppointments, weekStart, weekEnd, focusDayAppointments]);

  const todayCount = React.useMemo(() => {
    const all = (jobsAllQ.data ?? []) as AnyObj[];

    const act = all.filter((j) =>
      ExecutionQueueHelpers.isActiveStatus(
        (j?.status ?? undefined) as StatusKey | undefined
      )
    );

    const todays = act.filter((j) => String(j?.scheduled_date ?? "") === todayStr);
    return todays.length;
  }, [jobsAllQ.data, todayStr]);

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
      .filter((j) =>
        showCompleted
          ? true
          : ExecutionQueueHelpers.isActiveStatus(
              (j?.status ?? undefined) as StatusKey | undefined
            )
      )
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
  }, [focusDayAppointments, search, showCompleted]);

  const canCreateAppointment =
    !!aptForm.scheduled_date &&
    !!aptForm.scheduled_time_start &&
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
      {/* ✅ Toast (new component) */}
      <NewJobToast
        toast={toast}
        prefersReducedMotion={!!prefersReducedMotion}
        onClose={() => setToast(null)}
        onViewJob={(jobId) => {
          router.push(`/tech/dashboard/schedule/jobs/${jobId}`);
          setToast(null);
        }}
      />

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 480px at -10% -10%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(840px 520px at 110% 0%, rgba(52,211,153,0.22), transparent 60%), linear-gradient(180deg, #020617, #020617 40%, #020617 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' width='128' height='128' viewBox='0 0 128 128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(#n)' opacity='0.32'/></svg>\")",
          }}
        />
      </div>

      <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
        {devActive && <DevBanner />}

        {/* HERO */}
        <GradientFrame>
          <GlassPanel depth={36} className="overflow-hidden">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative overflow-hidden rounded-2xl"
            >
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-sky-500/40 via-sky-400/30 to-emerald-400/30 blur-3xl" />
              <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/40 via-teal-400/30 to-indigo-400/30 blur-3xl" />

              <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="min-w-0 flex gap-4 items-start">
                  <div
                    className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-[0_36px_90px_rgba(37,99,235,0.6)] grid place-items-center transform-gpu"
                    style={{ border: "1px solid rgba(148,163,184,0.5)" }}
                  >
                    <Shield className="w-7 h-7 text-white drop-shadow-[0_6px_20px_rgba(2,6,23,0.7)]" />
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-50 truncate">
                      Tech Command Center · {displayName}
                    </h1>
                    <p className="text-slate-300">
                      {format(new Date(), "EEEE, MMMM d, yyyy")} · {TECH_TZ} ops
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-slate-900/70 border-sky-400/60 text-sky-100"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" /> Pro-grade
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-slate-900/70 border-sky-400/60 text-slate-100"
                      >
                        <Calendar className="w-3.5 h-3.5 mr-1" />{" "}
                        {mode === "today"
                          ? "Today view"
                          : mode === "week"
                          ? "Week view"
                          : "Availability"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-slate-900/70 border-sky-500/70 text-slate-100"
                      >
                        <Clock className="w-3.5 h-3.5 mr-1" /> {todayCount} active today
                      </Badge>

                      {devActive && (
                        <Badge
                          variant="outline"
                          className="bg-amber-950/70 border-amber-400/70 text-amber-100"
                        >
                          DevSim active
                        </Badge>
                      )}
                    </div>

                    {anyError && (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                        <AlertCircle className="w-4 h-4" />
                        <span>{anyErrorMessage ?? "Something failed loading data."}</span>
                      </div>
                    )}

                    {availabilityError && (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-400/70 bg-amber-950/60 px-3 py-2 text-xs text-amber-100">
                        <AlertTriangle className="w-4 h-4" />
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

                {/* Controls */}
                <div className="w-full lg:w-auto space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                    {/* Mode switch */}
                    <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 p-1">
                      <ModeButton
                        active={mode === "today"}
                        onClick={() => {
                          setMode("today");
                          setWeekZoomDay(null);
                        }}
                        icon={<Navigation className="w-3.5 h-3.5" />}
                        label="Today"
                      />
                      <ModeButton
                        active={mode === "week"}
                        onClick={() => setMode("week")}
                        icon={<CalendarIcon className="w-3.5 h-3.5" />}
                        label="Week"
                      />
                      <ModeButton
                        active={mode === "availability"}
                        onClick={() => setMode("availability")}
                        icon={<Sparkles className="w-3.5 h-3.5" />}
                        label="Availability"
                      />
                    </div>

                    {/* Week nav only when week mode */}
                    {mode === "week" && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="border border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-slate-100"
                          onClick={handlePrevWeek}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="px-3 py-1 rounded-full border border-slate-700 bg-slate-950/90 text-xs text-slate-300 shadow-[0_12px_40px_rgba(15,23,42,0.85)]">
                          Week of{" "}
                          <span className="font-semibold text-slate-100">
                            {format(weekStart, "MMM d")}
                          </span>{" "}
                          –{" "}
                          <span className="font-semibold text-slate-100">
                            {format(weekEnd, "MMM d")}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="border border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-slate-100"
                          onClick={handleNextWeek}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Right-side CTAs */}
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        className="border-emerald-400/70 text-emerald-100 bg-slate-900/70 hover:border-emerald-300 hover:bg-emerald-500/15"
                        onClick={() => router.push("/tech/dashboard/schedule/jobs")}
                      >
                        <Route className="w-4 h-4 mr-2" />
                        Job Board
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>

                      <Button
                        variant="outline"
                        className="border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-900"
                        onClick={hardRefresh}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>

                      {/* Set Availability */}
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 border border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.7)]">
                            <Plus className="w-4 h-4 mr-2" />
                            Set Availability
                          </Button>
                        </DialogTrigger>

                        <DialogContent className="sm:max-w-lg border border-slate-700 bg-slate-950 text-slate-100">
                          <DialogHeader>
                            <DialogTitle className="text-slate-50">
                              Set Availability
                            </DialogTitle>
                          </DialogHeader>

                          {upsertAvailabilityM.isError && (
                            <div className="mt-3 mb-2 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                              <AlertCircle className="w-4 h-4" />
                              <span>
                                {(upsertAvailabilityM.error as any)?.message ??
                                  "Failed to save availability."}
                              </span>
                            </div>
                          )}

                          <form
                            onSubmit={handleSubmitAvailability}
                            className="space-y-4 mt-4"
                          >
                            <div>
                              <Label className="text-xs text-slate-200">Date</Label>
                              <Input
                                type="date"
                                value={formData.date}
                                onChange={(e) =>
                                  setFormData({ ...formData, date: e.target.value })
                                }
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-slate-200">
                                  Start Time
                                </Label>
                                <Input
                                  type="time"
                                  value={formData.start_time}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      start_time: e.target.value,
                                    })
                                  }
                                  className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                              </div>

                              <div>
                                <Label className="text-xs text-slate-200">End Time</Label>
                                <Input
                                  type="time"
                                  value={formData.end_time}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      end_time: e.target.value,
                                    })
                                  }
                                  className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700">
                              <Label
                                htmlFor="avail-switch"
                                className="text-xs text-slate-200"
                              >
                                Available
                              </Label>
                              <Switch
                                id="avail-switch"
                                checked={formData.is_available}
                                onCheckedChange={(checked) =>
                                  setFormData({ ...formData, is_available: checked })
                                }
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-200">Zone (optional)</Label>
                              <Input
                                value={formData.zone}
                                onChange={(e) =>
                                  setFormData({ ...formData, zone: e.target.value })
                                }
                                placeholder="e.g., Downtown, North Side"
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-200">Notes</Label>
                              <Textarea
                                value={formData.notes}
                                onChange={(e) =>
                                  setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder="Any special notes..."
                                rows={2}
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>

                            <Button
                              type="submit"
                              className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 border border-cyan-300"
                              disabled={upsertAvailabilityM.isPending}
                            >
                              {upsertAvailabilityM.isPending
                                ? "Saving…"
                                : "Save Availability"}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {/* New Appointment */}
                      <Dialog open={aptDialogOpen} onOpenChange={setAptDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            disabled={devActive}
                            className={[
                              "bg-sky-600 hover:bg-sky-500 text-slate-950 border border-sky-300 shadow-[0_0_24px_rgba(59,130,246,0.7)]",
                              devActive ? "opacity-60 cursor-not-allowed" : "",
                            ].join(" ")}
                            title={
                              devActive
                                ? "DevSim mode: log in as real tech to create appointments"
                                : undefined
                            }
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            New Appointment
                          </Button>
                        </DialogTrigger>

                        <DialogContent className="sm:max-w-lg border border-slate-700 bg-slate-950 text-slate-100">
                          <DialogHeader>
                            <DialogTitle className="text-slate-50">
                              Create New Appointment
                            </DialogTitle>
                          </DialogHeader>

                          {createAppointmentM.isError && (
                            <div className="mt-3 mb-2 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                              <AlertCircle className="w-4 h-4" />
                              <span>
                                {(createAppointmentM.error as any)?.message ??
                                  "Failed to create appointment."}
                              </span>
                            </div>
                          )}

                          <form
                            className="mt-4 space-y-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              createAppointmentM.mutate();
                            }}
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-slate-200">Date</Label>
                                <Input
                                  type="date"
                                  value={aptForm.scheduled_date}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      scheduled_date: e.target.value,
                                    }))
                                  }
                                  className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-slate-200">Start</Label>
                                  <Input
                                    type="time"
                                    value={aptForm.scheduled_time_start}
                                    onChange={(e) =>
                                      setAptForm((f) => ({
                                        ...f,
                                        scheduled_time_start: e.target.value,
                                      }))
                                    }
                                    className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs text-slate-200">End</Label>
                                  <Input
                                    type="time"
                                    value={aptForm.scheduled_time_end}
                                    onChange={(e) =>
                                      setAptForm((f) => ({
                                        ...f,
                                        scheduled_time_end: e.target.value,
                                      }))
                                    }
                                    className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Customer email suggestions */}
                            <div>
                              <div className="flex items-end justify-between gap-3">
                                <Label className="text-xs text-slate-200">
                                  Customer Email
                                </Label>
                                <span className="text-[10px] text-slate-500">
                                  Suggestions: {emailSuggestions.length}
                                </span>
                              </div>

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
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />

                              <datalist id="gg-customer-emails">
                                {emailSuggestions.map((email) => (
                                  <option key={email} value={email} />
                                ))}
                              </datalist>

                              <p className="mt-1 text-[10px] text-slate-500">
                                Pulls from past appointments + your{" "}
                                <span className="font-semibold">user_invites</span>.
                              </p>
                            </div>

                            <div>
                              <Label className="text-xs text-slate-200">Service Type</Label>
                              <Input
                                value={aptForm.service_type}
                                onChange={(e) =>
                                  setAptForm((f) => ({
                                    ...f,
                                    service_type: e.target.value,
                                  }))
                                }
                                placeholder="Chip Repair / Crack Repair / Full Replacement"
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-slate-200">Damage Size</Label>
                                <Input
                                  value={aptForm.damage_size}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      damage_size: e.target.value,
                                    }))
                                  }
                                  placeholder="Quarter size, etc."
                                  className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                              </div>

                              <div>
                                <Label className="text-xs text-slate-200">
                                  Location Type
                                </Label>
                                <Input
                                  value={aptForm.location_type}
                                  onChange={(e) =>
                                    setAptForm((f) => ({
                                      ...f,
                                      location_type: e.target.value,
                                    }))
                                  }
                                  placeholder="Home, Work, Parking lot, etc."
                                  className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs text-slate-200">Service Address</Label>
                              <Input
                                value={aptForm.service_address}
                                onChange={(e) =>
                                  setAptForm((f) => ({
                                    ...f,
                                    service_address: e.target.value,
                                  }))
                                }
                                placeholder="Full address / on-site location"
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-200">
                                Damage Description
                              </Label>
                              <Textarea
                                value={aptForm.damage_description}
                                onChange={(e) =>
                                  setAptForm((f) => ({
                                    ...f,
                                    damage_description: e.target.value,
                                  }))
                                }
                                rows={2}
                                placeholder="Star crack, bullseye, spread, etc."
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-200">Notes (optional)</Label>
                              <Textarea
                                value={aptForm.notes_customer}
                                onChange={(e) =>
                                  setAptForm((f) => ({
                                    ...f,
                                    notes_customer: e.target.value,
                                  }))
                                }
                                rows={2}
                                placeholder="Gate code, parking notes, special glass, etc."
                                className="mt-1 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <p className="text-[10px] text-slate-500 max-w-[70%]">
                                You can create jobs even if the customer doesn&apos;t have an
                                account yet — we match later by email.
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setAptDialogOpen(false)}
                                  disabled={createAppointmentM.isPending}
                                  className="border-slate-600 text-slate-100 bg-slate-900/80 hover:border-slate-400"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={!canCreateAppointment}
                                  className="bg-sky-600 hover:bg-sky-500 text-white"
                                >
                                  {createAppointmentM.isPending ? "Saving…" : "Create"}
                                </Button>
                              </div>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 max-w-2xl ml-auto">
                    Built for speed: today-first execution + quick actions, with week/availability as
                    tools (not clutter).
                  </p>
                </div>
              </div>
            </motion.div>
          </GlassPanel>
        </GradientFrame>

        {/* STATS GRID (new component) */}
        <TechScheduleStatsGrid
          stats={stats}
          mode={mode}
          weekZoomDay={weekZoomDay}
          GlassPanel={GlassPanel}
        />

        {/* Loading */}
        {isLoadingCore && (
          <GradientFrame>
            <GlassPanel>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  Loading…
                </div>
                <SkeletonRow />
                <SkeletonRow />
              </CardContent>
            </GlassPanel>
          </GradientFrame>
        )}

        {/* MAIN GRID */}
        <section className="grid lg:grid-cols-[2.1fr_1.2fr] gap-5">
          {/* LEFT PANEL (ExecutionQueue) */}
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

          {/* RIGHT PANEL (UpcomingNextDays) */}
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
        "flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition border",
        active
          ? "bg-sky-500/20 text-sky-100 border-sky-400/60 shadow-[0_0_24px_rgba(56,189,248,0.25)]"
          : "bg-transparent text-slate-300 border-transparent hover:border-slate-700 hover:bg-slate-900/60",
      ].join(" ")}
    >
      <span className={active ? "text-sky-200" : "text-slate-400"}>{icon}</span>
      {label}
    </button>
  );
}