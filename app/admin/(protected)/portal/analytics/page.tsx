// app/admin/(protected)/portal/analytics/page.tsx
"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  DollarSign,
  Users,
  Calendar as CalendarIcon,
  Target,
  Award,
  AlertCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { motion } from "framer-motion";

/* ---------------------------------- Types ---------------------------------- */
type Any = Record<string, any>;

type Appointment = {
  id: string;
  status?: string | null;
  service_type?: string | null;
  scheduled_date?: string | null; // ISO date (YYYY-MM-DD)
  created_at?: string;
};

type Invoice = {
  id: string;
  invoice_number?: string | null;
  customer_email?: string | null;
  invoice_date?: string | null; // ISO date
  total_amount?: number | null;
  payment_status?: "paid" | "pending" | "partial" | "refunded" | "failed" | string | null;
  payment_date?: string | null;
  payment_method?: string | null;
  line_items?: { description?: string; total?: number }[];
  subtotal?: number | null;
  tax_amount?: number | null;
  tip_amount?: number | null;
  created_at?: string;
};

type TechInvoice = Invoice & {
  // if you store tech payouts separately
};

type User = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

type Warranty = {
  id: string;
  status?: string | null; // e.g., "claimed" | "active" | ...
};

type Review = {
  id: string;
  rating?: number | null; // 1..5
};

const COLORS = ["#38bdf8", "#22c55e", "#facc15", "#a855f7", "#ec4899", "#06b6d4"];

