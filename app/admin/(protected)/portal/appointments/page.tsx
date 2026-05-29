// app/admin/(protected)/portal/appointments/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Calendar,
  Search,
  Filter,
  ArrowRight,
  User as UserIcon,
  ShieldCheck,
  Sparkles,
  Activity,
  RefreshCw,
  MapPin,
  Clock3,
  DollarSign,
  Wrench,
  CheckCircle2,
  AlertCircle,
  UserRound,
  ClipboardList,
  Siren,
  Star,
} from "lucide-react";
import { format } from "date-fns";

type AnyObj = Record<string, any>;

type AppointmentRow = {
  id: string;
  created_at?: string | null;
  status?: string | null;
  service_type?: string | null;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  customer_email?: string | null;
  full_name?: string | null;
  service_address?: string | null;
  estimate_amount?: number | null;
  technician_email?: string | null;
  location_type?: string | null;
};

type TechnicianRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  tech_rating?: number | string | null;
  is_active?: boolean | null;
};

type CustomerRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

type StatusFilter =
  | "all"
  | "requested"
  | "scheduled"
  | "in_progress"
  | "completed";

function normalizeStatus(status?: string | null) {
  return String(status ?? "").trim().toLowerCase();
}

function niceLabel(v?: string | null) {
  const s = String(v ?? "").trim();
  if (!s) return "Unknown";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatMoney(value?: number | null) {
  const cents = Number(value ?? 0);
  if (!Number.isFinite(cents)) return "$0.00";

  const dollars = cents / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatWhen(apt: AppointmentRow) {
  if (!apt.scheduled_date) return "Not scheduled yet";
  const d = safeDate(apt.scheduled_date);
  const dateLabel = d ? format(d, "MMM d, yyyy") : apt.scheduled_date;
  const start = apt.scheduled_time_start ? ` at ${apt.scheduled_time_start}` : "";
  const end = apt.scheduled_time_end ? `–${apt.scheduled_time_end}` : "";
  return `${dateLabel}${start}${end}`;
}

function emailNameFallback(email?: string | null) {
  if (!email) return "Customer";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  return cleaned
    ? cleaned.replace(/\b\w/g, (m) => m.toUpperCase())
    : "Customer";
}

function getStatusTone(status?: string | null) {
  const s = normalizeStatus(status);

  if (["requested", "pending", "new", "submitted"].includes(s)) {
    return {
      chip: "border-amber-300/20 bg-amber-500/10 text-amber-100",
      dot: "bg-amber-300",
      ring: "rgba(245,158,11,0.18)",
    };
  }

  if (["estimating", "approved", "scheduled"].includes(s)) {
    return {
      chip: "border-sky-300/20 bg-sky-500/10 text-sky-100",
      dot: "bg-sky-300",
      ring: "rgba(56,189,248,0.18)",
    };
  }

  if (["en_route", "on_site", "in_progress", "curing"].includes(s)) {
    return {
      chip: "border-violet-300/20 bg-violet-500/10 text-violet-100",
      dot: "bg-violet-300",
      ring: "rgba(168,85,247,0.18)",
    };
  }

  if (["completed", "paid"].includes(s)) {
    return {
      chip: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
      dot: "bg-emerald-300",
      ring: "rgba(16,185,129,0.18)",
    };
  }

  return {
    chip: "border-white/10 bg-white/[0.06] text-slate-100",
    dot: "bg-slate-300",
    ring: "rgba(255,255,255,0.08)",
  };
}

async function fetchAppointments(): Promise<AppointmentRow[]> {
  const { data, error, status } = await supabaseClient
    .from("appointments")
    .select(
  "id, created_at, status, service_type, scheduled_date, scheduled_time_start, scheduled_time_end, customer_email, service_address, estimate_amount, technician_email, location_type"
)
    .order("created_at", { ascending: false });

  if (status === 404) return [];
  if (error) throw error;
  return (data ?? []) as AppointmentRow[];
}

async function fetchTechnicians(): Promise<TechnicianRow[]> {
  const { data, error, status } = await supabaseClient
    .from("technicians")
    .select("id, email, full_name, tech_rating, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (status === 404) return [];
  if (error) throw error;
  return (data ?? []) as TechnicianRow[];
}

async function fetchCustomers(): Promise<CustomerRow[]> {
  const { data, error, status } = await supabaseClient
    .from("app_users")
    .select("id, email, full_name")
    .limit(5000);

  if (status === 404) return [];
  if (error) throw error;

  return (data ?? []) as CustomerRow[];
}

function PageGlow({
  className,
  delay = 0,
  reducedMotion = false,
}: {
  className: string;
  delay?: number;
  reducedMotion?: boolean;
}) {
  if (reducedMotion) return <div className={className} aria-hidden="true" />;

  return (
    <motion.div
      aria-hidden="true"
      className={className}
      initial={{ opacity: 0.45, scale: 0.98 }}
      animate={{
        opacity: [0.4, 0.7, 0.45],
        scale: [0.98, 1.06, 1],
        x: [0, 14, -8, 0],
        y: [0, -10, 8, 0],
      }}
      transition={{
        duration: 12,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

function GradientBorder({
  children,
  className = "",
  intensity = 0.92,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="pointer-events-none absolute -inset-[1.2px] rounded-[28px] blur-[4px]"
        style={{
          opacity: intensity,
          background:
            "conic-gradient(from 220deg at 50% 50%, rgba(255,255,255,0.12), rgba(56,189,248,0.45), rgba(168,85,247,0.24), rgba(16,185,129,0.18), rgba(255,255,255,0.12))",
        }}
      />
      <div className="relative rounded-[28px]">{children}</div>
    </div>
  );
}

function GlassShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,22,28,0.72),rgba(10,12,18,0.9)_38%,rgba(5,7,11,0.96))] shadow-[0_32px_120px_rgba(0,0,0,0.5),0_10px_40px_rgba(2,6,23,0.52),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(480px_220px_at_0%_0%,rgba(255,255,255,0.07),transparent_56%),radial-gradient(520px_260px_at_100%_0%,rgba(56,189,248,0.08),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/6 px-5 py-4 md:px-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
          {eyebrow}
        </p>
        <p className="mt-1 text-lg font-semibold text-slate-50">{title}</p>
      </div>
      {right}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  sub: string;
  accent: "cyan" | "emerald" | "violet" | "amber";
}) {
  const accentMap = {
    cyan: {
      bg: "bg-cyan-500/10",
      text: "text-cyan-300",
      ring: "from-cyan-500/18 to-sky-500/6",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      ring: "from-emerald-500/18 to-teal-500/6",
    },
    violet: {
      bg: "bg-violet-500/10",
      text: "text-violet-300",
      ring: "from-violet-500/18 to-fuchsia-500/6",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      ring: "from-amber-500/18 to-orange-500/6",
    },
  } as const;

  const a = accentMap[accent];

  return (
    <div className="relative">
      <div
        className={`pointer-events-none absolute -inset-px rounded-[28px] bg-gradient-to-br ${a.ring} blur-md`}
      />
      <GlassShell className="h-full">
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {label}
              </div>
              <div className="mt-3 text-3xl font-black tracking-tight text-slate-50">
                {value}
              </div>
              <div className="mt-2 text-sm text-slate-400">{sub}</div>
            </div>
            <div
              className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/10 ${a.bg}`}
            >
              <Icon className={`h-5 w-5 ${a.text}`} />
            </div>
          </div>
        </div>
      </GlassShell>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <GlassShell key={i}>
          <div className="animate-pulse p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/8" />
              </div>
              <div className="h-8 w-24 rounded-full bg-white/8" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="h-14 rounded-2xl bg-white/6" />
              <div className="h-14 rounded-2xl bg-white/6" />
              <div className="h-14 rounded-2xl bg-white/6" />
              <div className="h-14 rounded-2xl bg-white/6" />
            </div>
          </div>
        </GlassShell>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <GradientBorder>
      <GlassShell>
        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 shadow-[0_12px_30px_rgba(239,68,68,0.12)]">
            <AlertCircle className="h-7 w-7 text-red-300" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-50">
            Appointments failed to load
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slate-400">
            One or more appointment sources could not be retrieved. Refresh and
            try again.
          </p>
          <Button
            onClick={onRetry}
            className="mt-5 border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </GlassShell>
    </GradientBorder>
  );
}

export default function AdminAppointmentsPage() {
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilter>("all");

  const [page, setPage] = React.useState(1);
  const pageSize = 3;

  const appointmentsQuery = useQuery({
    queryKey: ["admin:appointments"],
    queryFn: fetchAppointments,
    staleTime: 15_000,
  });

  const techniciansQuery = useQuery({
    queryKey: ["admin:technicians"],
    queryFn: fetchTechnicians,
    staleTime: 60_000,
  });

  const customersQuery = useQuery({
  queryKey: ["admin:appointment_customers", "app_users"],
  queryFn: fetchCustomers,
  staleTime: 0,
});

  const appointments = appointmentsQuery.data ?? [];
  const technicians = techniciansQuery.data ?? [];
  const customers = customersQuery.data ?? [];

  const customerNameByEmail = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      const email = String(c.email ?? "").trim().toLowerCase();
      const name = String(c.full_name ?? "").trim();
      if (email && name) map.set(email, name);
    }
    return map;
  }, [customers]);

  const technicianByEmail = React.useMemo(() => {
    const map = new Map<string, TechnicianRow>();
    for (const tech of technicians) {
      const email = String(tech.email ?? "").trim().toLowerCase();
      if (email) map.set(email, tech);
    }
    return map;
  }, [technicians]);

const resolveCustomerName = React.useCallback(
  (apt: AppointmentRow) => {
    const appointmentEmail = String(apt.customer_email ?? "")
      .trim()
      .toLowerCase();

    const fromAppUsers = customerNameByEmail.get(appointmentEmail);

    if (fromAppUsers) return fromAppUsers;

    return emailNameFallback(apt.customer_email);
  },
  [customerNameByEmail]
);

  const assignTechMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      techEmail,
    }: {
      appointmentId: string;
      techEmail: string;
    }) => {
      const isUnassigned = techEmail === "unassigned";

      const { error } = await supabaseClient
        .from("appointments")
        .update({
          technician_email: isUnassigned ? null : techEmail,
          ...(isUnassigned ? {} : { status: "scheduled" }),
        })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin:appointments"] });
    },
    onError: (err) => {
      console.error("assignTech error", err);
    },
  });

  const enrichedAppointments = React.useMemo(() => {
    return appointments.map((apt) => {
      const customerName = resolveCustomerName(apt);
      const technician =
        technicianByEmail.get(String(apt.technician_email ?? "").toLowerCase()) ??
        null;

      return {
        ...apt,
        displayCustomerName: customerName,
        displayTechnicianName:
          String(technician?.full_name ?? "").trim() ||
          String(apt.technician_email ?? "").trim() ||
          "Unassigned",
      };
    });
  }, [appointments, resolveCustomerName, technicianByEmail]);

  const filteredAppointments = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return enrichedAppointments.filter((apt) => {
      const status = normalizeStatus(apt.status);

      const matchesSearch =
        q.length === 0 ||
        String(apt.displayCustomerName ?? "")
          .toLowerCase()
          .includes(q) ||
        String(apt.customer_email ?? "")
          .toLowerCase()
          .includes(q) ||
        String(apt.service_type ?? "")
          .toLowerCase()
          .includes(q) ||
        String(apt.service_address ?? "")
          .toLowerCase()
          .includes(q) ||
        String(apt.id ?? "")
          .toLowerCase()
          .includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "requested" &&
          ["requested", "pending", "new", "submitted", "estimating"].includes(
            status
          )) ||
        (statusFilter === "scheduled" &&
          ["approved", "scheduled", "en_route", "on_site"].includes(status)) ||
        (statusFilter === "in_progress" &&
          ["in_progress", "curing"].includes(status)) ||
        (statusFilter === "completed" &&
          ["completed", "paid"].includes(status));

      return matchesSearch && matchesStatus;
    });
  }, [enrichedAppointments, search, statusFilter]);

  const totalPages = Math.max(
  1,
  Math.ceil(filteredAppointments.length / pageSize)
);

const paginatedAppointments = React.useMemo(() => {
  const start = (page - 1) * pageSize;
  return filteredAppointments.slice(start, start + pageSize);
}, [filteredAppointments, page]);

React.useEffect(() => {
  setPage(1);
}, [search, statusFilter]);

  const requestedCount = React.useMemo(
    () =>
      enrichedAppointments.filter((apt) =>
        ["requested", "pending", "new", "submitted", "estimating"].includes(
          normalizeStatus(apt.status)
        )
      ).length,
    [enrichedAppointments]
  );

  const scheduledCount = React.useMemo(
    () =>
      enrichedAppointments.filter((apt) =>
        ["approved", "scheduled", "en_route", "on_site"].includes(
          normalizeStatus(apt.status)
        )
      ).length,
    [enrichedAppointments]
  );

  const inProgressCount = React.useMemo(
    () =>
      enrichedAppointments.filter((apt) =>
        ["in_progress", "curing"].includes(normalizeStatus(apt.status))
      ).length,
    [enrichedAppointments]
  );

  const completedCount = React.useMemo(
    () =>
      enrichedAppointments.filter((apt) =>
        ["completed", "paid"].includes(normalizeStatus(apt.status))
      ).length,
    [enrichedAppointments]
  );

  const unassignedCount = React.useMemo(
    () =>
      enrichedAppointments.filter(
        (apt) =>
          !apt.technician_email &&
          !["cancelled", "completed", "paid"].includes(normalizeStatus(apt.status))
      ).length,
    [enrichedAppointments]
  );

  const anyLoading =
    appointmentsQuery.isLoading ||
    techniciansQuery.isLoading ||
    customersQuery.isLoading;

  const anyError =
    appointmentsQuery.isError ||
    techniciansQuery.isError ||
    customersQuery.isError;

  const refetchAll = React.useCallback(() => {
    appointmentsQuery.refetch();
    techniciansQuery.refetch();
    customersQuery.refetch();
  }, [appointmentsQuery, techniciansQuery, customersQuery]);

  if (anyError) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-slate-100 md:px-8 md:py-10">
        <ErrorState onRetry={refetchAll} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0 bg-[radial-gradient(1000px_620px_at_8%_0%,rgba(56,189,248,0.16),transparent_48%),radial-gradient(980px_640px_at_92%_100%,rgba(34,197,94,0.10),transparent_48%),radial-gradient(700px_480px_at_50%_0%,rgba(168,85,247,0.08),transparent_52%),linear-gradient(180deg,rgba(5,9,19,1),rgba(4,8,16,1))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.08]" />
        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.92%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.32%22/></svg>')",
          }}
        />
        <PageGlow
          reducedMotion={!!prefersReducedMotion}
          className="absolute left-[-10%] top-[4%] h-[24rem] w-[24rem] rounded-full bg-cyan-400/12 blur-3xl"
        />
        <PageGlow
          reducedMotion={!!prefersReducedMotion}
          delay={0.8}
          className="absolute right-[-8%] top-[16%] h-[20rem] w-[20rem] rounded-full bg-emerald-400/10 blur-3xl"
        />
        <PageGlow
          reducedMotion={!!prefersReducedMotion}
          delay={1.4}
          className="absolute bottom-[-10%] left-[22%] h-[18rem] w-[18rem] rounded-full bg-violet-500/10 blur-3xl"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mb-8"
        >
          <GradientBorder>
            <GlassShell className="overflow-hidden">
              <div className="grid gap-6 px-5 py-6 md:grid-cols-[1.2fr_0.8fr] md:px-7 md:py-7">
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/22 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <UserIcon className="h-3.5 w-3.5" />
                    Admin · Dispatch Hub
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-50 md:text-[2.5rem]">
                    Manage Appointments
                  </h1>
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Unassigned
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-50">
                        {unassignedCount}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Waiting for routing
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Completed
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-50">
                        {completedCount}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Completed / paid
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassShell>
          </GradientBorder>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={ClipboardList}
            label="All Jobs"
            value={String(enrichedAppointments.length)}
            sub="Total appointment records"
            accent="cyan"
          />
          <StatCard
            icon={Siren}
            label="Requested"
            value={String(requestedCount)}
            sub="New / estimating jobs"
            accent="amber"
          />
          <StatCard
            icon={Wrench}
            label="Scheduled"
            value={String(scheduledCount + inProgressCount)}
            sub="Scheduled + active field work"
            accent="violet"
          />
          <StatCard
            icon={CheckCircle2}
            label="Finished"
            value={String(completedCount)}
            sub="Completed or paid jobs"
            accent="emerald"
          />
        </div>

        <div className="mt-6">
          <GradientBorder>
            <GlassShell>
              <SectionHeader
                eyebrow="Filters"
                title="Search and route appointments"
                right={
                  <div className="text-xs text-slate-400">
                    {filteredAppointments.length} visible
                  </div>
                }
              />

              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                      <Input
                        placeholder="Search by customer name, email, service, location, or ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-white/10 bg-slate-950/70 pl-10 text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <Tabs
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                    className="w-full xl:w-auto"
                  >
                    <TabsList className="grid w-full grid-cols-5 rounded-2xl border border-white/10 bg-slate-950/80 p-1 xl:w-auto">
                      <TabsTrigger value="all" className="rounded-xl text-xs">
                        All
                      </TabsTrigger>
                      <TabsTrigger value="requested" className="rounded-xl text-xs">
                        Requested
                      </TabsTrigger>
                      <TabsTrigger value="scheduled" className="rounded-xl text-xs">
                        Scheduled
                      </TabsTrigger>
                      <TabsTrigger value="in_progress" className="rounded-xl text-xs">
                        In Progress
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="rounded-xl text-xs">
                        Completed
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </GlassShell>
          </GradientBorder>
        </div>

        <div className="mt-6">
          {anyLoading ? (
            <LoadingState />
          ) : filteredAppointments.length === 0 ? (
            <GradientBorder>
              <GlassShell>
                <div className="py-16 text-center">
                  <Calendar className="mx-auto mb-4 h-16 w-16 text-slate-500" />
                  <h3 className="mb-2 text-xl font-semibold text-slate-100">
                    No Appointments Found
                  </h3>
                  <p className="text-slate-300">
                    Try adjusting your filters or check another day.
                  </p>
                </div>
              </GlassShell>
            </GradientBorder>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {paginatedAppointments.map((apt) => {
                  const tone = getStatusTone(apt.status);
                  const assignedTech = technicianByEmail.get(
                    String(apt.technician_email ?? "").toLowerCase()
                  );

                  return (
                    <motion.div
                      key={apt.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    >
                      <div
                        className="rounded-[28px]"
                        style={{
                          boxShadow: `0 24px 80px rgba(0,0,0,0.42), 0 0 0 1px ${tone.ring}`,
                        }}
                      >
                        <GlassShell className="overflow-hidden">
                          <Card className="border-0 bg-transparent shadow-none">
                            <CardContent className="p-5 md:p-6">
                              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-xl font-black tracking-tight text-white md:text-[1.35rem]">
                                          {niceLabel(apt.service_type)}
                                        </h3>

                                        <Badge
                                          className={`border shadow-sm ${tone.chip}`}
                                        >
                                          <span
                                            className={`mr-2 inline-block h-2 w-2 rounded-full ${tone.dot}`}
                                          />
                                          {niceLabel(apt.status)}
                                        </Badge>

                                        {!apt.technician_email &&
                                          !["cancelled", "completed", "paid"].includes(
                                            normalizeStatus(apt.status)
                                          ) && (
                                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-100">
                                              <Siren className="h-3.5 w-3.5" />
                                              Needs Route
                                            </span>
                                          )}
                                      </div>

                                      <p className="mt-2 text-xs text-slate-400">
                                        Appointment ID: {String(apt.id).slice(0, 8)}
                                      </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">
                                      <Link href={`/admin/portal/appointments/${apt.id}`}>
                                        <Button
                                          variant="outline"
                                          className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                                        >
                                          View Details
                                          <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                      </Link>
                                    </div>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                                        <UserRound className="h-3.5 w-3.5 text-sky-300" />
                                        Customer
                                      </div>
                                      <div className="text-sm font-semibold text-slate-50">
                                        {apt.displayCustomerName}
                                      </div>
                                      <div className="mt-1 break-all text-xs text-slate-400">
                                        {apt.customer_email || "No email"}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                                        <Clock3 className="h-3.5 w-3.5 text-violet-300" />
                                        Scheduled
                                      </div>
                                      <div className="text-sm font-semibold text-slate-50">
                                        {formatWhen(apt)}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400">
                                        {apt.location_type
                                          ? niceLabel(apt.location_type)
                                          : "Appointment timing"}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                                        <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                                        Location
                                      </div>
                                      <div className="text-sm font-semibold text-slate-50">
                                        {apt.service_address
                                          ? String(apt.service_address)
                                              .split(",")
                                              .slice(0, 2)
                                              .join(",")
                                          : "No address"}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400">
                                        Service destination
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                                        <DollarSign className="h-3.5 w-3.5 text-amber-300" />
                                        Estimate
                                      </div>
                                      <div className="text-sm font-semibold text-emerald-300">
                                        {formatMoney(apt.estimate_amount)}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400">
                                        Estimated ticket value
                                      </div>
                                    </div>
                                  </div>

                                  {!apt.technician_email &&
                                    normalizeStatus(apt.status) !== "cancelled" && (
                                      <div className="mt-4 rounded-[22px] border border-white/10 bg-[linear-gradient(90deg,rgba(15,23,42,0.72),rgba(30,41,59,0.58),rgba(8,47,73,0.42))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                          <div className="flex items-center gap-2 text-sm text-slate-200">
                                            <Filter className="h-4 w-4 text-sky-300" />
                                            <span className="font-medium">
                                              Route this job to a technician
                                            </span>
                                          </div>
                                          <div className="text-xs text-slate-400">
                                            Assigning a tech moves this job to
                                            scheduled
                                          </div>
                                        </div>

                                        <select
                                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 sm:w-[320px]"
                                          value={apt.technician_email ?? "unassigned"}
                                          disabled={assignTechMutation.isPending}
                                          onChange={(e) =>
                                            assignTechMutation.mutate({
                                              appointmentId: apt.id,
                                              techEmail: e.target.value,
                                            })
                                          }
                                        >
                                          <option value="unassigned">
                                            — Unassigned —
                                          </option>
                                          {technicians.map((tech) => (
                                            <option
                                              key={tech.id}
                                              value={tech.email ?? ""}
                                            >
                                              {tech.full_name || tech.email}
                                              {tech.tech_rating
                                                ? ` (★${Number(
                                                    tech.tech_rating
                                                  ).toFixed(1)})`
                                                : ""}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}

                                  {apt.technician_email && (
                                    <div className="mt-4 rounded-[22px] border border-emerald-300/16 bg-[linear-gradient(90deg,rgba(6,78,59,0.18),rgba(7,89,133,0.14),rgba(2,6,23,0.34))] p-4">
                                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-emerald-200">
                                        <Wrench className="h-3.5 w-3.5" />
                                        Assigned Technician
                                      </div>
                                      <div className="text-sm font-semibold text-emerald-50">
                                        {String(assignedTech?.full_name ?? "").trim() ||
                                          String(apt.displayTechnicianName)}
                                      </div>
                                      <div className="mt-1 break-all text-xs text-emerald-200/80">
                                        {apt.technician_email}
                                      </div>
                                      {assignedTech?.tech_rating ? (
                                        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100">
                                          <Star className="h-3.5 w-3.5" />
                                          {Number(assignedTech.tech_rating).toFixed(1)} rating
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </GlassShell>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {filteredAppointments.length > pageSize && (
  <div className="mt-6 flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <Button
      variant="outline"
      disabled={page <= 1}
      onClick={() => setPage(1)}
      className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08] disabled:opacity-40"
    >
      First
    </Button>

    <div className="flex flex-wrap items-center justify-center gap-2">
      {Array.from({ length: totalPages }).map((_, i) => {
        const pageNumber = i + 1;
        const isActive = pageNumber === page;

        return (
          <Button
            key={pageNumber}
            variant="outline"
            onClick={() => setPage(pageNumber)}
            className={`h-9 min-w-9 border-white/10 px-3 text-sm ${
              isActive
                ? "bg-cyan-300/20 text-cyan-100"
                : "bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
            }`}
          >
            {pageNumber}
          </Button>
        );
      })}
    </div>

    <Button
      variant="outline"
      disabled={page >= totalPages}
      onClick={() => setPage(totalPages)}
      className="border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08] disabled:opacity-40"
    >
      Last
    </Button>
  </div>
)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}