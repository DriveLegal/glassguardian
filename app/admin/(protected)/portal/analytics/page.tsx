// app/admin/(protected)/portal/analytics/page.tsx
"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { motion, useReducedMotion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  DollarSign,
  Users,
  Calendar as CalendarIcon,
  Target,
  Award,
  AlertCircle,
  Activity,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
  Wallet,
  Clock3,
  CheckCircle2,
  Star,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ---------------------------------- Types ---------------------------------- */
type Appointment = {
  id: string;
  status?: string | null;
  service_type?: string | null;
  scheduled_date?: string | null; // ISO date (YYYY-MM-DD)
  created_at?: string | null;
};

type Invoice = {
  id: string;
  invoice_number?: string | null;
  customer_email?: string | null;
  technician_email?: string | null;
  invoice_date?: string | null;
  status?: string | null;
  subtotal_cents?: number | null;
  total_cents?: number | null;
  final_paid_cents?: number | null;
  insurance_due_cents?: number | null;
  customer_due_cents?: number | null;
  paid_at?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
};

type User = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  phone?: string | null;
  tech_rating?: number | string | null;
  created_at?: string | null;
};

type Warranty = {
  id: string;
  status?: string | null;
};

type TimeRange = "7days" | "30days" | "90days" | "1year";

const COLORS = [
  "#38bdf8",
  "#22c55e",
  "#facc15",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
];

