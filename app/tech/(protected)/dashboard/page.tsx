// app/tech/(protected)/dashboard/page.tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Clock,
  ArrowRight,
  Info,
  Sparkles,
  Calendar,
  PlusCircle,
  RefreshCw,
  X,
  User as UserIcon,
  CreditCard,
  Copy,
  CheckCircle2,
  BadgeDollarSign,
  RotateCcw,
  AlertCircle,
  ShieldCheck,
  Hourglass,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";
import DevBanner from "@/components/DevBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import JobCard from "@/components/tech/JobCard";
import CompletedJobRow from "@/components/tech/CompletedJobRow";
import { getNextStatus, getNextStatusLabel } from "@/components/tech/status";
import { localISODate } from "@/lib/dateLocal";
import { ensureTechProfile } from "@/lib/ensureTechProfile";
type AnyObj = Record<string, any>;
const TECH_TZ = "America/Los_Angeles";
type DepositState =
  | "paid"
  | "pending"
  | "refunded"
  | "failed"
  | "waived"
  | "not_requested"
  | "unknown";
function isSameLocalDate(iso?: string | null, isoRef?: string | null) {
  if (!iso || !isoRef) return false;
  return iso.slice(0, 10) === isoRef.slice(0, 10);
}
function moneyFromCents(v: any) {
  const n = Number(v || 0);
  return `$${(n / 100).toFixed(0)}`;
}
function normalizeDepositStatus(v: any): DepositState {
  const raw = String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (["paid", "succeeded", "success", "complete", "completed"].includes(raw)) {
    return "paid";
  }
  if (
    [
      "pending",
      "open",
      "created",
      "requires_payment",
      "requires_action",
      "requested",
      "sent",
      "unpaid",
    ].includes(raw)
  ) {
    return "pending";
  }
  if (["refunded", "refund", "partially_refunded"].includes(raw)) {
    return "refunded";
  }
  if (["failed", "canceled", "cancelled", "expired", "void"].includes(raw)) {
    return "failed";
  }
  if (["waived", "not_required", "no_deposit_required"].includes(raw)) {
    return "waived";
  }
  return "unknown";
}
function getDepositInfo(job: AnyObj): {
  state: DepositState;
  amountCents: number;
  label: string;
  note: string;
} {
  const meta =
    job.deposit_meta ||
    job.deposit_request ||
    job.payment_meta ||
    job.stripe_meta ||
    job.appointment_payment_meta ||
    {};
  const amountCents =
    Number(
      job.deposit_amount_cents ??
        job.deposit_cents ??
        job.required_deposit_cents ??
        meta.amount_cents ??
        meta.deposit_amount_cents ??
        2000
    ) || 2000;
  const directStatus =
    job.deposit_status ??
    job.deposit_payment_status ??
    job.payment_status ??
    job.stripe_payment_status ??
    meta.status ??
    meta.payment_status ??
    meta.deposit_status;
  let state = normalizeDepositStatus(directStatus);
  if (job.deposit_refunded_at || meta.refunded_at) state = "refunded";
  else if (
    job.deposit_paid_at ||
    meta.paid_at ||
    meta.paid === true ||
    job.deposit_payment_id ||
    job.stripe_payment_intent_id ||
    meta.payment_intent_id ||
    meta.stripe_payment_intent_id
  ) {
    state = "paid";
  } else if (
    job.deposit_link ||
    job.deposit_url ||
    job.deposit_checkout_url ||
    meta.deposit_url ||
    meta.url ||
    meta.checkout_url
  ) {
    if (state === "unknown") state = "pending";
  }
  if (state === "unknown") {
    const requiresDeposit =
      job.requires_deposit ??
      job.deposit_required ??
      meta.requires_deposit ??
      meta.deposit_required;
    if (requiresDeposit === false) state = "waived";
    else state = "not_requested";
  }
  const amount = moneyFromCents(amountCents);
  switch (state) {
    case "paid":
      return { state, amountCents, label: `${amount} Deposit Paid`, note: "Collected and ready" };
    case "pending":
      return { state, amountCents, label: `${amount} Deposit Pending`, note: "Link sent / awaiting payment" };
    case "refunded":
      return { state, amountCents, label: `${amount} Deposit Refunded`, note: "Returned to customer" };
    case "failed":
      return { state, amountCents, label: `${amount} Deposit Issue`, note: "Needs payment follow-up" };
    case "waived":
      return { state, amountCents, label: "Deposit Waived", note: "No deposit required" };
    default:
      return { state, amountCents, label: "No Deposit Yet", note: "Not requested" };
  }
}
function DepositBadge({ job }: { job: AnyObj }) {
  const info = getDepositInfo(job);
  const styles: Record<DepositState, string> = {
    paid: "border-emerald-300/45 bg-emerald-400/12 text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,0.18)]",
    pending: "border-sky-300/45 bg-sky-400/12 text-sky-100 shadow-[0_0_28px_rgba(56,189,248,0.16)]",
    refunded: "border-violet-300/45 bg-violet-400/12 text-violet-100 shadow-[0_0_28px_rgba(139,92,246,0.16)]",
    failed: "border-rose-300/45 bg-rose-400/12 text-rose-100 shadow-[0_0_28px_rgba(244,63,94,0.16)]",
    waived: "border-slate-300/35 bg-white/[0.055] text-slate-100 shadow-[0_0_24px_rgba(148,163,184,0.12)]",
    not_requested: "border-white/12 bg-white/[0.035] text-slate-300",
    unknown: "border-white/12 bg-white/[0.035] text-slate-300",
  };
  const Icon =
    info.state === "paid"
      ? CheckCircle2
      : info.state === "pending"
        ? Hourglass
        : info.state === "refunded"
          ? RotateCcw
          : info.state === "failed"
            ? AlertCircle
            : info.state === "waived"
              ? ShieldCheck
              : BadgeDollarSign;
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-xl",
        styles[info.state],
      ].join(" ")}
      title={info.note}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{info.label}</span>
    </div>
  );
}
function DashboardSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/70 shadow-[0_40px_160px_rgba(2,6,23,0.94)] backdrop-blur-2xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(56,189,248,0.15), transparent 34%), radial-gradient(circle at 82% 18%, rgba(16,185,129,0.11), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.095), rgba(255,255,255,0.025) 42%, rgba(2,6,23,0) 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-28 -bottom-32 h-80 w-80 rounded-full bg-emerald-400/8 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}
function SectionDivider({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={["h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent", className].join(" ")} />
  );
}
function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold tracking-tight text-slate-50">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 backdrop-blur">
      <div className="mb-2 h-4 w-40 rounded bg-white/10" />
      <div className="h-3 w-64 rounded bg-white/5" />
    </div>
  );
}
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_18px_70px_rgba(2,6,23,0.38)] backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-sky-400/8 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}
function ActiveTodayJobShell({ job, children }: { job: AnyObj; children: React.ReactNode }) {
  const customer =
    job.customer_name ||
    job.full_name ||
    job.name ||
    job.customer_email ||
    job.email ||
    "Customer";
  const address = job.service_address || job.address || job.location || null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-slate-950/72 via-slate-950/58 to-sky-950/24 p-3 shadow-[0_22px_90px_rgba(2,6,23,0.55)] backdrop-blur-2xl"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/35 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-emerald-400/8 blur-3xl" />
      <div className="relative mb-3 flex flex-col gap-3 px-1 pt-1 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-50">{customer}</p>
            <DepositBadge job={job} />
          </div>
          {address ? (
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">{address}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Deposit visibility active for this appointment</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5 text-sky-200/80" />
          <span>
            {job.scheduled_time_start || "Time TBA"}
            {job.scheduled_time_end ? ` – ${job.scheduled_time_end}` : ""}
          </span>
        </div>
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
}
function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <GlassCard>
      <div className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <button type="button" onClick={() => setOpen((s) => !s)} className="group flex items-center gap-2 text-left">
              <span
                className={[
                  "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition",
                  open ? "border-sky-200/50 bg-sky-400/14 text-sky-100" : "border-white/12 bg-white/[0.03] text-slate-200",
                ].join(" ")}
                aria-hidden
              >
                <span className={["block h-0.5 w-3 bg-current transition-transform", open ? "rotate-0" : "rotate-90"].join(" ")} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-50">{title}</p>
                {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
              </div>
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 md:justify-end">
            {right}
            <Button
              variant="outline"
              size="sm"
              className="border-white/12 bg-white/[0.025] text-slate-100 hover:border-sky-200/35 hover:bg-white/[0.055]"
              onClick={() => setOpen((s) => !s)}
            >
              {open ? "Hide" : "Show"}
            </Button>
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="border-t border-white/10"
          >
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
type NewUserForm = {
  full_name: string;
  email: string;
  phone: string;
};
type DepositForm = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
};
type CreatedDeposit = {
  deposit_url: string;
  message: string;
};
type UserInvite = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
  used_at: string | null;
};
type AssignmentToast = {
  id: string;
  service_type: string | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  customer_email: string | null;
  service_address: string | null;
};
export default function TechDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [devActive, setDevActive] = React.useState(false);
  const [techEmail, setTechEmail] = React.useState<string | null>(null);
  const [userOpen, setUserOpen] = React.useState(false);
  const [userBusy, setUserBusy] = React.useState(false);
  const [userErr, setUserErr] = React.useState<string | null>(null);
  const [userForm, setUserForm] = React.useState<NewUserForm>({
    full_name: "",
    email: "",
    phone: "",
  });
  const [depositOpen, setDepositOpen] = React.useState(false);
  const [depositBusy, setDepositBusy] = React.useState(false);
  const [depositErr, setDepositErr] = React.useState<string | null>(null);
  const [copiedDepositText, setCopiedDepositText] = React.useState(false);
  const [createdDeposit, setCreatedDeposit] = React.useState<CreatedDeposit | null>(null);
  const [depositForm, setDepositForm] = React.useState<DepositForm>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
  });
  const [inboxTab, setInboxTab] = React.useState<"leads" | "invites">("leads");
  const [assignmentToast, setAssignmentToast] = React.useState<AssignmentToast | null>(null);
  const prevJobIdsRef = React.useRef<Set<string> | null>(null);
  const [resendingInviteId, setResendingInviteId] = React.useState<string | null>(null);
  const canCreateUser =
    userForm.full_name.trim().length > 1 &&
    userForm.email.trim().length > 3 &&
    !userBusy;
  const canRequestDeposit =
    depositForm.customer_name.trim().length > 1 &&
    depositForm.customer_phone.trim().length > 6 &&
    !depositBusy;
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (session) {
        if (!mounted) return;
        setTechEmail(session.user.email ?? null);
        setDevActive(false);
        ensureTechProfile().catch(() => {});
        return;
      }
      const role = readDevRoleFromCookie();
      if (role === "tech") {
        const dev = makeDevUser("tech");
        if (!mounted) return;
        setTechEmail(dev.email || "dev.tech@example.com");
        setDevActive(true);
        return;
      }
      router.replace(`/login?redirect=${encodeURIComponent("/tech/dashboard")}`);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);
  const todayISO = React.useMemo(() => localISODate(TECH_TZ), []);
  const { data: todayJobs = [], isLoading: loadingToday } = useQuery({
    queryKey: ["tech:today-jobs", techEmail, todayISO],
    enabled: !!techEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("technician_email", techEmail)
        .eq("scheduled_date", todayISO)
        .order("scheduled_time_start", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 10_000,
  });
  const { data: depositRequests = [] } = useQuery({
    queryKey: ["tech:deposit-requests", techEmail],
    enabled: !!techEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("deposit_requests")
        .select("*")
        .eq("technician_email", techEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 10_000,
  });
  const { data: allJobs = [] } = useQuery({
    queryKey: ["tech:all-jobs", techEmail],
    enabled: !!techEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("technician_email", techEmail)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
  });
  const jobsWithDeposits = React.useMemo(() => {
    return todayJobs.map((job) => {
      const deposit = depositRequests.find(
        (d: AnyObj) => String(d.appointment_id || "") === String(job.id || "")
      );
      if (!deposit) return job;
      return {
        ...job,
        deposit_request: deposit,
        deposit_meta: deposit,
        deposit_status: deposit.status,
        deposit_amount_cents: deposit.amount_cents,
        deposit_paid_at: deposit.paid_at,
        deposit_refunded_at: deposit.refunded_at,
        deposit_url: deposit.deposit_url || deposit.url || deposit.checkout_url,
        deposit_checkout_url: deposit.checkout_url,
        deposit_payment_id:
          deposit.payment_id ||
          deposit.stripe_payment_intent_id ||
          deposit.payment_intent_id,
      };
    });
  }, [todayJobs, depositRequests]);
  React.useEffect(() => {
    if (!allJobs || allJobs.length === 0) {
      prevJobIdsRef.current = new Set();
      return;
    }
    const currentIds = new Set<string>(allJobs.map((j: AnyObj) => String(j.id)));
    if (!prevJobIdsRef.current) {
      prevJobIdsRef.current = currentIds;
      return;
    }
    const prev = prevJobIdsRef.current;
    const newlyAssigned = allJobs.filter((j: AnyObj) => {
      const id = String(j.id);
      const status = (j.status ?? "").toLowerCase();
      if (prev.has(id)) return false;
      if (status === "completed" || status === "cancelled" || status === "paid") return false;
      return true;
    });
    if (newlyAssigned.length > 0) {
      const latest = newlyAssigned[newlyAssigned.length - 1];
      setAssignmentToast({
        id: String(latest.id),
        service_type: latest.service_type ?? null,
        scheduled_date: latest.scheduled_date ?? null,
        scheduled_time_start: latest.scheduled_time_start ?? null,
        customer_email: latest.customer_email ?? null,
        service_address: latest.service_address ?? null,
      });
    }
    prevJobIdsRef.current = currentIds;
  }, [allJobs]);
  React.useEffect(() => {
    if (!assignmentToast) return;
    const t = setTimeout(() => setAssignmentToast(null), 8000);
    return () => clearTimeout(t);
  }, [assignmentToast]);
  const { data: bookingLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["tech:booking-leads", techEmail],
    enabled: !!techEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("booking_leads")
        .select("*")
        .eq("technician_email", techEmail)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
  });
  const { data: invites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ["tech:user-invites", techEmail],
    enabled: !!techEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("user_invites")
        .select("id, full_name, email, phone, created_at, used_at")
        .eq("created_by_tech_email", techEmail)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as UserInvite[];
    },
  });
  const resendInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { data: s } = await supabaseClient.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/tech/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "resend",
          invite_id: inviteId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to resend invite email");
      return json;
    },
    onMutate: async (inviteId: string) => {
      setResendingInviteId(inviteId);
    },
    onSettled: () => {
      setResendingInviteId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech:user-invites", techEmail] });
    },
  });
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: AnyObj = { status };
      if (status === "on_site") patch.actual_start_time = new Date().toISOString();
      if (status === "completed") patch.actual_end_time = new Date().toISOString();
      const { error } = await supabaseClient.from("appointments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech:today-jobs", techEmail, todayISO] });
      queryClient.invalidateQueries({ queryKey: ["tech:deposit-requests", techEmail] });
      queryClient.invalidateQueries({ queryKey: ["tech:all-jobs", techEmail] });
    },
  });
  const completedToday = React.useMemo(
    () => jobsWithDeposits.filter((j) => j.status === "completed" || j.status === "paid"),
    [jobsWithDeposits]
  );
  const activeToday = React.useMemo(
    () =>
      jobsWithDeposits.filter(
        (j) => !["completed", "paid", "cancelled"].includes(j.status)
      ),
    [jobsWithDeposits]
  );
  const pipelineStats = React.useMemo(() => {
    const base: Record<"scheduled" | "en_route" | "on_site" | "in_progress" | "curing" | "completed", number> = {
      scheduled: 0,
      en_route: 0,
      on_site: 0,
      in_progress: 0,
      curing: 0,
      completed: 0,
    };
    if (!allJobs || allJobs.length === 0) return base;
    for (const j of allJobs) {
      const s = j.status as keyof typeof base;
      if (s in base) base[s] += 1;
    }
    return base;
  }, [allJobs]);
  const upcomingByDate = React.useMemo(() => {
    if (!allJobs || allJobs.length === 0) return [] as { date: string; count: number }[];
    const map = new Map<string, number>();
    for (const j of allJobs) {
      const d: string | null = j.scheduled_date ?? null;
      if (!d) continue;
      if (d < todayISO) continue;
      if (j.status === "cancelled") continue;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
      .map(([date, count]) => ({ date, count }));
  }, [allJobs, todayISO]);
  async function submitNewUser() {
    try {
      setUserBusy(true);
      setUserErr(null);
      const { data: s } = await supabaseClient.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/tech/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: userForm.full_name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create user");
      setUserOpen(false);
      setUserForm({ full_name: "", email: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["tech:user-invites", techEmail] });
      alert("Invite email sent.\nThe customer will confirm their email and finish signup with standard authentication (no access code).");
      return json;
    } catch (e: any) {
      setUserErr(e?.message || "Failed to create user");
    } finally {
      setUserBusy(false);
    }
  }
  async function submitDepositRequest() {
    try {
      setDepositBusy(true);
      setDepositErr(null);
      setCreatedDeposit(null);
      setCopiedDepositText(false);
      const { data: s } = await supabaseClient.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/payments/deposits/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name: depositForm.customer_name.trim(),
          customer_email: depositForm.customer_email.trim(),
          customer_phone: depositForm.customer_phone.trim(),
          amount_cents: 2000,
          source: "tech_dashboard",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create deposit link");
      const depositUrl = json?.deposit_url || json?.url || json?.link || json?.checkout_url;
      if (!depositUrl) throw new Error("Deposit link was created, but no URL was returned.");
      const message = `Glass Guardian: Your $20 deposit link to lock your appointment is below. This deposit is applied toward your final repair total.\n\n${depositUrl}`;
      setCreatedDeposit({ deposit_url: depositUrl, message });
      queryClient.invalidateQueries({ queryKey: ["tech:deposit-requests", techEmail] });
      queryClient.invalidateQueries({ queryKey: ["tech:today-jobs", techEmail, todayISO] });
      queryClient.invalidateQueries({ queryKey: ["tech:all-jobs", techEmail] });
      return json;
    } catch (e: any) {
      setDepositErr(e?.message || "Failed to create deposit request");
    } finally {
      setDepositBusy(false);
    }
  }
  async function copyDepositMessage() {
    if (!createdDeposit?.message) return;
    try {
      await navigator.clipboard.writeText(createdDeposit.message);
      setCopiedDepositText(true);
      window.setTimeout(() => setCopiedDepositText(false), 1800);
    } catch {
      setDepositErr("Could not copy automatically. Highlight the message and copy it manually.");
    }
  }
  const inboxLeadsCount = bookingLeads?.length ?? 0;
  const inboxInvitesCount = invites?.length ?? 0;
  const completedCount = completedToday.length;
  const hasJobsToday = jobsWithDeposits.length > 0;
  return (
    <div className="relative pt-8 md:pt-12">
      <AnimatePresence>
        {assignmentToast && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, x: 80, scale: 0.95 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 80, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed right-4 top-24 z-[70] max-w-sm md:right-6"
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/95 via-sky-950/90 to-emerald-950/90 shadow-[0_36px_120px_rgba(2,6,23,0.95)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-400/30 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-emerald-400/24 blur-3xl" />
              <div className="relative p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/60 bg-slate-900/90 shadow-[0_0_36px_rgba(56,189,248,0.95)]">
                    <Sparkles className="h-5 w-5 text-sky-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/90">NEW JOB ROUTED</p>
                        <p className="mt-1 text-sm font-semibold text-slate-50">
                          {assignmentToast.service_type
                            ? assignmentToast.service_type.toString().replace(/_/g, " ").toUpperCase()
                            : "SERVICE REQUEST"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAssignmentToast(null)}
                        className="rounded-full border border-white/15 bg-white/[0.04] p-1 text-slate-300 transition hover:bg-white/[0.07] hover:text-slate-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {assignmentToast.customer_email && (
                      <p className="mt-1 break-all text-xs text-slate-200/90">{assignmentToast.customer_email}</p>
                    )}
                    {assignmentToast.service_address && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-300/80">{assignmentToast.service_address}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300/80">
                        <Clock className="h-3 w-3" />
                        <span>
                          {assignmentToast.scheduled_date ? format(new Date(assignmentToast.scheduled_date), "MMM d") : "Date TBA"}
                          {assignmentToast.scheduled_time_start ? ` · ${assignmentToast.scheduled_time_start}` : ""}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="h-8 bg-sky-500 px-3 text-xs text-white shadow-[0_0_32px_rgba(59,130,246,0.65)] hover:bg-sky-600"
                        onClick={() => {
                          router.push(`/tech/dashboard/schedule/jobs/${assignmentToast.id}`);
                          setAssignmentToast(null);
                        }}
                      >
                        View Job
                        <ArrowRight className="ml-1.5 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-auto max-w-7xl">
        {devActive && <DevBanner />}
        <DashboardSurface>
          <div className="px-5 py-6 md:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/75">Dashboard</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">Today at a glance</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="bg-blue-600 text-white shadow-[0_16px_44px_rgba(37,99,235,0.45)] hover:bg-blue-700"
                    onClick={() => {
                      setUserErr(null);
                      setUserOpen(true);
                      setInboxTab("invites");
                    }}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create User
                  </Button>
                  <Button
                    className="bg-emerald-600 text-white shadow-[0_16px_44px_rgba(16,185,129,0.35)] hover:bg-emerald-700"
                    onClick={() => {
                      setDepositErr(null);
                      setCreatedDeposit(null);
                      setCopiedDepositText(false);
                      setDepositOpen(true);
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Request Deposit
                  </Button>
                  <Link href="/tech/dashboard/schedule" className="inline-flex">
                    <Button variant="outline" className="border-white/12 bg-white/[0.025] text-slate-100 hover:border-sky-200/35 hover:bg-white/[0.055]">
                      View Schedule
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="w-full lg:max-w-md">
                <GlassCard>
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Today Snapshot</p>
                      <Badge variant="outline" className="border-white/12 bg-white/[0.025] text-slate-100">
                        {todayISO}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { label: "Jobs", value: jobsWithDeposits.length },
                        { label: "Active", value: activeToday.length },
                        { label: "Done", value: completedToday.length },
                      ].map((k) => (
                        <div key={k.label} className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2">
                          <p className="text-[11px] text-slate-400">{k.label}</p>
                          <p className="text-xl font-semibold tracking-tight text-slate-50">{k.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
          {loadingToday || hasJobsToday ? (
            <>
              <SectionDivider />
              <div className="px-5 py-6 md:px-7">
                <SectionHeader title="Active Today" subtitle="Live appointments with deposit status visible at a glance." />
                <div className="mt-4">
                  {loadingToday ? (
                    <div className="space-y-3">
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : activeToday.length > 0 ? (
                    <div className="space-y-4">
                      {activeToday.map((job) => (
                        <ActiveTodayJobShell key={job.id} job={job}>
                          <JobCard
                            job={job}
                            onAdvance={() =>
                              updateStatusMutation.mutate({
                                id: job.id,
                                status: getNextStatus(job.status),
                              })
                            }
                            advanceLabel={getNextStatusLabel(job.status)}
                            disableAdvance={updateStatusMutation.isPending}
                          />
                        </ActiveTodayJobShell>
                      ))}
                    </div>
                  ) : (
                    <GlassCard>
                      <div className="p-5 text-sm text-slate-400">No active jobs left for today.</div>
                    </GlassCard>
                  )}
                </div>
              </div>
            </>
          ) : null}
          <SectionDivider />
          <div className="px-5 py-6 md:px-7">
            <div className="grid gap-4 md:grid-cols-2">
              <GlassCard>
                <div className="p-5">
                  <SectionHeader
                    title="Next Up"
                    subtitle="Next few days of work."
                    action={
                      <Link href="/tech/dashboard/schedule" className="inline-flex">
                        <Button size="sm" variant="outline" className="border-white/12 bg-white/[0.025] text-slate-100 hover:border-sky-200/35 hover:bg-white/[0.055]">
                          Open Calendar
                          <ArrowRight className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    }
                  />
                  <div className="mt-4">
                    {upcomingByDate.length === 0 ? (
                      <p className="text-sm text-slate-400">No upcoming jobs scheduled yet.</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {upcomingByDate.map((row) => (
                          <div key={row.date} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 backdrop-blur">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-sky-200/75" />
                              <span className="font-medium text-slate-100">
                                {isSameLocalDate(row.date, todayISO) ? "Today" : format(new Date(row.date), "EEE, MMM d")}
                              </span>
                            </div>
                            <span className="text-slate-300">
                              {row.count} job{row.count === 1 ? "" : "s"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
              <CollapsiblePanel
                title="Pipeline"
                subtitle="Status distribution across assigned jobs."
                defaultOpen={false}
                right={
                  <Badge variant="outline" className="border-white/12 bg-white/[0.025] text-slate-100">
                    Total tracked: {Object.values(pipelineStats).reduce((a, b) => a + b, 0)}
                  </Badge>
                }
              >
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  {[
                    ["Scheduled", pipelineStats.scheduled],
                    ["En Route", pipelineStats.en_route],
                    ["On Site", pipelineStats.on_site],
                    ["In Progress", pipelineStats.in_progress],
                    ["Curing", pipelineStats.curing],
                    ["Completed", pipelineStats.completed],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 backdrop-blur">
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-lg font-semibold text-slate-50">{value as number}</p>
                    </div>
                  ))}
                </div>
              </CollapsiblePanel>
            </div>
          </div>
          <SectionDivider />
          <div className="px-5 py-6 md:px-7">
            <SectionHeader
              title="Inbox"
              subtitle="People tasks — leads and invites in one place."
              action={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={inboxTab === "leads" ? "default" : "outline"}
                    className={
                      inboxTab === "leads"
                        ? "bg-sky-600 text-white hover:bg-sky-700"
                        : "border-white/12 bg-white/[0.025] text-slate-100 hover:border-sky-200/35 hover:bg-white/[0.055]"
                    }
                    onClick={() => setInboxTab("leads")}
                  >
                    Leads
                    <Badge className="ml-2 border-white/10 bg-white/10 text-white">{inboxLeadsCount}</Badge>
                  </Button>
                  <Button
                    size="sm"
                    variant={inboxTab === "invites" ? "default" : "outline"}
                    className={
                      inboxTab === "invites"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border-white/12 bg-white/[0.025] text-slate-100 hover:border-emerald-200/35 hover:bg-white/[0.055]"
                    }
                    onClick={() => setInboxTab("invites")}
                  >
                    Invites
                    <Badge className="ml-2 border-white/10 bg-white/10 text-white">{inboxInvitesCount}</Badge>
                  </Button>
                </div>
              }
            />
            <div className="mt-4 space-y-3">
              {inboxTab === "leads" ? (
                loadingLeads ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : bookingLeads.length === 0 ? (
                  <GlassCard>
                    <div className="p-5 text-sm text-slate-400">No leads assigned to you yet.</div>
                  </GlassCard>
                ) : (
                  bookingLeads.map((lead: AnyObj) => {
                    const createdAt = lead.created_at ? format(new Date(lead.created_at), "MMM d, yyyy h:mma") : null;
                    const email = lead.customer_email || lead.email || lead.contact_email || "—";
                    const phone = lead.phone || lead.contact_phone || lead.customer_phone || null;
                    const serviceType = lead.service_type || lead.lead_type || "Lead";
                    const priorityLabel = lead.priority || lead.priority_label || lead.priority_to_contact || null;
                    return (
                      <GlassCard key={lead.id}>
                        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-2 text-emerald-100">
                              <MessageSquare className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-50">{serviceType.toString().replace(/_/g, " ").toUpperCase()}</p>
                                {priorityLabel && (
                                  <Badge className="border-sky-300/45 bg-sky-400/12 text-sky-100">
                                    {String(priorityLabel).replace(/_/g, " ")}
                                  </Badge>
                                )}
                              </div>
                              <p className="break-all text-sm text-slate-300">
                                {email}
                                {phone ? ` · ${phone}` : ""}
                              </p>
                              {createdAt && <p className="mt-1 text-xs text-slate-400">Added {createdAt}</p>}
                              {lead.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-300">{lead.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start text-xs text-slate-400 sm:self-auto">
                            <Info className="h-3 w-3" />
                            <span>Follow up and route to schedule when ready.</span>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })
                )
              ) : loadingInvites ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : invites.length === 0 ? (
                <GlassCard>
                  <div className="p-5 text-sm text-slate-400">
                    No invites yet. Use <strong>Create User</strong> above to send your first one.
                  </div>
                </GlassCard>
              ) : (
                invites.map((inv) => {
                  const isPending = !inv.used_at;
                  const statusLabel = isPending ? "Awaiting signup" : "Account created";
                  const dateLabel = format(new Date(inv.created_at), "MMM d, yyyy h:mma");
                  const isThisResending = resendingInviteId === inv.id;
                  return (
                    <GlassCard key={inv.id}>
                      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-sky-300/20 bg-sky-500/10 p-2 text-sky-200">
                            <UserIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-50">{inv.full_name || "Unnamed user"}</p>
                              <Badge className={isPending ? "border-sky-300/45 bg-sky-400/12 text-sky-100" : "border-emerald-400/60 bg-emerald-500/12 text-emerald-100"}>
                                {statusLabel}
                              </Badge>
                            </div>
                            <p className="break-all text-sm text-slate-300">
                              {inv.email}
                              {inv.phone ? ` · ${inv.phone}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">Sent {dateLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {isPending && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/12 bg-white/[0.025] text-slate-100 hover:border-sky-200/35 hover:bg-white/[0.055]"
                              onClick={() => resendInviteMutation.mutate(inv.id)}
                              disabled={isThisResending}
                            >
                              {isThisResending ? (
                                <>
                                  <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                  Resending…
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-1 h-4 w-4" />
                                  Resend Email
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  );
                })
              )}
            </div>
          </div>
          {completedCount > 0 && (
            <>
              <SectionDivider />
              <div className="px-5 py-6 md:px-7">
                <CollapsiblePanel title={`Completed Today (${completedCount})`} subtitle="Nice work — wrapped up jobs are tucked away here." defaultOpen={false}>
                  <div className="space-y-2">
                    {completedToday.map((job) => (
                      <CompletedJobRow key={job.id} job={job} />
                    ))}
                  </div>
                </CollapsiblePanel>
              </div>
            </>
          )}
        </DashboardSurface>
      </div>
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-md border-white/10 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle>Request $20 Deposit</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a deposit link, then copy the message and send it through Google Voice. Payment status will update automatically after Stripe payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {depositErr && (
              <div className="rounded-md border border-red-500/70 bg-red-900/40 px-3 py-2 text-sm text-red-100">
                {depositErr}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Customer Name</label>
              <Input
                value={depositForm.customer_name}
                onChange={(e) => setDepositForm((s) => ({ ...s, customer_name: e.target.value }))}
                placeholder="Customer name"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Email optional</label>
              <Input
                type="email"
                value={depositForm.customer_email}
                onChange={(e) => setDepositForm((s) => ({ ...s, customer_email: e.target.value }))}
                placeholder="customer@example.com"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Phone</label>
              <Input
                type="tel"
                value={depositForm.customer_phone}
                onChange={(e) => setDepositForm((s) => ({ ...s, customer_phone: e.target.value }))}
                placeholder="(555) 555-5555"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <CreditCard className="h-4 w-4" />
                $20 deposit
              </div>
              <p className="mt-1 text-xs text-emerald-100/80">This deposit will be applied toward the final repair invoice.</p>
            </div>
            {createdDeposit && (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  Deposit link ready
                </div>
                <textarea
                  readOnly
                  value={createdDeposit.message}
                  className="min-h-[120px] w-full resize-none rounded-xl border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-100 outline-none"
                />
                <Button type="button" onClick={copyDepositMessage} className="w-full bg-sky-600 text-white hover:bg-sky-700">
                  {copiedDepositText ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Text for Google Voice
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDepositOpen(false)}
              disabled={depositBusy}
              className="border-white/12 bg-white/[0.02] text-slate-100 hover:bg-white/[0.04]"
            >
              Close
            </Button>
            {!createdDeposit && (
              <Button onClick={submitDepositRequest} disabled={!canRequestDeposit} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {depositBusy ? "Creating…" : "Create Deposit Link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="max-w-md border-white/10 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new customer invite. We’ll store their info and email them a link to complete signup with standard authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {userErr && (
              <div className="rounded-md border border-red-500/70 bg-red-900/40 px-3 py-2 text-sm text-red-100">
                {userErr}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Full Name</label>
              <Input
                value={userForm.full_name}
                onChange={(e) => setUserForm((s) => ({ ...s, full_name: e.target.value }))}
                placeholder="Customer name"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Email</label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="customer@example.com"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Phone</label>
              <Input
                type="tel"
                value={userForm.phone}
                onChange={(e) => setUserForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="(555) 555-5555"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <p className="text-xs text-slate-400">
              The customer will receive an email to confirm and complete signup. No access code is required.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setUserOpen(false)}
              disabled={userBusy}
              className="border-white/12 bg-white/[0.02] text-slate-100 hover:bg-white/[0.04]"
            >
              Cancel
            </Button>
            <Button onClick={submitNewUser} disabled={!canCreateUser} className="bg-blue-600 text-white hover:bg-blue-700">
              {userBusy ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}