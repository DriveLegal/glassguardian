// app/tech/(protected)/dashboard/schedule/jobs/page.tsx
"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

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
  CreditCard,
  Copy,
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

type DepositForm = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
};

type CreatedDeposit = {
  deposit_url: string;
  message: string;
};

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
  return (
    colors[(status ?? "").toLowerCase()] ??
    "bg-slate-800 text-slate-100 border-slate-600/60"
  );
}

function isActiveStatus(status?: StatusKey) {
  const done = ["completed", "cancelled", "canceled"];
  if (!status) return true;
  return !done.includes(status.toLowerCase());
}

function getCustomerName(job: AnyObj) {
  return (
    job.customer_name ||
    job.customer_full_name ||
    job.full_name ||
    job.name ||
    job.customer_email ||
    "Customer"
  );
}

function getCustomerEmail(job: AnyObj) {
  return job.customer_email || job.email || job.contact_email || "";
}

function getCustomerPhone(job: AnyObj) {
  return (
    job.customer_phone ||
    job.phone ||
    job.contact_phone ||
    job.client_phone ||
    ""
  );
}

export default function TechJobsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [techEmail, setTechEmail] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const [depositOpen, setDepositOpen] = React.useState(false);
  const [depositBusy, setDepositBusy] = React.useState(false);
  const [depositErr, setDepositErr] = React.useState<string | null>(null);
  const [copiedDepositText, setCopiedDepositText] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<AnyObj | null>(null);
  const [createdDeposit, setCreatedDeposit] =
    React.useState<CreatedDeposit | null>(null);
  const [depositForm, setDepositForm] = React.useState<DepositForm>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
  });

  const canRequestDeposit =
    depositForm.customer_name.trim().length > 1 &&
    depositForm.customer_phone.trim().length > 6 &&
    !!selectedJob?.id &&
    !depositBusy;

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
        job.customer_phone,
        job.phone,
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
        job.customer_phone,
        job.phone,
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

  function openDepositForJob(job: AnyObj) {
    setSelectedJob(job);
    setDepositErr(null);
    setCreatedDeposit(null);
    setCopiedDepositText(false);
    setDepositForm({
      customer_name: getCustomerName(job),
      customer_email: getCustomerEmail(job),
      customer_phone: getCustomerPhone(job),
    });
    setDepositOpen(true);
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
      if (!selectedJob?.id) throw new Error("Missing appointment ID.");

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
          source: "tech_job_board",
          appointment_id: selectedJob.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create deposit link.");
      }

      const depositUrl =
        json?.deposit_url || json?.url || json?.link || json?.checkout_url;

      if (!depositUrl) {
        throw new Error("Deposit link was created, but no URL was returned.");
      }

      const message = `Glass Guardian: Your $20 deposit link to lock your appointment is below. This deposit is applied toward your final repair total.\n\n${depositUrl}`;

      setCreatedDeposit({
        deposit_url: depositUrl,
        message,
      });

      queryClient.invalidateQueries({ queryKey: ["tech-jobs", techEmail] });

      return json;
    } catch (e: any) {
      setDepositErr(e?.message || "Failed to create deposit request.");
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
      setDepositErr(
        "Could not copy automatically. Highlight the message and copy it manually."
      );
    }
  }

  if (!techEmail || (isLoading && !jobs.length)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-slate-200">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
          <p className="text-sm text-slate-400">Loading your job board…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md border-slate-800 bg-slate-900/90 text-slate-50 shadow-2xl shadow-red-900/40">
          <CardContent className="space-y-4 py-10 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
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

      <div className="relative min-h-screen bg-gradient-to-b from-slate-950/95 via-slate-900/90 to-slate-950/95 p-4 pt-8 backdrop-blur-xl md:p-8 md:pt-12">
        <div className="mx-auto max-w-6xl space-y-6 text-slate-50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                onClick={() => router.push("/tech/dashboard/schedule")}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Schedule
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Job Board
                </h1>
                <p className="text-xs text-slate-400 md:text-sm">
                  All appointments assigned to you, plus unassigned if allowed.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto sm:min-w-[260px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-slate-100 shadow-[0_0_0_1px_rgba(15,23,42,0.9)] placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/70"
                  placeholder="Search by name, vehicle, address…"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-sky-900/40">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Jobs Today
                  </p>
                  <p className="mt-1 text-3xl font-bold text-sky-300">
                    {todayCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Scheduled for today&apos;s route
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-400/60 bg-sky-500/20 shadow-[0_0_16px_rgba(56,189,248,0.7)]">
                  <Route className="h-5 w-5 text-sky-300" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-emerald-900/40">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Active Jobs
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-300">
                    {activeJobs.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Anything not completed / cancelled
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.7)]">
                  <Clock className="h-5 w-5 text-emerald-300" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-indigo-900/40">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Completed
                  </p>
                  <p className="mt-1 text-3xl font-bold text-indigo-300">
                    {completedJobs.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    All time completed jobs
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-400/60 bg-indigo-500/20 shadow-[0_0_16px_rgba(129,140,248,0.7)]">
                  <CheckCircle2 className="h-5 w-5 text-indigo-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                Active Jobs
              </h2>
              <span className="text-xs text-slate-400">
                {filteredActive.length} shown
              </span>
            </div>

            {filteredActive.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
                <CardContent className="py-8 text-center text-sm text-slate-400">
                  No active jobs match your filters.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredActive.map((job: AnyObj) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onRequestDeposit={openDepositForJob}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 pb-10 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                Recently Completed
              </h2>
              <span className="text-xs text-slate-400">
                {filteredCompleted.length} total
              </span>
            </div>

            {filteredCompleted.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
                <CardContent className="py-6 text-center text-xs text-slate-500">
                  Completed jobs will show here once finished.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredCompleted.slice(0, 6).map((job: AnyObj) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    compact
                    onRequestDeposit={openDepositForJob}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-md border-white/10 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle>Request $20 Deposit</DialogTitle>
            <DialogDescription className="text-slate-400">
              This deposit will be linked directly to this appointment. Copy the
              message and send it through Google Voice.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {depositErr && (
              <div className="rounded-md border border-red-500/70 bg-red-900/40 px-3 py-2 text-sm text-red-100">
                {depositErr}
              </div>
            )}

            {selectedJob && (
              <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-3 text-xs text-sky-100">
                <p className="font-semibold">Linked appointment</p>
                <p className="mt-1 break-all text-sky-100/80">
                  #{String(selectedJob.id).slice(0, 8)}
                  {selectedJob.scheduled_date
                    ? ` · ${selectedJob.scheduled_date}`
                    : ""}
                </p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                Customer Name
              </label>
              <Input
                value={depositForm.customer_name}
                onChange={(e) =>
                  setDepositForm((s) => ({
                    ...s,
                    customer_name: e.target.value,
                  }))
                }
                placeholder="Customer name"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                Email optional
              </label>
              <Input
                type="email"
                value={depositForm.customer_email}
                onChange={(e) =>
                  setDepositForm((s) => ({
                    ...s,
                    customer_email: e.target.value,
                  }))
                }
                placeholder="customer@example.com"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                Phone
              </label>
              <Input
                type="tel"
                value={depositForm.customer_phone}
                onChange={(e) =>
                  setDepositForm((s) => ({
                    ...s,
                    customer_phone: e.target.value,
                  }))
                }
                placeholder="(555) 555-5555"
                className="border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <CreditCard className="h-4 w-4" />
                $20 appointment deposit
              </div>
              <p className="mt-1 text-xs text-emerald-100/80">
                Stripe payment status will update this appointment automatically.
              </p>
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

                <Button
                  type="button"
                  onClick={copyDepositMessage}
                  className="w-full bg-sky-600 text-white hover:bg-sky-700"
                >
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
              <Button
                onClick={submitDepositRequest}
                disabled={!canRequestDeposit}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {depositBusy ? "Creating…" : "Create Deposit Link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobRow({
  job,
  compact = false,
  onRequestDeposit,
}: {
  job: AnyObj;
  compact?: boolean;
  onRequestDeposit: (job: AnyObj) => void;
}) {
  const status = job.status as StatusKey | undefined;
  const depositStatus = String(job.deposit_status || "none").toLowerCase();

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
      const label =
        `${job.vehicle_year ?? ""} ${job.vehicle_make ?? ""} ${job.vehicle_model ?? ""}`.trim();
      return label || "Vehicle details pending";
    }
    if (job.vehicle_id) return `Vehicle #${String(job.vehicle_id).slice(0, 6)}`;
    return "Vehicle details pending";
  })();

  const customerName = getCustomerName(job);

  const serviceTitle =
    (job.service_type as string | undefined)?.replace(/_/g, " ").toUpperCase() ??
    "SERVICE";

  const canRequestDeposit =
    depositStatus !== "paid" &&
    String(job.status || "").toLowerCase() !== "completed" &&
    String(job.status || "").toLowerCase() !== "cancelled";

  return (
    <Card className="border border-slate-800/90 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-slate-950/95 shadow-[0_18px_45px_rgba(15,23,42,0.9)] transition-all duration-300 hover:border-sky-500/80 hover:shadow-[0_20px_55px_rgba(56,189,248,0.45)]">
      <CardContent className="flex flex-col items-start gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-5">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`border px-2 py-0.5 text-[10px] ${getStatusColor(status)}`}>
              {getStatusLabel(status)}
            </Badge>

            {depositStatus === "paid" && (
              <Badge className="border border-emerald-400/60 bg-emerald-500/12 px-2 py-0.5 text-[10px] text-emerald-100">
                Deposit Paid
              </Badge>
            )}

            {depositStatus === "pending" && (
              <Badge className="border border-amber-400/60 bg-amber-500/12 px-2 py-0.5 text-[10px] text-amber-100">
                Deposit Pending
              </Badge>
            )}

            <span className="text-[11px] uppercase tracking-wide text-slate-500">
              #{String(job.id).slice(0, 8)}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-100">{serviceTitle}</p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                {customerName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-sky-400" />
                {vehicleLabel}
              </span>
            </div>
          </div>

          {!compact && job.service_address && (
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <MapPin className="mt-0.5 h-3.5 w-3.5 text-sky-400" />
              <p className="line-clamp-2">{job.service_address}</p>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 md:min-w-[190px] md:items-end">
          {scheduled ? (
            <div className="flex flex-col text-xs text-slate-300 md:items-end">
              <div className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>{scheduled}</span>
              </div>
              {timeWindow && (
                <div className="mt-1 inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{timeWindow}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Not yet scheduled</span>
            </div>
          )}

          <div className="mt-1 flex w-full flex-col gap-2 sm:flex-row md:w-auto md:flex-col">
            {canRequestDeposit && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => onRequestDeposit(job)}
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                Request Deposit
              </Button>
            )}

            <Link href={`/tech/dashboard/schedule/jobs/${job.id}`}>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-sky-500/80 bg-slate-900/80 text-sky-200 transition-all hover:border-sky-400 hover:bg-sky-500 hover:text-slate-950 md:w-auto"
              >
                View Job
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}