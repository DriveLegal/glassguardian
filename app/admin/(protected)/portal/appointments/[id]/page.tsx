// app/admin/(protected)/portal/appointments/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

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
} from "lucide-react";

type AnyObj = Record<string, any>;

const STATUS_FLOW: Record<string, string | undefined> = {
  requested: "estimating",
  estimating: "approved",
  approved: "scheduled",
  scheduled: "en_route",
  en_route: "on_site",
  on_site: "in_progress",
  in_progress: "curing",
  curing: "completed",
  completed: undefined,
  paid: undefined,
};

function nextStatus(s?: string) {
  return STATUS_FLOW[s ?? ""] || undefined;
}

function getStatusColor(status?: string) {
  const colors: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
    estimating: "bg-blue-100 text-blue-800 border-blue-200",
    estimate_sent: "bg-indigo-100 text-indigo-800 border-indigo-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    scheduled: "bg-purple-100 text-purple-800 border-purple-200",
    en_route: "bg-orange-100 text-orange-800 border-orange-200",
    on_site: "bg-indigo-100 text-indigo-800 border-indigo-200",
    in_progress: "bg-cyan-100 text-cyan-800 border-cyan-200",
    curing: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return colors[status ?? ""] || "bg-gray-100 text-gray-800";
}

/**
 * Shared dark, glassy input styles
 * ZERO white background anywhere.
 */
const INPUT_BASE =
  "w-full h-9 rounded-md border bg-slate-950/80 border-slate-700 " +
  "px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 " +
  "shadow-sm focus:bg-slate-950 focus:border-sky-500 focus:ring-2 " +
  "focus:ring-sky-500 focus-visible:outline-none";

const TEXTAREA_BASE =
  "w-full rounded-md border bg-slate-950/80 border-slate-700 " +
  "px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 " +
  "shadow-sm focus:bg-slate-950 focus:border-sky-500 focus:ring-2 " +
  "focus:ring-sky-500 focus-visible:outline-none resize-y min-h-[120px]";

const SELECT_BASE =
  "w-full rounded-md border bg-slate-950/80 border-slate-700 px-3 py-2 " +
  "text-sm text-slate-100 shadow-sm focus:border-sky-500 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-500";

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

