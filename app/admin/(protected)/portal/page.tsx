// app/admin/(protected)/portal/page.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  DollarSign,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  Star,
  ArrowRight,
  Siren,
  BellRing,
  X,
  ShieldCheck,
  Sparkles,
  Activity,
  Cloud,
  Database,
  CreditCard,
  Mail,
  Server,
  Globe2,
  Radio,
  Phone,
  MapPin,
  MessageCircle,
  CalendarCheck,
  Ban,
  CircleDashed,
  Loader2,
  ExternalLink,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

const HeroBackground3D = dynamic(
  () => import("@/components/home/web/backgrounds/HeroBackground3D"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-[#05070b] via-[#0a0d12] to-black" />
    ),
  },
);

/* ----------------------------- Types ----------------------------- */

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
  scheduled_time_end?: string | null;
  status?: string | null;
  service_type?: string | null;
  customer_email?: string | null;
  technician_email?: string | null;
  service_address?: string | null;
  location_type?: string | null;
  estimate_amount?: number | null;
};

type InvoiceRow = {
  id: string;
  invoice_date?: string | null;
  status?: string | null;
  total_cents?: number | null;
  final_paid_cents?: number | null;
  paid_at?: string | null;
};

type UsersPublicRow = {
  id: string;
  email?: string | null;
  role?: Role | null;
  customer_name?: string | null;
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

type UrgentAlert = {
  key: string;
  createdAtMs: number;
  apt: AppointmentRow;
  seen: boolean;
};

type HealthStatus = "good" | "warning" | "error";

type HealthService = {
  key: string;
  name: string;
  icon: React.ReactNode;
  status: HealthStatus;
  summary: string;
  detail: string;
  errors: string[];
};

type LeadStatus =
  | "new"
  | "contacted"
  | "booked"
  | "completed"
  | "no_response"
  | "canceled";

type BookingLead = {
  id: string;
  created_at: string;
  full_name?: string | null;
  name?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  phone_number?: string | null;
  contact_phone?: string | null;
  zip?: string | null;
  postal_code?: string | null;
  chips?: number | string | null;
  chip_count?: number | string | null;
  damage_count?: number | string | null;
  num_chips?: number | string | null;
  slot?: string | null;
  photo_url?: string | null;
  source?: string | null;
  status?: LeadStatus | string | null;
  last_contacted_at?: string | null;
};

/* ----------------------------- Lead Status ----------------------------- */

const LEAD_STATUS_META: Record<
  LeadStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  new: {
    label: "New",
    icon: Sparkles,
    className: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  },
  contacted: {
    label: "Contacted",
    icon: MessageCircle,
    className: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  },
  booked: {
    label: "Booked",
    icon: CalendarCheck,
    className: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "border-green-300/30 bg-green-400/10 text-green-100",
  },
  no_response: {
    label: "No Response",
    icon: CircleDashed,
    className: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  },
  canceled: {
    label: "Canceled",
    icon: Ban,
    className: "border-rose-300/30 bg-rose-400/10 text-rose-100",
  },
};

/* ----------------------------- Helpers ----------------------------- */