/* ------------------------------- Data Fetchers ------------------------------ */
function useAppointments() {
  return useQuery({
    queryKey: ["analytics:appointments"],
    queryFn: async () => {
      const { data, error, status } = await supabaseClient
        .from("appointments")
        .select("id, status, service_type, scheduled_date, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (status === 404) return [];
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
    staleTime: 15_000,
  });
}

function useInvoices() {
  return useQuery({
    queryKey: ["analytics:invoices"],
    queryFn: async () => {
      const { data, error, status } = await supabaseClient
        .from("tech_invoices")
        .select(
          "id, customer_email, invoice_number, technician_email, invoice_date, status, subtotal_cents, total_cents, payment_method, created_at, final_paid_cents, insurance_due_cents, customer_due_cents, paid_at"
        )
        .order("invoice_date", { ascending: false })
        .limit(2000);

      if (status === 404) return [];
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    staleTime: 15_000,
  });
}

function useCustomers() {
  return useQuery({
    queryKey: ["analytics:customers"],
    queryFn: async () => {
      const { data, error, status } = await supabaseClient
        .from("users_public")
        .select("id, email, full_name, role, phone, tech_rating, created_at")
        .eq("role", "customer")
        .limit(5000);

      if (status === 404) return [];
      if (error) throw error;
      return (data ?? []) as User[];
    },
    staleTime: 15_000,
  });
}

function useTechnicians() {
  return useQuery({
    queryKey: ["analytics:technicians"],
    queryFn: async () => {
      const { data, error, status } = await supabaseClient
        .from("users_public")
        .select("id, email, full_name, role, phone, tech_rating, created_at")
        .eq("role", "technician")
        .limit(5000);

      if (status === 404) return [];
      if (error) throw error;
      return (data ?? []) as User[];
    },
    staleTime: 15_000,
  });
}

function useWarranties() {
  return useQuery({
    queryKey: ["analytics:warranties"],
    queryFn: async () => {
      const { data, error, status } = await supabaseClient
        .from("warranties")
        .select("id, status")
        .limit(3000);

      if (status === 404) return [];
      if (error) throw error;
      return (data ?? []) as Warranty[];
    },
    staleTime: 15_000,
  });
}

/* --------------------------------- Helpers --------------------------------- */
function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(n) ? n : 0);
}

function monthKeyFromISO(isoDate?: string | null) {
  if (!isoDate) return null;
  const raw = String(isoDate).slice(0, 7);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

function shortMonthLabel(keyYYYYMM: string) {
  try {
    return new Date(`${keyYYYYMM}-01T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
    });
  } catch {
    return keyYYYYMM;
  }
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysForRange(range: TimeRange) {
  switch (range) {
    case "7days":
      return 7;
    case "30days":
      return 30;
    case "90days":
      return 90;
    case "1year":
      return 365;
    default:
      return 30;
  }
}

function getRangeStart(range: TimeRange) {
  const d = startOfToday();
  d.setDate(d.getDate() - (daysForRange(range) - 1));
  return d;
}

function safeDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isOnOrAfterRange(value: string | null | undefined, range: TimeRange) {
  const d = safeDate(value);
  if (!d) return false;
  return d >= getRangeStart(range);
}

function normalizeStatus(status?: string | null) {
  return String(status || "unknown").trim().toLowerCase();
}

function niceLabel(v?: string | null) {
  const s = String(v || "unknown").trim();
  if (!s) return "Unknown";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function calcTrend(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

function trendLabel(value: number, suffix = "%") {
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${value >= 0 ? "+" : ""}${rounded}${suffix}`;
}

function tooltipStyle() {
  return {
    backgroundColor: "rgba(7,12,24,0.96)",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.25)",
    color: "#e5e7eb",
    boxShadow: "0 18px 40px rgba(2,6,23,0.72)",
    backdropFilter: "blur(12px)",
  };
}

function invoiceDollars(inv: Invoice) {
  const cents =
    typeof inv.final_paid_cents === "number"
      ? inv.final_paid_cents
      : typeof inv.total_cents === "number"
      ? inv.total_cents
      : 0;
  return cents / 100;
}

function invoiceIsPaid(inv: Invoice) {
  const s = normalizeStatus(inv.status);
  return s === "paid" || s === "completed" || !!inv.paid_at;
}

/* ----------------------------- Shared UI Shells ---------------------------- */
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
        x: [0, 16, -8, 0],
        y: [0, -12, 8, 0],
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="pointer-events-none absolute -inset-[1.2px] rounded-[28px] opacity-90 blur-[3px]"
        style={{
          background:
            "conic-gradient(from 210deg at 50% 50%, rgba(56,189,248,0.9), rgba(34,197,94,0.12), rgba(168,85,247,0.65), rgba(245,158,11,0.16), rgba(56,189,248,0.9))",
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
      className={`relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,30,0.88),rgba(4,9,19,0.94))] shadow-[0_28px_90px_rgba(2,6,23,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_180px_at_0%_0%,rgba(255,255,255,0.08),transparent_58%),radial-gradient(420px_220px_at_100%_0%,rgba(56,189,248,0.08),transparent_52%)]" />
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

function EmptyState({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <Icon className="h-6 w-6 text-slate-300" />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <div className="mt-1 max-w-sm text-xs text-slate-400">{subtitle}</div>
      </div>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <GlassShell className="overflow-hidden">
      <div className="animate-pulse p-5">
        <div className="mb-3 h-3 w-28 rounded bg-white/8" />
        <div className="h-8 w-36 rounded bg-white/10" />
        <div className="mt-6 h-20 rounded-2xl bg-white/5" />
      </div>
      <div className="border-t border-white/6 px-5 py-3 text-xs text-slate-400">
        Loading {label}…
      </div>
    </GlassShell>
  );
}

function QueryError({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <GradientBorder>
      <GlassShell>
        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 shadow-[0_12px_30px_rgba(239,68,68,0.12)]">
            <AlertCircle className="h-7 w-7 text-red-300" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-50">
            Analytics failed to load
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slate-400">
            One or more analytics sources could not be retrieved. Refresh and
            try again.
          </p>
          <button
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/16"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </GlassShell>
    </GradientBorder>
  );
}

function TrendChip({
  value,
  positiveGood = true,
}: {
  value: number;
  positiveGood?: boolean;
}) {
  const up = value >= 0;
  const good = positiveGood ? up : !up;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
        good
          ? "bg-emerald-500/12 text-emerald-100"
          : "bg-amber-500/14 text-amber-100",
      ].join(" ")}
    >
      {trendLabel(value)}
    </span>
  );
}

function GlassStatCard({
  icon: Icon,
  label,
  value,
  chip,
  accent,
  subtext,
  delay = 0,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  chip: React.ReactNode;
  subtext?: string;
  accent: "cyan" | "emerald" | "violet" | "amber";
  delay?: number;
}) {
  const accents = {
    cyan: {
      ring: "from-cyan-500/20 to-sky-500/10",
      icon: "text-cyan-300",
      iconBg: "bg-cyan-500/10",
    },
    emerald: {
      ring: "from-emerald-500/20 to-teal-500/10",
      icon: "text-emerald-300",
      iconBg: "bg-emerald-500/10",
    },
    violet: {
      ring: "from-violet-500/20 to-fuchsia-500/10",
      icon: "text-violet-300",
      iconBg: "bg-violet-500/10",
    },
    amber: {
      ring: "from-amber-400/25 to-orange-500/10",
      icon: "text-amber-300",
      iconBg: "bg-amber-500/10",
    },
  } as const;

  const a = accents[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 240, damping: 22 }}
      whileHover={{ y: -3, scale: 1.01 }}
      className="relative"
    >
      <div
        className={`pointer-events-none absolute -inset-px rounded-[28px] bg-gradient-to-br ${a.ring} opacity-90 blur-md`}
      />
      <GlassShell className="relative h-full">
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 ${a.iconBg}`}
              >
                <Icon className={`h-5 w-5 ${a.icon}`} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  {label}
                </div>
                {subtext && (
                  <div className="mt-1 text-xs text-slate-500">{subtext}</div>
                )}
              </div>
            </div>
            {chip}
          </div>

          <div className="mt-5 text-3xl font-black tracking-tight text-slate-50 md:text-[2rem]">
            {value}
          </div>
        </div>
      </GlassShell>
    </motion.div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  hint,
  accent = "cyan",
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  hint: React.ReactNode;
  accent?: "cyan" | "emerald" | "amber";
}) {
  const styleMap = {
    cyan: "text-cyan-300 bg-cyan-500/10",
    emerald: "text-emerald-300 bg-emerald-500/10",
    amber: "text-amber-300 bg-amber-500/10",
  } as const;

  return (
    <GlassShell>
      <div className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`grid h-10 w-10 place-items-center rounded-2xl border border-white/10 ${styleMap[accent]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-slate-50">{label}</div>
        </div>

        <div className="flex items-end gap-3">
          <div className="text-4xl font-black tracking-tight text-slate-50">
            {value}
          </div>
          {hint}
        </div>
      </div>
    </GlassShell>
  );
}

/* --------------------------------- Page ------------------------------------ */
export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30days");
  const prefersReducedMotion = useReducedMotion();

  const appointmentsQuery = useAppointments();
  const invoicesQuery = useInvoices();
  const customersQuery = useCustomers();
  const techniciansQuery = useTechnicians();
  const warrantiesQuery = useWarranties();

  const appointments = appointmentsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const technicians = techniciansQuery.data ?? [];
  const warranties = warrantiesQuery.data ?? [];

  const anyLoading =
    appointmentsQuery.isLoading ||
    invoicesQuery.isLoading ||
    customersQuery.isLoading ||
    techniciansQuery.isLoading ||
    warrantiesQuery.isLoading;

  const anyError =
    appointmentsQuery.isError ||
    invoicesQuery.isError ||
    customersQuery.isError ||
    techniciansQuery.isError ||
    warrantiesQuery.isError;

  const refetchAll = React.useCallback(() => {
    appointmentsQuery.refetch();
    invoicesQuery.refetch();
    customersQuery.refetch();
    techniciansQuery.refetch();
    warrantiesQuery.refetch();
  }, [
    appointmentsQuery,
    invoicesQuery,
    customersQuery,
    techniciansQuery,
    warrantiesQuery,
  ]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) =>
      isOnOrAfterRange(a.scheduled_date || a.created_at, timeRange)
    );
  }, [appointments, timeRange]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) =>
      isOnOrAfterRange(i.invoice_date || i.paid_at || i.created_at, timeRange)
    );
  }, [invoices, timeRange]);

  const previousAppointments = useMemo(() => {
    const start = getRangeStart(timeRange);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysForRange(timeRange));
    return appointments.filter((a) => {
      const d = safeDate(a.scheduled_date || a.created_at);
      return !!d && d >= prevStart && d < start;
    });
  }, [appointments, timeRange]);

  const previousInvoices = useMemo(() => {
    const start = getRangeStart(timeRange);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysForRange(timeRange));
    return invoices.filter((i) => {
      const d = safeDate(i.invoice_date || i.paid_at || i.created_at);
      return !!d && d >= prevStart && d < start;
    });
  }, [invoices, timeRange]);

  const totalRevenue = useMemo(() => {
    return filteredInvoices
      .filter(invoiceIsPaid)
      .reduce((sum, inv) => sum + invoiceDollars(inv), 0);
  }, [filteredInvoices]);

  const completedAppointments = useMemo(() => {
    return filteredAppointments.filter((a) =>
      ["completed", "paid"].includes(normalizeStatus(a.status))
    );
  }, [filteredAppointments]);

  const previousCompletedAppointments = useMemo(() => {
    return previousAppointments.filter((a) =>
      ["completed", "paid"].includes(normalizeStatus(a.status))
    );
  }, [previousAppointments]);

  const conversionRate = useMemo(() => {
    return percent(completedAppointments.length, filteredAppointments.length);
  }, [completedAppointments.length, filteredAppointments.length]);

  const previousConversionRate = useMemo(() => {
    return percent(
      previousCompletedAppointments.length,
      previousAppointments.length
    );
  }, [previousCompletedAppointments.length, previousAppointments.length]);

  const avgTicket = useMemo(() => {
    const paidCount = filteredInvoices.filter(invoiceIsPaid).length;
    return totalRevenue / Math.max(paidCount, 1);
  }, [totalRevenue, filteredInvoices]);

  const previousRevenue = useMemo(() => {
    return previousInvoices
      .filter(invoiceIsPaid)
      .reduce((sum, inv) => sum + invoiceDollars(inv), 0);
  }, [previousInvoices]);

  const previousAvgTicket = useMemo(() => {
    const prevPaidCount = previousInvoices.filter(invoiceIsPaid).length;
    return previousRevenue / Math.max(prevPaidCount, 1);
  }, [previousRevenue, previousInvoices]);

  const avgRating = useMemo(() => {
    if (!technicians.length) return 0;
    return (
      technicians.reduce((sum, tech) => sum + (Number(tech.tech_rating) || 0), 0) /
      technicians.length
    );
  }, [technicians]);

  const ratedTechniciansCount = useMemo(() => {
    return technicians.filter((t) => Number(t.tech_rating) > 0).length;
  }, [technicians]);

  const warrantyClaimCount = useMemo(() => {
    return warranties.filter((w) => normalizeStatus(w.status) === "claimed")
      .length;
  }, [warranties]);

  const warrantyClaimRate = useMemo(() => {
    return percent(warrantyClaimCount, warranties.length);
  }, [warrantyClaimCount, warranties.length]);

  const paidInvoicesCount = useMemo(() => {
    return filteredInvoices.filter(invoiceIsPaid).length;
  }, [filteredInvoices]);

  const totalInvoicesCount = filteredInvoices.length;

  const revenueTrend = calcTrend(totalRevenue, previousRevenue);
  const appointmentTrend = calcTrend(
    filteredAppointments.length,
    previousAppointments.length
  );
  const avgTicketTrend = calcTrend(avgTicket, previousAvgTicket);
  const conversionTrend = calcTrend(conversionRate, previousConversionRate);

  const serviceTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const apt of filteredAppointments) {
      const key = niceLabel(apt.service_type || "Unknown");
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAppointments]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const apt of filteredAppointments) {
      const key = niceLabel(apt.status || "Unknown");
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAppointments]);

  const revenueChartData = useMemo(() => {
    const monthly: Record<string, number> = {};
    for (const inv of invoices) {
      const sourceDate = inv.invoice_date || inv.paid_at || inv.created_at;
      if (!isOnOrAfterRange(sourceDate, timeRange)) continue;
      if (!invoiceIsPaid(inv)) continue;
      const key = monthKeyFromISO(sourceDate);
      if (!key) continue;
      monthly[key] = (monthly[key] || 0) + invoiceDollars(inv);
    }

    return Object.entries(monthly)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-12)
      .map(([month, revenue]) => ({
        month: shortMonthLabel(month),
        revenue,
      }));
  }, [invoices, timeRange]);

  const dailyAppointments = useMemo(() => {
    const length = timeRange === "7days" ? 7 : timeRange === "30days" ? 10 : 12;
    const start = getRangeStart(timeRange);
    const dates = Array.from({ length }, (_, i) => {
      const d = new Date(start);
      const interval =
        timeRange === "7days" ? i : timeRange === "30days" ? i * 3 : i * 8;
      d.setDate(d.getDate() + interval);
      return d;
    });

    return dates.map((d, index) => {
      const next = new Date(d);
      if (timeRange === "7days") next.setDate(next.getDate() + 1);
      else if (timeRange === "30days") next.setDate(next.getDate() + 3);
      else next.setDate(next.getDate() + 8);

      const count = filteredAppointments.filter((a) => {
        const dt = safeDate(a.scheduled_date || a.created_at);
        return !!dt && dt >= d && dt < next;
      }).length;

      const label =
        timeRange === "7days"
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : timeRange === "30days"
          ? `P${index + 1}`
          : d.toLocaleDateString("en-US", { month: "short" });

      return {
        date: label,
        count,
      };
    });
  }, [filteredAppointments, timeRange]);

  const paymentMethodData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of filteredInvoices) {
      const key = niceLabel(inv.payment_method || "Unknown");
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredInvoices]);

  const topService = serviceTypeData[0]?.name ?? "No data";
  const topServiceCount = serviceTypeData[0]?.value ?? 0;

  const topStatus = statusData[0]?.name ?? "No data";
  const topStatusCount = statusData[0]?.value ?? 0;

  if (anyError) {
    return <QueryError onRetry={refetchAll} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0 bg-[radial-gradient(1000px_620px_at_8%_0%,rgba(56,189,248,0.18),transparent_48%),radial-gradient(980px_640px_at_92%_100%,rgba(34,197,94,0.12),transparent_48%),radial-gradient(700px_480px_at_50%_0%,rgba(168,85,247,0.09),transparent_52%),linear-gradient(180deg,rgba(5,9,19,1),rgba(4,8,16,1))]" />
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
          delay={1.5}
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
                    <BarChart3 className="h-3.5 w-3.5" />
                    Analytics Command Center
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-50 md:text-[2.5rem]">
                    Glass Guardian Analytics
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-[15px]">
                    Product-ready executive view of revenue, appointment
                    movement, service mix, warranty performance, and customer
                    activity across your admin portal.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
                      Real portal data
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      <Activity className="h-3.5 w-3.5 text-emerald-300" />
                      Live operational visibility
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                      Range-aware metrics
                    </span>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                      Time range
                    </div>
                    <Tabs
                      value={timeRange}
                      onValueChange={(v) => setTimeRange(v as TimeRange)}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-4 rounded-2xl border border-white/10 bg-slate-950/80 p-1">
                        <TabsTrigger value="7days" className="rounded-xl text-xs">
                          7d
                        </TabsTrigger>
                        <TabsTrigger value="30days" className="rounded-xl text-xs">
                          30d
                        </TabsTrigger>
                        <TabsTrigger value="90days" className="rounded-xl text-xs">
                          90d
                        </TabsTrigger>
                        <TabsTrigger value="1year" className="rounded-xl text-xs">
                          1y
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Top service
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-100">
                        {topService}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {fmtInt(topServiceCount)} jobs
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Top status
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-100">
                        {topStatus}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {fmtInt(topStatusCount)} items
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                        Refresh
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Pull latest analytics snapshot
                      </div>
                    </div>
                    <button
                      onClick={refetchAll}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/16"
                    >
                      <RefreshCw
                        className={[
                          "h-4 w-4",
                          anyLoading ? "animate-spin" : "",
                        ].join(" ")}
                      />
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </GlassShell>
          </GradientBorder>
        </motion.div>

        {anyLoading ? (
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <LoadingCard label="revenue" />
              <LoadingCard label="appointments" />
              <LoadingCard label="customers" />
              <LoadingCard label="ratings" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <LoadingCard label="revenue trend" />
              <LoadingCard label="activity chart" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <GlassStatCard
                icon={Wallet}
                label="Total Revenue"
                value={fmtUSD(totalRevenue)}
                subtext="Paid / completed tech invoices in selected range"
                chip={<TrendChip value={revenueTrend} />}
                accent="emerald"
                delay={0.02}
              />
              <GlassStatCard
                icon={CalendarIcon}
                label="Appointments"
                value={fmtInt(filteredAppointments.length)}
                subtext="Scheduled volume in selected range"
                chip={<TrendChip value={appointmentTrend} />}
                accent="cyan"
                delay={0.05}
              />
              <GlassStatCard
                icon={Users}
                label="Active Customers"
                value={fmtInt(customers.length)}
                subtext="Customer profiles currently stored"
                chip={
                  <span className="inline-flex rounded-full bg-violet-500/12 px-2.5 py-1 text-[11px] text-violet-100">
                    Live base
                  </span>
                }
                accent="violet"
                delay={0.08}
              />
              <GlassStatCard
                icon={Star}
                label="Average Rating"
                value={avgRating.toFixed(1)}
                subtext="Average technician rating from users_public"
                chip={
                  <span className="inline-flex rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] text-amber-100">
                    {fmtInt(ratedTechniciansCount)} rated techs
                  </span>
                }
                accent="amber"
                delay={0.11}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <GradientBorder>
                <GlassShell>
                  <SectionHeader
                    eyebrow="Revenue"
                    title="Revenue trend"
                    right={
                      <div className="text-xs text-slate-400">
                        {timeRange === "7days"
                          ? "Last 7 days"
                          : timeRange === "30days"
                          ? "Last 30 days"
                          : timeRange === "90days"
                          ? "Last 90 days"
                          : "Last 12 months"}
                      </div>
                    }
                  />

                  <div className="p-4 md:p-6">
                    {revenueChartData.length === 0 ? (
                      <EmptyState
                        icon={DollarSign}
                        title="No revenue data"
                        subtitle="Revenue will appear here once paid or completed invoices fall within the selected time range."
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={340}>
                        <AreaChart data={revenueChartData}>
                          <defs>
                            <linearGradient id="ggRevenueFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                              <stop offset="85%" stopColor="#38bdf8" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="month" stroke="#94a3b8" />
                          <YAxis
                            stroke="#94a3b8"
                            tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle()}
                            formatter={(value: number) => fmtUSD(value)}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            name="Revenue"
                            stroke="#38bdf8"
                            strokeWidth={2.8}
                            fill="url(#ggRevenueFill)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </GlassShell>
              </GradientBorder>

              <div className="grid gap-6">
                <MiniMetric
                  icon={Target}
                  label="Conversion rate"
                  value={`${conversionRate.toFixed(1)}%`}
                  accent="cyan"
                  hint={<TrendChip value={conversionTrend} />}
                />
                <MiniMetric
                  icon={DollarSign}
                  label="Average ticket"
                  value={fmtUSD(avgTicket)}
                  accent="emerald"
                  hint={<TrendChip value={avgTicketTrend} />}
                />
                <MiniMetric
                  icon={AlertCircle}
                  label="Warranty claim rate"
                  value={`${warrantyClaimRate.toFixed(1)}%`}
                  accent="amber"
                  hint={
                    <span className="inline-flex rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] text-amber-100">
                      {fmtInt(warrantyClaimCount)} claimed
                    </span>
                  }
                />
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <GradientBorder>
                <GlassShell>
                  <SectionHeader
                    eyebrow="Mix"
                    title="Service type distribution"
                    right={
                      <div className="text-xs text-slate-400">
                        {fmtInt(filteredAppointments.length)} total jobs
                      </div>
                    }
                  />
                  <div className="p-4 md:p-6">
                    {serviceTypeData.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="No service mix data"
                        subtitle="Once appointments are present in the selected range, service distribution will render here."
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={serviceTypeData}
                            cx="50%"
                            cy="50%"
                            outerRadius={105}
                            innerRadius={54}
                            paddingAngle={3}
                            labelLine={false}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, value }) => {
                              const total =
                                serviceTypeData.reduce((s, d) => s + d.value, 0) || 1;
                              const pct = Math.round((Number(value || 0) / total) * 100);
                              return `${name} ${pct}%`;
                            }}
                          >
                            {serviceTypeData.map((_, index) => (
                              <Cell
                                key={`service-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle()} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </GlassShell>
              </GradientBorder>

              <GradientBorder>
                <GlassShell>
                  <SectionHeader
                    eyebrow="Flow"
                    title="Appointment volume"
                    right={
                      <div className="text-xs text-slate-400">
                        Adaptive to selected range
                      </div>
                    }
                  />
                  <div className="p-4 md:p-6">
                    {dailyAppointments.every((d) => d.count === 0) ? (
                      <EmptyState
                        icon={Clock3}
                        title="No appointment activity"
                        subtitle="Appointment volume will populate here when scheduled items fall into the selected range."
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dailyAppointments}>
                          <defs>
                            <linearGradient id="ggBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#a855f7" />
                              <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="date" stroke="#94a3b8" />
                          <YAxis allowDecimals={false} stroke="#94a3b8" />
                          <Tooltip contentStyle={tooltipStyle()} />
                          <Bar
                            dataKey="count"
                            name="Appointments"
                            fill="url(#ggBarGradient)"
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </GlassShell>
              </GradientBorder>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <GradientBorder>
                <GlassShell>
                  <SectionHeader
                    eyebrow="Pipeline"
                    title="Appointment status distribution"
                    right={
                      <div className="text-xs text-slate-400">
                        {fmtInt(statusData.length)} statuses
                      </div>
                    }
                  />
                  <div className="p-4 md:p-6">
                    {statusData.length === 0 ? (
                      <EmptyState
                        icon={CheckCircle2}
                        title="No status data"
                        subtitle="Appointment statuses will appear here after records are available in range."
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={340}>
                        <BarChart data={statusData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis type="number" stroke="#94a3b8" />
                          <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#94a3b8"
                            width={150}
                          />
                          <Tooltip contentStyle={tooltipStyle()} />
                          <Bar
                            dataKey="value"
                            name="Appointments"
                            fill="#38bdf8"
                            radius={[0, 8, 8, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </GlassShell>
              </GradientBorder>

              <GradientBorder>
                <GlassShell>
                  <SectionHeader
                    eyebrow="Billing"
                    title="Payment method mix"
                    right={
                      <div className="text-xs text-slate-400">
                        {fmtInt(totalInvoicesCount)} invoices
                      </div>
                    }
                  />
                  <div className="p-4 md:p-6">
                    {paymentMethodData.length === 0 ? (
                      <EmptyState
                        icon={Wallet}
                        title="No payment method data"
                        subtitle="Payment method analytics will show here once invoices include payment method values."
                      />
                    ) : (
                      <div className="space-y-3">
                        {paymentMethodData.slice(0, 6).map((item, idx) => {
                          const pct = percent(item.value, totalInvoicesCount);
                          return (
                            <div
                              key={item.name}
                              className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                            >
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span
                                    className="inline-flex h-3 w-3 rounded-full"
                                    style={{
                                      backgroundColor: COLORS[idx % COLORS.length],
                                      boxShadow: `0 0 18px ${COLORS[idx % COLORS.length]}55`,
                                    }}
                                  />
                                  <span className="text-sm font-medium text-slate-100">
                                    {item.name}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400">
                                  {fmtInt(item.value)} • {pct.toFixed(1)}%
                                </div>
                              </div>
                              <div className="h-2 rounded-full bg-slate-900/90">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, pct))}%`,
                                    background: `linear-gradient(90deg, ${
                                      COLORS[idx % COLORS.length]
                                    }, rgba(255,255,255,0.65))`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </GlassShell>
              </GradientBorder>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <GlassShell>
                <div className="p-5">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-100">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Revenue health
                  </div>
                  <div className="text-xl font-bold text-slate-50">
                    {paidInvoicesCount} paid invoices
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    {fmtInt(totalInvoicesCount)} tech invoices are in the selected
                    range.
                  </div>
                </div>
              </GlassShell>

              <GlassShell>
                <div className="p-5">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Job output
                  </div>
                  <div className="text-xl font-bold text-slate-50">
                    {fmtInt(completedAppointments.length)} completed / paid
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Completion is based on appointment statuses marked completed
                    or paid inside the selected range.
                  </div>
                </div>
              </GlassShell>

              <GlassShell>
                <div className="p-5">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-violet-100">
                    <Users className="h-3.5 w-3.5" />
                    Customer base
                  </div>
                  <div className="text-xl font-bold text-slate-50">
                    {fmtInt(customers.length)} customer profiles
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Current active customer count is pulled from your users_public
                    table where role equals customer.
                  </div>
                </div>
              </GlassShell>

              <GlassShell>
                <div className="p-5">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-100">
                    <Award className="h-3.5 w-3.5" />
                    Quality
                  </div>
                  <div className="text-xl font-bold text-slate-50">
                    {avgRating.toFixed(1)} / 5 rating
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Technician rating average based on tech_rating values
                    currently available in users_public.
                  </div>
                </div>
              </GlassShell>
            </div>
          </>
        )}
      </div>
    </div>
  );
}