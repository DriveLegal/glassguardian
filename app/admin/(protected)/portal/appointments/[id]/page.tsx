// app/admin/(protected)/portal/appointments/[id]/page.tsx
"use client";
import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  MapPin,
  DollarSign,
  User as UserIcon,
  Wrench,
  Images,
  MessageSquare,
  CheckCircle,
  Clock,
  Phone,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Navigation,
  Timer,
  BadgeDollarSign,
  ScanEye,
  Activity,
  Camera,
  Eye,
  FileText,
  Lock,
  Loader2,
  PenSquare,
  RefreshCw,
  Route,
  X,
  CreditCard,
  ReceiptText,
  Unlock,
  Mail,
  Home,
} from "lucide-react";
type AnyObj = Record<string, any>;
type AdminOutcome = "completed" | "crack_out";
const HeroBackground3D = dynamic(
  () => import("@/components/home/web/backgrounds/HeroBackground3D"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 -z-30 bg-gradient-to-br from-slate-950 via-slate-900 to-black" />
    ),
  }
);
class BgErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("HeroBackground3D crashed, falling back:", err);
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 -z-30 bg-gradient-to-br from-slate-950 via-slate-900 to-black" />
      );
    }
    return this.props.children;
  }
}
function SafeHeroBackground3D() {
  return (
    <BgErrorBoundary>
      <HeroBackground3D />
    </BgErrorBoundary>
  );
}
/* ----------------------------- Tech mirror flow ----------------------------- */
const SERVICE_STATUS_STEPS = [
  { key: "requested", label: "Requested", icon: FileText },
  { key: "estimating", label: "Estimating", icon: DollarSign },
  { key: "estimate_sent", label: "Quote Sent", icon: DollarSign },
  { key: "approved", label: "Approved", icon: CheckCircle },
  { key: "scheduled", label: "Scheduled", icon: CalendarIcon },
  { key: "en_route", label: "En Route", icon: Route },
  { key: "on_site", label: "On Site", icon: MapPin },
  { key: "in_progress", label: "Repairing", icon: Wrench },
  { key: "curing", label: "Curing", icon: Clock },
  { key: "completed", label: "Completed", icon: CheckCircle },
] as const;
const TECH_WORKFLOW_STEPS = [
  { id: "arrive", label: "Arrive on Site", status: "on_site", icon: MapPin },
  { id: "inspect", label: "Inspect Damage", status: "on_site", icon: ScanEye },
  { id: "repair", label: "Perform Repair", status: "in_progress", icon: Wrench },
  { id: "cure", label: "Curing Process", status: "curing", icon: Clock },
  { id: "photos", label: "Final Photos", status: "curing", icon: Camera },
  {
    id: "complete",
    label: "Complete & Final Check",
    status: "completed",
    icon: CheckCircle,
  },
] as const;
const CRACK_OUT_CAUSES = [
  { value: "pre_existing_stress", label: "Pre-existing stress / pressure" },
  { value: "damage_too_deep", label: "Damage too deep" },
  { value: "edge_crack", label: "Edge crack / near edge" },
  { value: "temperature_stress", label: "Temperature stress" },
  { value: "unknown", label: "Unknown" },
] as const;
function clampWorkflowStep(n: any) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(TECH_WORKFLOW_STEPS.length - 1, num));
}
function getStatusIndex(current?: string | null) {
  return SERVICE_STATUS_STEPS.findIndex((s) => s.key === String(current ?? ""));
}
function statusToWorkflowStep(status?: string | null): number {
  const s = String(status ?? "");
  if (s === "on_site") return 0;
  if (s === "in_progress") return 2;
  if (s === "curing") return 3;
  if (s === "completed" || s === "paid") return TECH_WORKFLOW_STEPS.length - 1;
  return 0;
}
/* ----------------------------- Status flow ----------------------------- */
const STATUS_FLOW: Record<string, string | undefined> = {
  requested: "estimating",
  estimating: "approved",
  estimate_sent: "approved",
  approved: "scheduled",
  scheduled: "en_route",
  en_route: "on_site",
  on_site: "in_progress",
  in_progress: "curing",
  curing: "completed",
  completed: undefined,
  paid: undefined,
  cancelled: undefined,
};
function nextStatus(s?: string) {
  return STATUS_FLOW[String(s ?? "")] || undefined;
}
function getStatusPill(status?: string) {
  const s = String(status ?? "");
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold capitalize tracking-wide";
  const map: Record<string, string> = {
    requested:
      "border-amber-300/30 bg-amber-500/10 text-amber-100 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]",
    estimating:
      "border-sky-300/30 bg-sky-500/10 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]",
    estimate_sent:
      "border-indigo-300/30 bg-indigo-500/10 text-indigo-100 shadow-[0_0_0_1px_rgba(99,102,241,0.08)]",
    approved:
      "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]",
    scheduled:
      "border-violet-300/30 bg-violet-500/10 text-violet-100 shadow-[0_0_0_1px_rgba(167,139,250,0.08)]",
    en_route:
      "border-orange-300/30 bg-orange-500/10 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.08)]",
    on_site:
      "border-cyan-300/30 bg-cyan-500/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]",
    in_progress:
      "border-sky-300/30 bg-sky-500/10 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]",
    curing:
      "border-amber-300/30 bg-amber-500/10 text-amber-100 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]",
    completed:
      "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]",
    paid:
      "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]",
    cancelled:
      "border-slate-300/20 bg-slate-500/10 text-slate-100 shadow-[0_0_0_1px_rgba(148,163,184,0.06)]",
  };
  const dot =
    s === "paid" || s === "completed"
      ? "bg-emerald-400"
      : s === "cancelled"
        ? "bg-slate-400"
        : s === "requested"
          ? "bg-amber-400"
          : "bg-sky-400";
  return { base, cls: map[s] ?? map.cancelled, dot };
}
/* ----------------------------- Glass tokens ----------------------------- */
const INPUT_BASE =
  "w-full h-10 rounded-xl border bg-slate-950/70 border-white/10 " +
  "px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-400 " +
  "shadow-sm focus:bg-slate-950 focus:border-sky-500/70 focus:ring-2 " +
  "focus:ring-sky-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55";
const TEXTAREA_BASE =
  "w-full rounded-xl border bg-slate-950/70 border-white/10 " +
  "px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-400 " +
  "shadow-sm focus:bg-slate-950 focus:border-sky-500/70 focus:ring-2 " +
  "focus:ring-sky-500/40 focus-visible:outline-none resize-y min-h-[120px] disabled:cursor-not-allowed disabled:opacity-55";
const SELECT_BASE =
  "w-full rounded-xl border bg-slate-950/70 border-white/10 px-3.5 py-2.5 " +
  "text-sm text-slate-100 shadow-sm focus:border-sky-500/70 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-55";
