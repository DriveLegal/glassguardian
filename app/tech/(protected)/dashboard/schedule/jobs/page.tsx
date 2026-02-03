//app/tech/(protected)/dashboard/schedule/jobs/page.tsx
"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Car,
  Clock,
  MapPin,
  Search,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Route,
} from "lucide-react";

type AnyObj = Record<string, any>;

type StatusKey =
  | "requested"
  | "estimating"
  | "estimate_sent"
  | "approved"
  | "scheduled"
  | "en_route"
  | "on_site"
  | "in_progress"
  | "curing"
  | "completed"
  | "cancelled"
  | "pending"
  | "confirmed"
  | "accepted"
  | string;

function getStatusLabel(status?: StatusKey) {
  const map: Record<string, string> = {
    requested: "Requested",
    estimating: "Estimating",
    estimate_sent: "Quote Sent",
    approved: "Approved",
    scheduled: "Scheduled",
    en_route: "En Route",
    on_site: "On Site",
    in_progress: "Repairing",
    curing: "Curing",
    completed: "Completed",
    cancelled: "Cancelled",
    pending: "Pending",
    confirmed: "Confirmed",
    accepted: "Accepted",
  };
  const key = (status ?? "").toLowerCase();
  return map[key] ?? (status ?? "").replace(/_/g, " ");
}

function getStatusColor(status?: StatusKey) {
  const colors: Record<string, string> = {
    requested: "bg-yellow-500/15 text-yellow-200 border-yellow-400/60",
    estimating: "bg-sky-500/15 text-sky-200 border-sky-400/60",
    estimate_sent: "bg-indigo-500/15 text-indigo-200 border-indigo-400/60",
    approved: "bg-emerald-500/15 text-emerald-200 border-emerald-400/60",
    scheduled: "bg-purple-500/15 text-purple-200 border-purple-400/60",
    en_route: "bg-orange-500/15 text-orange-200 border-orange-400/60",
    on_site: "bg-cyan-500/15 text-cyan-200 border-cyan-400/60",
    in_progress: "bg-sky-500/15 text-sky-200 border-sky-400/60",
    curing: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/60",
    completed: "bg-emerald-500/20 text-emerald-200 border-emerald-400/70",
    cancelled: "bg-slate-700/40 text-slate-200 border-slate-500/80",
    pending: "bg-amber-500/15 text-amber-200 border-amber-400/60",
    confirmed: "bg-emerald-500/15 text-emerald-200 border-emerald-400/60",
    accepted: "bg-emerald-500/15 text-emerald-200 border-emerald-400/60",
  };
  return colors[(status ?? "").toLowerCase()] ?? "bg-slate-800 text-slate-100 border-slate-600/60";
}

function isActiveStatus(status?: StatusKey) {
  const done = ["completed", "cancelled", "canceled"];
  if (!status) return true;
  return !done.includes(status.toLowerCase());
}

