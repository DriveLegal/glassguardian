// app/ios/user/(protected)/dashboard/appointments/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  Calendar,
  MapPin,
  ArrowRight,
  FileText,
  XCircle,
  TriangleAlert,
  HeartHandshake,
  Sparkles,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string;
  service_type: string;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  service_address?: string | null;
  damage_description?: string | null;
  estimate_amount?: number | null;
  status?: string | null;
  created_at?: string | null;

  repair_outcome?: "completed" | "crack_out" | null;
  crack_out_occurred?: boolean | null;
  crack_out_cause?: string | null;
  crack_out_notes?: string | null;
  crack_out_photo_url?: string | null;
  crack_out_at?: string | null;
  replacement_required?: boolean | null;
};

const CANCELLABLE_STATUSES = [
  "requested",
  "estimating",
  "estimate_sent",
  "approved",
  "scheduled",
];

const TABBAR_H = 78;
const TOP_OFFSET = 0;

// ✅ NEW booking route (your new page)
const IOS_BOOK_ROUTE = "/ios/user/dashboard/appointments/book";

function canCancelStatus(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  return CANCELLABLE_STATUSES.includes(normalized);
}

function isCrackOut(apt: Appointment | null | undefined) {
  if (!apt) return false;
  return apt.crack_out_occurred === true || apt.repair_outcome === "crack_out";
}

function getStatusColor(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();

  const colors: Record<string, string> = {
    requested:
      "border-amber-400/60 text-amber-200 bg-amber-500/10 shadow-[0_0_18px_rgba(251,191,36,0.25)]",
    estimating:
      "border-sky-400/60 text-sky-200 bg-sky-500/10 shadow-[0_0_18px_rgba(56,189,248,0.25)]",
    estimate_sent:
      "border-sky-400/60 text-sky-200 bg-sky-500/10 shadow-[0_0_18px_rgba(56,189,248,0.25)]",
    approved:
      "border-emerald-400/60 text-emerald-200 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.25)]",
    scheduled:
      "border-violet-400/60 text-violet-200 bg-violet-500/10 shadow-[0_0_18px_rgba(139,92,246,0.25)]",
    en_route:
      "border-orange-400/70 text-orange-100 bg-orange-500/10 shadow-[0_0_18px_rgba(249,115,22,0.35)]",
    on_site:
      "border-indigo-400/70 text-indigo-100 bg-indigo-500/10 shadow-[0_0_18px_rgba(79,70,229,0.3)]",
    in_progress:
      "border-cyan-400/70 text-cyan-100 bg-cyan-500/10 shadow-[0_0_18px_rgba(6,182,212,0.3)]",
    completed:
      "border-emerald-400/70 text-emerald-100 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.4)]",
    cancelled:
      "border-red-500/70 text-red-100 bg-red-500/10 shadow-[0_0_18px_rgba(248,113,113,0.45)]",
    paid:
      "border-emerald-300/80 text-emerald-100 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.45)]",
  };

  return (
    colors[normalized] ||
    "border-slate-500/70 text-slate-200 bg-slate-800/60 shadow-[0_0_10px_rgba(148,163,184,0.25)]"
  );
}

function getCardClasses(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  const base =
    "backdrop-blur-xl rounded-2xl transition-shadow shadow-[0_18px_50px_rgba(15,23,42,0.98)] hover:shadow-[0_22px_60px_rgba(15,23,42,1)]";

  switch (normalized) {
    case "requested":
      return (
        base +
        " border border-amber-500/60 bg-gradient-to-br from-slate-950 via-amber-500/10 to-slate-950"
      );
    case "estimating":
    case "estimate_sent":
      return (
        base +
        " border border-sky-500/60 bg-gradient-to-br from-slate-950 via-sky-500/10 to-slate-950"
      );
    case "approved":
      return (
        base +
        " border border-emerald-500/60 bg-gradient-to-br from-slate-950 via-emerald-500/10 to-slate-950"
      );
    case "scheduled":
      return (
        base +
        " border border-violet-500/60 bg-gradient-to-br from-slate-950 via-violet-500/10 to-slate-950"
      );
    case "en_route":
      return (
        base +
        " border border-orange-500/70 bg-gradient-to-br from-slate-950 via-orange-500/10 to-slate-950"
      );
    case "on_site":
      return (
        base +
        " border border-indigo-500/70 bg-gradient-to-br from-slate-950 via-indigo-500/10 to-slate-950"
      );
    case "in_progress":
      return (
        base +
        " border border-cyan-500/70 bg-gradient-to-br from-slate-950 via-cyan-500/10 to-slate-950"
      );
    case "completed":
    case "paid":
      return (
        base +
        " border border-emerald-500/70 bg-gradient-to-br from-slate-950 via-emerald-500/12 to-slate-950"
      );
    case "cancelled":
      return (
        base +
        " border border-red-500/80 bg-gradient-to-br from-slate-950 via-red-900/60 to-slate-950"
      );
    default:
      return base + " border border-slate-800/80 bg-slate-950/85";
  }
}