function safeString(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function pickLeadName(lead: BookingLead) {
  return (
    safeString(lead.full_name) ||
    safeString(lead.name) ||
    safeString(lead.customer_name) ||
    "Unknown lead"
  );
}

function pickLeadPhone(lead: BookingLead) {
  return (
    safeString(lead.phone) ||
    safeString(lead.mobile) ||
    safeString(lead.phone_number) ||
    safeString(lead.contact_phone)
  );
}

function pickLeadZip(lead: BookingLead) {
  return safeString(lead.zip) || safeString(lead.postal_code);
}

function pickLeadChips(lead: BookingLead) {
  return (
    safeString(lead.chips) ||
    safeString(lead.chip_count) ||
    safeString(lead.damage_count) ||
    safeString(lead.num_chips)
  );
}

function pickLeadStatus(lead: BookingLead): LeadStatus {
  const raw = safeString(lead.status) as LeadStatus;
  return raw && raw in LEAD_STATUS_META ? raw : "new";
}

function formatLeadAge(createdAt?: string | null) {
  if (!createdAt) return "—";

  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "—";

  const diff = Date.now() - created;
  const mins = Math.max(0, Math.round(diff / 60_000));

  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;

  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

async function fetchAdminProfileByTable(email: string): Promise<{
  allowed: boolean;
  name?: string | null;
}> {
  if (!email) return { allowed: false };

  const { data, error } = await supabaseClient
    .from("admins")
    .select("role, is_active, name, email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error || !data) return { allowed: false };

  const role = String(data.role ?? "");
  const allowed =
    data.is_active === true && (role === "admin" || role === "support");

  const name = String(data.name ?? "").trim() || null;

  return { allowed, name };
}

function resolveRole(u: SupaUserLike | null | undefined): Role | null {
  if (!u) return null;

  const appRole = (u.app_metadata as any)?.role;
  const userRole = (u.user_metadata as any)?.role;
  const r = (appRole ?? userRole ?? null) as Role | null;

  return typeof r === "string" ? r : null;
}

function resolveDisplayName(
  email: string | null,
  userMetadata?: Record<string, unknown>,
) {
  const full = (userMetadata as any)?.full_name;
  const name = (userMetadata as any)?.name;

  if (typeof full === "string" && full.trim()) return full.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  if (email?.includes("@")) return email.split("@")[0]!;

  return "Admin";
}

function safeMsFromISO(iso?: string | null): number {
  if (!iso) return Date.now();

  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

function titleCaseServiceType(v?: string | null) {
  return String(v ?? "")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function urgencyTier(apt: AppointmentRow): "critical" | "urgent" | "normal" {
  const st = String(apt.service_type ?? "");
  const status = String(apt.status ?? "");

  if (st === "insurance") return "critical";

  if (status === "estimating" || status === "pending" || status === "new") {
    return "urgent";
  }

  return "normal";
}

function formatMoney(v?: number | null) {
  const n = Number(v ?? 0);

  if (!Number.isFinite(n)) return "$0.00";

  return `$${n.toFixed(2)}`;
}

function formatAptWhen(apt: AppointmentRow) {
  const d = apt.scheduled_date ?? "—";
  const s = apt.scheduled_time_start ?? "";
  const e = apt.scheduled_time_end ?? "";
  const t = s ? (e ? `${s}–${e}` : s) : "—";

  return { d, t };
}

function isNewRequest(apt: AppointmentRow): boolean {
  const s = String(apt.status ?? "new").toLowerCase().trim();

  const done = new Set([
    "completed",
    "complete",
    "paid",
    "cancelled",
    "canceled",
    "declined",
    "rejected",
    "no_show",
    "noshow",
    "refunded",
  ]);

  if (done.has(s)) return false;

  const allow = new Set([
    "new",
    "pending",
    "estimating",
    "estimate",
    "requested",
    "request",
    "unassigned",
    "submitted",
    "needs_review",
    "needs review",
  ]);

  if (!s) return true;
  if (allow.has(s)) return true;

  return false;
}

function getErrorMessage(err: unknown) {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof (err as any)?.message === "string") return (err as any).message;

  return "Unknown error";
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
    let unsubscribe: (() => void) | null = null;

    const allow = (name: string, email: string | null, devActive = false) => {
      if (!mounted) return;

      setState({ name, email, devActive, ready: true, allowed: true });
    };

    const block = () => {
      if (!mounted || redirected) return;

      redirected = true;

      setState((s) => ({ ...s, ready: true, allowed: false }));

      router.replace(
        `/admin/login?redirect=${encodeURIComponent("/admin/portal")}`,
      );
    };

    async function verifyUser(user: any) {
      const email = user?.email ?? null;
      const role = resolveRole(user as any);

      if (user && email) {
        const adminProfile = await fetchAdminProfileByTable(email);

        if (adminProfile.allowed) {
          allow(
            adminProfile.name ||
              resolveDisplayName(email, (user as any)?.user_metadata),
            email,
            false,
          );

          return true;
        }
      }

      if (user && (role === "admin" || role === "support")) {
        allow(
          resolveDisplayName(email, (user as any)?.user_metadata),
          email,
          false,
        );

        return true;
      }

      return false;
    }

    (async () => {
      const { data } = await supabaseClient.auth.getSession();

      const session = data?.session ?? null;
      const user = session?.user ?? null;
      const verified = await verifyUser(user);

      if (verified) return;

      const devRole = String(readDevRoleFromCookie() ?? "");

      if (devRole === "admin" || devRole === "support") {
        const dev = makeDevUser("admin");

        allow(dev.user_metadata?.full_name || `Dev ${devRole}`, dev.email, true);

        return;
      }

      const { data: sub } = supabaseClient.auth.onAuthStateChange(
        async (_evt, sess) => {
          if (!mounted || redirected) return;

          const u = sess?.user ?? null;
          const verifiedFromChange = await verifyUser(u);

          if (verifiedFromChange) return;

          const devRoleFromChange = String(readDevRoleFromCookie() ?? "");

          if (
            devRoleFromChange === "admin" ||
            devRoleFromChange === "support"
          ) {
            const dev = makeDevUser("admin");

            allow(
              dev.user_metadata?.full_name || `Dev ${devRoleFromChange}`,
              dev.email,
              true,
            );

            return;
          }

          block();
        },
      );

      unsubscribe = () => sub?.subscription?.unsubscribe();
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [router]);

  return state;
}

/* --------------------------- Data fetchers --------------------------- */

async function fetchAppointments(): Promise<AppointmentRow[]> {
  try {
    const { data, error, status } = await supabaseClient
      .from("appointments")
      .select(
        "id, created_at, scheduled_date, scheduled_time_start, scheduled_time_end, status, service_type, customer_email, technician_email, service_address, location_type, estimate_amount",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status === 404) return [];
    if (error) throw error;

    return (data as AppointmentRow[]) ?? [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("fetchAppointments:", e);
    }

    return [];
  }
}

async function fetchInvoices(): Promise<InvoiceRow[]> {
  try {
    const { data, error, status } = await supabaseClient
      .from("tech_invoices")
      .select("id, invoice_date, status, total_cents, final_paid_cents, paid_at")
      .order("invoice_date", { ascending: false })
      .limit(200);

    if (status === 404) return [];
    if (error) throw error;

    return (data as InvoiceRow[]) ?? [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("fetchInvoices (tech_invoices):", e);
    }

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
    if (process.env.NODE_ENV !== "production") {
      console.warn("fetchUsersByRole:", e);
    }

    return [];
  }
}

async function fetchBookingLeads(): Promise<BookingLead[]> {
  try {
    const { data, error, status } = await supabaseClient
      .from("booking_leads")
      .select("*")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5);

    if (status === 404) return [];
    if (error) throw error;

    return (data as BookingLead[]) ?? [];
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("fetchBookingLeads:", e);
    }

    return [];
  }
}

/* ------------------------- Motion presets -------------------------- */

const vPage = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.36,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.055,
    },
  },
};

const vSection = {
  hidden: { opacity: 0, y: 12, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 300, damping: 28 },
  },
};

const vItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
};

/* ------------------------- UI building blocks -------------------------- */