export default function TechJobsPage() {
  const router = useRouter();

  const [techEmail, setTechEmail] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  // Keep auth consistent with your schedule page
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const email = data?.session?.user?.email ?? null;
      if (mounted) setTechEmail(email);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const {
    data: jobs = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["tech-jobs", techEmail],
    enabled: !!techEmail,
    queryFn: async () => {
      // IMPORTANT: match schedule logic (include unassigned)
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .or(`technician_email.eq.${techEmail},technician_email.is.null`)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
  });

  const { activeJobs, completedJobs, todayCount } = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const act = jobs.filter((j) => isActiveStatus(j.status));
    const comp = jobs.filter(
      (j) => (j.status ?? "").toLowerCase() === "completed"
    );
    const todays = act.filter((j) => {
      if (!j.scheduled_date) return false;
      try {
        return format(new Date(j.scheduled_date), "yyyy-MM-dd") === todayStr;
      } catch {
        return false;
      }
    });

    return { activeJobs: act, completedJobs: comp, todayCount: todays.length };
  }, [jobs]);

  const filteredActive = useMemo(() => {
    if (!search.trim()) return activeJobs;
    const q = search.toLowerCase();
    return activeJobs.filter((job) => {
      const fields = [
        job.id,
        job.service_type,
        job.service_address,
        job.customer_name,
        job.customer_full_name,
        job.customer_email,
        job.vehicle_make,
        job.vehicle_model,
        job.vehicle_year,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(q);
    });
  }, [activeJobs, search]);

  const filteredCompleted = useMemo(() => {
    if (!search.trim()) return completedJobs;
    const q = search.toLowerCase();
    return completedJobs.filter((job) => {
      const fields = [
        job.id,
        job.service_type,
        job.service_address,
        job.customer_name,
        job.customer_full_name,
        job.customer_email,
        job.vehicle_make,
        job.vehicle_model,
        job.vehicle_year,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(q);
    });
  }, [completedJobs, search]);

  if (!techEmail || (isLoading && !jobs.length)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-slate-200">
          <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
          <p className="text-sm text-slate-400">Loading your job board…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md border-slate-800 bg-slate-900/90 text-slate-50 shadow-2xl shadow-red-900/40">
          <CardContent className="py-10 space-y-4 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className="text-xl font-semibold">Unable to load jobs</h2>
            <p className="text-sm text-slate-400">
              {(error as any)?.message ??
                "There was a problem loading your appointment list."}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-100"
                onClick={() => router.refresh()}
              >
                Retry
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-100"
                onClick={() => router.push("/tech/dashboard/schedule")}
              >
                Back to Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 0% 0%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(circle at 100% 0%, rgba(129,140,248,0.28), transparent 55%), radial-gradient(circle at 10% 80%, rgba(52,211,153,0.3), transparent 55%), radial-gradient(circle at 80% 90%, rgba(59,130,246,0.20), transparent 55%)",
        }}
      />

      <div className="relative min-h-screen p-4 md:p-8 bg-gradient-to-b from-slate-950/95 via-slate-900/90 to-slate-950/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto text-slate-50 space-y-6">
          {/* Top bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                onClick={() => router.push("/tech/dashboard/schedule")}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Schedule
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Job Board
                </h1>
                <p className="text-xs md:text-sm text-slate-400">
                  All appointments assigned to you (plus unassigned if allowed).
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="w-full sm:w-auto sm:min-w-[260px]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-400 shadow-[0_0_0_1px_rgba(15,23,42,0.9)]"
                  placeholder="Search by name, vehicle, address…"
                />
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-sky-900/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Jobs Today
                  </p>
                  <p className="mt-1 text-3xl font-bold text-sky-300">
                    {todayCount}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Scheduled for today&apos;s route
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center border border-sky-400/60 shadow-[0_0_16px_rgba(56,189,248,0.7)]">
                  <Route className="w-5 h-5 text-sky-300" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-emerald-900/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Active Jobs
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-300">
                    {activeJobs.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Anything not completed / cancelled
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.7)]">
                  <Clock className="w-5 h-5 text-emerald-300" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-indigo-900/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Completed
                  </p>
                  <p className="mt-1 text-3xl font-bold text-indigo-300">
                    {completedJobs.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    All time completed jobs
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/60 shadow-[0_0_16px_rgba(129,140,248,0.7)]">
                  <CheckCircle2 className="w-5 h-5 text-indigo-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
                Active Jobs
              </h2>
              <span className="text-xs text-slate-400">
                {filteredActive.length} shown
              </span>
            </div>

            {filteredActive.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
                <CardContent className="py-8 text-center text-slate-400 text-sm">
                  No active jobs match your filters.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredActive.map((job: AnyObj) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>

          {/* Completed list */}
          <div className="space-y-4 pt-4 pb-10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
                Recently Completed
              </h2>
              <span className="text-xs text-slate-400">
                {filteredCompleted.length} total
              </span>
            </div>

            {filteredCompleted.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
                <CardContent className="py-6 text-center text-slate-500 text-xs">
                  Completed jobs will show here once finished.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredCompleted.slice(0, 6).map((job: AnyObj) => (
                  <JobRow key={job.id} job={job} compact />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function JobRow({ job, compact = false }: { job: AnyObj; compact?: boolean }) {
  const status = job.status as StatusKey | undefined;

  const scheduled =
    job.scheduled_date &&
    (() => {
      try {
        return format(new Date(job.scheduled_date), "EEE, MMM d");
      } catch {
        return null;
      }
    })();

  const timeWindow = (() => {
    if (!job.scheduled_time_start && !job.scheduled_time_end) return null;
    if (!job.scheduled_time_end) return job.scheduled_time_start;
    return `${job.scheduled_time_start} – ${job.scheduled_time_end}`;
  })();

  const vehicleLabel = (() => {
    if (job.vehicle_year || job.vehicle_make || job.vehicle_model) {
      const label = `${job.vehicle_year ?? ""} ${job.vehicle_make ?? ""} ${job.vehicle_model ?? ""}`.trim();
      return label || "Vehicle details pending";
    }
    if (job.vehicle_id) return `Vehicle #${String(job.vehicle_id).slice(0, 6)}`;
    return "Vehicle details pending";
  })();

  const customerName =
    job.customer_name || job.customer_full_name || job.customer_email || "Customer";

  const serviceTitle =
    (job.service_type as string | undefined)?.replace(/_/g, " ").toUpperCase() ?? "SERVICE";

  return (
    <Link
      href={`/tech/dashboard/schedule/jobs/${job.id}`}
      className="block group"
    >
      <Card className="border border-slate-800/90 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-slate-950/95 shadow-[0_18px_45px_rgba(15,23,42,0.9)] group-hover:shadow-[0_20px_55px_rgba(56,189,248,0.45)] group-hover:border-sky-500/80 transition-all duration-300">
        <CardContent className="p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`border text-[10px] px-2 py-0.5 ${getStatusColor(status)}`}>
                {getStatusLabel(status)}
              </Badge>
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">
                #{String(job.id).slice(0, 8)}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-100">{serviceTitle}</p>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                  {customerName}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-sky-400" />
                  {vehicleLabel}
                </span>
              </div>
            </div>

            {!compact && job.service_address && (
              <div className="flex items-start gap-2 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-sky-400" />
                <p className="line-clamp-2">{job.service_address}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 min-w-[160px]">
            {scheduled ? (
              <div className="flex flex-col items-end text-xs text-slate-300">
                <div className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{scheduled}</span>
                </div>
                {timeWindow && (
                  <div className="inline-flex items-center gap-1.5 mt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{timeWindow}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Not yet scheduled</span>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="mt-1 border-sky-500/80 bg-slate-900/80 text-sky-200 hover:bg-sky-500 hover:text-slate-950 hover:border-sky-400 group-hover:translate-x-0.5 transition-all"
            >
              View Job
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}