/* ----------------------------- Queries ----------------------------- */
async function fetchAppointment(id: string): Promise<AnyObj | null> {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
async function fetchAppUserByEmail(email?: string | null): Promise<AnyObj | null> {
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  if (!cleanEmail) return null;
  const { data, error } = await supabaseClient
    .from("app_users")
    .select(
      [
        "id",
        "created_at",
        "updated_at",
        "full_name",
        "email",
        "phone",
        "address_line1",
        "address_line2",
        "city",
        "state",
        "zip",
        "notes",
        "gate_notes",
        "auth_user_id",
        "portal_invited_at",
        "portal_activated_at",
        "notification_email",
        "notification_sms",
      ].join(",")
    )
    .ilike("email", cleanEmail)
    .maybeSingle();
  if (error) {
    console.warn("fetchAppUserByEmail error:", error.message);
    return null;
  }
  return data ?? null;
}
async function fetchTechnicians(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("technicians")
    .select("id, email, full_name, tech_rating, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function fetchPhotos(appointmentId: string): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("photos")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function fetchBookingLead(id: string): Promise<AnyObj | null> {
  const { data, error } = await supabaseClient
    .from("booking_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
async function fetchTechInvoiceForAppointment(
  appointmentId: string
): Promise<AnyObj | null> {
  const { data, error } = await supabaseClient
    .from("tech_invoices")
    .select(
      [
        "id",
        "appointment_id",
        "status",
        "invoice_number",
        "created_at",
        "paid_at",
        "total_cents",
        "subtotal_cents",
        "final_paid_cents",
        "insurance_due_cents",
        "customer_due_cents",
        "discount_cents",
        "services_json",
        "repair_outcome",
        "crack_out_occurred",
        "crack_out_cause",
        "crack_out_notes",
        "crack_out_photo_url",
        "replacement_required",
        "replacement_status",
        "deposit_request_id",
        "deposit_cents",
        "deposit_applied_at",
        "payment_method",
        "payment_note",
      ].join(",")
    )
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
async function fetchWaiverRecord(appointmentId: string): Promise<AnyObj | null> {
  const { data, error } = await supabaseClient
    .from("appointment_waivers")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (error) {
    console.warn("fetchWaiverRecord error:", error.message);
    return null;
  }
  return data ?? null;
}
async function fetchDepositRequest(
  appointmentId: string,
  depositRequestId?: string | null
): Promise<AnyObj | null> {
  let q = supabaseClient
    .from("deposit_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (depositRequestId) {
    q = q.or(`appointment_id.eq.${appointmentId},id.eq.${depositRequestId}`);
  } else {
    q = q.eq("appointment_id", appointmentId);
  }
  const { data, error } = await q;
  if (error) {
    console.warn("fetchDepositRequest error:", error.message);
    return null;
  }
  return data?.[0] ?? null;
}
/* ----------------------------- Utils ----------------------------- */
function niceServiceType(s?: string) {
  return String(s ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
function centsNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function moneyFromCents(cents: any) {
  const n = centsNumber(cents);
  return `$${(n / 100).toFixed(2)}`;
}
function numericStoredMoneyToCents(value: any) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1000) return Math.round(n);
  return Math.round(n * 100);
}
function computeGrossFinalCents(inv: AnyObj | null, apt: AnyObj | null) {
  if (inv) {
    const total = centsNumber(inv.total_cents);
    const finalPaid = centsNumber(inv.final_paid_cents);
    const subtotal = centsNumber(inv.subtotal_cents);
    const insurance = centsNumber(inv.insurance_due_cents);
    const customer = centsNumber(inv.customer_due_cents);
    const dueSum = insurance + customer;
    if (total > 0) return total;
    if (finalPaid > 0) return finalPaid;
    if (dueSum > 0) return dueSum;
    if (subtotal > 0) return subtotal;
  }
  const finalAmountCents = numericStoredMoneyToCents(apt?.final_amount);
  if (finalAmountCents > 0) return finalAmountCents;
  return numericStoredMoneyToCents(apt?.estimate_amount);
}
function computeDepositCents(
  inv: AnyObj | null,
  apt: AnyObj | null,
  depositRequest: AnyObj | null
) {
  const invDeposit = centsNumber(inv?.deposit_cents);
  if (invDeposit > 0) return invDeposit;
  const aptDeposit = centsNumber(apt?.deposit_cents);
  if (aptDeposit > 0) return aptDeposit;
  const requestStatus = String(depositRequest?.status ?? "").toLowerCase();
  const requestPaid =
    !!depositRequest?.paid_at ||
    requestStatus === "paid" ||
    requestStatus === "succeeded";
  if (requestPaid) return centsNumber(depositRequest?.amount_cents);
  return 0;
}
function computeDepositStatus(apt: AnyObj | null, depositRequest: AnyObj | null) {
  const aptStatus = String(apt?.deposit_status ?? "").trim();
  if (aptStatus && aptStatus !== "none") return aptStatus;
  const reqStatus = String(depositRequest?.status ?? "").trim();
  if (reqStatus) return reqStatus;
  return "none";
}
function safeISODate(d?: any) {
  if (!d) return null;
  try {
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return null;
    return dd.toISOString().split("T")[0];
  } catch {
    return null;
  }
}
function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}
function formatCustomerAddress(user: AnyObj | null, apt: AnyObj | null) {
  const appUserAddress = [
    user?.address_line1,
    user?.address_line2,
    [user?.city, user?.state, user?.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" • ");
  return appUserAddress || String(apt?.service_address ?? "").trim() || "—";
}
function getPhotoGroups(photos: AnyObj[]) {
  const before = photos.filter((p) => String(p.photo_type ?? "").includes("before"));
  const after = photos.filter((p) => String(p.photo_type ?? "").includes("after"));
  const crackOut = photos.filter((p) => String(p.photo_type ?? "") === "crack_out");
  const other = photos.filter((p) => {
    const t = String(p.photo_type ?? "");
    return !t.includes("before") && !t.includes("after") && t !== "crack_out";
  });
  return { before, after, crackOut, other };
}
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  }
}
/* ----------------------------- Motion presets ----------------------------- */
const easeOutExpo = [0.16, 1, 0.3, 1] as const;
const vPage = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.35, ease: easeOutExpo, staggerChildren: 0.06 },
  },
};
const vSection = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 320, damping: 28 },
  },
};
const vItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 360, damping: 28 },
  },
};
/* ----------------------------- UI atoms ----------------------------- */
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
        className="absolute -inset-[1.5px] rounded-2xl blur-[2.5px]"
        style={{
          opacity: intensity,
          background:
            "conic-gradient(from 215deg at 50% 50%, rgba(56,189,248,0.95), rgba(99,102,241,0.55), rgba(52,211,153,0.85), rgba(56,189,248,0.95))",
        }}
      />
      <div className="relative rounded-2xl">{children}</div>
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
      className={`relative overflow-hidden rounded-2xl border ${
        dense ? "backdrop-blur-3xl" : "backdrop-blur-2xl"
      } ${className}`}
      style={{
        borderColor: "rgba(255,255,255,0.14)",
        background:
          "linear-gradient(180deg, rgba(8,13,26,0.68), rgba(2,6,23,0.92))",
        boxShadow:
          "0 48px 160px rgba(0,0,0,0.66), 0 24px 80px rgba(3,10,24,0.72), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.10] gg-noise mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 gg-vignette opacity-90" />
      <div className="pointer-events-none absolute inset-0 gg-aurora opacity-70" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
function Pill({
  icon,
  children,
  tone = "sky",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "sky" | "emerald" | "amber" | "slate" | "violet" | "rose";
}) {
  const tones: Record<string, string> = {
    sky: "border-sky-300/30 bg-sky-500/10 text-sky-100",
    emerald: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-300/30 bg-amber-500/10 text-amber-100",
    slate: "border-white/10 bg-white/[0.06] text-slate-100",
    violet: "border-violet-300/30 bg-violet-500/10 text-violet-100",
    rose: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        tones[tone] ?? tones.slate
      }`}
    >
      {icon ? <span className="opacity-90">{icon}</span> : null}
      <span className="translate-y-[0.5px]">{children}</span>
    </span>
  );
}
function StatChip({
  icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "slate" | "sky" | "emerald" | "amber" | "violet" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "border-white/10 bg-white/[0.06]",
    sky: "border-sky-300/20 bg-sky-500/10",
    emerald: "border-emerald-300/20 bg-emerald-500/10",
    amber: "border-amber-300/20 bg-amber-500/10",
    violet: "border-violet-300/20 bg-violet-500/10",
    rose: "border-rose-300/20 bg-rose-500/10",
  };
  return (
    <div className={`gg-card-lift rounded-2xl border p-4 ${tones[tone] ?? tones.slate}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 border border-white/10">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/90">
            {label}
          </div>
          <div className="mt-1 text-lg font-extrabold text-white tabular-nums">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
function DetailTile({
  icon,
  label,
  value,
  sub,
  tone = "slate",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "slate" | "sky" | "emerald" | "amber" | "violet" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "border-white/10 bg-white/[0.05]",
    sky: "border-sky-300/20 bg-sky-500/10",
    emerald: "border-emerald-300/20 bg-emerald-500/10",
    amber: "border-amber-300/20 bg-amber-500/10",
    violet: "border-violet-300/20 bg-violet-500/10",
    rose: "border-rose-300/20 bg-rose-500/10",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] ?? tones.slate}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <div className="mt-1 break-words text-sm font-extrabold text-white">
            {value}
          </div>
          {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}
function SectionPanel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <m.div
      variants={vItem}
      className="gg-card-lift rounded-2xl border border-white/10 bg-white/[0.06] p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/30">
            {icon}
          </div>
          <div>
            <h3 className="font-extrabold text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      {children}
    </m.div>
  );
}
function ReadOnlyNotice({ overrideMode }: { overrideMode: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        overrideMode
          ? "border-amber-300/30 bg-amber-500/10 text-amber-100"
          : "border-sky-300/25 bg-sky-500/10 text-sky-100"
      }`}
    >
      {overrideMode ? (
        <span className="flex items-start gap-2">
          <Unlock className="mt-0.5 h-4 w-4" />
          Override is ON. Admin controls are unlocked.
        </span>
      ) : (
        <span className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4" />
          View-only mode. Admin can watch progress in real time. Enable override
          to make changes.
        </span>
      )}
    </div>
  );
}
function LiveServiceTimeline({
  status,
  busy,
  readOnly,
  onPick,
}: {
  status?: string | null;
  busy?: boolean;
  readOnly?: boolean;
  onPick: (status: string) => void;
}) {
  const currentIndex = getStatusIndex(status);
  const safeIndex = Math.max(0, currentIndex);
  const pct =
    SERVICE_STATUS_STEPS.length > 1
      ? (safeIndex / (SERVICE_STATUS_STEPS.length - 1)) * 100
      : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-white">Live Service Timeline</p>
          <p className="mt-1 text-xs text-slate-400">
            Mirrors the tech-facing progress bar in real time.
          </p>
        </div>
        <Badge className="border border-sky-300/20 bg-sky-500/10 text-sky-100">
          {busy ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Syncing
            </>
          ) : readOnly ? (
            <>
              <Eye className="mr-1 h-3.5 w-3.5" />
              View Only
            </>
          ) : (
            <>
              <Activity className="mr-1 h-3.5 w-3.5" />
              Override
            </>
          )}
        </Badge>
      </div>
      <div className="relative px-1">
        <div className="absolute left-0 right-0 top-7 h-[2px] bg-slate-700/80" />
        <div
          className="absolute left-0 top-7 h-[2px] bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 shadow-[0_0_16px_rgba(56,189,248,0.75)] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        <div className="relative flex justify-between gap-2 overflow-x-auto pb-2">
          {SERVICE_STATUS_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const completed = currentIndex >= 0 ? idx <= currentIndex : false;
            const current = idx === currentIndex;
            const disabled = busy || readOnly;
            return (
              <button
                key={step.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onPick(step.key);
                }}
                className={`group flex min-w-[92px] flex-col items-center gap-2 rounded-xl px-1 py-1 focus:outline-none ${
                  disabled ? "cursor-not-allowed opacity-75" : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="relative">
                  {current ? (
                    <span className="absolute -inset-2 rounded-full bg-sky-400/25 blur-md animate-pulse" />
                  ) : null}
                  <div
                    className={`relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] text-xs transition-all duration-300 ${
                      current
                        ? "bg-sky-500 border-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.9)]"
                        : completed
                          ? "bg-emerald-500 border-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.8)]"
                          : "bg-slate-950 border-slate-600 group-hover:border-slate-300"
                    }`}
                  >
                    {completed && !current ? (
                      <CheckCircle className="h-6 w-6 text-white" />
                    ) : (
                      <Icon
                        className={`h-6 w-6 ${
                          current || completed ? "text-white" : "text-slate-400"
                        }`}
                      />
                    )}
                  </div>
                </div>
                <p
                  className={`px-1 text-center text-[11px] font-medium leading-tight ${
                    completed || current ? "text-slate-100" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                {current ? (
                  <span className="mt-0.5 inline-flex items-center rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    Current
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function TechWorkflowMirror({
  apt,
  photos,
  waiver,
  techInvoice,
  updateBusy,
  overrideMode,
  onStepPick,
  onCompleteClick,
}: {
  apt: AnyObj;
  photos: AnyObj[];
  waiver: AnyObj | null | undefined;
  techInvoice: AnyObj | null | undefined;
  updateBusy: boolean;
  overrideMode: boolean;
  onStepPick: (step: number) => void;
  onCompleteClick: () => void;
}) {
  const persisted = Number.isFinite(Number(apt.tech_workflow_step))
    ? clampWorkflowStep(apt.tech_workflow_step)
    : statusToWorkflowStep(apt.status);
  const isCompleted = ["completed", "paid"].includes(String(apt.status ?? ""));
  const groups = getPhotoGroups(photos);
  const current = TECH_WORKFLOW_STEPS[persisted] ?? TECH_WORKFLOW_STEPS[0];
  const CurrentIcon = current.icon;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl bg-sky-400/20 blur-md" />
            <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-sky-300/30 bg-sky-500/15">
              {isCompleted ? (
                <Lock className="h-5 w-5 text-emerald-200" />
              ) : (
                <CurrentIcon className="h-5 w-5 text-sky-100" />
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-extrabold text-white">
              {isCompleted ? "Completed Tech Workflow" : "Tech Workflow Mirror"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Step {persisted + 1} of {TECH_WORKFLOW_STEPS.length} •{" "}
              {current.label}
            </p>
          </div>
        </div>
        {!isCompleted ? (
          <Button
            onClick={onCompleteClick}
            disabled={updateBusy || !overrideMode}
            className={overrideMode ? "gg-btn-primary" : "gg-btn"}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {overrideMode ? "Admin Complete" : "View Only"}
          </Button>
        ) : (
          <Badge className="border border-emerald-300/30 bg-emerald-500/10 text-emerald-100">
            <Lock className="mr-1 h-3.5 w-3.5" />
            Locked Complete
          </Badge>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-6">
        {TECH_WORKFLOW_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const active = idx === persisted;
          const done = idx <= persisted;
          const disabled = updateBusy || isCompleted || !overrideMode;
          return (
            <button
              key={step.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onStepPick(idx);
              }}
              className={`gg-card-lift rounded-2xl border p-3 text-left transition ${
                active
                  ? "border-sky-300/40 bg-sky-500/15 shadow-[0_0_30px_rgba(56,189,248,0.12)]"
                  : done
                    ? "border-emerald-300/25 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              } ${disabled ? "cursor-not-allowed opacity-80" : ""}`}
            >
              <div
                className={`mb-2 grid h-9 w-9 place-items-center rounded-xl border ${
                  active
                    ? "border-sky-300/35 bg-sky-400/15 text-sky-100"
                    : done
                      ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                      : "border-white/10 bg-black/25 text-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-white">{step.label}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-slate-400">
                {step.status.replace(/_/g, " ")}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <StatChip
          icon={<ShieldCheck className="h-5 w-5 text-emerald-200" />}
          label="Waiver"
          value={
            waiver ? "Signed" : apt.waiver_signing_mode === "portal" ? "Portal" : "Missing"
          }
          tone={waiver || apt.waiver_signing_mode === "portal" ? "emerald" : "amber"}
        />
        <StatChip
          icon={<Camera className="h-5 w-5 text-sky-200" />}
          label="Before"
          value={groups.before.length}
          tone="sky"
        />
        <StatChip
          icon={<Images className="h-5 w-5 text-violet-200" />}
          label="After"
          value={groups.after.length}
          tone="violet"
        />
        <StatChip
          icon={<FileText className="h-5 w-5 text-emerald-200" />}
          label="Invoice"
          value={techInvoice?.invoice_number || (techInvoice?.id ? "Created" : "Not Yet")}
          tone={techInvoice?.id ? "emerald" : "slate"}
        />
      </div>
      {isCompleted ? (
        <div className="gg-complete-card mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-100">
                <CheckCircle className="h-4 w-4" />
                Completed UI Rendered
              </p>
              <p className="mt-1 text-xs text-emerald-100/80">
                Admin is now viewing the completed job record.
              </p>
            </div>
            {techInvoice?.id ? (
              <Link href={`/tech/dashboard/invoices/invoice/${techInvoice.id}`}>
                <Button className="gg-btn">
                  <Eye className="mr-2 h-4 w-4" />
                  View Invoice
                </Button>
              </Link>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Completed At
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {formatDateTime(apt.actual_end_time)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Outcome
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {apt.crack_out_occurred ? "Crack-out / Replacement" : "Repair Completed"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Invoice
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {techInvoice?.invoice_number || "Draft pending"}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function AdminCompleteModal({
  open,
  onOpenChange,
  apt,
  pending,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  apt: AnyObj;
  pending: boolean;
  onComplete: (payload: AnyObj) => void;
}) {
  const [outcome, setOutcome] = React.useState<AdminOutcome>("completed");
  const [notes, setNotes] = React.useState("");
  const [resin, setResin] = React.useState("");
  const [cureTime, setCureTime] = React.useState(30);
  const [crackCause, setCrackCause] = React.useState("");
  const [crackNotes, setCrackNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setOutcome(apt?.repair_outcome === "crack_out" ? "crack_out" : "completed");
    setNotes(String(apt?.notes_tech ?? ""));
    setResin(String(apt?.resin_type ?? ""));
    setCureTime(Number(apt?.cure_duration_minutes ?? 30) || 30);
    setCrackCause(String(apt?.crack_out_cause ?? ""));
    setCrackNotes(String(apt?.crack_out_notes ?? ""));
    setError(null);
  }, [open, apt]);
  const isCrackOut = outcome === "crack_out";
  const submit = () => {
    setError(null);
    if (isCrackOut) {
      if (!crackCause) {
        setError("Crack-out cause is required.");
        return;
      }
      if (!crackNotes || crackNotes.trim().length < 10) {
        setError("Crack-out notes must be at least 10 characters.");
        return;
      }
    }
    const now = new Date().toISOString();
    onComplete({
      status: "completed",
      actual_end_time: now,
      notes_tech: notes || null,
      resin_type: resin || null,
      cure_duration_minutes: cureTime || null,
      tech_workflow_step: TECH_WORKFLOW_STEPS.length - 1,
      tech_workflow_updated_at: now,
      repair_outcome: outcome,
      crack_out_occurred: isCrackOut,
      crack_out_cause: isCrackOut ? crackCause : null,
      crack_out_notes: isCrackOut ? crackNotes : null,
      crack_out_at: isCrackOut ? now : null,
      replacement_required: isCrackOut,
      replacement_status: isCrackOut ? "required" : null,
    });
  };
  return (
    <AnimatePresence>
      {open ? (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm"
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
            >
              <div className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/50 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold text-white">
                      Admin Complete Job
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Override completion should only be used when the tech flow
                      needs admin correction.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="gg-btn"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setOutcome("completed")}
                    className={`rounded-2xl border p-4 text-left transition ${
                      outcome === "completed"
                        ? "border-emerald-300/40 bg-emerald-500/15"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                    }`}
                  >
                    <ShieldCheck className="mb-2 h-5 w-5 text-emerald-200" />
                    <p className="font-extrabold text-white">Repair Completed</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Normal completed repair.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutcome("crack_out")}
                    className={`rounded-2xl border p-4 text-left transition ${
                      outcome === "crack_out"
                        ? "border-amber-300/40 bg-amber-500/15"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                    }`}
                  >
                    <AlertTriangle className="mb-2 h-5 w-5 text-amber-200" />
                    <p className="font-extrabold text-white">Crack-out Occurred</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Replacement required.
                    </p>
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">Resin Type</label>
                    <input
                      value={resin}
                      onChange={(e) => setResin(e.target.value)}
                      className={INPUT_BASE}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Cure Time Minutes
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cureTime}
                      onChange={(e) => setCureTime(Number(e.target.value || 0))}
                      className={INPUT_BASE}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Tech/Admin Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={TEXTAREA_BASE}
                    placeholder="Completion notes…"
                  />
                </div>
                {isCrackOut ? (
                  <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
                    <p className="mb-3 text-sm font-extrabold text-amber-100">
                      Crack-out Details
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400">Cause</label>
                        <select
                          value={crackCause}
                          onChange={(e) => setCrackCause(e.target.value)}
                          className={SELECT_BASE}
                        >
                          <option value="" disabled>
                            Select cause…
                          </option>
                          {CRACK_OUT_CAUSES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">
                          Crack-out Notes
                        </label>
                        <textarea
                          value={crackNotes}
                          onChange={(e) => setCrackNotes(e.target.value)}
                          className={TEXTAREA_BASE}
                          placeholder="Min 10 characters…"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="gg-btn flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={submit}
                    disabled={pending}
                    className="gg-btn-primary flex-1"
                  >
                    {pending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing…
                      </>
                    ) : (
                      <>
                        Complete & Render Locked UI
                        <CheckCircle className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </m.div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
/* ----------------------------- Page ----------------------------- */
export default function AdminAppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const rawId = (params as any)?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const qc = useQueryClient();
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [overrideMode, setOverrideMode] = React.useState(false);
  const [lastLiveSyncAt, setLastLiveSyncAt] = React.useState<string | null>(null);
  const {
    data: apt,
    isLoading: loadingApt,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin:appointment", id ?? "unknown"],
    queryFn: () => fetchAppointment(String(id)),
    enabled: !!id,
    staleTime: 5000,
    refetchInterval: 10000,
  });
  const { data: appUser } = useQuery({
    queryKey: ["admin:appointment:app-user", apt?.customer_email ?? "none"],
    queryFn: () => fetchAppUserByEmail(apt?.customer_email),
    enabled: !!apt?.customer_email,
    staleTime: 5000,
    refetchInterval: 10000,
  });
  const { data: techInvoice } = useQuery({
    queryKey: ["admin:appointment:tech-invoice", id ?? "unknown"],
    queryFn: () => fetchTechInvoiceForAppointment(String(id)),
    enabled: !!id,
    staleTime: 5000,
    refetchInterval: 10000,
  });
  const depositRequestId =
    (techInvoice?.deposit_request_id as string | null | undefined) ||
    (apt?.deposit_request_id as string | null | undefined) ||
    null;
  const { data: depositRequest } = useQuery({
    queryKey: [
      "admin:appointment:deposit-request",
      id ?? "unknown",
      depositRequestId ?? "none",
    ],
    queryFn: () => fetchDepositRequest(String(id), depositRequestId),
    enabled: !!id && !!apt,
    staleTime: 5000,
    refetchInterval: 10000,
  });
  const { data: waiverRecord } = useQuery({
    queryKey: ["admin:appointment:waiver", id ?? "unknown"],
    queryFn: () => fetchWaiverRecord(String(id)),
    enabled: !!id,
    staleTime: 5000,
    refetchInterval: 10000,
  });
  const { data: techs = [] } = useQuery({
    queryKey: ["admin:technicians"],
    queryFn: fetchTechnicians,
    staleTime: 30000,
  });
  const { data: photos = [] } = useQuery({
    queryKey: ["admin:appointment:photos", id ?? "unknown"],
    queryFn: () => fetchPhotos(String(id)),
    enabled: !!id && !!apt,
    staleTime: 5000,
    refetchInterval: 10000,
  });
  const { data: lead, isLoading: loadingLead } = useQuery({
    queryKey: ["admin:appointment:lead-source", id ?? "unknown"],
    queryFn: () => fetchBookingLead(String(id)),
    enabled: !!id && !apt && !loadingApt && !isError,
    staleTime: 15000,
  });
  React.useEffect(() => {
    if (!id) return;
    const invalidateLive = () => {
      setLastLiveSyncAt(new Date().toISOString());
      qc.invalidateQueries({ queryKey: ["admin:appointment", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointments"] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:app-user"] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:photos", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:tech-invoice", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:waiver", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:deposit-request", id] });
    };
    const channel = supabaseClient
      .channel(`admin-appointment-live-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `id=eq.${id}`,
        },
        invalidateLive
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "photos",
          filter: `appointment_id=eq.${id}`,
        },
        invalidateLive
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_waivers",
          filter: `appointment_id=eq.${id}`,
        },
        invalidateLive
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tech_invoices",
          filter: `appointment_id=eq.${id}`,
        },
        invalidateLive
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposit_requests",
          filter: `appointment_id=eq.${id}`,
        },
        invalidateLive
      )
      .subscribe();
    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [id, qc]);
  const updateMutation = useMutation({
    mutationFn: async (patch: AnyObj) => {
      if (!id) return;
      const { error } = await supabaseClient
        .from("appointments")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!id) return;
      qc.invalidateQueries({ queryKey: ["admin:appointment", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointments"] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:app-user"] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:tech-invoice", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:photos", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:waiver", id] });
      qc.invalidateQueries({ queryKey: ["admin:appointment:deposit-request", id] });
    },
    onError: (err) => {
      console.error("update appointment error", err);
      alert((err as any)?.message ?? "Failed to update appointment.");
    },
  });
  const createFromLeadMutation = useMutation({
    mutationFn: async (lead: AnyObj) => {
      const payload: AnyObj = {
        status: "requested",
        service_type: lead.service_type ?? lead.lead_type ?? "chip_repair",
        customer_email: lead.customer_email ?? lead.email ?? null,
        notes_customer: lead.notes ?? null,
      };
      const { data, error } = await supabaseClient
        .from("appointments")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as AnyObj;
    },
    onSuccess: (newApt) => {
      router.replace(`/admin/portal/appointments/${newApt.id}`);
    },
    onError: (err) => {
      console.error("createFromLead error", err);
      alert((err as any)?.message ?? "Failed to create appointment.");
    },
  });
  const guarded = React.useCallback(
    (fn: () => void) => {
      if (!overrideMode) return;
      fn();
    },
    [overrideMode]
  );
  const handleAssignTech = (email: string) => {
    if (!overrideMode) return;
    const isUnassigned = email === "unassigned";
    updateMutation.mutate({
      technician_email: isUnassigned ? null : email,
      ...(apt?.status &&
      ["requested", "approved", "estimating"].includes(String(apt.status)) &&
      !isUnassigned
        ? { status: "scheduled" }
        : {}),
    });
  };
  const handleAdvanceStatus = () => {
    if (!overrideMode) return;
    const ns = nextStatus(apt?.status);
    if (!ns) return;
    const now = new Date().toISOString();
    const patch: AnyObj = { status: ns };
    if (ns === "on_site" && !apt?.actual_start_time) {
      patch.actual_start_time = now;
    }
    if (ns === "completed") {
      patch.actual_end_time = now;
      patch.tech_workflow_step = TECH_WORKFLOW_STEPS.length - 1;
      patch.tech_workflow_updated_at = now;
      patch.repair_outcome = apt?.repair_outcome || "completed";
    }
    updateMutation.mutate(patch);
  };
  const handlePickStatus = (status: string) => {
    if (!overrideMode) return;
    const now = new Date().toISOString();
    const patch: AnyObj = { status };
    if (status === "on_site" && !apt?.actual_start_time) {
      patch.actual_start_time = now;
    }
    if (status === "completed") {
      patch.actual_end_time = now;
      patch.tech_workflow_step = TECH_WORKFLOW_STEPS.length - 1;
      patch.tech_workflow_updated_at = now;
      patch.repair_outcome = apt?.repair_outcome || "completed";
    }
    updateMutation.mutate(patch);
  };
  const handlePickWorkflowStep = (step: number) => {
    if (!overrideMode) return;
    const clamped = clampWorkflowStep(step);
    const status = TECH_WORKFLOW_STEPS[clamped]?.status ?? apt?.status;
    const patch: AnyObj = {
      tech_workflow_step: clamped,
      tech_workflow_updated_at: new Date().toISOString(),
      status,
    };
    if (status === "on_site" && !apt?.actual_start_time) {
      patch.actual_start_time = new Date().toISOString();
    }
    updateMutation.mutate(patch);
  };
  const handleAdminComplete = (payload: AnyObj) => {
    if (!overrideMode) return;
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setCompleteOpen(false);
      },
    });
  };
  if (!id) {
    return (
      <ScreenShell>
        <CenteredCard
          icon={<AlertTriangle className="h-5 w-5 text-rose-200" />}
          title="No appointment ID"
          body="We couldn’t find an appointment ID in this URL."
          actionHref="/admin/portal/appointments"
          actionLabel="Back to Appointments"
        />
      </ScreenShell>
    );
  }
  if (loadingApt) {
    return (
      <ScreenShell>
        <div className="min-h-screen grid place-items-center px-6">
          <GlassShell className="w-[min(560px,92vw)] p-7">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-300/85">
                  Admin • Job Detail
                </div>
                <div className="mt-2 text-xl font-extrabold text-white">
                  Loading appointment…
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-5 rounded-full bg-sky-500/20 blur-2xl" />
                <div className="relative h-11 w-11 animate-spin rounded-full border-2 border-sky-400 border-b-transparent" />
              </div>
            </div>
          </GlassShell>
        </div>
      </ScreenShell>
    );
  }
  if (isError) {
    return (
      <ScreenShell>
        <CenteredCard
          icon={<AlertTriangle className="h-5 w-5 text-rose-200" />}
          title="Error loading appointment"
          body={(error as any)?.message ?? "Something went wrong fetching data."}
          actionHref="/admin/portal/appointments"
          actionLabel="Back to Appointments"
        />
      </ScreenShell>
    );
  }
  if (!apt) {
    if (loadingLead) {
      return (
        <ScreenShell>
          <div className="min-h-screen grid place-items-center px-6">
            <div className="relative">
              <div className="absolute -inset-5 rounded-full bg-emerald-500/20 blur-2xl" />
              <div className="relative h-11 w-11 animate-spin rounded-full border-2 border-emerald-400 border-b-transparent" />
            </div>
          </div>
        </ScreenShell>
      );
    }
    if (lead) {
      const createdAt = lead.created_at ? new Date(lead.created_at) : null;
      const createdLabel = createdAt
        ? format(createdAt, "MMM d, yyyy • h:mm a")
        : "Just now";
      return (
        <ScreenShell>
          <LazyMotion features={domAnimation}>
            <m.div
              variants={vPage}
              initial="hidden"
              animate="show"
              className="relative p-4 md:p-8"
            >
              <div className="mx-auto max-w-3xl space-y-6">
                <m.div
                  variants={vSection}
                  className="flex items-center justify-between gap-4"
                >
                  <Pill tone="emerald" icon={<Sparkles className="h-4 w-4" />}>
                    Convert Lead → Appointment
                  </Pill>
                  <Pill tone="slate" icon={<Clock className="h-4 w-4" />}>
                    Captured {createdLabel}
                  </Pill>
                </m.div>
                <m.div variants={vSection}>
                  <GradientBorder intensity={0.92}>
                    <GlassShell className="p-0">
                      <Card className="border-0 bg-transparent shadow-none">
                        <CardHeader className="border-b border-emerald-300/20 bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-emerald-950/40">
                          <CardTitle className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 border border-emerald-300/30">
                              <ShieldCheck className="h-5 w-5 text-emerald-100" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-lg font-extrabold text-white">
                                Create an appointment from this booking lead
                              </div>
                              <p className="mt-1 text-sm text-slate-300">
                                We didn’t find an appointment with this ID, but we
                                did find a booking lead.
                              </p>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 md:p-7 space-y-6">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className="flex items-center gap-2 font-semibold text-slate-50">
                                <Phone className="h-4 w-4 text-emerald-300" />
                                Lead contact
                              </h3>
                              <span className="text-[11px] text-slate-300">
                                Captured {createdLabel}
                              </span>
                            </div>
                            <div className="grid gap-4 text-sm md:grid-cols-2">
                              <div>
                                <p className="text-xs text-slate-400">
                                  Full name
                                </p>
                                <p className="font-medium text-slate-100">
                                  {lead.full_name ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400">Phone</p>
                                <p className="font-medium text-slate-100">
                                  {lead.phone ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400">ZIP</p>
                                <p className="font-medium text-slate-100">
                                  {lead.zip ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400">
                                  Requested slot
                                </p>
                                <p className="font-medium text-slate-100">
                                  {lead.slot ?? "No specific time selected"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-5">
                            <p className="text-sm text-emerald-50">
                              We’ll create a new appointment with status{" "}
                              <span className="font-semibold">requested</span>.
                            </p>
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-[11px] text-emerald-100/90">
                                Source:{" "}
                                <span className="font-mono">
                                  {lead.source ?? "website"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                  className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-sm font-extrabold"
                                  disabled={createFromLeadMutation.isPending}
                                  onClick={() =>
                                    createFromLeadMutation.mutate(lead)
                                  }
                                >
                                  {createFromLeadMutation.isPending
                                    ? "Creating…"
                                    : "Create appointment"}
                                </Button>
                                <Link href="/admin/portal/bookingleads">
                                  <Button className="gg-btn">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Booking Leads
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </GlassShell>
                  </GradientBorder>
                </m.div>
              </div>
            </m.div>
          </LazyMotion>
        </ScreenShell>
      );
    }
    return (
      <ScreenShell>
        <CenteredCard
          icon={<ScanEye className="h-5 w-5 text-slate-100" />}
          title="Appointment not found"
          body="The appointment you’re looking for doesn’t exist or was removed."
          actionHref="/admin/portal/appointments"
          actionLabel="Back to Appointments"
        />
      </ScreenShell>
    );
  }
  const serviceTitle = niceServiceType(apt.service_type);
  const shortId = String(apt.id ?? "").slice(0, 8);
  const statusPill = getStatusPill(apt.status);
  const nextLabel = apt.status
    ? ({
        requested: "Move to Estimating",
        estimating: "Approve",
        estimate_sent: "Approve",
        approved: "Schedule",
        scheduled: "Mark En Route",
        en_route: "Arrived On Site",
        on_site: "Start Repair",
        in_progress: "Begin Curing",
        curing: "Mark Complete",
        completed: "Completed",
        paid: "Paid",
        cancelled: "Cancelled",
      } as Record<string, string>)[String(apt.status)]
    : "Advance";
  const scheduleDateISO = safeISODate(apt.scheduled_date);
  const scheduleDateLabel = scheduleDateISO
    ? format(new Date(scheduleDateISO), "MMM d, yyyy")
    : "—";
  const startLabel = String(apt.scheduled_time_start ?? "") || "—";
  const endLabel = String(apt.scheduled_time_end ?? "") || "—";
  const scheduleFullLabel =
    scheduleDateLabel === "—"
      ? "Not scheduled"
      : `${scheduleDateLabel}${startLabel !== "—" ? ` • ${startLabel}` : ""}${
          endLabel !== "—" ? `–${endLabel}` : ""
        }`;
  const hasCrackOut =
    !!apt.crack_out_occurred || !!techInvoice?.crack_out_occurred;
  const replacementReq =
    !!apt.replacement_required || !!techInvoice?.replacement_required;
  const estimateCents = numericStoredMoneyToCents(apt.estimate_amount);
  const estimateLabel = estimateCents > 0 ? moneyFromCents(estimateCents) : "—";
  const grossFinalCents = computeGrossFinalCents(techInvoice ?? null, apt ?? null);
  const depositCents = computeDepositCents(
    techInvoice ?? null,
    apt ?? null,
    depositRequest ?? null
  );
  const invoicePaid =
    String(techInvoice?.status ?? "").toLowerCase() === "paid" ||
    !!techInvoice?.paid_at ||
    centsNumber(techInvoice?.final_paid_cents) > 0;
  const actualDueCents = invoicePaid
    ? 0
    : Math.max(0, grossFinalCents - depositCents);
  const finalLabel = grossFinalCents > 0 ? moneyFromCents(grossFinalCents) : "—";
  const depositLabel = depositCents > 0 ? moneyFromCents(depositCents) : "—";
  const actualDueLabel = invoicePaid
    ? "$0.00 paid"
    : grossFinalCents > 0
      ? moneyFromCents(actualDueCents)
      : "—";
  const depositStatus = computeDepositStatus(apt ?? null, depositRequest ?? null);
  const isCompleted = ["completed", "paid"].includes(String(apt.status ?? ""));
  const photoGroups = getPhotoGroups(photos);
  const customerName =
    String(appUser?.full_name ?? "").trim() ||
    String(techInvoice?.customer_name ?? "").trim() ||
    "Customer";
  const customerEmail =
    String(appUser?.email ?? apt.customer_email ?? "").trim() || "—";
  const customerPhone = String(appUser?.phone ?? "").trim() || "No phone";
  const customerAddress = formatCustomerAddress(appUser ?? null, apt ?? null);
  const portalStatus = appUser?.portal_activated_at
    ? "Portal active"
    : appUser?.portal_invited_at
      ? "Invited"
      : appUser?.auth_user_id
        ? "Auth linked"
        : "No portal";
  return (
    <ScreenShell>
      <AdminCompleteModal
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        apt={apt}
        pending={updateMutation.isPending}
        onComplete={handleAdminComplete}
      />
      <LazyMotion features={domAnimation}>
        <m.div
          variants={vPage}
          initial="hidden"
          animate="show"
          className="relative p-4 md:p-8"
        >
          <div className="mx-auto max-w-7xl space-y-6">
            <m.div
              variants={vSection}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <Pill tone="sky" icon={<Sparkles className="h-4 w-4" />}>
                Admin · Live Job Detail
              </Pill>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${statusPill.base} ${statusPill.cls}`}>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${statusPill.dot}`}
                  />
                  {String(apt.status ?? "requested").replace(/_/g, " ")}
                </span>
                <Pill tone="slate" icon={<Timer className="h-4 w-4" />}>
                  #{shortId}
                </Pill>
                <span className="gg-live-dot">
                  <Pill
                    tone="emerald"
                    icon={
                      lastLiveSyncAt ? (
                        <RefreshCw className="h-4 w-4" />
                      ) : (
                        <Activity className="h-4 w-4" />
                      )
                    }
                  >
                    Live Sync
                  </Pill>
                </span>
                {customerEmail !== "—" ? (
                  <button
                    onClick={() => copyToClipboard(customerEmail)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100 hover:bg-white/[0.09]"
                    title="Copy customer email"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy email
                  </button>
                ) : null}
              </div>
            </m.div>
            <m.div
              variants={vSection}
              className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <Link href="/admin/portal/appointments">
                  <Button className="gg-btn">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to list
                  </Button>
                </Link>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-300/85">
                    Appointment
                  </div>
                  <div className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
                    {serviceTitle || "Service"}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {customerName} • {customerEmail}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setOverrideMode((v) => !v)}
                  className={overrideMode ? "gg-btn-primary" : "gg-btn"}
                >
                  {overrideMode ? (
                    <Unlock className="mr-2 h-4 w-4" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  {overrideMode ? "Override On" : "Enable Override"}
                </Button>
                <Link href={`/admin/messages?appointment_id=${apt.id}`}>
                  <Button className="gg-btn">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Open Thread
                  </Button>
                </Link>
                {apt.service_address ? (
                  <a
                    className="inline-flex"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      String(apt.service_address)
                    )}`}
                  >
                    <Button className="gg-btn">
                      <Navigation className="mr-2 h-4 w-4" />
                      Maps
                    </Button>
                  </a>
                ) : null}
                {!isCompleted ? (
                  <Button
                    onClick={() => guarded(() => setCompleteOpen(true))}
                    disabled={updateMutation.isPending || !overrideMode}
                    className={overrideMode ? "gg-btn-primary" : "gg-btn"}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Admin Complete
                  </Button>
                ) : null}
                {nextStatus(apt.status) ? (
                  <Button
                    onClick={handleAdvanceStatus}
                    disabled={updateMutation.isPending || !overrideMode}
                    className={overrideMode ? "gg-btn-primary" : "gg-btn"}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {updateMutation.isPending ? "Updating…" : nextLabel}
                  </Button>
                ) : null}
              </div>
            </m.div>
            <m.div variants={vSection}>
              <ReadOnlyNotice overrideMode={overrideMode} />
            </m.div>
            <m.div variants={vSection}>
              <GradientBorder intensity={0.88}>
                <GlassShell className="p-5 md:p-6">
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_1.3fr]">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className="absolute -inset-2 rounded-3xl bg-sky-400/20 blur-xl" />
                          <div className="relative grid h-16 w-16 place-items-center rounded-3xl border border-sky-300/25 bg-sky-500/15">
                            <UserIcon className="h-7 w-7 text-sky-100" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                            Customer Info
                          </p>
                          <h2 className="mt-1 truncate text-2xl font-black text-white">
                            {customerName}
                          </h2>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Pill tone={appUser?.id ? "emerald" : "amber"}>
                              {appUser?.id ? "App User Found" : "No App User Row"}
                            </Pill>
                            <Pill tone={appUser?.portal_activated_at ? "emerald" : "slate"}>
                              {portalStatus}
                            </Pill>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3">
                        <DetailTile
                          icon={<Mail className="h-5 w-5 text-sky-200" />}
                          label="Email"
                          value={customerEmail}
                          sub={
                            customerEmail !== "—" ? (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(customerEmail)}
                                className="text-sky-200 hover:text-sky-100"
                              >
                                Copy email
                              </button>
                            ) : (
                              "No email found"
                            )
                          }
                          tone="sky"
                        />
                        <DetailTile
                          icon={<Phone className="h-5 w-5 text-emerald-200" />}
                          label="Phone"
                          value={customerPhone}
                          sub={
                            customerPhone !== "No phone" ? (
                              <a
                                href={`tel:${customerPhone}`}
                                className="text-emerald-200 hover:text-emerald-100"
                              >
                                Tap to call
                              </a>
                            ) : (
                              "No phone saved in app_users"
                            )
                          }
                          tone="emerald"
                        />
                        <DetailTile
                          icon={<Home className="h-5 w-5 text-violet-200" />}
                          label="Customer / Service Address"
                          value={customerAddress}
                          sub="Reads app_users address first, then appointment service_address"
                          tone="violet"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <StatChip
                        icon={<CalendarIcon className="h-5 w-5 text-sky-200" />}
                        label="Scheduled"
                        value={scheduleFullLabel}
                        tone="sky"
                      />
                      <StatChip
                        icon={<BadgeDollarSign className="h-5 w-5 text-emerald-200" />}
                        label="Estimate"
                        value={estimateLabel}
                        tone="emerald"
                      />
                      <StatChip
                        icon={<DollarSign className="h-5 w-5 text-violet-200" />}
                        label="Final"
                        value={finalLabel}
                        tone="violet"
                      />
                      <StatChip
                        icon={<CreditCard className="h-5 w-5 text-amber-200" />}
                        label="Deposit"
                        value={
                          <span>
                            {depositLabel}{" "}
                            <span className="text-xs text-slate-300">
                              • {depositStatus}
                            </span>
                          </span>
                        }
                        tone="amber"
                      />
                      <StatChip
                        icon={<ReceiptText className="h-5 w-5 text-emerald-200" />}
                        label="Actual Due"
                        value={actualDueLabel}
                        tone={actualDueCents <= 0 && grossFinalCents > 0 ? "emerald" : "sky"}
                      />
                      <StatChip
                        icon={<AlertTriangle className="h-5 w-5 text-amber-200" />}
                        label="Risk"
                        value={
                          <span className="text-white">
                            {hasCrackOut ? "Crack-out" : "Normal"}{" "}
                            <span className="text-slate-300 font-semibold">
                              • {replacementReq ? "Replacement" : "Repair"}
                            </span>
                          </span>
                        }
                        tone="amber"
                      />
                    </div>
                  </div>
                </GlassShell>
              </GradientBorder>
            </m.div>
            <m.div variants={vSection}>
              <GradientBorder intensity={0.92}>
                <GlassShell className="p-0">
                  <Card className="border-0 bg-transparent shadow-none">
                    <CardHeader className="border-b border-white/10 bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-sky-950/50">
                      <CardTitle className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 border border-white/10">
                            <ShieldCheck className="h-5 w-5 text-sky-100" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-lg font-extrabold text-white">
                              Job Control Center
                            </div>
                            <div className="text-sm text-slate-300">
                              Live tech mirror • view-only by default • override unlocks controls
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border border-white/10 bg-white/[0.06] text-slate-100">
                            {apt.location_type
                              ? String(apt.location_type).replace(/_/g, " ")
                              : "—"}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-8 p-6 md:p-8 lg:grid-cols-3">
                      <div className="space-y-6 lg:col-span-2">
                        <m.div variants={vItem}>
                          <LiveServiceTimeline
                            status={apt.status}
                            busy={updateMutation.isPending}
                            readOnly={!overrideMode}
                            onPick={handlePickStatus}
                          />
                        </m.div>
                        <m.div variants={vItem}>
                          <TechWorkflowMirror
                            apt={apt}
                            photos={photos}
                            waiver={waiverRecord}
                            techInvoice={techInvoice}
                            updateBusy={updateMutation.isPending}
                            overrideMode={overrideMode}
                            onStepPick={handlePickWorkflowStep}
                            onCompleteClick={() => guarded(() => setCompleteOpen(true))}
                          />
                        </m.div>
                        <SectionPanel
                          title="Deposit & Balance"
                          subtitle="Deposit is pulled from tech_invoices, appointments, or deposit_requests."
                          icon={<CreditCard className="h-4 w-4 text-amber-300" />}
                        >
                          <div className="grid gap-3 md:grid-cols-4">
                            <StatChip
                              icon={<BadgeDollarSign className="h-5 w-5 text-violet-200" />}
                              label="Gross Final"
                              value={finalLabel}
                              tone="violet"
                            />
                            <StatChip
                              icon={<CreditCard className="h-5 w-5 text-amber-200" />}
                              label="Deposit Paid"
                              value={depositLabel}
                              tone="amber"
                            />
                            <StatChip
                              icon={<ReceiptText className="h-5 w-5 text-emerald-200" />}
                              label="Actual Due"
                              value={actualDueLabel}
                              tone={actualDueCents <= 0 && grossFinalCents > 0 ? "emerald" : "sky"}
                            />
                            <StatChip
                              icon={<Clock className="h-5 w-5 text-slate-200" />}
                              label="Deposit Status"
                              value={depositStatus}
                              tone={
                                ["paid", "succeeded", "applied"].includes(depositStatus)
                                  ? "emerald"
                                  : depositStatus === "pending"
                                    ? "amber"
                                    : "slate"
                              }
                            />
                          </div>
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">
                            <div className="grid gap-2 md:grid-cols-2">
                              <p>
                                <span className="text-slate-500">Deposit request:</span>{" "}
                                {depositRequest?.id ? String(depositRequest.id).slice(0, 8) : "—"}
                              </p>
                              <p>
                                <span className="text-slate-500">Paid at:</span>{" "}
                                {formatDateTime(
                                  depositRequest?.paid_at ||
                                    apt.deposit_paid_at ||
                                    techInvoice?.deposit_applied_at
                                )}
                              </p>
                              <p>
                                <span className="text-slate-500">Stripe session:</span>{" "}
                                {depositRequest?.stripe_checkout_session_id
                                  ? String(depositRequest.stripe_checkout_session_id).slice(0, 18)
                                  : "—"}
                              </p>
                              <p>
                                <span className="text-slate-500">Payment intent:</span>{" "}
                                {depositRequest?.stripe_payment_intent_id
                                  ? String(depositRequest.stripe_payment_intent_id).slice(0, 18)
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        </SectionPanel>
                      </div>
                      <div className="space-y-6">
                        <SectionPanel
                          title="Technician"
                          icon={<Wrench className="h-4 w-4 text-sky-300" />}
                        >
                          <select
                            className={SELECT_BASE}
                            value={apt.technician_email ?? "unassigned"}
                            onChange={(e) => handleAssignTech(e.target.value)}
                            disabled={!overrideMode}
                          >
                            <option value="unassigned">— Unassigned —</option>
                            {techs.map((t: AnyObj) => (
                              <option key={t.id} value={t.email}>
                                {t.full_name || t.email}
                                {t.tech_rating
                                  ? ` (★${Number(t.tech_rating).toFixed(1)})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </SectionPanel>
                        <SectionPanel
                          title="Status"
                          icon={<Activity className="h-4 w-4 text-emerald-300" />}
                        >
                          <div className="space-y-3">
                            <select
                              className={SELECT_BASE}
                              value={apt.status ?? "requested"}
                              onChange={(e) => handlePickStatus(e.target.value)}
                              disabled={!overrideMode}
                            >
                              {[
                                "requested",
                                "estimating",
                                "estimate_sent",
                                "approved",
                                "scheduled",
                                "en_route",
                                "on_site",
                                "in_progress",
                                "curing",
                                "completed",
                                "paid",
                                "cancelled",
                              ].map((s) => (
                                <option key={s} value={s}>
                                  {s.replace(/_/g, " ")}
                                </option>
                              ))}
                            </select>
                            {nextStatus(apt.status) ? (
                              <Button
                                onClick={handleAdvanceStatus}
                                disabled={updateMutation.isPending || !overrideMode}
                                className="gg-btn w-full"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                {updateMutation.isPending
                                  ? "Updating…"
                                  : nextLabel}
                              </Button>
                            ) : null}
                          </div>
                        </SectionPanel>
                        <SectionPanel
                          title="Photos"
                          subtitle={`${photos.length} uploaded • before ${photoGroups.before.length} • after ${photoGroups.after.length}`}
                          icon={<Images className="h-4 w-4 text-sky-300" />}
                        >
                          {photos.length === 0 ? (
                            <p className="text-sm text-slate-400">
                              No photos uploaded yet.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <AnimatePresence initial={false}>
                                {photos.map((p: AnyObj, idx: number) => (
                                  <m.a
                                    key={p.id ?? p.file_url}
                                    href={p.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={{
                                      duration: reducedMotion ? 0 : 0.25,
                                      ease: easeOutExpo,
                                      delay: reducedMotion ? 0 : idx * 0.02,
                                    }}
                                    className="group block overflow-hidden rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30"
                                  >
                                    <div className="relative h-28 w-full">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={String(p.file_url)}
                                        alt={String(p.photo_type ?? "photo")}
                                        loading="lazy"
                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                                      />
                                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-90" />
                                    </div>
                                    <div className="px-2.5 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-200/90">
                                      {String(p.photo_type ?? "").replace(/_/g, " ") ||
                                        "photo"}
                                    </div>
                                  </m.a>
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </SectionPanel>
                        <SectionPanel
                          title="Invoice"
                          icon={<PenSquare className="h-4 w-4 text-violet-300" />}
                        >
                          <div className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Invoice
                              </p>
                              <p className="mt-1 text-sm font-bold text-white">
                                {techInvoice?.invoice_number ||
                                  (techInvoice?.id ? "Draft Created" : "Not created")}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Final: {finalLabel}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Deposit: {depositLabel}
                              </p>
                              <p className="mt-1 text-xs text-emerald-200">
                                Actual due: {actualDueLabel}
                              </p>
                            </div>
                            {techInvoice?.id ? (
                              <Link href={`/tech/dashboard/invoices/invoice/${techInvoice.id}`}>
                                <Button className="gg-btn w-full">
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Invoice
                                </Button>
                              </Link>
                            ) : null}
                          </div>
                        </SectionPanel>
                      </div>
                    </CardContent>
                  </Card>
                </GlassShell>
              </GradientBorder>
            </m.div>
          </div>
        </m.div>
      </LazyMotion>
    </ScreenShell>
  );
}
/* ----------------------------- Shell helpers ----------------------------- */
function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-slate-100">
      <div className="absolute inset-0 -z-30">
        <SafeHeroBackground3D />
      </div>
      <div className="absolute inset-0 -z-20 pointer-events-none">
        <div className="absolute inset-0 gg-aurora" />
        <div className="absolute inset-0 gg-vignette" />
        <div className="absolute inset-0 gg-noise opacity-[0.08] mix-blend-overlay" />
      </div>
      {children}
      <GlobalStyles />
    </div>
  );
}
function CenteredCard({
  icon,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <GradientBorder intensity={0.95} className="w-full max-w-lg">
        <GlassShell className="p-7">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 border border-white/10">
              {icon}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-300/90">
                Glass Guardian • Admin
              </div>
              <h2 className="mt-2 text-xl font-extrabold text-white">{title}</h2>
              <p className="mt-2 text-sm text-slate-300">{body}</p>
              <div className="mt-5">
                <Link href={actionHref}>
                  <Button className="gg-btn w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {actionLabel}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </GlassShell>
      </GradientBorder>
    </div>
  );
}
/* ----------------------------- Global Styles ----------------------------- */
function GlobalStyles() {
  return (
    <style jsx global>{`
      @keyframes gg-aurora-drift {
        0% {
          transform: translate3d(0, 0, 0) scale(1);
          filter: hue-rotate(0deg);
        }
        50% {
          transform: translate3d(1.2%, -1%, 0) scale(1.035);
          filter: hue-rotate(8deg);
        }
        100% {
          transform: translate3d(0, 0, 0) scale(1);
          filter: hue-rotate(0deg);
        }
      }
      @keyframes gg-live-pulse {
        0%,
        100% {
          opacity: 0.55;
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.28);
        }
        50% {
          opacity: 1;
          transform: scale(1.08);
          box-shadow: 0 0 0 7px rgba(34, 211, 238, 0);
        }
      }
      @keyframes gg-shimmer {
        0% {
          transform: translateX(-140%) skewX(-18deg);
          opacity: 0;
        }
        15% {
          opacity: 0.9;
        }
        55% {
          opacity: 0.65;
        }
        100% {
          transform: translateX(180%) skewX(-18deg);
          opacity: 0;
        }
      }
      @keyframes gg-complete-bloom {
        0% {
          opacity: 0;
          transform: scale(0.96);
          filter: blur(8px);
        }
        45% {
          opacity: 1;
          filter: blur(0px);
        }
        100% {
          opacity: 1;
          transform: scale(1);
          filter: blur(0px);
        }
      }
      .gg-aurora {
        background: radial-gradient(
            1000px 680px at 12% 10%,
            rgba(59, 130, 246, 0.3),
            transparent 55%
          ),
          radial-gradient(
            900px 620px at 88% 82%,
            rgba(16, 185, 129, 0.24),
            transparent 58%
          ),
          radial-gradient(
            820px 580px at 62% 22%,
            rgba(168, 85, 247, 0.16),
            transparent 60%
          );
        animation: gg-aurora-drift 18s ease-in-out infinite;
        will-change: transform, filter;
      }
      .gg-vignette {
        background: linear-gradient(
          180deg,
          rgba(2, 6, 23, 0.65),
          rgba(2, 6, 23, 0.88) 35%,
          rgba(0, 0, 0, 0.96)
        );
      }
      .gg-noise {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' width='128' height='128' viewBox='0 0 128 128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(%23n)' opacity='0.35'/></svg>");
      }
      .gg-btn,
      .gg-btn-primary {
        position: relative;
        overflow: hidden;
        transform: translateZ(0);
        will-change: transform, filter, box-shadow, background;
      }
      .gg-btn::before,
      .gg-btn-primary::before {
        content: "";
        position: absolute;
        inset: 0;
        width: 48%;
        transform: translateX(-140%) skewX(-18deg);
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.22),
          transparent
        );
        pointer-events: none;
      }
      .gg-btn:hover::before,
      .gg-btn-primary:hover::before {
        animation: gg-shimmer 900ms ease-out;
      }
      .gg-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: rgba(248, 250, 252, 0.96);
        box-shadow: 0 16px 50px rgba(0, 0, 0, 0.48),
          inset 0 1px 0 rgba(255, 255, 255, 0.07);
        transition: transform 170ms ease, background 170ms ease,
          box-shadow 170ms ease, border-color 170ms ease;
      }
      .gg-btn:hover {
        background: rgba(255, 255, 255, 0.145);
        border-color: rgba(255, 255, 255, 0.24);
        transform: translateY(-1.5px) scale(1.01);
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.55),
          0 0 28px rgba(56, 189, 248, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }
      .gg-btn:active {
        transform: translateY(0px) scale(0.975);
      }
      .gg-btn-primary {
        background: linear-gradient(
          135deg,
          rgba(56, 189, 248, 0.98),
          rgba(16, 185, 129, 0.88)
        );
        background-size: 140% 140%;
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: rgba(2, 6, 23, 0.98);
        font-weight: 900;
        box-shadow: 0 18px 60px rgba(56, 189, 248, 0.18),
          0 18px 60px rgba(16, 185, 129, 0.13),
          inset 0 1px 0 rgba(255, 255, 255, 0.22);
        transition: transform 170ms ease, filter 170ms ease,
          background-position 220ms ease, box-shadow 170ms ease;
      }
      .gg-btn-primary:hover {
        filter: brightness(1.045) saturate(1.08);
        background-position: 100% 50%;
        transform: translateY(-1.5px) scale(1.012);
        box-shadow: 0 24px 80px rgba(56, 189, 248, 0.22),
          0 24px 80px rgba(16, 185, 129, 0.16),
          0 0 36px rgba(34, 211, 238, 0.16),
          inset 0 1px 0 rgba(255, 255, 255, 0.28);
      }
      .gg-btn-primary:active {
        transform: translateY(0px) scale(0.975);
      }
      .gg-btn:disabled,
      .gg-btn-primary:disabled {
        cursor: not-allowed;
        opacity: 0.58;
        transform: none;
        filter: grayscale(0.25);
      }
      .gg-btn:focus-visible,
      .gg-btn-primary:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.35),
          0 20px 70px rgba(0, 0, 0, 0.5);
      }
      .gg-live-dot {
        position: relative;
      }
      .gg-live-dot::before {
        content: "";
        display: inline-block;
        width: 7px;
        height: 7px;
        margin-right: 7px;
        border-radius: 999px;
        background: rgb(34, 211, 238);
        animation: gg-live-pulse 1.8s ease-in-out infinite;
        vertical-align: middle;
      }
      .gg-complete-card {
        animation: gg-complete-bloom 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .gg-card-lift {
        transition: transform 180ms ease, border-color 180ms ease,
          background 180ms ease, box-shadow 180ms ease;
      }
      .gg-card-lift:hover {
        transform: translateY(-2px);
        border-color: rgba(125, 211, 252, 0.28);
        background: rgba(255, 255, 255, 0.078);
        box-shadow: 0 22px 75px rgba(0, 0, 0, 0.32),
          0 0 32px rgba(56, 189, 248, 0.08);
      }
      input,
      textarea,
      select {
        transition: border-color 160ms ease, box-shadow 160ms ease,
          background 160ms ease, transform 160ms ease;
      }
      input:focus,
      textarea:focus,
      select:focus {
        transform: translateY(-1px);
      }
      select option {
        background: #020617;
        color: #f8fafc;
      }
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.001ms !important;
        }
      }
    `}</style>
  );
}