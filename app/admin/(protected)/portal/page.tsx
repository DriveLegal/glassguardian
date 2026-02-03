"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  Star,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { AdminControlSurface } from "@/components/admin/portal/AdminControlSurface";
import {
  AdminBookingLeadsPanel,
  BookingLead,
} from "@/components/admin/portal/AdminBookingLeadsPanel";

const HeroBackground3D = dynamic(
  () => import("@/components/visual/HeroBackground3D"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-slate-950 via-slate-900 to-black" />
    ),
  }
);

/* ----------------------------- Types (tighter) ----------------------------- */

type Role = "admin" | "support" | "customer" | "technician" | string;

type SupaUserLike = {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type AppointmentRow = {
  id: string;
  created_at?: string | null;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  status?: string | null;
  service_type?: string | null;
  customer_email?: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_date?: string | null;
  total_amount?: number | string | null;
};

type UsersPublicRow = {
  id: string;
  email?: string | null;
  role?: Role | null;
  full_name?: string | null;
  phone?: string | null;
  tech_rating?: number | string | null;
  created_at?: string | null;
};

type GateState = {
  name: string;
  email: string | null;
  devActive: boolean;
  ready: boolean;
  allowed: boolean;
};

/* ----------------------------- Admin helpers ----------------------------- */

async function fetchIsAdminByTable(email: string): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await supabaseClient
    .from("admins")
    .select("role, is_active")
    .eq("email", email)
    .maybeSingle();

  if (error) return false;

  const role = (data?.role ?? "") as string;
  return !!data && data.is_active === true && (role === "admin" || role === "support");
}

function resolveRole(u: SupaUserLike | null | undefined): Role | null {
  if (!u) return null;
  const appRole = (u.app_metadata as any)?.role;
  const userRole = (u.user_metadata as any)?.role;
  const r = (appRole ?? userRole ?? null) as Role | null;
  return typeof r === "string" ? r : null;
}

function resolveDisplayName(email: string | null, userMetadata?: Record<string, unknown>) {
  const full = (userMetadata as any)?.full_name;
  if (typeof full === "string" && full.trim()) return full.trim();
  if (email?.includes("@")) return email.split("@")[0]!;
  return "Admin";
}

/* ----------------------------- Auth Gate ----------------------------- */