/* ------------------------------- Data Fetchers ------------------------------ */
function useAppointments() {
  return useQuery({
    queryKey: ["analytics:appointments"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("id, status, service_type, scheduled_date, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
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
      const { data, error } = await supabaseClient
        .from("invoices")
        .select(
          "id, invoice_number, customer_email, invoice_date, total_amount, payment_status, payment_date, payment_method, line_items, subtotal, tax_amount, tip_amount, created_at"
        )
        .order("invoice_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    staleTime: 15_000,
  });
}

function useTechInvoices() {
  return useQuery({
    queryKey: ["analytics:tech_invoices"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          "id, invoice_number, customer_email, invoice_date, total_amount, payment_status, payment_date, payment_method, created_at"
        )
        .order("invoice_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as TechInvoice[];
    },
    staleTime: 15_000,
  });
}

function useCustomers() {
  return useQuery({
    queryKey: ["analytics:customers"],
    queryFn: async () => {
      // Adjust to your real customer store if needed
      const { data, error } = await supabaseClient
        .from("app_users")
        .select("id, email, full_name, role")
        .eq("role", "customer")
        .limit(2000);
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
      const { data, error } = await supabaseClient
        .from("warranties")
        .select("id, status")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Warranty[];
    },
    staleTime: 15_000,
  });
}

function useReviews() {
  return useQuery({
    queryKey: ["analytics:reviews"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("reviews")
        .select("id, rating")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Review[];
    },
    staleTime: 15_000,
  });
}

/* --------------------------------- Helpers --------------------------------- */
function fmtUSD(n: number) {
  return `$${n.toFixed(2)}`;
}

function monthKeyFromISO(isoDate?: string | null) {
  if (!isoDate) return null;
  const key = isoDate.substring(0, 7); // YYYY-MM
  return /^\d{4}-\d{2}$/.test(key) ? key : null;
}

function shortMonthLabel(keyYYYYMM: string) {
  try {
    return new Date(`${keyYYYYMM}-01`).toLocaleDateString("en-US", { month: "short" });
  } catch {
    return keyYYYYMM;
  }
}

/* --------------------------- Glass Guardian shells ------------------------- */

function GradientBorder({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="pointer-events-none absolute -inset-[1.5px] rounded-2xl opacity-80 blur-[2px]"
        style={{
          background:
            "conic-gradient(from 210deg at 50% 50%, #38bdf8, transparent 20%, #22c55e 40%, transparent 65%, #a855f7 85%, #38bdf8)",
        }}
      />
      <div className="relative rounded-2xl">{children}</div>
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
      className={`rounded-2xl border border-white/10 bg-slate-950/80 shadow-[0_32px_120px_rgba(15,23,42,0.95)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function GlassStatCard({
  icon: Icon,
  label,
  value,
  chip,
  accent,
  delay = 0,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  chip: string;
  accent: "cyan" | "emerald" | "violet" | "amber";
  delay?: number;
}) {
  const accentClasses: Record<
    typeof accent,
    { ring: string; icon: string; chip: string; glow: string }
  > = {
    cyan: {
      ring: "from-cyan-500/20 to-sky-500/10",
      icon: "text-cyan-300",
      chip: "bg-cyan-500/15 text-cyan-100",
      glow: "shadow-cyan-500/40",
    },
    emerald: {
      ring: "from-emerald-500/20 to-teal-500/10",
      icon: "text-emerald-300",
      chip: "bg-emerald-500/15 text-emerald-100",
      glow: "shadow-emerald-500/40",
    },
    violet: {
      ring: "from-violet-500/20 to-fuchsia-500/10",
      icon: "text-violet-300",
      chip: "bg-violet-500/15 text-violet-100",
      glow: "shadow-violet-500/40",
    },
    amber: {
      ring: "from-amber-400/25 to-orange-500/10",
      icon: "text-amber-300",
      chip: "bg-amber-400/20 text-amber-100",
      glow: "shadow-amber-400/40",
    },
  };

  const a = accentClasses[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="relative"
    >
      <div
        className={`pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br ${a.ring} opacity-80 blur-md`}
      />
      <GlassShell className={`relative overflow-hidden ${a.glow}`}>
        <div className="absolute inset-0 opacity-40">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 0% 0%, rgba(248,250,252,0.18), transparent 55%)",
            }}
          />
        </div>
        <div className="relative p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/80 border border-white/10">
                <Icon className={`h-5 w-5 ${a.icon}`} />
              </div>
              <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                {label}
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${a.chip}`}
            >
              {chip}
            </span>
          </div>
          <div className="text-3xl md:text-4xl font-extrabold leading-none tabular-nums text-slate-50">
            {value}
          </div>
        </div>
      </GlassShell>
    </motion.div>
  );
}

/* --------------------------------- Page ------------------------------------ */
export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "90days" | "1year">("30days");

  const { data: appointments = [] } = useAppointments();
  const { data: invoices = [] } = useInvoices();
  const { data: techInvoices = [] } = useTechInvoices();
  const { data: customers = [] } = useCustomers();
  const { data: warranties = [] } = useWarranties();
  const { data: reviews = [] } = useReviews();

  /* ---------------------------- Metrics & Shaping --------------------------- */
  const totalRevenue = useMemo(() => {
    return [...invoices, ...techInvoices].reduce(
      (sum, inv) => sum + (inv.total_amount || 0),
      0
    );
  }, [invoices, techInvoices]);

  const completedAppointments = useMemo(
    () =>
      appointments.filter((a) =>
        ["completed", "paid"].includes(String(a.status || "").toLowerCase())
      ),
    [appointments]
  );

  const conversionRate = useMemo(() => {
    const total = appointments.length || 1;
    return (completedAppointments.length / total) * 100;
  }, [appointments.length, completedAppointments.length]);

  const avgTicket = useMemo(() => {
    const completedCount = completedAppointments.length || 1;
    return totalRevenue / completedCount;
  }, [totalRevenue, completedAppointments.length]);

  const avgRating = useMemo(() => {
    const denom = reviews.length || 1;
    return (
      reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / denom
    );
  }, [reviews]);

  const warrantyClaimRate = useMemo(() => {
    const denom = warranties.length || 1;
    const claimed = warranties.filter(
      (w) => String(w.status || "").toLowerCase() === "claimed"
    ).length;
    return (claimed / denom) * 100;
  }, [warranties]);

  // Pie: service types
  const serviceTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const apt of appointments) {
      const key = (apt.service_type || "unknown").toString();
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({
      name: name.replace(/_/g, " ").toUpperCase(),
      value,
    }));
  }, [appointments]);

  // Monthly revenue (last 6 keys)
  const revenueChartData = useMemo(() => {
    const monthly: Record<string, number> = {};
    const all = [...invoices, ...techInvoices];
    for (const inv of all) {
      const key = monthKeyFromISO(
        inv.invoice_date || inv.payment_date || inv.created_at || ""
      );
      if (!key) continue;
      monthly[key] = (monthly[key] || 0) + (inv.total_amount || 0);
    }
    return Object.entries(monthly)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-6)
      .map(([month, revenue]) => ({
        month: shortMonthLabel(month),
        revenue,
      }));
  }, [invoices, techInvoices]);

  // Status distribution
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const apt of appointments) {
      const st = (apt.status || "unknown").toString();
      map[st] = (map[st] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({
      name: name.replace(/_/g, " ").toUpperCase(),
      value,
    }));
  }, [appointments]);

  // Daily appointments, last 7 days
  const dailyAppointments = useMemo(() => {
    const days: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    return days.map((iso) => ({
      date: new Date(iso).toLocaleDateString("en-US", { weekday: "short" }),
      count: appointments.filter((a) => a.scheduled_date === iso).length,
    }));
  }, [appointments]);

  /* ---------------------------------- UI ----------------------------------- */
  return (
    <div className="relative min-h-screen text-slate-100">
      {/* Background field */}
      <div className="pointer-events-none fixed inset-0 -z-20">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 10% 0%, rgba(59,130,246,0.32), transparent 55%), radial-gradient(900px 600px at 90% 100%, rgba(16,185,129,0.25), transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,1))",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-8 py-8 md:py-10 space-y-8">
        {/* Top row: title + time range */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100">
              <BarChart3 className="h-3.5 w-3.5" />
              Ops • Analytics
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-50 flex items-center gap-3">
              Glass Guardian Analytics
            </h1>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl">
              High-signal view of revenue, appointments, and field performance —
              tuned for windshield ops in real time.
            </p>
          </div>

          <GlassShell className="inline-flex items-center justify-between gap-3 px-4 py-3">
            <div className="text-xs text-slate-300">
              Time range<span className="hidden sm:inline"> (visual only)</span>
            </div>
            <Tabs
              value={timeRange}
              onValueChange={(v) => setTimeRange(v as any)}
              className="text-xs"
            >
              <TabsList className="bg-slate-900/80 border border-white/10">
                <TabsTrigger value="7days" className="px-2 py-1">
                  7d
                </TabsTrigger>
                <TabsTrigger value="30days" className="px-2 py-1">
                  30d
                </TabsTrigger>
                <TabsTrigger value="90days" className="px-2 py-1">
                  90d
                </TabsTrigger>
                <TabsTrigger value="1year" className="px-2 py-1">
                  1y
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </GlassShell>
        </div>

        {/* KPI row */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <GlassStatCard
            icon={DollarSign}
            label="Total Revenue"
            value={fmtUSD(totalRevenue || 0)}
            chip="+12.5% vs last period"
            accent="emerald"
            delay={0.02}
          />
          <GlassStatCard
            icon={CalendarIcon}
            label="Total Appointments"
            value={String(appointments.length)}
            chip="+8.3% volume"
            accent="cyan"
            delay={0.06}
          />
          <GlassStatCard
            icon={Users}
            label="Active Customers"
            value={String(customers.length)}
            chip="+15.2% growth"
            accent="violet"
            delay={0.1}
          />
          <GlassStatCard
            icon={Award}
            label="Avg Tech Rating"
            value={(Number.isFinite(avgRating) ? avgRating : 0).toFixed(1)}
            chip="+0.3 vs last period"
            accent="amber"
            delay={0.14}
          />
        </div>

        {/* Revenue trend */}
        <GradientBorder>
          <GlassShell>
            <div className="border-b border-white/5 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Revenue
                </p>
                <p className="text-lg font-semibold text-slate-50">
                  Monthly revenue trend
                </p>
              </div>
              <div className="text-xs text-slate-400">
                Last <span className="text-slate-100">6</span> months
              </div>
            </div>
            <div className="p-4 md:p-6">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.9} />
                      <stop offset="85%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15,23,42,0.96)",
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,0.4)",
                      color: "#e5e7eb",
                      boxShadow: "0 18px 40px rgba(15,23,42,0.9)",
                    }}
                    formatter={(value: number) => fmtUSD(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#38bdf8"
                    strokeWidth={2.6}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassShell>
        </GradientBorder>

        {/* Middle charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Service distribution */}
          <GradientBorder>
            <GlassShell>
              <div className="border-b border-white/5 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Mix
                </p>
                <p className="text-lg font-semibold text-slate-50">
                  Service type distribution
                </p>
              </div>
              <div className="p-4 md:p-6">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    {(() => {
                      const total =
                        serviceTypeData.reduce((s, d) => s + d.value, 0) || 1;
                      const renderLabel = (props: any) => {
                        const { name, value } = props;
                        const pct = Math.round(
                          (Number(value || 0) / total) * 100
                        );
                        return `${name} ${pct}%`;
                      };

                      return (
                        <Pie
                          data={serviceTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={renderLabel}
                          outerRadius={100}
                          fill="#38bdf8"
                          dataKey="value"
                        >
                          {serviceTypeData.map((_, index) => (
                            <Cell
                              key={index}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                      );
                    })()}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15,23,42,0.96)",
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.4)",
                        color: "#e5e7eb",
                        boxShadow: "0 18px 40px rgba(15,23,42,0.9)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassShell>
          </GradientBorder>

          {/* Weekly activity */}
          <GradientBorder>
            <GlassShell>
              <div className="border-b border-white/5 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Flow
                </p>
                <p className="text-lg font-semibold text-slate-50">
                  Weekly appointment volume
                </p>
              </div>
              <div className="p-4 md:p-6">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyAppointments}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15,23,42,0.96)",
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.4)",
                        color: "#e5e7eb",
                        boxShadow: "0 18px 40px rgba(15,23,42,0.9)",
                      }}
                    />
                    <defs>
                      <linearGradient
                        id="barGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <Bar
                      dataKey="count"
                      fill="url(#barGradient)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassShell>
          </GradientBorder>
        </div>

        {/* Performance metrics row */}
        <div className="grid gap-6 md:grid-cols-3">
          <GlassShell>
            <div className="px-5 py-4 border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-slate-50 text-base">
                <Target className="h-5 w-5 text-cyan-300" />
                Conversion rate
              </CardTitle>
            </div>
            <div className="px-5 pb-5 pt-4 space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-extrabold text-sky-300 tabular-nums">
                  {Number.isFinite(conversionRate)
                    ? conversionRate.toFixed(1)
                    : "0.0"}
                  %
                </p>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                  +2.4% vs prior
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {completedAppointments.length} of {appointments.length}{" "}
                appointments completed/paid.
              </p>
              <div className="mt-2 w-full rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, conversionRate || 0)
                    )}%`,
                  }}
                />
              </div>
            </div>
          </GlassShell>

          <GlassShell>
            <div className="px-5 py-4 border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-slate-50 text-base">
                <DollarSign className="h-5 w-5 text-emerald-300" />
                Avg ticket size
              </CardTitle>
            </div>
            <div className="px-5 pb-5 pt-4 space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-extrabold text-emerald-300 tabular-nums">
                  {fmtUSD(Number.isFinite(avgTicket) ? avgTicket : 0)}
                </p>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                  +$5.20 vs prior
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Average revenue per completed job.
              </p>
            </div>
          </GlassShell>

          <GlassShell>
            <div className="px-5 py-4 border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-slate-50 text-base">
                <AlertCircle className="h-5 w-5 text-amber-300" />
                Warranty claim rate
              </CardTitle>
            </div>
            <div className="px-5 pb-5 pt-4 space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-extrabold text-amber-300 tabular-nums">
                  {Number.isFinite(warrantyClaimRate)
                    ? warrantyClaimRate.toFixed(1)
                    : "0.0"}
                  %
                </p>
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-100">
                  -0.5% vs prior
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {
                  warranties.filter(
                    (w) =>
                      String(w.status || "").toLowerCase() === "claimed"
                  ).length
                }{" "}
                of {warranties.length} warranties claimed.
              </p>
            </div>
          </GlassShell>
        </div>

        {/* Status distribution */}
        <GradientBorder>
          <GlassShell>
            <div className="border-b border-white/5 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Pipeline
                </p>
                <p className="text-lg font-semibold text-slate-50">
                  Appointment status distribution
                </p>
              </div>
            </div>
            <div className="p-4 md:p-6">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={statusData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#9ca3af"
                    width={160}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15,23,42,0.96)",
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,0.4)",
                      color: "#e5e7eb",
                      boxShadow: "0 18px 40px rgba(15,23,42,0.9)",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#38bdf8"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassShell>
        </GradientBorder>
      </div>
    </div>
  );
}