async function fetchTechnicians(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("technicians")
    .select("id, email, full_name, tech_rating, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("fetchTechnicians ([id]) error:", error);
    throw error;
  }

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

/* ----------------------------- Page ----------------------------- */

export default function AdminAppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = (params as any)?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const qc = useQueryClient();

  const {
    data: apt,
    isLoading: loadingApt,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin:appointment", id ?? "unknown"],
    queryFn: () => fetchAppointment(String(id)),
    enabled: !!id,
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["admin:technicians"],
    queryFn: fetchTechnicians,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["admin:appointment:photos", id ?? "unknown"],
    queryFn: () => fetchPhotos(String(id)),
    enabled: !!id && !!apt,
  });

  const {
    data: lead,
    isLoading: loadingLead,
  } = useQuery({
    queryKey: ["admin:appointment:lead-source", id ?? "unknown"],
    queryFn: () => fetchBookingLead(String(id)),
    enabled: !!id && !apt && !loadingApt && !isError,
  });

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
    },
    onError: (err) => {
      console.error("update appointment error", err);
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
    },
  });

  const handleAssignTech = (email: string) => {
    const isUnassigned = email === "unassigned";

    updateMutation.mutate({
      technician_email: isUnassigned ? null : email,
      ...(apt?.status &&
      ["requested", "approved", "estimating"].includes(apt.status) &&
      !isUnassigned
        ? { status: "scheduled" }
        : {}),
    });
  };

  const handleAdvanceStatus = () => {
    const ns = nextStatus(apt?.status);
    if (!ns) return;
    updateMutation.mutate({ status: ns });
  };

  const handleSaveBasics: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const scheduled_date = fd.get("scheduled_date") as string | null;
    const scheduled_time_start = fd.get("scheduled_time_start") as
      | string
      | null;
    const scheduled_time_end = fd.get("scheduled_time_end") as string | null;
    const estimate_amount_raw = fd.get("estimate_amount") as string | null;
    const notes_internal = fd.get("notes_internal") as string | null;

    updateMutation.mutate({
      scheduled_date: scheduled_date || null,
      scheduled_time_start: scheduled_time_start || null,
      scheduled_time_end: scheduled_time_end || null,
      estimate_amount: estimate_amount_raw ? Number(estimate_amount_raw) : null,
      notes_internal: notes_internal || null,
    });
  };

  const handleSaveCustomer: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const customer_email = (fd.get("customer_email") as string | null) || "";
    updateMutation.mutate({
      customer_email: customer_email.trim() || null,
    });
  };

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
        <Card className="max-w-md border border-white/10 bg-slate-900/80 px-6 py-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <CardContent>
            <h2 className="mb-2 text-xl font-bold text-slate-50">
              No appointment ID
            </h2>
            <p className="mb-6 text-sm text-slate-300">
              We couldn’t find an appointment ID in this URL.
            </p>
            <Link href="/admin/portal/appointments">
              <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                Back to Appointments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingApt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-sky-500/20 blur-2xl" />
          <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-sky-400 border-b-transparent" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
        <Card className="max-w-md border border-rose-400/30 bg-slate-900/80 px-6 py-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <CardContent>
            <h2 className="mb-2 text-xl font-bold text-rose-100">
              Error loading appointment
            </h2>
            <p className="mb-4 text-sm text-slate-200">
              {(error as any)?.message ?? "Something went wrong fetching data."}
            </p>
            <Link href="/admin/portal/appointments">
              <Button className="border border-slate-500 bg-slate-950/80 text-slate-100 hover:border-sky-500 hover:bg-sky-900/60">
                Back to Appointments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!apt) {
    if (loadingLead) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-emerald-400 border-b-transparent" />
          </div>
        </div>
      );
    }

    if (lead) {
      const createdAt = lead.created_at ? new Date(lead.created_at) : null;
      const createdLabel = createdAt
        ? format(createdAt, "MMM d, yyyy • h:mm a")
        : "Just now";

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-4 md:p-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 bg-slate-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 shadow-[0_18px_60px_rgba(6,95,70,0.8)] backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              Convert Lead → Appointment
            </div>

            <Card className="border border-white/10 bg-slate-950/80 shadow-[0_30px_100px_rgba(15,23,42,0.95)] backdrop-blur-2xl relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-80 mix-blend-screen">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(600px 380px at 0% 0%, rgba(34,197,94,0.45), transparent 55%), radial-gradient(600px 380px at 100% 100%, rgba(56,189,248,0.3), transparent 55%)",
                  }}
                />
              </div>

              <CardHeader className="relative z-10 border-b border-emerald-400/20">
                <CardTitle className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-emerald-50">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 border border-emerald-300/70">
                      <Sparkles className="h-4 w-4 text-emerald-100" />
                    </span>
                    <span className="text-lg md:text-xl font-semibold">
                      Create an appointment from this booking lead
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 max-w-xl">
                    We didn’t find an appointment with this ID, but we did find
                    a website booking lead. You can spin it into a live job with
                    one click and then fine-tune details on the next screen.
                  </p>
                </CardTitle>
              </CardHeader>

              <CardContent className="relative z-10 p-6 md:p-7 space-y-6">
                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
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
                      <p className="text-xs text-slate-400">Full name</p>
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
                      <p className="text-xs text-slate-400">Requested slot</p>
                      <p className="font-medium text-slate-100">
                        {lead.slot ?? "No specific time selected"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-5">
                  <p className="text-xs text-emerald-50">
                    We’ll create a new appointment with status{" "}
                    <span className="font-semibold">“requested”</span> and a
                    default service type based on this lead. You can assign a
                    technician, set address, and add estimate details on the job
                    screen.
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                    <div className="text-[11px] text-emerald-100/90">
                      Source:{" "}
                      <span className="font-mono">
                        {lead.source ?? "website"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-sm font-semibold"
                        disabled={createFromLeadMutation.isPending}
                        onClick={() => createFromLeadMutation.mutate(lead)}
                      >
                        {createFromLeadMutation.isPending
                          ? "Creating appointment..."
                          : "Create appointment from this lead"}
                      </Button>
                      <Link href="/admin/portal/bookingleads">
                        <Button
                          className="border border-emerald-300/60 bg-slate-950/80 text-emerald-100 text-xs hover:bg-emerald-400/10"
                        >
                          Back to Booking Leads
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
        <Card className="max-w-md border border-white/10 bg-slate-900/80 px-6 py-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <CardContent>
            <h2 className="mb-2 text-xl font-bold text-slate-50">
              Appointment not found
            </h2>
            <p className="mb-6 text-sm text-slate-300">
              The appointment you’re looking for doesn’t exist or was removed.
            </p>
            <Link href="/admin/portal/appointments">
              <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                Back to Appointments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextLabel = apt.status
    ? ({
        requested: "Move to Estimating",
        estimating: "Approve",
        approved: "Schedule",
        scheduled: "Mark En Route",
        en_route: "Arrived On Site",
        on_site: "Start Repair",
        in_progress: "Begin Curing",
        curing: "Mark Complete",
        completed: "Completed",
        paid: "Paid",
      } as Record<string, string>)[apt.status]
    : "Advance";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-4 md:p-8">
      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.12),transparent_55%)] opacity-80" />

        <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/40 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100 shadow-[0_18px_60px_rgba(8,47,73,0.8)] backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
          Admin · Live Job Detail
        </div>

        <div className="flex items-center justify-between gap-4">
          <Link href="/admin/portal/appointments">
            <Button
              className="border border-slate-600/80 bg-slate-950/80 text-slate-100 hover:border-sky-500 hover:bg-sky-900/60"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to list
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <Badge
              className={`px-3 py-1 border ${getStatusColor(
                apt.status
              )} shadow-sm`}
            >
              {(apt.status ?? "").replace(/_/g, " ")}
            </Badge>
            {nextStatus(apt.status) && (
              <Button
                onClick={handleAdvanceStatus}
                disabled={updateMutation.isPending}
                className="bg-sky-600 text-white hover:bg-sky-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {nextLabel}
              </Button>
            )}
          </div>
        </div>

        <Card className="border border-white/10 bg-slate-950/80 shadow-[0_30px_100px_rgba(15,23,42,0.95)] backdrop-blur-2xl">
          <CardHeader className="border-b border-slate-800/80 bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-sky-950/60">
            <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <span className="text-lg font-semibold text-slate-50">
                  {(apt.service_type ?? "").replace(/_/g, " ").toUpperCase()}
                </span>
                <div className="text-xs text-slate-400">
                  Appointment{" "}
                  <span className="font-mono text-slate-100">
                    #{String(apt.id).slice(0, 8)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/admin/messages?appointment_id=${apt.id}`}>
                  <Button
                    className="border border-slate-600/80 bg-slate-950/70 text-slate-100 hover:border-sky-500 hover:bg-sky-900/70"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Open Thread
                  </Button>
                </Link>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-8 p-6 md:p-8 lg:grid-cols-3">
            {/* Left: Core details */}
            <div className="space-y-6 lg:col-span-2">
              {/* Customer (editable) */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-5 shadow-inner">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                  <UserIcon className="h-4 w-4 text-sky-300" />
                  Customer
                </h3>

                <form
                  onSubmit={handleSaveCustomer}
                  className="grid gap-4 text-sm md:grid-cols-2 md:items-end"
                >
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Email</label>
                    <input
                      name="customer_email"
                      type="email"
                      defaultValue={apt.customer_email ?? ""}
                      placeholder="customer@email.com"
                      className={INPUT_BASE}
                    />
                  </div>
                  {apt.vehicle_id && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400">Vehicle ID</p>
                      <p className="font-mono text-xs text-slate-100">
                        {apt.vehicle_id}
                      </p>
                    </div>
                  )}

                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="bg-sky-600 text-white hover:bg-sky-700"
                    >
                      Save Customer
                    </Button>
                  </div>
                </form>
              </div>

              {/* Schedule */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-5 shadow-inner">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                  <CalendarIcon className="h-4 w-4 text-sky-300" />
                  Schedule
                </h3>

                <form
                  onSubmit={handleSaveBasics}
                  className="grid gap-4 md:grid-cols-3"
                >
                  <div>
                    <label className="text-xs text-slate-400">Date</label>
                    <input
                      type="date"
                      name="scheduled_date"
                      defaultValue={
                        apt.scheduled_date
                          ? format(
                              new Date(apt.scheduled_date),
                              "yyyy-MM-dd"
                            )
                          : ""
                      }
                      className={INPUT_BASE}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Start</label>
                    <input
                      type="time"
                      name="scheduled_time_start"
                      defaultValue={apt.scheduled_time_start ?? ""}
                      className={INPUT_BASE}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">End</label>
                    <input
                      type="time"
                      name="scheduled_time_end"
                      defaultValue={apt.scheduled_time_end ?? ""}
                      className={INPUT_BASE}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-slate-400">
                      Service Address
                    </label>
                    <div className="mt-1 flex items-start gap-2 text-sm">
                      <MapPin className="mt-1 h-4 w-4 text-slate-400" />
                      <p className="font-medium text-slate-100">
                        {apt.service_address || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="md:col-span-3 flex items-center justify-between pt-1 text-xs text-slate-500">
                    <div>
                      <Clock className="mr-1 inline h-4 w-4" />
                      Last updated{" "}
                      {apt.updated_at
                        ? format(new Date(apt.updated_at), "MMM d, h:mm a")
                        : "—"}
                    </div>
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="bg-sky-600 text-white hover:bg-sky-700"
                    >
                      Save Schedule
                    </Button>
                  </div>
                </form>
              </div>

              {/* Estimate & notes */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-5 shadow-inner">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                  <DollarSign className="h-4 w-4 text-emerald-300" />
                  Estimate &amp; Internal Notes
                </h3>

                <form
                  onSubmit={handleSaveBasics}
                  className="grid gap-4 md:grid-cols-3"
                >
                  <div>
                    <label className="text-xs text-slate-400">
                      Estimate Amount
                    </label>
                    <input
                      name="estimate_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        typeof apt.estimate_amount === "number"
                          ? String(apt.estimate_amount)
                          : ""
                      }
                      className={INPUT_BASE}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-slate-400">
                      Internal Notes
                    </label>
                    <textarea
                      name="notes_internal"
                      placeholder="Internal-only notes…"
                      defaultValue={apt.notes_internal ?? ""}
                      rows={4}
                      className={TEXTAREA_BASE}
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="bg-sky-600 text-white hover:bg-sky-700"
                    >
                      Save
                    </Button>
                  </div>
                </form>
              </div>

              {/* Customer-facing notes */}
              {(apt.damage_description || apt.notes_customer) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {apt.damage_description && (
                    <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-5">
                      <h4 className="mb-2 font-semibold text-amber-100">
                        Damage Description
                      </h4>
                      <p className="whitespace-pre-wrap text-sm text-amber-50">
                        {apt.damage_description}
                      </p>
                    </div>
                  )}
                  {apt.notes_customer && (
                    <div className="rounded-xl border border-sky-300/40 bg-sky-500/10 p-5">
                      <h4 className="mb-2 font-semibold text-sky-100">
                        Customer Notes
                      </h4>
                      <p className="whitespace-pre-wrap text-sm text-sky-50">
                        {apt.notes_customer}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right rail */}
            <div className="space-y-6">
              {/* Technician */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-5 shadow-inner">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                  <Wrench className="h-4 w-4 text-sky-300" />
                  Technician
                </h3>

                <select
                  className={SELECT_BASE}
                  value={apt.technician_email ?? "unassigned"}
                  onChange={(e) => handleAssignTech(e.target.value)}
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

                {apt.technician_email && (
                  <p className="mt-2 text-xs text-slate-400">
                    Assigned to{" "}
                    <span className="font-medium text-slate-100">
                      {apt.technician_email}
                    </span>
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-5 shadow-inner">
                <h3 className="mb-3 font-semibold text-slate-100">Status</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={`${SELECT_BASE} w-56`}
                    value={apt.status ?? "requested"}
                    onChange={(e) =>
                      updateMutation.mutate({ status: e.target.value })
                    }
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

                  {nextStatus(apt.status) && (
                    <Button
                      onClick={handleAdvanceStatus}
                      disabled={updateMutation.isPending}
                      className="border border-slate-600 bg-slate-950/80 text-slate-100 hover:border-sky-500 hover:bg-sky-900/60"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {nextLabel}
                    </Button>
                  )}
                </div>
              </div>

              {/* Photos */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-5 shadow-inner">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                  <Images className="h-4 w-4 text-sky-300" />
                  Photos ({photos.length})
                </h3>
                {photos.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No photos uploaded yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((p: AnyObj) => (
                      <a
                        key={p.id}
                        href={p.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-slate-700/80 hover:shadow-[0_12px_40px_rgba(15,23,42,0.9)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.file_url}
                          alt={p.photo_type || "photo"}
                          className="h-32 w-full object-cover"
                        />
                        <div className="bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
                          {(p.photo_type ?? "").replace(/_/g, " ")}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Messaging shortcut */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-5 shadow-inner">
                <h3 className="mb-3 font-semibold text-slate-100">
                  Messaging
                </h3>
                <Link href={`/admin/messages?appointment_id=${apt.id}`}>
                  <Button
                    className="border border-slate-600 bg-slate-950/80 text-slate-100 hover:border-sky-500 hover:bg-sky-900/60"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Open Appointment Thread
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}