function useAdminGate(): GateState {
  const router = useRouter();
  const [state, setState] = React.useState<GateState>({
    name: "Admin",
    email: null,
    devActive: false,
    ready: false,
    allowed: false,
  });

  React.useEffect(() => {
    let mounted = true;
    let redirected = false;

    const allow = (name: string, email: string | null, devActive = false) => {
      if (!mounted) return;
      setState({ name, email, devActive, ready: true, allowed: true });
    };

    const block = () => {
      if (!mounted || redirected) return;
      redirected = true;
      setState((s) => ({ ...s, ready: true, allowed: false }));
      router.replace(`/admin/login?redirect=${encodeURIComponent("/admin/portal")}`);
    };

    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      const email = user?.email ?? null;
      const role = resolveRole(user as any);

      if (user && (role === "admin" || role === "support")) {
        allow(resolveDisplayName(email, (user as any)?.user_metadata), email, false);
        return;
      }

      if (user && email) {
        const ok = await fetchIsAdminByTable(email);
        if (ok) {
          allow(resolveDisplayName(email, (user as any)?.user_metadata), email, false);
          return;
        }
      }

      const devRole = String(readDevRoleFromCookie() ?? "");
      if (devRole === "admin" || devRole === "support") {
        const dev = makeDevUser("admin");
        allow(dev.user_metadata?.full_name || `Dev ${devRole}`, dev.email, true);
        return;
      }

      const { data: sub } = supabaseClient.auth.onAuthStateChange(async (_evt, sess) => {
        if (!mounted || redirected) return;

        const u = sess?.user ?? null;
        const e = u?.email ?? null;
        const r = resolveRole(u as any);

        if (u && (r === "admin" || r === "support")) {
          allow(resolveDisplayName(e, (u as any)?.user_metadata), e, false);
          return;
        }

        if (u && e) {
          const ok = await fetchIsAdminByTable(e);
          if (ok) {
            allow(resolveDisplayName(e, (u as any)?.user_metadata), e, false);
            return;
          }
        }

        block();
      });

      return () => {
        mounted = false;
        sub?.subscription?.unsubscribe();
      };
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return state;
}

/* --------------------------- Data fetchers --------------------------- */

async function fetchAppointments(): Promise<AppointmentRow[]> {
  try {
    const { data, error, status } = await supabaseClient
      .from("appointments")
      .select("id, created_at, scheduled_date, scheduled_time_start, status, service_type, customer_email")
      .order("created_at", { ascending: false })
      .limit(100);

    if (status === 404) return [];
    if (error) throw error;
    return (data as AppointmentRow[]) ?? [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("fetchAppointments:", e);
    return [];
  }
}

async function fetchInvoices(): Promise<InvoiceRow[]> {
  try {
    const { data, error, status } = await supabaseClient
      .from("invoices")
      .select("id, invoice_date, total_amount")
      .order("invoice_date", { ascending: false })
      .limit(50);

    if (status === 404) return [];
    if (error) throw error;
    return (data as InvoiceRow[]) ?? [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("fetchInvoices:", e);
    return [];
  }
}

async function fetchUsersByRole(role: Role): Promise<UsersPublicRow[]> {
  try {
    const { data, error, status } = await supabaseClient
      .from("users_public")
      .select("id, email, role, full_name, phone, tech_rating, created_at")
      .eq("role", role);

    if (status === 404) return [];
    if (error) throw error;
    return (data as UsersPublicRow[]) ?? [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("fetchUsersByRole:", e);
    return [];
  }
}

async function fetchBookingLeads(): Promise<BookingLead[]> {
  try {
    const { data, error, status } = await supabaseClient
      .from("booking_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (status === 404) return [];
    if (error) throw error;
    return (data as BookingLead[]) ?? [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("fetchBookingLeads:", e);
    return [];
  }
}

/* ------------------------- Motion presets -------------------------- */

const vPage = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.07 },
  },
};

const vSection = {
  hidden: { opacity: 0, y: 12, filter: "blur(5px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 300, damping: 28 } },
};

const vItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 28 } },
};

/* ------------------------- UI building blocks -------------------------- */

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
    <div className={`relative group ${className}`}>
      <div
        className="absolute -inset-[1.5px] rounded-2xl opacity-85 blur-[2.5px] transition-all duration-700 group-hover:opacity-100 group-hover:blur-[3px]"
        style={{
          opacity: intensity,
          background:
            "conic-gradient(from 210deg at 50% 50%, rgba(96,165,250,0.95), transparent 20%, rgba(52,211,153,0.92) 50%, transparent 72%, rgba(167,139,250,0.95) 100%)",
        }}
      />
      <div className="relative rounded-2xl transition-all duration-300 group-hover:scale-[1.006] group-hover:shadow-[0_0_40px_rgba(96,165,250,0.18)]">
        {children}
      </div>
    </div>
  );
}

