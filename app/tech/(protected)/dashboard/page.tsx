// app/tech/(protected)/dashboard/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Shield,
  MessageSquare,
  Clock,
  ArrowRight,
  Info,
  Sparkles,
  Gauge,
  Calendar,
  PlusCircle,
  RefreshCw,
  X,
  User as UserIcon,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";
import DevBanner from "@/components/DevBanner";

import { CardContent } from "@/components/ui/card";
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
import TodayEmpty from "@/components/tech/TodayEmpty";
import { getNextStatus, getNextStatusLabel } from "@/components/tech/status";
import { localISODate } from "@/lib/dateLocal";
import { ensureTechProfile } from "@/lib/ensureTechProfile";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import type { AssistantAction } from "@/lib/assistantTypes";

type AnyObj = Record<string, any>;
const TECH_TZ = "America/Los_Angeles";

function isSameLocalDate(iso?: string | null, isoRef?: string | null) {
  if (!iso || !isoRef) return false;
  return iso.slice(0, 10) === isoRef.slice(0, 10);
}

/* --------------------------- Decorative UI helpers --------------------------- */

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
      className={`relative rounded-2xl border border-slate-700/80 bg-slate-900/80 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.85)] ${className}`}
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

/* ---------------------- Small utility & skeletons ---------------------- */

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
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div>
        <h3 className="text-xl font-bold text-slate-50">{title}</h3>
        {subtitle ? <p className="text-slate-400 text-sm">{subtitle}</p> : null}
      </div>
      {action}
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

/* ---------------------- Collapsible helper ---------------------- */

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
    <GlassPanel className="overflow-hidden">
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen((s) => !s)}
              className="group flex items-center gap-2 text-left"
            >
              <span
                className={[
                  "inline-flex h-7 w-7 items-center justify-center rounded-lg border",
                  open
                    ? "border-sky-400/70 bg-sky-500/15 text-sky-100"
                    : "border-slate-600/80 bg-slate-900/50 text-slate-200",
                ].join(" ")}
                aria-hidden
              >
                <span
                  className={[
                    "block h-0.5 w-3 bg-current transition-transform",
                    open ? "rotate-0" : "rotate-90",
                  ].join(" ")}
                />
              </span>

              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-50 truncate">
                  {title}
                </p>
                {subtitle ? (
                  <p className="text-sm text-slate-400">{subtitle}</p>
                ) : null}
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3">
            {right}
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-100 bg-slate-900/60 hover:border-sky-400/70 hover:text-sky-100"
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
            className="border-t border-slate-700/70"
          >
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}

/* ---------------------- New User Modal Types ---------------------- */

type NewUserForm = {
  full_name: string;
  email: string;
  phone: string;
};