/* ---------------- Crack-out trust dialog ---------------- */

function CrackOutTrustDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const serviceLabel = (appointment.service_type ?? "windshield service")
    .replace(/_/g, " ")
    .toUpperCase();

  const when =
    appointment.scheduled_date && appointment.scheduled_date.length > 0
      ? appointment.scheduled_date
      : appointment.crack_out_at
      ? appointment.crack_out_at.split("T")[0]
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-amber-400/40 bg-slate-950/95 text-slate-50 backdrop-blur-xl shadow-[0_30px_120px_rgba(251,191,36,0.12)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-100">
            <HeartHandshake className="w-5 h-5 text-amber-300" />
            A quick note from Glass Guardian
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Transparent, respectful, and focused on making it right.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 mt-0.5 text-amber-300" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  A crack-out occurred during your {serviceLabel}
                  {when ? ` (${when})` : ""}.
                </p>
                <p className="text-slate-200/90">
                  This can happen with pre-stressed glass or certain impact
                  patterns. Either way — we’re sorry for the inconvenience.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-semibold text-slate-100">What happens next:</p>
            <ul className="mt-2 space-y-2 text-slate-200/90">
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>Your documentation is saved with your appointment and invoice.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  If replacement is required, we’ll guide you through the next
                  steps and keep you updated.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span>
                  Our goal is long-term trust — clean work, honest updates, and a fair outcome.
                </span>
              </li>
            </ul>
          </div>

          {appointment.crack_out_photo_url && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold text-slate-200 mb-2">
                Photo documentation
              </p>
              <div className="relative overflow-hidden rounded-lg border border-slate-700/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={appointment.crack_out_photo_url}
                  alt="Crack-out documentation"
                  className="w-full max-h-[240px] object-cover"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Link
            href={`/ios/user/dashboard/appointments/${appointment.id}`}
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              className="w-full border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
            >
              View Details
            </Button>
          </Link>

          <Link
            href={`/ios/user/dashboard/pay/${appointment.id}`}
            className="w-full sm:w-auto"
          >
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
              View Invoice
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Page ---------------- */

export default function IOSAppointmentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "active" | "completed">(
    "all"
  );
  const [cancelId, setCancelId] = React.useState<string | null>(null);

  const [trustOpen, setTrustOpen] = React.useState(false);
  const [trustAppointment, setTrustAppointment] =
    React.useState<Appointment | null>(null);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const emailRaw = data?.session?.user?.email ?? null;
      const email = emailRaw ? emailRaw.trim().toLowerCase() : null;

      if (!email) {
        router.replace(`/ios/user/login?redirect=/ios/user/dashboard/appointments`);
        return;
      }
      if (!mounted) return;
      setUserEmail(email);

      // ✅ prefetch booking page for instant navigation
      try {
        router.prefetch?.(IOS_BOOK_ROUTE);
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const {
    data: appointments = [],
    isLoading,
    error,
  } = useQuery<Appointment[]>({
    queryKey: ["ios-my-appointments", userEmail],
    enabled: typeof userEmail === "string" && userEmail.trim().length > 0,
    queryFn: async () => {
      const email = (userEmail ?? "").trim().toLowerCase();
      if (!email) return [];

      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .ilike("customer_email", email)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  React.useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    const candidate =
      appointments.find(
        (a) =>
          isCrackOut(a) &&
          ["completed", "paid"].includes((a.status ?? "").toLowerCase())
      ) ??
      appointments.find((a) => isCrackOut(a)) ??
      null;

    if (!candidate) return;

    const key = `gg_ios_ack_crackout_appts_${candidate.id}`;
    try {
      const already = window.localStorage.getItem(key) === "1";
      if (already) return;

      setTrustAppointment(candidate);
      setTrustOpen(true);
      window.localStorage.setItem(key, "1");
    } catch {
      setTrustAppointment(candidate);
      setTrustOpen(true);
    }
  }, [appointments]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", CANCELLABLE_STATUSES)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error(
          "Unable to cancel — your appointment may already be in progress or en route."
        );
      }
      return data as Appointment;
    },
    onSuccess: () => {
      setCancelId(null);
      queryClient.invalidateQueries({
        queryKey: ["ios-my-appointments", userEmail],
      });
      queryClient.invalidateQueries({ queryKey: ["appointment"] });
    },
    onError: (err: any) => {
      setCancelId(null);
      alert(
        err?.message ??
          "Something went wrong cancelling this appointment. Please try again."
      );
    },
  });

  const handleCancel = (appointment: Appointment) => {
    if (!canCancelStatus(appointment.status)) return;

    const ok = window.confirm("Are you sure you want to cancel this appointment?");
    if (!ok) return;

    setCancelId(appointment.id);
    cancelMutation.mutate(appointment.id);
  };

  const filteredAppointments = appointments.filter((apt) => {
    const status = (apt.status ?? "").toLowerCase();

    if (filter === "active") {
      return !["completed", "cancelled", "paid"].includes(status);
    }
    if (filter === "completed") {
      return ["completed", "paid"].includes(status);
    }
    return true;
  });

  const activeCount = appointments.filter((a) => {
    const s = (a.status ?? "").toLowerCase();
    return !["completed", "cancelled", "paid"].includes(s);
  }).length;

  const completedCount = appointments.filter((a) => {
    const s = (a.status ?? "").toLowerCase();
    return ["completed", "paid"].includes(s);
  }).length;

  const crackOutCount = appointments.filter((a) => isCrackOut(a)).length;

  // ✅ Direct route to your new booking page
  const openBooking = () => {
    try {
      router.push(IOS_BOOK_ROUTE);
    } catch {
      window.location.href = IOS_BOOK_ROUTE;
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        className="relative"
        style={
          {
            ["--tabbar-h" as any]: `${TABBAR_H}px`,
          } as React.CSSProperties
        }
      >
        <m.div
          className="min-h-[100dvh] px-4 pb-6 sm:px-5"
          initial={
            prefersReducedMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 12, filter: "blur(6px)" }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          transition={{ duration: 0.45, ease: "easeOut" }}
          style={{
            willChange: "transform, opacity, filter",
            paddingTop: `calc(${TOP_OFFSET}px + env(safe-area-inset-top))`,
            paddingBottom:
              "calc(var(--tabbar-h, 78px) + env(safe-area-inset-bottom) + 18px)",
          }}
        >
          <div className="mx-auto w-full max-w-3xl space-y-5">
            {trustAppointment && (
              <CrackOutTrustDialog
                appointment={trustAppointment}
                open={trustOpen}
                onOpenChange={setTrustOpen}
              />
            )}

            {/* Hero */}
            <m.div
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative overflow-hidden rounded-[24px] border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900/90 to-sky-950/60 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_20px_60px_rgba(15,23,42,0.95)]"
            >
              <div className="pointer-events-none absolute -top-24 -left-10 h-40 w-40 rounded-full bg-sky-500/18 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-48 rounded-full bg-cyan-400/18 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-soft-light bg-[radial-gradient(circle_at_top,#1e293b_0,transparent_55%),radial-gradient(circle_at_bottom,#020617_0,transparent_60%)]" />

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl border border-sky-400/60 bg-sky-500/10 shadow-[0_0_18px_rgba(56,189,248,0.6)]">
                      <Calendar className="h-4 w-4 text-sky-100" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-sky-200/90">
                        Glass Guardian
                      </span>
                      <span className="text-xs text-slate-300/80">Appointments cockpit</span>
                    </div>
                  </div>

                  <h1 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-slate-50">
                    Your repair timeline
                  </h1>
                  <p className="mt-1 text-[12px] text-slate-300/90">
                    See what’s booked, what’s in motion, and what’s wrapped — all in one orbit.
                  </p>

                  {crackOutCount > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                      <Sparkles className="h-3 w-3" />
                      <span>Transparency on crack-outs enabled</span>
                    </div>
                  )}
                </div>

                {/* ✅ Book button routes to /app/ios/user/(protected)/dashboard/appointments/book/page.tsx */}
                <Button
                  onClick={openBooking}
                  className="h-9 rounded-full bg-sky-500 px-3.5 text-[11px] font-semibold text-slate-950 shadow-[0_0_22px_rgba(56,189,248,0.7)] hover:bg-sky-600 flex items-center"
                >
                  Book
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </m.div>

            {/* Filters */}
            <m.div
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            >
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
                <TabsList className="flex w-full gap-1 rounded-full border border-slate-800/80 bg-slate-950/80 px-1 py-1">
                  <TabsTrigger
                    value="all"
                    className="flex-1 rounded-full px-3 py-1.5 text-[11px] text-slate-200 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_0_16px_rgba(56,189,248,0.7)]"
                  >
                    All ({appointments.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="active"
                    className="flex-1 rounded-full px-3 py-1.5 text-[11px] text-slate-200 data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_0_16px_rgba(16,185,129,0.7)]"
                  >
                    Active ({activeCount})
                  </TabsTrigger>
                  <TabsTrigger
                    value="completed"
                    className="flex-1 rounded-full px-3 py-1.5 text-[11px] text-slate-200 data-[state=active]:bg-violet-500 data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_0_16px_rgba(139,92,246,0.7)]"
                  >
                    Completed ({completedCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </m.div>

            {/* List */}
            <m.div
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                </div>
              ) : error ? (
                <Card className="border border-red-500/50 bg-slate-950/80 backdrop-blur-xl">
                  <CardContent className="py-10 text-center space-y-3">
                    <h3 className="text-lg font-semibold text-red-300">
                      Couldn&apos;t load your appointments
                    </h3>
                    <p className="text-sm text-slate-400">
                      Please refresh the page or try again in a moment.
                    </p>
                  </CardContent>
                </Card>
              ) : filteredAppointments.length === 0 ? (
                <Card className="border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
                  <CardContent className="py-14 text-center space-y-4">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700/80 mx-auto shadow-[0_0_30px_rgba(15,23,42,0.9)]">
                      <FileText className="w-7 h-7 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-50 mb-1">
                        {filter === "all" ? "No appointments yet" : `No ${filter} appointments`}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        {filter === "all"
                          ? "Book your first windshield repair or chip fix to see it show up here."
                          : "Nothing in this category yet — check back later or adjust your filter."}
                      </p>
                    </div>

                    {filter === "all" && (
                      <Button
                        onClick={openBooking}
                        className="mt-2 bg-sky-500 hover:bg-sky-600 shadow-[0_0_22px_rgba(56,189,248,0.7)] rounded-full text-xs px-4"
                      >
                        Book your first service
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 pb-2">
                  {filteredAppointments.map((appointment, idx) => {
                    const isCancelling = cancelId === appointment.id;
                    const crackOut = isCrackOut(appointment);

                    const statusLabel = (appointment.status ?? "unknown")
                      .replace(/_/g, " ")
                      .toUpperCase();

                    const serviceLabel = (appointment.service_type ?? "service")
                      .replace(/_/g, " ")
                      .toUpperCase();

                    return (
                      <m.div
                        key={appointment.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.04 * idx, ease: "easeOut" }}
                      >
                        <Card className={getCardClasses(appointment.status)}>
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex flex-col gap-4">
                              {/* Top */}
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-sm sm:text-base font-semibold text-slate-50">
                                        {serviceLabel}
                                      </h3>
                                      {crackOut && (
                                        <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-400/50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.25)]">
                                          <TriangleAlert className="w-3.5 h-3.5 mr-1" />
                                          Crack-out
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      <Badge
                                        className={cn(
                                          "px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wide",
                                          getStatusColor(appointment.status)
                                        )}
                                      >
                                        {statusLabel}
                                      </Badge>

                                      {crackOut && (
                                        <Badge className="border border-amber-400/40 bg-amber-500/10 text-amber-100 text-[0.65rem] px-2 py-0.5 rounded-full">
                                          {appointment.replacement_required
                                            ? "Replacement may be required"
                                            : "Documented & tracked"}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {typeof appointment.estimate_amount === "number" && (
                                    <div className="text-right">
                                      <p className="text-[10px] text-slate-300/80">Estimate</p>
                                      <p className="text-lg font-semibold text-slate-50 tabular-nums">
                                        ${appointment.estimate_amount.toFixed(2)}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Crack-out trust strip */}
                                {crackOut && (
                                  <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-slate-950/60 to-slate-950 px-3 py-2.5">
                                    <div className="flex items-start gap-2">
                                      <HeartHandshake className="w-3.5 h-3.5 mt-0.5 text-amber-300" />
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-amber-100">
                                          We&apos;re sorry — and we&apos;re on it.
                                        </p>
                                        <p className="text-[10px] text-slate-200/90">
                                          Crack-outs are rare, but when they happen we document everything,
                                          keep you updated, and help you land on the right next step.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Middle */}
                              <div className="space-y-2 text-xs sm:text-[13px]">
                                {appointment.scheduled_date && (
                                  <div className="flex items-center gap-2 text-slate-300">
                                    <Calendar className="w-4 h-4 text-sky-300 flex-shrink-0" />
                                    <span>
                                      {format(
                                        new Date(appointment.scheduled_date),
                                        "EEEE, MMM d, yyyy"
                                      )}
                                      {appointment.scheduled_time_start && (
                                        <span className="ml-2 text-sky-300 font-medium">
                                          {appointment.scheduled_time_start}
                                          {appointment.scheduled_time_end
                                            ? ` – ${appointment.scheduled_time_end}`
                                            : ""}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )}

                                {appointment.service_address && (
                                  <div className="flex items-start gap-2 text-slate-300">
                                    <MapPin className="w-4 h-4 mt-0.5 text-emerald-300 flex-shrink-0" />
                                    <span>{appointment.service_address}</span>
                                  </div>
                                )}
                              </div>

                              {appointment.damage_description && (
                                <p className="text-[11px] sm:text-xs text-slate-300/90 line-clamp-2">
                                  {appointment.damage_description}
                                </p>
                              )}

                              {/* Bottom */}
                              <div className="flex items-center justify-between gap-3 pt-1">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  <span className="inline-block h-1 w-1 rounded-full bg-sky-400" />
                                  <span>Tap any appointment for full status + invoice trail.</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <Link href={`/ios/user/dashboard/appointments/${appointment.id}`}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-full text-[11px] border border-slate-600/70 text-slate-100 hover:text-slate-100 hover:bg-slate-900/70 h-8 px-3"
                                    >
                                      Details
                                      <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                                    </Button>
                                  </Link>

                                  {crackOut && (
                                    <Link href={`/ios/user/dashboard/pay/${appointment.id}`}>
                                      <Button
                                        size="sm"
                                        className="rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-[0_0_18px_rgba(251,191,36,0.45)] h-8 px-3"
                                      >
                                        Invoice
                                        <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                                      </Button>
                                    </Link>
                                  )}

                                  {canCancelStatus(appointment.status) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCancel(appointment)}
                                      disabled={isCancelling}
                                      className="inline-flex items-center gap-1 rounded-full border border-red-500/60 text-[10px] text-red-200 hover:text-red-100 hover:bg-red-500/15 h-8 px-3"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      {isCancelling ? "Cancelling…" : "Cancel"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </m.div>
                    );
                  })}
                </div>
              )}
            </m.div>
          </div>
        </m.div>
      </div>
    </LazyMotion>
  );
}