function GlassShell({
  children,
  className = "",
  dense = false,
}: {
  children: React.ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={`gg-glass rounded-2xl border overflow-hidden ${dense ? "gg-glass-dense" : ""} ${className}`}
      style={{
        borderColor: "rgba(255,255,255,0.17)",
      }}
    >
      <div className="gg-liquid-sheen pointer-events-none absolute inset-0 rounded-2xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Tilt({
  children,
  className = "",
  max = 10,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  const onMove = React.useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -max;
      const ry = (px - 0.5) * max;

      el.style.setProperty("--rx", `${rx}deg`);
      el.style.setProperty("--ry", `${ry}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      el.style.setProperty("--lift", "1");
    },
    [max]
  );

  const onLeave = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--lift", "0");
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`gg-tilt ${className}`}
    >
      {children}
    </div>
  );
}

function ShimmerLine({ className = "" }: { className?: string }) {
  return <div className={`gg-shimmer ${className}`} />;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`gg-skel ${className}`} />;
}

function StatCard({
  title,
  value,
  icon,
  gradient,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
  loading?: boolean;
}) {
  return (
    <Tilt className="rounded-2xl">
      <motion.div
        variants={vItem}
        whileTap={{ scale: 0.98 }}
        className="rounded-2xl gg-lift"
      >
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-48 gg-radial-soft" />
          <div className="pointer-events-none absolute inset-0 gg-noise opacity-[0.09] mix-blend-overlay" />
          <div className={`relative p-6 text-white ${gradient}`}>
            <div className="flex items-center justify-between gap-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/10 gg-icon-glow">
                {icon}
              </div>
              <div className="text-right">
                <div className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none tabular-nums gg-text-pop">
                  {loading ? <span className="inline-block w-[100px]"><SkeletonBlock className="h-10 w-full" /></span> : value}
                </div>
                <div className="text-sm opacity-95 mt-1.5">{title}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Tilt>
  );
}

/* ------------------------- Error Boundary -------------------------- */

class PortalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; msg?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: typeof err?.message === "string" ? err.message : "Unexpected error" };
  }
  componentDidCatch(err: any) {
    if (process.env.NODE_ENV !== "production") console.error("AdminPortal error:", err);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center bg-black text-slate-100 px-6">
        <div className="max-w-lg w-full">
          <GradientBorder intensity={0.95}>
            <GlassShell className="p-7">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-300/90">
                Glass Guardian • Portal
              </div>
              <h2 className="mt-3 text-2xl font-extrabold text-white">Something glitched.</h2>
              <p className="mt-3 text-base text-slate-300">
                Refresh the page. If the issue persists, check console logs or contact support.
              </p>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200/90">
                {this.state.msg}
              </div>
              <div className="mt-6 flex gap-4">
                <Button className="gg-btn flex-1" onClick={() => window.location.reload()}>
                  Reload
                </Button>
                <Link href="/admin/portal" className="flex-1">
                  <Button variant="outline" className="w-full gg-btn-outline">
                    Back to Portal
                  </Button>
                </Link>
              </div>
            </GlassShell>
          </GradientBorder>
        </div>
      </div>
    );
  }
}

/* ---------------------- Inner content ---------------------- */

function PortalContent({ gateName }: { gateName: string }) {
  const qAppointments = useQuery({
    queryKey: ["admin:appointments"],
    queryFn: fetchAppointments,
    staleTime: 15000,
  });

  const qInvoices = useQuery({
    queryKey: ["admin:invoices"],
    queryFn: fetchInvoices,
    staleTime: 15000,
  });

  const qCustomers = useQuery({
    queryKey: ["admin:customers"],
    queryFn: () => fetchUsersByRole("customer"),
    staleTime: 30000,
  });

  const qTechs = useQuery({
    queryKey: ["admin:technicians"],
    queryFn: () => fetchUsersByRole("technician"),
    staleTime: 30000,
  });

  const qLeads = useQuery({
    queryKey: ["admin:booking_leads"],
    queryFn: fetchBookingLeads,
    staleTime: 10000,
  });

  const appointments = qAppointments.data ?? [];
  const invoices = qInvoices.data ?? [];
  const customers = qCustomers.data ?? [];
  const technicians = qTechs.data ?? [];
  const bookingLeads = qLeads.data ?? [];

  const loadingCore = qAppointments.isLoading || qInvoices.isLoading || qCustomers.isLoading || qTechs.isLoading;

  const totalRevenue = invoices.reduce((sum, inv) => {
    const n = Number(inv.total_amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const todayISO = new Date().toISOString().split("T")[0];
  const todayAppointments = appointments.filter((apt) => apt.scheduled_date === todayISO);
  const activeAppointments = appointments.filter(
    (apt) => !["completed", "cancelled", "paid"].includes(String(apt.status ?? ""))
  );
  const completedAppointments = appointments.filter((apt) =>
    ["completed", "paid"].includes(String(apt.status ?? ""))
  );

  const avgRating =
    technicians.reduce((sum, tech) => sum + (Number(tech.tech_rating) || 0), 0) /
    (technicians.length || 1);

  return (
    <div className="relative min-h-screen text-slate-100">
      {/* 3D + HD layers */}
      <div className="absolute inset-0 -z-30">
        <HeroBackground3D />
      </div>

      {/* overlays */}
      <div className="absolute inset-0 -z-20 pointer-events-none">
        <div className="absolute inset-0 gg-aurora" />
        <div className="absolute inset-0 gg-vignette" />
        <div className="absolute inset-0 gg-noise opacity-[0.08] mix-blend-overlay" />
      </div>

      <motion.div
        variants={vPage}
        initial="hidden"
        animate="show"
        className="relative px-5 md:px-9 py-12"
      >
        <div className="max-w-7xl mx-auto space-y-12">
          {/* HERO */}
          <motion.div variants={vSection}>
            <GradientBorder intensity={0.95}>
              <GlassShell className="p-7 md:p-9 gg-lift">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-10">
                  <div className="space-y-4 max-w-2xl">
                    <div className="text-xs md:text-sm uppercase tracking-[0.26em] text-slate-300/85">
                      Glass Guardian • Admin Control
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold leading-tight text-white gg-title">
                      Welcome back, {gateName}.
                    </h1>
                    <p className="text-base text-slate-300 leading-relaxed">
                      Monitor revenue, active jobs, and field performance in one high-signal dashboard. Everything you need to keep operations smooth and profitable.
                    </p>

                    <div className="pt-3">
                      <ShimmerLine className="my-1" />
                    </div>

                    <div className="flex flex-wrap gap-3 pt-1">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3.5 py-1 text-sm text-emerald-100 gg-pill">
                        <CheckCircle className="h-4 w-4" />
                        Live environment secured
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-500/10 px-3.5 py-1 text-sm text-sky-100 gg-pill">
                        <TrendingUp className="h-4 w-4" />
                        Real-time telemetry
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex justify-center xl:justify-end">
                    <Tilt max={12} className="rounded-2xl">
                      <div className="gg-lift rounded-2xl">
                        <AdminControlSurface
                          totalRevenue={totalRevenue}
                          activeAppointments={activeAppointments.length}
                          technicians={technicians.length}
                        />
                      </div>
                    </Tilt>
                  </div>
                </div>
              </GlassShell>
            </GradientBorder>
          </motion.div>

          {/* Booking Leads */}
          <motion.div variants={vSection}>
            <GradientBorder intensity={0.92}>
              <GlassShell className="p-5 md:p-7 gg-lift">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="text-base font-semibold text-white/95">Recent Booking Leads</div>
                  <div className="text-sm text-slate-300/90">
                    {qLeads.isLoading ? "Loading…" : `${bookingLeads.length} new`}
                  </div>
                </div>
                <AdminBookingLeadsPanel leads={bookingLeads} />
              </GlassShell>
            </GradientBorder>
          </motion.div>

          {/* MAIN GRID */}
          <div className="grid lg:grid-cols-3 gap-9">
            {/* Today’s appointments */}
            <motion.div variants={vSection} className="lg:col-span-2">
              <GradientBorder intensity={0.92}>
                <GlassShell className="gg-lift">
                  <Card className="bg-transparent border-0 shadow-none">
                    <CardHeader className="px-6 pt-6 pb-3">
                      <CardTitle className="flex items-center justify-between text-white text-xl">
                        <span>Today’s Appointments</span>
                        <Link href="/admin/calendar">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gg-btn-outline flex items-center gap-2 text-sm"
                          >
                            View Calendar
                            <ArrowRight className="ml-1.5 w-4 h-4" />
                          </Button>
                        </Link>
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="px-6 pb-6">
                      {qAppointments.isLoading ? (
                        <div className="space-y-4 py-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"
                            >
                              <div className="flex items-center justify-between gap-5">
                                <div className="w-[65%] space-y-3">
                                  <SkeletonBlock className="h-5 w-[60%]" />
                                  <SkeletonBlock className="h-4 w-[80%]" />
                                </div>
                                <div className="w-[35%] space-y-3 text-right">
                                  <SkeletonBlock className="h-5 w-[70%] ml-auto" />
                                  <SkeletonBlock className="h-4 w-[50%] ml-auto" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : todayAppointments.length === 0 ? (
                        <div className="py-16 text-center text-slate-300/90">
                          <Calendar className="w-14 h-14 mx-auto mb-4 text-slate-500/70" />
                          <p className="text-lg">No appointments scheduled for today.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <AnimatePresence initial={false}>
                            {todayAppointments.slice(0, 8).map((apt) => {
                              const title = String(apt.service_type ?? "")
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (m) => m.toUpperCase());

                              return (
                                <motion.div
                                  key={apt.id}
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 12 }}
                                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                                >
                                  <Tilt max={9} className="rounded-2xl">
                                    <div className="gg-row rounded-2xl p-5 border bg-white/6 text-slate-100">
                                      <div className="flex items-center justify-between gap-5">
                                        <div>
                                          <p className="font-semibold text-base gg-text-pop">
                                            {title || "Appointment"}
                                          </p>
                                          <p className="text-sm text-slate-300/90 mt-1">
                                            {apt.customer_email ?? "—"}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-base font-semibold text-sky-300">
                                            {apt.scheduled_time_start ?? "—"}
                                          </p>
                                          <p className="text-xs text-slate-400/90 capitalize mt-1">
                                            {String(apt.status ?? "").replace(/_/g, " ") || "—"}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </Tilt>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </GlassShell>
              </GradientBorder>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={vSection}>
              <GradientBorder intensity={0.92}>
                <GlassShell className="gg-lift">
                  <Card className="bg-transparent border-0 shadow-none">
                    <CardHeader className="px-6 pt-6 pb-3">
                      <CardTitle className="text-white text-xl">Quick Actions</CardTitle>
                    </CardHeader>

                    <CardContent className="px-6 pb-6 space-y-4">
                      {[
                        { href: "/admin/appointments", icon: <Calendar className="w-5 h-5" />, label: "Manage Appointments" },
                        { href: "/admin/customers", icon: <Users className="w-5 h-5" />, label: "View Customers" },
                        { href: "/admin/technicians", icon: <Users className="w-5 h-5" />, label: "Manage Technicians" },
                        { href: "/admin/invoices", icon: <DollarSign className="w-5 h-5" />, label: "View Invoices" },
                        { href: "/admin/analytics", icon: <TrendingUp className="w-5 h-5" />, label: "Analytics" },
                      ].map((a) => (
                        <Link key={a.href} href={a.href}>
                          <motion.div variants={vItem} whileTap={{ scale: 0.98 }}>
                            <Button className="w-full justify-between gg-btn text-base py-6 px-5">
                              <span className="flex items-center gap-3">
                                {a.icon}
                                {a.label}
                              </span>
                              <ArrowRight className="w-5 h-5 opacity-80" />
                            </Button>
                          </motion.div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                </GlassShell>
              </GradientBorder>
            </motion.div>
          </div>

          {/* STATUS ROW */}
          <motion.div variants={vSection} className="grid md:grid-cols-3 gap-7">
            {[
              {
                title: "Active Jobs",
                icon: <Clock className="w-6 h-6 text-amber-300" />,
                value: activeAppointments.length,
                sub: "Currently in progress",
                glow: "gg-glow-amber",
                loading: qAppointments.isLoading,
              },
              {
                title: "Completed",
                icon: <CheckCircle className="w-6 h-6 text-emerald-300" />,
                value: completedAppointments.length,
                sub: "All-time completions",
                glow: "gg-glow-emerald",
                loading: qAppointments.isLoading,
              },
              {
                title: "Technicians",
                icon: <Users className="w-6 h-6 text-sky-300" />,
                value: technicians.length,
                sub: "Active field techs",
                glow: "gg-glow-sky",
                loading: qTechs.isLoading,
              },
            ].map((s) => (
              <GradientBorder key={s.title} intensity={0.9}>
                <GlassShell className={`gg-lift ${s.glow}`}>
                  <Card className="bg-transparent border-0 shadow-none">
                    <CardHeader className="px-6 pt-6 pb-3">
                      <CardTitle className="flex items-center gap-3 text-white text-lg">
                        {s.icon}
                        {s.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                      <div className="text-5xl font-extrabold text-white leading-none tabular-nums gg-text-pop">
                        {s.loading ? (
                          <div className="inline-block w-[100px]">
                            <SkeletonBlock className="h-12 w-full" />
                          </div>
                        ) : (
                          s.value
                        )}
                      </div>
                      <p className="text-base text-slate-300/90 mt-2">{s.sub}</p>
                    </CardContent>
                  </Card>
                </GlassShell>
              </GradientBorder>
            ))}
          </motion.div>

          {/* KPI ROW */}
          <motion.div variants={vSection} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
            <StatCard
              title="Total Revenue"
              value={`$${totalRevenue.toFixed(2)}`}
              icon={<DollarSign className="w-6 h-6" />}
              gradient="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-950"
              loading={qInvoices.isLoading}
            />
            <StatCard
              title="Total Appointments"
              value={appointments.length}
              icon={<Calendar className="w-6 h-6" />}
              gradient="bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-950"
              loading={qAppointments.isLoading}
            />
            <StatCard
              title="Total Customers"
              value={customers.length}
              icon={<Users className="w-6 h-6" />}
              gradient="bg-gradient-to-br from-violet-600 via-purple-700 to-fuchsia-950"
              loading={qCustomers.isLoading}
            />
            <StatCard
              title="Avg Tech Rating"
              value={avgRating.toFixed(1)}
              icon={<Star className="w-6 h-6" />}
              gradient="bg-gradient-to-br from-amber-600 via-orange-700 to-rose-950"
              loading={qTechs.isLoading}
            />
          </motion.div>

          {/* footer status */}
          <motion.div variants={vSection} className="text-sm text-slate-400/80 flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className={`inline-block h-3 w-3 rounded-full ${loadingCore ? "bg-amber-400" : "bg-emerald-400"} gg-dot`} />
              {loadingCore ? "Syncing latest data…" : "All systems synced"}
            </div>
            <div className="opacity-75">Liquid glass • high-DPI optimized</div>
          </motion.div>
        </div>

        {/* global CSS – no spinning */}
        <style jsx global>{`
          :root {
            --gg-angle: 210deg;
          }

          @keyframes gg-shimmer {
            0% { background-position: 0% 50%; }
            100% { background-position: 120% 50%; }
          }

          @keyframes gg-skel {
            0% { background-position: 0% 0%; }
            100% { background-position: 200% 0%; }
          }

          .gg-glass {
            position: relative;
            overflow: hidden;
            background: linear-gradient(180deg, rgba(8,13,26,0.65), rgba(2,6,23,0.90));
            backdrop-filter: blur(24px) saturate(1.4);
            -webkit-backdrop-filter: blur(24px) saturate(1.4);
            box-shadow:
              0 48px 160px rgba(0,0,0,0.65),
              0 24px 80px rgba(6,12,28,0.78),
              inset 0 2px 0 rgba(255,255,255,0.09),
              inset 0 -1px 0 rgba(255,255,255,0.04);
          }

          .gg-glass-dense {
            backdrop-filter: blur(30px) saturate(1.6);
            -webkit-backdrop-filter: blur(30px) saturate(1.6);
          }

          /* liquid sheen – stronger on hover */
          .gg-liquid-sheen {
            background:
              radial-gradient(800px 280px at var(--mx, 50%) var(--my, 50%), rgba(96,165,250,0.22), transparent 58%),
              radial-gradient(760px 300px at calc(var(--mx, 50%) + 8%) calc(var(--my, 50%) + 12%), rgba(52,211,153,0.16), transparent 62%),
              linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.09));
            filter: blur(1px);
            opacity: 0.35;
            transition: opacity 0.45s ease;
            mix-blend-mode: screen;
          }

          .gg-glass:hover .gg-liquid-sheen {
            opacity: 0.85;
          }

          /* overlays */
          .gg-aurora {
            background:
              radial-gradient(1000px 680px at 12% 10%, rgba(59,130,246,0.32), transparent 55%),
              radial-gradient(900px 620px at 88% 82%, rgba(16,185,129,0.26), transparent 58%),
              radial-gradient(820px 580px at 62% 22%, rgba(168,85,247,0.18), transparent 60%);
          }

          .gg-vignette {
            background: linear-gradient(180deg, rgba(2,6,23,0.65), rgba(2,6,23,0.88) 35%, rgba(0,0,0,0.96));
          }

          .gg-noise {
            background-image:
              url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' width='128' height='128' viewBox='0 0 128 128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(%23n)' opacity='0.36'/></svg>");
          }

          .gg-radial-soft {
            background: radial-gradient(circle at 0% 0%, rgba(248,250,252,0.35), transparent 60%);
          }

          /* tilt + lift */
          .gg-tilt {
            transform-style: preserve-3d;
            transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
            transition: transform 180ms ease-out, filter 180ms ease-out;
          }

          .gg-lift {
            box-shadow:
              0 36px 140px rgba(0,0,0,0.58),
              0 20px 70px rgba(3,10,24,0.68),
              inset 0 1px 0 rgba(255,255,255,0.07);
            transform: translateY(calc(var(--lift, 0) * -3px));
            transition: transform 200ms ease, box-shadow 200ms ease;
          }

          .gg-row {
            border-color: rgba(255,255,255,0.14);
            box-shadow:
              0 20px 60px rgba(2,10,28,0.65),
              inset 0 1px 0 rgba(255,255,255,0.06);
            backdrop-filter: blur(16px) saturate(1.3);
            -webkit-backdrop-filter: blur(16px) saturate(1.3);
          }

          /* buttons */
          .gg-btn {
            position: relative;
            overflow: hidden;
            background: rgba(255,255,255,0.11);
            border: 1px solid rgba(255,255,255,0.16);
            color: rgba(248,250,252,0.96);
            box-shadow:
              0 16px 50px rgba(0,0,0,0.48),
              inset 0 1px 0 rgba(255,255,255,0.07);
            transition: all 0.2s ease;
          }

          .gg-btn:hover {
            background: rgba(255,255,255,0.16);
            border-color: rgba(255,255,255,0.22);
            transform: translateY(-1px);
          }

          .gg-btn::after {
            content: "";
            position: absolute;
            inset: -50%;
            background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(59,130,246,0.25), transparent 55%);
            opacity: 0;
            transition: opacity 0.25s ease;
            pointer-events: none;
          }

          .gg-btn:hover::after {
            opacity: 1;
          }

          .gg-btn-outline {
            background: rgba(255,255,255,0.07) !important;
            border: 1px solid rgba(255,255,255,0.18) !important;
            color: rgba(248,250,252,0.93) !important;
          }

          .gg-btn-outline:hover {
            background: rgba(255,255,255,0.12) !important;
          }

          /* text & glow */
          .gg-title {
            text-shadow: 0 0 20px rgba(59,130,246,0.2), 0 0 32px rgba(16,185,129,0.12);
          }

          .gg-text-pop {
            text-shadow: 0 12px 32px rgba(0,0,0,0.5), 0 0 26px rgba(59,130,246,0.18);
          }

          .gg-icon-glow {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.07), 0 0 32px rgba(59,130,246,0.16);
          }

          /* shimmer & skeleton */
          .gg-shimmer {
            height: 1px;
            width: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, rgba(255,255,255,0.12), rgba(59,130,246,0.6), rgba(52,211,153,0.5), rgba(255,255,255,0.12));
            background-size: 200% 100%;
            animation: gg-shimmer 3.5s linear infinite;
            opacity: 0.92;
          }

          .gg-skel {
            border-radius: 999px;
            background: linear-gradient(90deg, rgba(255,255,255,0.07), rgba(255,255,255,0.14), rgba(255,255,255,0.07));
            background-size: 200% 100%;
            animation: gg-skel 1.4s linear infinite;
          }

          /* pills & dot */
          .gg-pill {
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
            backdrop-filter: blur(16px) saturate(1.3);
            -webkit-backdrop-filter: blur(16px) saturate(1.3);
          }

          .gg-dot {
            box-shadow: 0 0 20px rgba(16,185,129,0.4);
          }

          /* status glows */
          .gg-glow-emerald { box-shadow: 0 0 0 1px rgba(16,185,129,0.14), 0 0 80px rgba(16,185,129,0.12); }
          .gg-glow-sky     { box-shadow: 0 0 0 1px rgba(59,130,246,0.14), 0 0 80px rgba(59,130,246,0.12); }
          .gg-glow-amber   { box-shadow: 0 0 0 1px rgba(245,158,11,0.12), 0 0 80px rgba(245,158,11,0.10); }

          /* hi-dpi */
          @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
            .gg-glass {
              backdrop-filter: blur(28px) saturate(1.65);
              -webkit-backdrop-filter: blur(28px) saturate(1.65);
            }
            .gg-noise { opacity: 0.065; }
          }
        `}</style>
      </motion.div>
    </div>
  );
}

/* ------------------------------- Page -------------------------------- */

export default function AdminPortalPage() {
  const gate = useAdminGate();

  if (!gate.ready) {
    return (
      <div className="relative min-h-screen grid place-items-center text-slate-100 bg-black">
        <div className="w-[min(580px,92vw)] px-5">
          <GradientBorder intensity={0.95}>
            <GlassShell className="p-7">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-300/90">
                Glass Guardian • Admin
              </div>
              <div className="mt-3 text-xl font-semibold text-white">Verifying access…</div>
              <div className="mt-5 space-y-4">
                <SkeletonBlock className="h-5 w-[65%]" />
                <SkeletonBlock className="h-5 w-[92%]" />
                <SkeletonBlock className="h-5 w-[78%]" />
              </div>
            </GlassShell>
          </GradientBorder>
        </div>
      </div>
    );
  }

  if (!gate.allowed) return null;

  return (
    <PortalErrorBoundary>
      <PortalContent gateName={gate.name} />
    </PortalErrorBoundary>
  );
}