type UserInvite = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  code: string;
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

  const [displayName, setDisplayName] = React.useState<string>("Tech");
  const [devActive, setDevActive] = React.useState(false);
  const [techEmail, setTechEmail] = React.useState<string | null>(null);

  // New user modal state
  const [userOpen, setUserOpen] = React.useState(false);
  const [userBusy, setUserBusy] = React.useState(false);
  const [userErr, setUserErr] = React.useState<string | null>(null);
  const [userForm, setUserForm] = React.useState<NewUserForm>({
    full_name: "",
    email: "",
    phone: "",
  });

  // Consolidation: inbox tab (leads / invites) + assistant collapse
  const [inboxTab, setInboxTab] = React.useState<"leads" | "invites">("leads");
  const [assistantOpen, setAssistantOpen] = React.useState(false);

  const canCreateUser =
    userForm.full_name.trim().length > 1 &&
    userForm.email.trim().length > 3 &&
    !userBusy;

  // 🔔 New assignment toast state
  const [assignmentToast, setAssignmentToast] =
    React.useState<AssignmentToast | null>(null);
  const prevJobIdsRef = React.useRef<Set<string> | null>(null);

  // ✅ Row-scoped resend state (so only the clicked invite shows loading)
  const [resendingInviteId, setResendingInviteId] = React.useState<
    string | null
  >(null);

  // Auth gate + display name (dev sim supported) + ensure tech profile
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
        setTechEmail(session.user.email ?? null);
        setDevActive(false);

        // Fire-and-forget ensure technicians row exists for this tech
        ensureTechProfile().catch(() => {});

        return;
      }

      const role = readDevRoleFromCookie();
      if (role === "tech") {
        const dev = makeDevUser("tech");
        if (!mounted) return;
        setDisplayName(dev.user_metadata?.full_name || "Dev Tech");
        setTechEmail(dev.email || "dev.tech@example.com");
        setDevActive(true);
        return;
      }

      router.replace(
        `/login?redirect=${encodeURIComponent("/tech/dashboard")}`
      );
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

 

  // Today string in LA tz
  const todayISO = React.useMemo(() => localISODate(TECH_TZ), []);

  /* =========================================================
     DATA: Today-only (headline) + All jobs (for Active/Completed)
     ========================================================= */
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

  /* =========================================================
     🔔 Detect NEW assignments for this tech and trigger toast
     - Do NOT show toast for completed/cancelled appointments
     ========================================================= */
  React.useEffect(() => {
    if (!allJobs || allJobs.length === 0) {
      prevJobIdsRef.current = new Set();
      return;
    }

    const currentIds = new Set<string>(allJobs.map((j: AnyObj) => String(j.id)));

    if (!prevJobIdsRef.current) {
      // First load – just establish baseline, don't toast
      prevJobIdsRef.current = currentIds;
      return;
    }

    const prev = prevJobIdsRef.current;

    const newlyAssigned = allJobs.filter((j: AnyObj) => {
      const id = String(j.id);
      const status = (j.status ?? "").toLowerCase();
      if (prev.has(id)) return false;

      // 🚫 Skip fully finished or cancelled appointments for toast
      if (status === "completed" || status === "cancelled" || status === "paid") {
        return false;
      }

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

  // Auto-hide toast after 8 seconds
  React.useEffect(() => {
    if (!assignmentToast) return;
    const t = setTimeout(() => setAssignmentToast(null), 8000);
    return () => clearTimeout(t);
  }, [assignmentToast]);

  /* =========================================================
     DATA: booking_leads assigned to this tech
     ========================================================= */
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

  /* =========================================================
     DATA: Last 5 user invites created by this tech
     ========================================================= */
  const { data: invites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ["tech:user-invites", techEmail],
    enabled: !!techEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("user_invites")
        .select("id, full_name, email, phone, code, created_at, used_at")
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

      if (!token) {
        throw new Error("Not signed in.");
      }

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
      if (!res.ok) {
        throw new Error(json?.error || "Failed to resend invite email");
      }

      return json;
    },
    onMutate: async (inviteId: string) => {
      setResendingInviteId(inviteId);
    },
    onSettled: () => {
      setResendingInviteId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tech:user-invites", techEmail],
      });
    },
  });

  // Mutate: advance status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: AnyObj = { status };
      if (status === "on_site") patch.actual_start_time = new Date().toISOString();
      if (status === "completed") patch.actual_end_time = new Date().toISOString();

      const { error } = await supabaseClient
        .from("appointments")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tech:today-jobs", techEmail, todayISO],
      });
      queryClient.invalidateQueries({ queryKey: ["tech:all-jobs", techEmail] });
    },
  });

  /* =========================================================
     HEADLINE STATS (Today)
     ========================================================= */
  const completedToday = React.useMemo(
    () =>
      todayJobs.filter(
        (j) => j.status === "completed" || j.status === "paid"
      ),
    [todayJobs]
  );
  const activeToday = React.useMemo(
    () =>
      todayJobs.filter(
        (j) => !["completed", "paid", "cancelled"].includes(j.status)
      ),
    [todayJobs]
  );

  /* =========================================================
     EXTRA DASHBOARD STATS (pipeline + upcoming)
     ========================================================= */
  const pipelineStats = React.useMemo(() => {
    const base: Record<
      "scheduled" | "en_route" | "on_site" | "in_progress" | "curing" | "completed",
      number
    > = {
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

  /* =========================================================
     Assistant actions handler (wired to AssistantPanel)
     ========================================================= */
  const handleAssistantAction = React.useCallback(
    (action: AssistantAction) => {
      if (!action) return;

      if (action.type === "navigate" && action.payload?.jobId) {
        router.push(`/tech/dashboard/schedule/jobs/${action.payload.jobId}`);
        return;
      }

      if (action.type === "advance_job_status" && action.payload?.jobId) {
        const jobId = String(action.payload.jobId);
        const nextStatus: string | null = action.payload.nextStatus ?? null;

        const job =
          allJobs.find((j: AnyObj) => String(j.id) === jobId) ||
          todayJobs.find((j: AnyObj) => String(j.id) === jobId);

        const status =
          nextStatus && typeof nextStatus === "string"
            ? nextStatus
            : job
            ? getNextStatus(job.status)
            : null;

        if (status) updateStatusMutation.mutate({ id: jobId, status });
        return;
      }

      if (action.type === "create_user" && action.payload?.email) {
        const email = String(action.payload.email);
        const name = action.payload.name ?? "";
        setUserForm((prev) => ({
          ...prev,
          email,
          full_name: name || prev.full_name,
        }));
        setUserErr(null);
        setUserOpen(true);
        return;
      }

      // Fallback
      alert(`Assistant action: ${action.type}`);
    },
    [router, allJobs, todayJobs, updateStatusMutation]
  );

  /* ====================== Create New User submit ====================== */

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

      const userCode = json?.user_code as string | undefined;

      setUserOpen(false);
      setUserForm({ full_name: "", email: "", phone: "" });

      queryClient.invalidateQueries({ queryKey: ["tech:user-invites", techEmail] });

      if (userCode) {
        alert(
          `User invite created.\nInvite ID: ${userCode}\nWe emailed the customer a link to create their account.`
        );
      } else {
        alert("User invite created and email sent.");
      }
    } catch (e: any) {
      setUserErr(e?.message || "Failed to create user");
    } finally {
      setUserBusy(false);
    }
  }

  /* =============================== Render =============================== */

  const inboxLeadsCount = bookingLeads?.length ?? 0;
  const inboxInvitesCount = invites?.length ?? 0;
  const completedCount = completedToday.length;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ✅ NOTE: No tabs/header bar rendered here (prevents doubled tabs). This page assumes layout provides nav. */}

      {/* 🔔 New assignment toast */}
      <AnimatePresence>
        {assignmentToast && (
          <motion.div
            initial={
              prefersReducedMotion ? undefined : { opacity: 0, x: 80, scale: 0.95 }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 80, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed right-6 top-20 z-40 max-w-sm"
          >
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-950/95 via-sky-950/90 to-emerald-950/90 shadow-[0_36px_120px_rgba(2,6,23,0.95)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-400/30 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-emerald-400/24 blur-3xl" />

              <div className="relative p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 border border-sky-400/60 shadow-[0_0_36px_rgba(56,189,248,0.95)]">
                    <Sparkles className="w-5 h-5 text-sky-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/90">
                          NEW JOB ROUTED
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-50">
                          {assignmentToast.service_type
                            ? assignmentToast.service_type.toString().replace(/_/g, " ").toUpperCase()
                            : "SERVICE REQUEST"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAssignmentToast(null)}
                        className="p-1 rounded-full bg-slate-900/80 border border-slate-500/70 text-slate-300 hover:text-slate-50 hover:bg-slate-800/90 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {assignmentToast.customer_email && (
                      <p className="mt-1 text-xs text-slate-200/90 break-all">
                        {assignmentToast.customer_email}
                      </p>
                    )}

                    {assignmentToast.service_address && (
                      <p className="mt-1 text-xs text-slate-300/80 line-clamp-2">
                        {assignmentToast.service_address}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300/80">
                        <Clock className="w-3 h-3" />
                        <span>
                          {assignmentToast.scheduled_date
                            ? format(new Date(assignmentToast.scheduled_date), "MMM d")
                            : "Date TBA"}
                          {assignmentToast.scheduled_time_start
                            ? ` · ${assignmentToast.scheduled_time_start}`
                            : ""}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_32px_rgba(59,130,246,0.85)]"
                          onClick={() => {
                            router.push(`/tech/dashboard/schedule/jobs/${assignmentToast.id}`);
                            setAssignmentToast(null);
                          }}
                        >
                          View Job
                          <ArrowRight className="w-3 h-3 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D-ish ambient background */}
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

              <div className="relative p-6 md:p-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="min-w-0 flex gap-4 items-start">
                    <div
                      className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-[0_36px_90px_rgba(37,99,235,0.6)] grid place-items-center transform-gpu"
                      style={{ border: "1px solid rgba(148,163,184,0.5)" }}
                    >
                      <Shield className="w-7 h-7 text-white drop-shadow-[0_6px_20px_rgba(2,6,23,0.7)]" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-50">
                        Welcome, {displayName}
                      </h1>
                      <p className="text-slate-300">
                        {format(new Date(), "EEEE, MMMM d, yyyy")} · Los Angeles route
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-slate-900/70 border-sky-400/60 text-sky-100"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1" /> Pro Mode UI
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-slate-900/70 border-sky-400/60 text-slate-100"
                        >
                          <Gauge className="w-3.5 h-3.5 mr-1" /> Real-time
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-slate-900/70 border-sky-500/70 text-slate-100"
                        >
                          <Calendar className="w-3.5 h-3.5 mr-1" /> {todayJobs.length} jobs today
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_16px_40px_rgba(37,99,235,0.7)]"
                          onClick={() => {
                            setUserErr(null);
                            setUserOpen(true);
                            setInboxTab("invites");
                          }}
                        >
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Create User
                        </Button>

                        <Button
                          variant="outline"
                          className="border-slate-600 text-slate-100 bg-slate-900/60 hover:border-sky-400/70 hover:text-sky-100"
                          onClick={() => setAssistantOpen((s) => !s)}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {assistantOpen ? "Hide Assistant" : "Open Assistant"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Today Snapshot (compact) */}
                  <div className="w-full lg:max-w-md">
                    <GlassPanel className="bg-slate-950/50 border-slate-700/70">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                            Today Snapshot
                          </p>
                          <Badge
                            variant="outline"
                            className="bg-slate-900/70 border-slate-500/70 text-slate-100"
                          >
                            {todayISO}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[
                            { label: "Jobs", value: todayJobs.length },
                            { label: "Active", value: activeToday.length },
                            { label: "Done", value: completedToday.length },
                          ].map((k) => (
                            <div
                              key={k.label}
                              className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2"
                            >
                              <p className="text-[11px] text-slate-400">{k.label}</p>
                              <p className="text-xl font-extrabold text-slate-50">{k.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <p className="text-sm text-slate-200">Upcoming (next 3)</p>
                          </div>
                          <p className="text-sm font-semibold text-slate-50">
                            {upcomingByDate.reduce((a, b) => a + b.count, 0)}
                          </p>
                        </div>
                      </CardContent>
                    </GlassPanel>
                  </div>
                </div>

                {/* Assistant (collapsible) */}
                <AnimatePresence initial={false}>
                  {assistantOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="mt-6"
                    >
                      <GlassPanel className="overflow-hidden">
                        <CardContent className="p-5">
                          <SectionHeader
                            title="Assistant"
                            subtitle="Quick actions, insights, and shortcuts"
                          />
                         <div className="mt-4">
  <AssistantPanel
    techEmail={techEmail}
    todayJobs={todayJobs}
    allJobs={allJobs}
    bookingLeads={bookingLeads}
    invites={invites}
  />
</div>
                        </CardContent>
                      </GlassPanel>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </GlassPanel>
        </GradientFrame>

        {/* ACTIVE TODAY (PRIMARY) */}
        <section className="space-y-4">
          <SectionHeader
            title="Active Today"
            subtitle="Jobs currently moving through your pipeline"
            action={
              <Link href="/tech/dashboard/schedule" className="inline-flex">
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-100 bg-slate-900/60 hover:border-sky-400/70 hover:text-sky-100"
                >
                  View Schedule
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            }
          />
          {loadingToday ? (
            <GlassPanel>
              <CardContent className="p-6 space-y-3">
                <SkeletonRow />
                <SkeletonRow />
              </CardContent>
            </GlassPanel>
          ) : activeToday.length > 0 ? (
            <div className="space-y-4">
              {activeToday.map((job) => (
                <JobCard
                  key={job.id}
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
              ))}
            </div>
          ) : (
            <GlassPanel>
              <CardContent className="p-8">
                <TodayEmpty />
              </CardContent>
            </GlassPanel>
          )}
        </section>

        {/* NEXT UP + PIPELINE */}
        <section className="grid gap-4 md:grid-cols-2">
          {/* Next Up */}
          <GlassPanel>
            <CardContent className="p-5 space-y-3">
              <SectionHeader
                title="Next Up"
                subtitle="Next few days of work on your route."
                action={
                  <Link href="/tech/dashboard/schedule" className="inline-flex">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-100 bg-slate-900/60 hover:border-sky-400/70 hover:text-sky-100"
                    >
                      Open Calendar
                      <ArrowRight className="w-3.5 h-3.5 ml-2" />
                    </Button>
                  </Link>
                }
              />
              {upcomingByDate.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No upcoming jobs scheduled yet. Once dispatch loads your calendar, you’ll see them here.
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  {upcomingByDate.map((row) => (
                    <div
                      key={row.date}
                      className="flex items-center justify-between rounded-xl bg-slate-900/80 backdrop-blur border border-slate-700/80 px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-100">
                          {isSameLocalDate(row.date, todayISO)
                            ? "Today"
                            : format(new Date(row.date), "EEE, MMM d")}
                        </span>
                      </div>
                      <span className="text-slate-300">
                        {row.count} job{row.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </GlassPanel>

          {/* Pipeline (collapsible) */}
          <CollapsiblePanel
            title="Pipeline"
            subtitle="Status distribution across your assigned jobs."
            defaultOpen={false}
            right={
              <Badge
                variant="outline"
                className="bg-slate-900/70 border-slate-500/70 text-slate-100"
              >
                Total tracked:{" "}
                {Object.values(pipelineStats).reduce((a, b) => a + b, 0)}
              </Badge>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ["Scheduled", pipelineStats.scheduled],
                ["En Route", pipelineStats.en_route],
                ["On Site", pipelineStats.on_site],
                ["In Progress", pipelineStats.in_progress],
                ["Curing", pipelineStats.curing],
                ["Completed", pipelineStats.completed],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-xl bg-slate-900/80 backdrop-blur border border-slate-700/80 px-3 py-2 shadow-sm"
                >
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-lg font-semibold text-slate-50">{value as number}</p>
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        </section>

        {/* INBOX (tabs: Leads / Invites) */}
        <section className="space-y-3">
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
                      ? "bg-sky-600 hover:bg-sky-700 text-white"
                      : "border-slate-600 text-slate-100 bg-slate-900/60 hover:border-sky-400/70 hover:text-sky-100"
                  }
                  onClick={() => setInboxTab("leads")}
                >
                  Leads
                  <Badge className="ml-2 bg-white/10 border-white/10 text-white">
                    {inboxLeadsCount}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={inboxTab === "invites" ? "default" : "outline"}
                  className={
                    inboxTab === "invites"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border-slate-600 text-slate-100 bg-slate-900/60 hover:border-emerald-400/70 hover:text-emerald-100"
                  }
                  onClick={() => setInboxTab("invites")}
                >
                  Invites
                  <Badge className="ml-2 bg-white/10 border-white/10 text-white">
                    {inboxInvitesCount}
                  </Badge>
                </Button>
              </div>
            }
          />

          <GlassPanel>
            <CardContent className="p-5 space-y-3">
              {inboxTab === "leads" ? (
                loadingLeads ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : bookingLeads.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No leads assigned to you yet. Admin can assign booking leads from the dashboard.
                  </p>
                ) : (
                  bookingLeads.map((lead: AnyObj) => {
                    const createdAt = lead.created_at
                      ? format(new Date(lead.created_at), "MMM d, yyyy h:mma")
                      : null;
                    const email =
                      lead.customer_email || lead.email || lead.contact_email || "—";
                    const phone =
                      lead.phone || lead.contact_phone || lead.customer_phone || null;
                    const serviceType = lead.service_type || lead.lead_type || "Lead";
                    const priorityLabel =
                      lead.priority || lead.priority_label || lead.priority_to_contact || null;

                    return (
                      <div
                        key={lead.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/80 backdrop-blur px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-full bg-emerald-500/20 p-2 text-emerald-100">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-50">
                                {serviceType.toString().replace(/_/g, " ").toUpperCase()}
                              </p>
                              {priorityLabel && (
                                <Badge className="border-amber-400/70 bg-amber-500/15 text-amber-100">
                                  {String(priorityLabel).replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-300 break-all">
                              {email}
                              {phone ? ` · ${phone}` : ""}
                            </p>
                            {createdAt && (
                              <p className="text-xs text-slate-400 mt-1">Added {createdAt}</p>
                            )}
                            {lead.notes && (
                              <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                                {lead.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-400">
                          <Info className="w-3 h-3" />
                          <span>Follow up and route to schedule when ready.</span>
                        </div>
                      </div>
                    );
                  })
                )
              ) : loadingInvites ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : invites.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No user invites yet. Use <strong>Create User</strong> above to send your first one.
                </p>
              ) : (
                invites.map((inv) => {
                  const isPending = !inv.used_at;
                  const statusLabel = isPending ? "Pending account" : "Account created";
                  const dateLabel = format(new Date(inv.created_at), "MMM d, yyyy h:mma");
                  const isThisResending = resendingInviteId === inv.id;

                  return (
                    <div
                      key={inv.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/80 backdrop-blur px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-sky-500/20 p-2 text-sky-200">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-50">
                              {inv.full_name || "Unnamed user"}
                            </p>
                            <Badge
                              className={
                                isPending
                                  ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
                                  : "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                              }
                            >
                              {statusLabel}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-300 break-all">
                            {inv.email}
                            {inv.phone ? ` · ${inv.phone}` : ""}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Code:{" "}
                            <span className="font-mono tracking-[0.2em] text-slate-100">
                              {inv.code}
                            </span>{" "}
                            · Sent {dateLabel}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {isPending && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-slate-900/70 border-slate-600 text-slate-100 hover:border-sky-400 hover:text-sky-100"
                            onClick={() => resendInviteMutation.mutate(inv.id)}
                            disabled={isThisResending}
                          >
                            {isThisResending ? (
                              <>
                                <span className="h-3 w-3 mr-2 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                                Resending…
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Resend Email
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </GlassPanel>
        </section>

        {/* COMPLETED TODAY (collapsible) */}
        {completedCount > 0 && (
          <CollapsiblePanel
            title={`Completed Today (${completedCount})`}
            subtitle="Nice work — wrapped up jobs are tucked away here."
            defaultOpen={false}
          >
            <div className="space-y-2">
              {completedToday.map((job) => (
                <CompletedJobRow key={job.id} job={job} />
              ))}
            </div>
          </CollapsiblePanel>
        )}
      </div>

      {/* Create User Modal */}
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="max-w-md bg-slate-950 border-slate-700 text-slate-50">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new customer invite. We’ll store their info and email them a
              link with their 7-digit code so they can create their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {userErr && (
              <div className="rounded-md border border-red-500/70 bg-red-900/40 px-3 py-2 text-sm text-red-100">
                {userErr}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Full Name
              </label>
              <Input
                value={userForm.full_name}
                onChange={(e) =>
                  setUserForm((s) => ({ ...s, full_name: e.target.value }))
                }
                placeholder="Customer name"
                className="bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm((s) => ({ ...s, email: e.target.value }))
                }
                placeholder="customer@example.com"
                className="bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Phone
              </label>
              <Input
                type="tel"
                value={userForm.phone}
                onChange={(e) =>
                  setUserForm((s) => ({ ...s, phone: e.target.value }))
                }
                placeholder="(555) 555-5555"
                className="bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <p className="text-xs text-slate-400">
              After you create the user, they&apos;ll get an email with their
              7-digit ID and a link to the user login page where they can create
              their account.
            </p>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setUserOpen(false)}
              disabled={userBusy}
              className="border-slate-600 text-slate-100 bg-slate-900/80 hover:border-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={submitNewUser}
              disabled={!canCreateUser}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {userBusy ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}