function GradientBorder({
  children,
  className = "",
  intensity = 0.88,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  return (
    <div className={`relative group ${className}`}>
      <div
        className="absolute -inset-[1px] rounded-[26px] blur-[3px] transition-all duration-500 group-hover:blur-[5px]"
        style={{
          opacity: intensity,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035) 28%, rgba(148,163,184,0.08) 58%, rgba(255,255,255,0.11) 100%)",
        }}
      />

      <div className="relative rounded-[26px]">{children}</div>
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
      className={`gg-glass rounded-[26px] border overflow-hidden ${
        dense ? "gg-glass-dense" : ""
      } ${className}`}
      style={{ borderColor: "rgba(255,255,255,0.12)" }}
    >
      <div className="gg-liquid-sheen pointer-events-none absolute inset-0 rounded-[26px]" />
      <div className="gg-top-line pointer-events-none absolute inset-x-0 top-0 h-px" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Tilt({
  children,
  className = "",
  max = 8,
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
    [max],
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
  sub,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  sub: string;
  loading?: boolean;
}) {
  return (
    <motion.div variants={vItem}>
      <GradientBorder intensity={0.84}>
        <GlassShell className="p-5 md:p-6 gg-lift">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {icon}
            </div>

            <div className="min-w-0 text-right">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {title}
              </div>

              <div className="mt-2 text-3xl md:text-4xl font-extrabold leading-none text-white tabular-nums gg-text-pop">
                {loading ? (
                  <span className="inline-block w-[110px]">
                    <SkeletonBlock className="h-10 w-full" />
                  </span>
                ) : (
                  value
                )}
              </div>

              <div className="mt-2 text-sm text-slate-400">{sub}</div>
            </div>
          </div>
        </GlassShell>
      </GradientBorder>
    </motion.div>
  );
}

function WorkflowLoad({
  newRequests,
  activeAppointments,
  completedAppointments,
}: {
  newRequests: number;
  activeAppointments: number;
  completedAppointments: number;
}) {
  const total = Math.max(
    1,
    newRequests + activeAppointments + completedAppointments,
  );
  const newPct = Math.round((newRequests / total) * 100);
  const activePct = Math.round((activeAppointments / total) * 100);
  const completePct = Math.max(0, 100 - newPct - activePct);

  return (
    <motion.section variants={vSection}>
      <GradientBorder intensity={0.86}>
        <GlassShell className="p-5 md:p-6 gg-lift">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                <Activity className="h-5 w-5 text-sky-300" />
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Workflow Load
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  Live tracking
                </div>
              </div>
            </div>

            <div className="min-w-0 lg:min-w-[520px]">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <span>{total} records tracked</span>
                <span>Live</span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full border border-white/10 bg-black/30">
                <div className="flex h-full w-full">
                  <div
                    className="gg-load-new"
                    style={{ width: `${newPct}%` }}
                  />
                  <div
                    className="gg-load-active"
                    style={{ width: `${activePct}%` }}
                  />
                  <div
                    className="gg-load-complete"
                    style={{ width: `${completePct}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <span className="text-amber-200">{newRequests}</span>{" "}
                  <span className="text-slate-400">new</span>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <span className="text-sky-200">{activeAppointments}</span>{" "}
                  <span className="text-slate-400">active</span>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <span className="text-emerald-200">
                    {completedAppointments}
                  </span>{" "}
                  <span className="text-slate-400">done</span>
                </div>
              </div>
            </div>
          </div>
        </GlassShell>
      </GradientBorder>
    </motion.section>
  );
}

/* ------------------------- Booking Lead Flow Panel -------------------------- */

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const meta = LEAD_STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        meta.className,
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function BookingLeadFlowPanel({
  leads,
  pendingLeadId,
  onChangeStatus,
}: {
  leads: BookingLead[];
  pendingLeadId: string | null;
  onChangeStatus: (leadId: string, status: LeadStatus) => void;
}) {
  if (!leads.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-slate-400">
        No recent booking leads yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead) => {
        const status = pickLeadStatus(lead);
        const name = pickLeadName(lead);
        const phone = pickLeadPhone(lead);
        const zip = pickLeadZip(lead);
        const chips = pickLeadChips(lead);
        const pending = pendingLeadId === lead.id;

        return (
          <div
            key={lead.id}
            className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_50px_rgba(2,6,14,0.35)] transition hover:border-cyan-300/35 hover:bg-white/[0.06]"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-white">
                      {name}
                    </div>
                    <LeadStatusBadge status={status} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    {phone ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {phone}
                      </span>
                    ) : null}

                    {zip ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        ZIP {zip}
                      </span>
                    ) : null}

                    {chips ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        {chips} chip{Number(chips) === 1 ? "" : "s"}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {formatLeadAge(lead.created_at)}
                    </span>
                  </div>
                </div>

                <Link href={`/admin/portal/bookingleads/${lead.id}`}>
                  <Button className="gg-btn shrink-0">
                    Open
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Lead flow status
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    Change status only here. Open lead for notes/details.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                  ) : null}

                  <select
                    value={status}
                    disabled={pending}
                    onChange={(event) =>
                      onChangeStatus(lead.id, event.target.value as LeadStatus)
                    }
                    className="rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-slate-100 outline-none transition hover:border-cyan-300/50 focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {Object.entries(LEAD_STATUS_META).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------- Health Panel -------------------------- */

function getPastDays(count = 21) {

  return Array.from({ length: count }).map((_, index) => {

    const date = new Date();

    date.setDate(date.getDate() - (count - 1 - index));

    return {

      date,

      iso: date.toISOString().slice(0, 10),

      label: date.toLocaleDateString(undefined, {

        month: "short",

        day: "numeric",

      }),

    };

  });

}

/* ------------------------- Health Panel -------------------------- */

function PortalHealthPanel({

  services,

  loadingCore,

}: {

  services: HealthService[];

  loadingCore: boolean;

}) {

  const days = React.useMemo(() => getPastDays(21), []);

  const todayIso = new Date().toISOString().slice(0, 10);

  const hasErrors = services.some((s) => s.status === "error");

  const hasWarnings = services.some((s) => s.status === "warning");

  const overall: HealthStatus = hasErrors

    ? "error"

    : hasWarnings

      ? "warning"

      : "good";

  const statusCopy =

    overall === "error"

      ? "Action needed"

      : overall === "warning"

        ? "Needs wiring"

        : loadingCore

          ? "Syncing"

          : "Operational";

  const dotClass =

    overall === "error"

      ? "bg-rose-400 text-rose-400"

      : overall === "warning"

        ? "bg-amber-400 text-amber-400"

        : "bg-emerald-400 text-emerald-400";

  return (

    <motion.section variants={vSection}>

      <GradientBorder intensity={0.9}>

        <GlassShell className="p-5 md:p-6 gg-lift">

          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">

                  <Server className="h-5 w-5 text-slate-100" />

                </div>

                <div>

                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">

                    System Status

                  </div>

                  <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">

                    Portal health

                    <span

                      className={`inline-block h-3 w-3 rounded-full ${dotClass} gg-dot`}

                    />

                  </div>

                </div>

                <span

                  className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${

                    overall === "error"

                      ? "border-rose-300/20 bg-rose-500/10 text-rose-100"

                      : overall === "warning"

                        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"

                        : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"

                  }`}

                >

                  {statusCopy}

                </span>

              </div>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">

                Compact service monitor for Supabase, auth, payments, email,

                public site, and app data. Green daily bars mean clear. Amber

                means watch. Red means action needed.

              </p>

            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xl:min-w-[520px]">

              {services.map((service) => (

                <div

                  key={service.key}

                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3"

                  title={service.detail}

                >

                  <div className="flex items-center justify-between gap-2">

                    <span className="text-slate-300">{service.icon}</span>

                    <span

                      className={`h-2.5 w-2.5 rounded-full ${

                        service.status === "error"

                          ? "bg-rose-400"

                          : service.status === "warning"

                            ? "bg-amber-400"

                            : "bg-emerald-400"

                      } gg-dot`}

                    />

                  </div>

                  <div className="mt-2 text-xs font-semibold text-white truncate">

                    {service.name}

                  </div>

                  <div className="mt-1 text-[11px] text-slate-500 truncate">

                    {service.summary}

                  </div>

                </div>

              ))}

            </div>

          </div>

          <div className="mt-6 space-y-3">

            {services.map((service) => {

              const todayHasError = service.status === "error";

              const todayHasWarning = service.status === "warning";

              return (

                <div

                  key={`${service.key}-history`}

                  className="grid grid-cols-[118px_minmax(0,1fr)] md:grid-cols-[160px_minmax(0,1fr)_220px] gap-3 items-center rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3"

                >

                  <div className="min-w-0 flex items-center gap-2">

                    <span className="text-slate-300 shrink-0">

                      {service.icon}

                    </span>

                    <div className="min-w-0">

                      <div className="text-xs font-semibold text-white truncate">

                        {service.name}

                      </div>

                      <div className="text-[11px] text-slate-500 truncate">

                        {service.summary}

                      </div>

                    </div>

                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">

                    {days.map((day) => {

                      const isToday = day.iso === todayIso;

                      const color =

                        isToday && todayHasError

                          ? "bg-rose-400 hover:bg-rose-300"

                          : isToday && todayHasWarning

                            ? "bg-amber-400 hover:bg-amber-300"

                            : "bg-emerald-400 hover:bg-emerald-300";

                      const title =

                        isToday && service.errors.length

                          ? `${day.label} ${day.iso} — ${service.errors.join("; ")}`

                          : isToday && todayHasWarning

                            ? `${day.label} ${day.iso} — ${service.detail}`

                            : `${day.label} ${day.iso} — All good`;

                      return (

                        <span

                          key={`${service.key}-${day.iso}`}

                          title={title}

                          className={`h-8 min-w-[5px] rounded-full transition ${color} ${

                            isToday ? "ring-2 ring-white/20" : ""

                          }`}

                        />

                      );

                    })}

                  </div>

                  <div className="hidden md:block text-right">

                    <div

                      className={`text-xs font-semibold ${

                        service.status === "error"

                          ? "text-rose-200"

                          : service.status === "warning"

                            ? "text-amber-200"

                            : "text-emerald-200"

                      }`}

                    >

                      {service.status === "error"

                        ? "Error"

                        : service.status === "warning"

                          ? "Watch"

                          : "Good"}

                    </div>

                    <div className="mt-1 text-[11px] text-slate-500 truncate">

                      {service.detail}

                    </div>

                  </div>

                </div>

              );

            })}

          </div>

        </GlassShell>

      </GradientBorder>

    </motion.section>

  );

}

/* ------------------------- Alert -------------------------- */

function UrgentAppointmentAlert({
  alerts,
  onDismissOne,
  onDismissAll,
}: {
  alerts: UrgentAlert[];
  onDismissOne: (key: string) => void;
  onDismissAll: () => void;
}) {
  const unseen = alerts.filter((a) => !a.seen);
  const top = unseen[0] ?? alerts[0];

  if (!top) return null;

  const tier = urgencyTier(top.apt);
  const title = titleCaseServiceType(top.apt.service_type) || "Appointment";
  const email = top.apt.customer_email ?? "—";
  const when = formatAptWhen(top.apt);
  const status = String(top.apt.status ?? "new").replace(/_/g, " ");
  const price = formatMoney(top.apt.estimate_amount);

  const tone =
    tier === "critical"
      ? {
          ring: "rgba(251,113,133,0.28)",
          bg:
            "linear-gradient(135deg, rgba(44,11,19,0.82), rgba(20,22,28,0.88), rgba(10,11,16,0.96))",
          badge: "bg-rose-500/10 border-rose-300/20 text-rose-100",
          icon: <Siren className="h-5 w-5 text-rose-300" />,
          label: "CRITICAL • Insurance Booking",
        }
      : {
          ring: "rgba(245,158,11,0.24)",
          bg:
            "linear-gradient(135deg, rgba(37,28,10,0.82), rgba(20,22,28,0.88), rgba(10,11,16,0.96))",
          badge: "bg-amber-500/10 border-amber-300/20 text-amber-100",
          icon: <BellRing className="h-5 w-5 text-amber-300" />,
          label: "URGENT • New Appointment",
        };

  return (
    <AnimatePresence>
      <motion.div
        key={top.key}
        initial={{ opacity: 0, y: -18, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="fixed top-4 left-0 right-0 z-[80] px-4 md:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div
            className="relative overflow-hidden rounded-[22px] border"
            style={{
              borderColor: tone.ring,
              background: tone.bg,
              boxShadow:
                "0 28px 110px rgba(0,0,0,0.48), 0 10px 40px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.06)",
              backdropFilter: "blur(18px) saturate(1.25)",
              WebkitBackdropFilter: "blur(18px) saturate(1.25)",
            }}
          >
            <div className="relative p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] gg-icon-glow">
                  {tone.icon}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase ${tone.badge}`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {tone.label}
                    </span>

                    {unseen.length > 1 && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-100/90">
                        <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                        {unseen.length} new
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-base md:text-lg font-extrabold text-white gg-text-pop truncate">
                    {title} • {email}
                  </div>

                  <div className="mt-1 text-sm text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-300" />
                      {when.d}
                    </span>

                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-300" />
                      {when.t}
                    </span>

                    <span className="inline-flex items-center gap-2 capitalize">
                      <CheckCircle className="h-4 w-4 text-slate-300" />
                      {status}
                    </span>

                    <span className="inline-flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-slate-300" />
                      Est: {price}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                <Link href={`/admin/appointments/${top.apt.id}`}>
                  <Button className="gg-btn">
                    Open Appointment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  className="gg-btn-outline"
                  onClick={() => onDismissOne(top.key)}
                >
                  Dismiss
                </Button>

                {alerts.length > 1 && (
                  <Button
                    variant="ghost"
                    className="rounded-xl border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                    onClick={onDismissAll}
                    title="Clear all alerts"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
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
    return {
      hasError: true,
      msg: typeof err?.message === "string" ? err.message : "Unexpected error",
    };
  }

  componentDidCatch(err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("AdminPortal error:", err);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen grid place-items-center bg-black text-slate-100 px-6">
        <div className="max-w-lg w-full">
          <GradientBorder intensity={0.9}>
            <GlassShell className="p-7">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Glass Guardian • Portal
              </div>

              <h2 className="mt-3 text-2xl font-extrabold text-white">
                Something glitched.
              </h2>

              <p className="mt-3 text-base text-slate-300">
                Refresh the page. If the issue persists, check console logs or
                contact support.
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200/90">
                {this.state.msg}
              </div>

              <div className="mt-6 flex gap-4">
                <Button
                  className="gg-btn flex-1"
                  onClick={() => window.location.reload()}
                >
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
  const queryClient = useQueryClient();

  const [urgentAlerts, setUrgentAlerts] = React.useState<UrgentAlert[]>([]);
  const lastInsertIdRef = React.useRef<string | null>(null);
  const didMountRef = React.useRef(false);
  const [aptView, setAptView] = React.useState<"new" | "active">("new");

  const qAppointments = useQuery({
    queryKey: ["admin:appointments"],
    queryFn: fetchAppointments,
    staleTime: 15000,
    refetchInterval: 15000,
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
    refetchInterval: 15000,
  });

  const [pendingLeadId, setPendingLeadId] = React.useState<string | null>(null);

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({
      leadId,
      status,
    }: {
      leadId: string;
      status: LeadStatus;
    }) => {
      const patch: Record<string, any> = { status };

      if (status === "contacted" || status === "booked") {
        patch.last_contacted_at = new Date().toISOString();
      }

      const { data, error } = await supabaseClient
        .from("booking_leads")
        .update(patch)
        .eq("id", leadId)
        .select("id,status,last_contacted_at")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "Lead status update matched 0 rows. Check RLS/admin access.",
        );
      }

      return data;
    },
    onMutate: ({ leadId }) => {
      setPendingLeadId(leadId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin:booking_leads"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin:booking_leads_stats"],
        exact: false,
      });
    },
    onError: (error) => {
      console.error("Failed to update booking lead status:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not update lead status.",
      );
    },
    onSettled: () => {
      setPendingLeadId(null);
    },
  });

  const appointments = qAppointments.data ?? [];
  const invoices = qInvoices.data ?? [];
  const customers = qCustomers.data ?? [];
  const technicians = qTechs.data ?? [];
  const bookingLeads = qLeads.data ?? [];

  const loadingCore =
    qAppointments.isLoading ||
    qInvoices.isLoading ||
    qCustomers.isLoading ||
    qTechs.isLoading;

  const totalRevenue =
    invoices
      .filter(
        (inv) =>
          ["paid", "completed"].includes(String(inv.status ?? "")) ||
          !!inv.paid_at,
      )
      .reduce((sum, inv) => {
        const cents =
          typeof inv.final_paid_cents === "number"
            ? inv.final_paid_cents
            : typeof inv.total_cents === "number"
            ? inv.total_cents
            : 0;

        return sum + cents;
      }, 0) / 100;

  const activeAppointments = appointments.filter(
    (apt) =>
      !["completed", "complete", "cancelled", "canceled", "paid"].includes(
        String(apt.status ?? "").toLowerCase(),
      ),
  );

  const completedAppointments = appointments.filter((apt) =>
    ["completed", "complete", "paid"].includes(
      String(apt.status ?? "").toLowerCase(),
    ),
  );

  const newRequests = React.useMemo(
    () => appointments.filter(isNewRequest),
    [appointments],
  );

  const visibleAppointments =
    aptView === "new" ? newRequests : activeAppointments;

  const shouldShowAppointmentsPanel = visibleAppointments.length > 0;
  const shouldShowLeadsPanel = bookingLeads.length > 0;
  const shouldShowLivePanels =
    shouldShowAppointmentsPanel || shouldShowLeadsPanel;

  const avgRating =
    technicians.reduce((sum, tech) => sum + (Number(tech.tech_rating) || 0), 0) /
    (technicians.length || 1);

  const healthServices: HealthService[] = React.useMemo(() => {
    const appointmentErr = getErrorMessage(qAppointments.error);
    const invoiceErr = getErrorMessage(qInvoices.error);
    const customerErr = getErrorMessage(qCustomers.error);
    const techErr = getErrorMessage(qTechs.error);
    const leadErr = getErrorMessage(qLeads.error);

    const supaErrors = [
      appointmentErr,
      invoiceErr,
      customerErr,
      techErr,
      leadErr,
    ].filter(Boolean);

    return [
      {
        key: "supabase",
        name: "Supabase DB",
        icon: <Database className="h-4 w-4" />,
        status: supaErrors.length ? "error" : "good",
        summary: supaErrors.length ? "Query issue" : "Connected",
        detail: supaErrors.length
          ? supaErrors[0]
          : "Appointments, invoices, customers, techs, and leads are reachable.",
        errors: supaErrors,
      },
      {
        key: "auth",
        name: "Admin Auth",
        icon: <ShieldCheck className="h-4 w-4" />,
        status: "good",
        summary: "Gate passed",
        detail: "Admin gate verified session, admin table, or dev admin role.",
        errors: [],
      },
      {
        key: "appointments",
        name: "Appointments",
        icon: <Calendar className="h-4 w-4" />,
        status: appointmentErr ? "error" : "good",
        summary: appointmentErr ? "Needs review" : `${appointments.length} loaded`,
        detail: appointmentErr || "Appointment table is responding.",
        errors: appointmentErr ? [appointmentErr] : [],
      },
      {
        key: "invoices",
        name: "Invoices",
        icon: <DollarSign className="h-4 w-4" />,
        status: invoiceErr ? "error" : "good",
        summary: invoiceErr ? "Needs review" : `${invoices.length} loaded`,
        detail: invoiceErr || "tech_invoices table is responding.",
        errors: invoiceErr ? [invoiceErr] : [],
      },
      {
        key: "leads",
        name: "Booking Leads",
        icon: <Radio className="h-4 w-4" />,
        status: leadErr ? "error" : "good",
        summary: leadErr ? "Needs review" : `${bookingLeads.length} loaded`,
        detail: leadErr || "booking_leads table is responding.",
        errors: leadErr ? [leadErr] : [],
      },
      {
        key: "vercel",
        name: "Vercel",
        icon: <Cloud className="h-4 w-4" />,
        status: "warning",
        summary: "Watch ready",
        detail:
          "Add /api/admin/health/vercel later for real deployment and uptime checks.",
        errors: [],
      },
      {
        key: "stripe",
        name: "Stripe",
        icon: <CreditCard className="h-4 w-4" />,
        status: "warning",
        summary: "Watch ready",
        detail:
          "Add /api/admin/health/stripe later to verify checkout, webhooks, and API keys.",
        errors: [],
      },
      {
        key: "resend",
        name: "Resend",
        icon: <Mail className="h-4 w-4" />,
        status: "warning",
        summary: "Watch ready",
        detail:
          "Add /api/admin/health/resend later to verify outbound email health.",
        errors: [],
      },
      {
        key: "site",
        name: "Public Site",
        icon: <Globe2 className="h-4 w-4" />,
        status: "warning",
        summary: "Watch ready",
        detail:
          "Add /api/admin/health/site later to ping /, /home, booking, and payment pages.",
        errors: [],
      },
    ];
  }, [
    qAppointments.error,
    qInvoices.error,
    qCustomers.error,
    qTechs.error,
    qLeads.error,
    appointments.length,
    invoices.length,
    bookingLeads.length,
  ]);

  React.useEffect(() => {
    if (didMountRef.current) return;

    didMountRef.current = true;

    const channel = supabaseClient
      .channel("gg-admin-appointments-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        (payload: any) => {
          const apt = payload?.new as AppointmentRow | undefined;

          if (!apt?.id) return;
          if (lastInsertIdRef.current === apt.id) return;

          lastInsertIdRef.current = apt.id;

          const createdAtMs = safeMsFromISO(apt.created_at);
          const key = `${apt.id}:${createdAtMs}`;

          const alert: UrgentAlert = {
            key,
            createdAtMs,
            apt,
            seen: false,
          };

          setUrgentAlerts((prev) => {
            const exists = prev.some((a) => a.key === key || a.apt.id === apt.id);
            if (exists) return prev;

            return [alert, ...prev].slice(0, 8);
          });

          queryClient.setQueryData<AppointmentRow[]>(
            ["admin:appointments"],
            (old) => {
              const prev = Array.isArray(old) ? old : [];
              const already = prev.some((x) => x.id === apt.id);

              if (already) return prev;

              return [apt, ...prev].slice(0, 200);
            },
          );

          try {
            const tier = urgencyTier(apt);
            const url =
              tier === "critical"
                ? "/sounds/gg-critical.mp3"
                : "/sounds/gg-alert.mp3";

            const a = new Audio(url);
            a.volume = tier === "critical" ? 0.7 : 0.55;

            void a.play();
          } catch {
            // no-op
          }

          queryClient.invalidateQueries({ queryKey: ["admin:appointments"] });
        },
      )
      .subscribe();

    return () => {
      try {
        supabaseClient.removeChannel(channel);
      } catch {
        // no-op
      }
    };
  }, [queryClient]);

  React.useEffect(() => {
    if (urgentAlerts.length === 0) return;

    const t = window.setTimeout(() => {
      setUrgentAlerts((prev) => prev.map((a) => ({ ...a, seen: true })));
    }, 8500);

    return () => window.clearTimeout(t);
  }, [urgentAlerts.length]);

  const dismissOne = React.useCallback((key: string) => {
    setUrgentAlerts((prev) => prev.filter((a) => a.key !== key));
  }, []);

  const dismissAll = React.useCallback(() => {
    setUrgentAlerts([]);
  }, []);

  const quickStats = [
    {
      title: "Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      sub: "Paid + completed",
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: "Open Work",
      value: activeAppointments.length,
      sub: "Active appointments",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: "Technicians",
      value: technicians.length,
      sub: "Current roster",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Rating",
      value: avgRating.toFixed(1),
      sub: "Avg tech rating",
      icon: <Star className="h-5 w-5" />,
    },
  ];

  return (
    <div className="relative min-h-screen text-slate-100">
      <UrgentAppointmentAlert
        alerts={urgentAlerts}
        onDismissOne={dismissOne}
        onDismissAll={dismissAll}
      />

      <div className="absolute inset-0 -z-30">
        <HeroBackground3D />
      </div>

      <div className="absolute inset-0 -z-20 pointer-events-none">
        <div className="absolute inset-0 gg-aurora" />
        <div className="absolute inset-0 gg-vignette" />
        <div className="absolute inset-0 gg-noise opacity-[0.06] mix-blend-overlay" />
      </div>

      <motion.div
        variants={vPage}
        initial="hidden"
        animate="show"
        className="relative px-4 md:px-8 py-8 md:py-10"
        style={{ paddingTop: urgentAlerts.length ? 120 : undefined }}
      >
        <div className="max-w-7xl mx-auto space-y-8 md:space-y-10">
          <motion.section variants={vSection}>
            <GradientBorder intensity={0.92}>
              <GlassShell className="p-5 md:p-7 xl:p-8 gg-lift">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {urgentAlerts.some((a) => !a.seen) && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100 gg-pulse">
                        <Siren className="h-3.5 w-3.5 text-amber-300" />
                        {urgentAlerts.filter((a) => !a.seen).length} urgent
                      </span>
                    )}

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                      Admin Portal
                    </span>
                  </div>

                  <div className="mt-5">
                    <h1 className="text-3xl md:text-[2.6rem] font-extrabold leading-[1.02] text-white gg-title">
                      Welcome back, {gateName}!
                    </h1>
                  </div>

                  <div className="mt-5">
                    <ShimmerLine />
                  </div>

                  <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {quickStats.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                            {item.title}
                          </span>
                          <span className="text-slate-200">{item.icon}</span>
                        </div>

                        <div className="mt-3 text-2xl md:text-[1.9rem] font-extrabold text-white leading-none tabular-nums gg-text-pop">
                          {item.value}
                        </div>

                        <div className="mt-2 text-xs text-slate-400">
                          {item.sub}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassShell>
            </GradientBorder>
          </motion.section>

          <motion.section
            variants={vSection}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <StatCard
              title="New Requests"
              value={newRequests.length}
              sub="Waiting for review"
              icon={<Siren className="w-5 h-5 text-amber-300" />}
              loading={qAppointments.isLoading}
            />

            <StatCard
              title="Completed"
              value={completedAppointments.length}
              sub="All-time completions"
              icon={<CheckCircle className="w-5 h-5 text-emerald-300" />}
              loading={qAppointments.isLoading}
            />

            <StatCard
              title="Customers"
              value={customers.length}
              sub="Portal customer records"
              icon={<Users className="w-5 h-5 text-sky-300" />}
              loading={qCustomers.isLoading}
            />
          </motion.section>

          <WorkflowLoad
            newRequests={newRequests.length}
            activeAppointments={activeAppointments.length}
            completedAppointments={completedAppointments.length}
          />

          {shouldShowLivePanels && (
            <div className="grid xl:grid-cols-2 gap-6 md:gap-7">
              {shouldShowAppointmentsPanel && (
                <motion.section variants={vSection} className="min-w-0 h-full">
                  <GradientBorder intensity={0.9} className="h-full">
                    <GlassShell className="gg-lift h-full">
                      <Card className="bg-transparent border-0 shadow-none h-full">
                        <CardHeader className="px-5 md:px-6 pt-5 md:pt-6 pb-3">
                          <CardTitle className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-white text-xl">
                            <span className="flex items-center gap-3">
                              <Calendar className="w-5 h-5 text-slate-200" />
                              {aptView === "new"
                                ? "New Appointment Requests"
                                : "Active Appointments"}
                            </span>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.05] p-1">
                                <button
                                  type="button"
                                  onClick={() => setAptView("new")}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition ${
                                    aptView === "new"
                                      ? "bg-white/[0.12] text-white border border-white/10 shadow-[0_10px_26px_rgba(0,0,0,0.25)]"
                                      : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                                  }`}
                                >
                                  New ({newRequests.length})
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setAptView("active")}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition ${
                                    aptView === "active"
                                      ? "bg-white/[0.12] text-white border border-white/10 shadow-[0_10px_26px_rgba(0,0,0,0.25)]"
                                      : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                                  }`}
                                >
                                  Active ({activeAppointments.length})
                                </button>
                              </div>

                              <Link href="/admin/portal/calendar">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gg-btn-outline flex items-center gap-2 text-sm"
                                >
                                  View Calendar
                                  <ArrowRight className="ml-1.5 w-4 h-4" />
                                </Button>
                              </Link>
                            </div>
                          </CardTitle>
                        </CardHeader>

                        <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                          <div className="space-y-3.5 max-h-[620px] overflow-y-auto pr-1 gg-scroll">
                            <AnimatePresence initial={false}>
                              {visibleAppointments.slice(0, 30).map((apt) => {
                                const title =
                                  titleCaseServiceType(apt.service_type) ||
                                  "Appointment";
                                const tier = urgencyTier(apt);
                                const isJustNow =
                                  Date.now() - safeMsFromISO(apt.created_at) <
                                  60_000;
                                const statusLabel = String(apt.status ?? "new")
                                  .replace(/_/g, " ")
                                  .trim();
                                const { d, t } = formatAptWhen(apt);

                                const badge =
                                  tier === "critical"
                                    ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
                                    : tier === "urgent"
                                    ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
                                    : "border-white/10 bg-white/[0.05] text-slate-100";

                                return (
                                  <motion.div
                                    key={apt.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 12 }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 340,
                                      damping: 28,
                                    }}
                                  >
                                    <Tilt max={6} className="rounded-[22px]">
                                      <div
                                        className={`gg-row rounded-[22px] p-5 border bg-white/[0.045] text-slate-100 ${
                                          (tier === "critical" ||
                                            tier === "urgent") &&
                                          isJustNow
                                            ? "gg-urgent-ring"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex flex-col gap-4">
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="font-semibold text-base gg-text-pop truncate">
                                                {title}
                                              </p>

                                              <span
                                                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.14em] ${badge}`}
                                              >
                                                {tier === "critical" ||
                                                tier === "urgent" ? (
                                                  <Siren className="h-3.5 w-3.5" />
                                                ) : (
                                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-300" />
                                                )}
                                                {tier === "critical"
                                                  ? "Insurance"
                                                  : tier === "urgent"
                                                  ? "Urgent"
                                                  : "Normal"}
                                              </span>

                                              {isJustNow && (
                                                <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.14em] text-sky-100">
                                                  <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                                                  New
                                                </span>
                                              )}
                                            </div>

                                            <div className="mt-1 text-sm text-slate-300/90 truncate">
                                              {apt.customer_email ?? "—"}
                                            </div>

                                            <div className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300/90">
                                              <span className="inline-flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-slate-300" />
                                                {d}
                                              </span>

                                              <span className="inline-flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-slate-300" />
                                                {t}
                                              </span>

                                              <span className="inline-flex items-center gap-2 capitalize">
                                                <CheckCircle className="h-4 w-4 text-slate-300" />
                                                {statusLabel || "—"}
                                              </span>

                                              <span className="inline-flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-slate-300" />
                                                Est:{" "}
                                                {formatMoney(
                                                  apt.estimate_amount,
                                                )}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-[0.7rem] text-slate-400/80">
                                              {apt.created_at
                                                ? new Date(
                                                    apt.created_at,
                                                  ).toLocaleString()
                                                : ""}
                                            </div>

                                            <Link
                                              href={`/admin/appointments/${apt.id}`}
                                            >
                                              <Button className="gg-btn">
                                                Open
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                              </Button>
                                            </Link>
                                          </div>
                                        </div>
                                      </div>
                                    </Tilt>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>

                            {visibleAppointments.length > 30 && (
                              <div className="pt-2 text-center text-xs text-slate-400/90">
                                Showing first 30 of{" "}
                                {visibleAppointments.length}.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </GlassShell>
                  </GradientBorder>
                </motion.section>
              )}

              {shouldShowLeadsPanel && (
                <motion.section variants={vSection} className="min-w-0 h-full">
                  <GradientBorder intensity={0.88} className="h-full">
                    <GlassShell className="p-5 md:p-6 gg-lift h-full">
                      <div className="mb-4 flex items-center justify-between gap-4">
  <div>
    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
      Booking Leads
    </div>
    <div className="mt-1 text-lg font-semibold text-white">
      Recent new leads
    </div>
    <div className="mt-1 text-xs text-slate-500">
      Only new leads show here. Open full leads page for the full pipeline.
    </div>
  </div>

  <div className="flex flex-col items-end gap-2">
    <div className="text-sm text-slate-300/90">
      {qLeads.isLoading ? "Loading…" : `${bookingLeads.length} new`}
    </div>

    <Link href="/admin/portal/bookingleads">
      <Button size="sm" className="gg-btn">
        View all leads
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </Link>
  </div>
</div>

                      <div className="max-h-[620px] overflow-y-auto pr-1 gg-scroll">
                        {qLeads.isLoading ? (
                          <div className="space-y-3">
                            <SkeletonBlock className="h-24 w-full rounded-2xl" />
                            <SkeletonBlock className="h-24 w-full rounded-2xl" />
                            <SkeletonBlock className="h-24 w-full rounded-2xl" />
                          </div>
                        ) : (
                          <BookingLeadFlowPanel
                            leads={bookingLeads}
                            pendingLeadId={pendingLeadId}
                            onChangeStatus={(leadId, status) =>
                              updateLeadStatusMutation.mutate({
                                leadId,
                                status,
                              })
                            }
                          />
                        )}
                      </div>
                    </GlassShell>
                  </GradientBorder>
                </motion.section>
              )}
            </div>
          )}

          <PortalHealthPanel
            services={healthServices}
            loadingCore={loadingCore}
          />

          <motion.div
            variants={vSection}
            className="text-sm text-slate-400/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2"
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-block h-3 w-3 rounded-full ${
                  loadingCore ? "bg-amber-400" : "bg-emerald-400"
                } gg-dot`}
              />
              {loadingCore ? "Syncing latest data…" : "All systems synced"}
            </div>

            <div className="opacity-75">
              Glass Guardian • luxury graphite liquid glass
            </div>
          </motion.div>
        </div>

        <style jsx global>{`
          @keyframes gg-shimmer {
            0% {
              background-position: 0% 50%;
            }
            100% {
              background-position: 120% 50%;
            }
          }

          @keyframes gg-skel {
            0% {
              background-position: 0% 0%;
            }
            100% {
              background-position: 200% 0%;
            }
          }

          @keyframes gg-pulse {
            0% {
              transform: translateZ(0) scale(1);
              filter: brightness(1);
            }
            50% {
              transform: translateZ(0) scale(1.02);
              filter: brightness(1.06);
            }
            100% {
              transform: translateZ(0) scale(1);
              filter: brightness(1);
            }
          }

          .gg-pulse {
            animation: gg-pulse 1.45s ease-in-out infinite;
          }

          .gg-urgent-ring {
            border-color: rgba(245, 158, 11, 0.22) !important;
            box-shadow:
              0 0 0 1px rgba(245, 158, 11, 0.12),
              0 18px 65px rgba(245, 158, 11, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
          }

          .gg-glass {
            position: relative;
            overflow: hidden;
            background:
              linear-gradient(
                180deg,
                rgba(20, 22, 28, 0.62),
                rgba(11, 13, 18, 0.84) 38%,
                rgba(5, 6, 10, 0.94)
              );
            backdrop-filter: blur(22px) saturate(1.12);
            -webkit-backdrop-filter: blur(22px) saturate(1.12);
            box-shadow:
              0 42px 140px rgba(0, 0, 0, 0.56),
              0 18px 64px rgba(2, 4, 8, 0.72),
              inset 0 1px 0 rgba(255, 255, 255, 0.06),
              inset 0 -1px 0 rgba(255, 255, 255, 0.03);
          }

          .gg-glass-dense {
            backdrop-filter: blur(28px) saturate(1.16);
            -webkit-backdrop-filter: blur(28px) saturate(1.16);
          }

          .gg-top-line {
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0),
              rgba(255, 255, 255, 0.18),
              rgba(255, 255, 255, 0)
            );
            opacity: 0.65;
          }

          .gg-liquid-sheen {
            background:
              radial-gradient(
                780px 220px at var(--mx, 50%) var(--my, 50%),
                rgba(255, 255, 255, 0.085),
                transparent 58%
              ),
              radial-gradient(
                720px 260px at calc(var(--mx, 50%) + 10%)
                  calc(var(--my, 50%) + 12%),
                rgba(148, 163, 184, 0.08),
                transparent 60%
              ),
              linear-gradient(
                135deg,
                rgba(255, 255, 255, 0.05),
                rgba(255, 255, 255, 0.01) 50%,
                rgba(255, 255, 255, 0.05)
              );
            filter: blur(1px);
            opacity: 0.32;
            transition: opacity 0.35s ease;
            mix-blend-mode: screen;
          }

          .gg-glass:hover .gg-liquid-sheen {
            opacity: 0.62;
          }

          .gg-aurora {
            background:
              radial-gradient(
                1000px 680px at 12% 10%,
                rgba(148, 163, 184, 0.08),
                transparent 55%
              ),
              radial-gradient(
                900px 620px at 88% 82%,
                rgba(71, 85, 105, 0.11),
                transparent 58%
              ),
              radial-gradient(
                820px 580px at 62% 22%,
                rgba(255, 255, 255, 0.04),
                transparent 60%
              );
          }

          .gg-vignette {
            background: linear-gradient(
              180deg,
              rgba(4, 6, 10, 0.55),
              rgba(5, 7, 11, 0.84) 35%,
              rgba(0, 0, 0, 0.97)
            );
          }

          .gg-noise {
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' width='128' height='128' viewBox='0 0 128 128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(%23n)' opacity='0.36'/></svg>");
          }

          .gg-tilt {
            transform-style: preserve-3d;
            transform: perspective(1000px) rotateX(var(--rx, 0deg))
              rotateY(var(--ry, 0deg));
            transition:
              transform 180ms ease-out,
              filter 180ms ease-out;
          }

          .gg-lift {
            box-shadow:
              0 28px 110px rgba(0, 0, 0, 0.48),
              0 12px 42px rgba(3, 6, 12, 0.6),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
            transform: translateY(calc(var(--lift, 0) * -2px));
            transition:
              transform 180ms ease,
              box-shadow 180ms ease;
          }

          .gg-row {
            border-color: rgba(255, 255, 255, 0.1);
            box-shadow:
              0 18px 50px rgba(2, 6, 14, 0.48),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(14px) saturate(1.1);
            -webkit-backdrop-filter: blur(14px) saturate(1.1);
          }

          .gg-btn {
            position: relative;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: rgba(248, 250, 252, 0.96);
            box-shadow:
              0 14px 40px rgba(0, 0, 0, 0.34),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
            transition: all 0.18s ease;
          }

          .gg-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.18);
            transform: translateY(-1px);
          }

          .gg-btn-outline {
            background: rgba(255, 255, 255, 0.04) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            color: rgba(248, 250, 252, 0.94) !important;
          }

          .gg-btn-outline:hover {
            background: rgba(255, 255, 255, 0.08) !important;
          }

          .gg-title {
            text-shadow:
              0 14px 38px rgba(0, 0, 0, 0.52),
              0 0 22px rgba(255, 255, 255, 0.03);
          }

          .gg-text-pop {
            text-shadow:
              0 12px 30px rgba(0, 0, 0, 0.42),
              0 0 20px rgba(255, 255, 255, 0.02);
          }

          .gg-icon-glow {
            box-shadow:
              0 0 0 1px rgba(255, 255, 255, 0.05),
              0 0 24px rgba(255, 255, 255, 0.04);
          }

          .gg-shimmer {
            height: 1px;
            width: 100%;
            border-radius: 999px;
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05),
              rgba(255, 255, 255, 0.3),
              rgba(148, 163, 184, 0.18),
              rgba(255, 255, 255, 0.05)
            );
            background-size: 200% 100%;
            animation: gg-shimmer 3.6s linear infinite;
            opacity: 0.85;
          }

          .gg-skel {
            border-radius: 999px;
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05),
              rgba(255, 255, 255, 0.11),
              rgba(255, 255, 255, 0.05)
            );
            background-size: 200% 100%;
            animation: gg-skel 1.35s linear infinite;
          }

          .gg-dot {
            box-shadow: 0 0 18px currentColor;
          }

          .gg-load-new {
            background: linear-gradient(
              90deg,
              rgba(245, 158, 11, 0.65),
              rgba(251, 191, 36, 0.9)
            );
          }

          .gg-load-active {
            background: linear-gradient(
              90deg,
              rgba(56, 189, 248, 0.62),
              rgba(125, 211, 252, 0.9)
            );
          }

          .gg-load-complete {
            background: linear-gradient(
              90deg,
              rgba(52, 211, 153, 0.62),
              rgba(110, 231, 183, 0.92)
            );
          }

          .gg-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
          }

          .gg-scroll::-webkit-scrollbar {
            width: 8px;
          }

          .gg-scroll::-webkit-scrollbar-track {
            background: transparent;
          }

          .gg-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.16);
            border-radius: 999px;
          }

          @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
            .gg-glass {
              backdrop-filter: blur(26px) saturate(1.14);
              -webkit-backdrop-filter: blur(26px) saturate(1.14);
            }

            .gg-noise {
              opacity: 0.055;
            }
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
          <GradientBorder intensity={0.9}>
            <GlassShell className="p-7">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Glass Guardian • Admin
              </div>

              <div className="mt-3 text-xl font-semibold text-white">
                Verifying access…
              </div>

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