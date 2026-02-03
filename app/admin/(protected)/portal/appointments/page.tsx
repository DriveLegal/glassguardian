// app/admin/(protected)/portal/appointments/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Calendar,
  Search,
  Filter,
  ArrowRight,
  User as UserIcon,
} from "lucide-react";
import { format } from "date-fns";

type AnyObj = Record<string, any>;

function getStatusColor(status?: string) {
  const colors: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
    estimating: "bg-blue-100 text-blue-800 border-blue-200",
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

async function fetchAppointments(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchTechnicians(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("technicians")
    .select("id, email, full_name, tech_rating, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("fetchTechnicians (appointments) error:", error);
    throw error;
  }

  return data ?? [];
}

export default function AdminAppointmentsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "requested" | "scheduled" | "in_progress" | "completed"
  >("all");

  const { data: appointments = [], isLoading: loadingApt } = useQuery({
    queryKey: ["admin:appointments"],
    queryFn: fetchAppointments,
    staleTime: 15_000,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["admin:technicians"],
    queryFn: fetchTechnicians,
    staleTime: 60_000,
  });

  const assignTechMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      techEmail,
    }: {
      appointmentId: string;
      techEmail: string;
    }) => {
      const isUnassigned = techEmail === "unassigned";

      const { error } = await supabaseClient
        .from("appointments")
        .update({
          technician_email: isUnassigned ? null : techEmail,
          ...(isUnassigned
            ? {}
            : {
                status: "scheduled",
              }),
        })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin:appointments"] });
    },
    onError: (err) => {
      console.error("assignTech error", err);
    },
  });

  const filteredAppointments = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return (appointments as AnyObj[]).filter((apt) => {
      const matchesSearch =
        q.length === 0 ||
        (apt.customer_email &&
          String(apt.customer_email).toLowerCase().includes(q)) ||
        (apt.service_type &&
          String(apt.service_type).toLowerCase().includes(q)) ||
        (apt.id && String(apt.id).toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "requested" && apt.status === "requested") ||
        (statusFilter === "scheduled" && apt.status === "scheduled") ||
        (statusFilter === "in_progress" && apt.status === "in_progress") ||
        (statusFilter === "completed" &&
          (apt.status === "completed" || apt.status === "paid"));

      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-sky-900 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1 backdrop-blur">
            <UserIcon className="h-4 w-4 text-sky-300" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
              Admin · Dispatch Hub
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">
            Manage Appointments
          </h1>
          <p className="text-slate-200/80">
            Review incoming jobs and route work to your field technicians.
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-white/10 bg-white/10 shadow-[0_30px_80px_rgba(15,23,42,0.7)] backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  <Input
                    placeholder="Search by customer, service type, or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-slate-700/80 bg-slate-900/60 pl-10 text-slate-100 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <Tabs
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as typeof statusFilter)
                }
              >
                <TabsList className="border border-slate-700/80 bg-slate-900/60">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="requested">Requested</TabsTrigger>
                  <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                  <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Loading state for appointments */}
        {loadingApt && (
          <div className="py-16 text-center">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-sky-400" />
          </div>
        )}

        {/* Appointments List */}
        {!loadingApt && (
          <div className="space-y-4">
            {filteredAppointments.map((apt: AnyObj) => (
              <Card
                key={apt.id}
                className="border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.9)] transition-shadow hover:shadow-[0_30px_90px_rgba(8,47,73,0.9)]"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-6 md:flex-row">
                    <div className="flex-1">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="mb-1 text-xl font-bold text-white">
                            {(apt.service_type ?? "")
                              .replace(/_/g, " ")
                              .toUpperCase()}
                          </h3>
                          <p className="mb-2 text-xs text-slate-300/80">
                            ID: {String(apt.id).slice(0, 8)}
                          </p>
                          <Badge
                            className={`border ${getStatusColor(
                              apt.status
                            )} shadow-sm`}
                          >
                            {(apt.status ?? "").replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>

                      <div className="mb-4 grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-400">Customer</p>
                          <p className="break-all font-medium text-slate-100">
                            {apt.customer_email}
                          </p>
                        </div>

                        {apt.scheduled_date && (
                          <div>
                            <p className="text-xs text-slate-400">Scheduled</p>
                            <p className="font-medium text-slate-100">
                              {format(
                                new Date(apt.scheduled_date),
                                "MMM d, yyyy"
                              )}
                              {apt.scheduled_time_start &&
                                ` at ${apt.scheduled_time_start}`}
                            </p>
                          </div>
                        )}

                        {apt.service_address && (
                          <div>
                            <p className="text-xs text-slate-400">Location</p>
                            <p className="text-sm font-medium text-slate-100">
                              {String(apt.service_address)
                                .split(",")
                                .slice(0, 2)
                                .join(",")}
                            </p>
                          </div>
                        )}

                        {typeof apt.estimate_amount === "number" && (
                          <div>
                            <p className="text-xs text-slate-400">Estimate</p>
                            <p className="font-medium text-emerald-300">
                              ${Number(apt.estimate_amount).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Assign technician */}
                      {!apt.technician_email && apt.status !== "cancelled" && (
                        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-slate-600/80 bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-sky-900/70 p-3 shadow-inner sm:flex-row sm:items-center">
                          <div className="flex items-center gap-2 text-sm text-slate-200">
                            <Filter className="h-4 w-4 text-sky-300" />
                            <span className="font-medium">
                              Route this job to a technician
                            </span>
                          </div>

                          {/* Native select, no Radix */}
                          <select
                            className="w-full rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 sm:w-64"
                            value={apt.technician_email ?? "unassigned"}
                            onChange={(e) =>
                              assignTechMutation.mutate({
                                appointmentId: apt.id,
                                techEmail: e.target.value,
                              })
                            }
                          >
                            <option value="unassigned">— Unassigned —</option>
                            {technicians.map((tech: AnyObj) => (
                              <option key={tech.id} value={tech.email}>
                                {tech.full_name || tech.email}
                                {tech.tech_rating
                                  ? ` (★${Number(
                                      tech.tech_rating
                                    ).toFixed(1)})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {apt.technician_email && (
                        <div className="mt-3 rounded-2xl border border-emerald-500/50 bg-gradient-to-r from-sky-900/80 via-emerald-900/50 to-slate-900/80 p-3">
                          <p className="text-xs font-medium text-emerald-200">
                            Assigned Technician
                          </p>
                          <p className="break-all text-sm text-emerald-50">
                            {apt.technician_email}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right column actions */}
                    <div className="flex flex-col items-end justify-between gap-3">
                      <Link href={`/admin/portal/appointments/${apt.id}`}>
                        <Button
                          variant="outline"
                          className="border-slate-600/70 bg-slate-900/60 text-slate-100 hover:border-sky-500 hover:bg-sky-800/70"
                        >
                          View Details
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredAppointments.length === 0 && (
              <Card className="border-2 border-dashed border-slate-600 bg-slate-900/70 backdrop-blur-xl">
                <CardContent className="py-16 text-center">
                  <Calendar className="mx-auto mb-4 h-16 w-16 text-slate-500" />
                  <h3 className="mb-2 text-xl font-semibold text-slate-100">
                    No Appointments Found
                  </h3>
                  <p className="text-slate-300">
                    Try adjusting your filters or check another day.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}