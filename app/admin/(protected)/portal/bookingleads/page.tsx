// app/admin/(protected)/portal/bookingleads/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import {
  Search,
  ArrowRight,
  Phone,
  MapPin,
  Clock,
  ListFilter,
  RefreshCw,
  CalendarClock,
  Camera,
  UserRound,
  Sparkles,
  CheckCircle2,
  MessageCircle,
  XCircle,
  Ban,
  CircleDashed,
} from "lucide-react";

import type { BookingLead } from "@/components/admin/portal/AdminBookingLeadsPanel";

type LeadStatus =
  | "new"
  | "contacted"
  | "booked"
  | "completed"
  | "no_response"
  | "not_interested"
  | "could_help"
  | "repair_not_done"
  | "canceled"
  | "invalid";

type FetchArgs = {
  page: number;
  pageSize: number;
  q: string;
};

type BookingLeadsResponse = {
  leads: BookingLead[];
  total: number;
};

const PAGE_SIZE = 50;

const STATUS_META: Record<
  LeadStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
    dotClassName: string;
  }
> = {
  new: {
    label: "New",
    icon: Sparkles,
    className: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    dotClassName: "bg-amber-300",
  },
  contacted: {
    label: "Contacted",
    icon: MessageCircle,
    className: "border-sky-300/30 bg-sky-400/10 text-sky-100",
    dotClassName: "bg-sky-300",
  },
  booked: {
    label: "Booked",
    icon: CalendarClock,
    className: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    dotClassName: "bg-emerald-300",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "border-green-300/30 bg-green-400/10 text-green-100",
    dotClassName: "bg-green-300",
  },
  no_response: {
    label: "No Response",
    icon: CircleDashed,
    className: "border-slate-500/40 bg-slate-500/10 text-slate-200",
    dotClassName: "bg-slate-400",
  },
  not_interested: {
    label: "Not Interested",
    icon: XCircle,
    className: "border-red-300/30 bg-red-400/10 text-red-100",
    dotClassName: "bg-red-300",
  },
  could_help: {
    label: "Could Help",
    icon: CheckCircle2,
    className: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
    dotClassName: "bg-cyan-300",
  },
  repair_not_done: {
    label: "Repair Not Done",
    icon: XCircle,
    className: "border-orange-300/30 bg-orange-400/10 text-orange-100",
    dotClassName: "bg-orange-300",
  },
  canceled: {
    label: "Canceled",
    icon: Ban,
    className: "border-rose-300/30 bg-rose-400/10 text-rose-100",
    dotClassName: "bg-rose-300",
  },
  invalid: {
    label: "Invalid",
    icon: Ban,
    className: "border-zinc-400/30 bg-zinc-400/10 text-zinc-100",
    dotClassName: "bg-zinc-300",
  },
};

function safeString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function pickLeadName(lead: any) {
  return (
    safeString(lead?.full_name) ||
    safeString(lead?.name) ||
    safeString(lead?.customer_name) ||
    safeString(
      lead?.first_name || lead?.last_name
        ? `${safeString(lead?.first_name)} ${safeString(lead?.last_name)}`.trim()
        : "",
    ) ||
    "Unknown lead"
  );
}

function pickLeadPhone(lead: any) {
  return (
    safeString(lead?.phone) ||
    safeString(lead?.mobile) ||
    safeString(lead?.phone_number) ||
    safeString(lead?.contact_phone) ||
    ""
  );
}

function pickLeadZip(lead: any) {
  return safeString(lead?.zip) || safeString(lead?.postal_code) || "";
}

function pickLeadSource(lead: any) {
  return (
    safeString(lead?.source) ||
    safeString(lead?.utm_source) ||
    safeString(lead?.origin) ||
    safeString(lead?.channel) ||
    "Website"
  );
}

function pickLeadStatus(lead: any): LeadStatus {
  const raw = safeString(lead?.status) as LeadStatus;
  return raw && raw in STATUS_META ? raw : "new";
}

function pickChips(lead: any) {
  const value =
    lead?.chips ?? lead?.chip_count ?? lead?.damage_count ?? lead?.num_chips;

  if (value == null || value === "") return "";
  return safeString(value);
}

function formatAge(createdAt?: string | null) {
  if (!createdAt) return "—";

  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return "—";

  const diff = Date.now() - timestamp;
  const mins = Math.max(0, Math.round(diff / 60_000));

  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;

  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatDateTime(createdAt?: string | null) {
  if (!createdAt) return "";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
}

function escapeSearchTerm(term: string) {
  return term.replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", " ");
}

async function fetchBookingLeads({
  page,
  pageSize,
  q,
}: FetchArgs): Promise<BookingLeadsResponse> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseClient
    .from("booking_leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  const term = escapeSearchTerm(q.trim());

  if (term) {
    query = query.or(
      [
        `full_name.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
        `zip.ilike.%${term}%`,
        `source.ilike.%${term}%`,
        `status.ilike.%${term}%`,
      ].join(","),
    );
  }

  const { data, error, status, count } = await query.range(from, to);

  if (status === 404) return { leads: [], total: 0 };

  if (error) {
    console.error("fetchBookingLeads error:", error);
    throw error;
  }

  return {
    leads: (data ?? []) as BookingLead[],
    total: count ?? 0,
  };
}

export default function AdminBookingLeadsPage() {
  const router = useRouter();

  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin:booking_leads", { page, pageSize: PAGE_SIZE, q: debouncedQ }],
    queryFn: () =>
      fetchBookingLeads({
        page,
        pageSize: PAGE_SIZE,
        q: debouncedQ,
      }),
    staleTime: 10_000,
  });

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const statusCounts = React.useMemo(() => {
    const counts: Record<LeadStatus, number> = {
      new: 0,
      contacted: 0,
      booked: 0,
      completed: 0,
      no_response: 0,
      not_interested: 0,
      could_help: 0,
      repair_not_done: 0,
      canceled: 0,
      invalid: 0,
    };

    leads.forEach((lead) => {
      counts[pickLeadStatus(lead)] += 1;
    });

    return counts;
  }, [leads]);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-white/10 bg-slate-950/80 shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 15% 0%, rgba(56,189,248,0.28), transparent 38%), radial-gradient(circle at 85% 0%, rgba(16,185,129,0.18), transparent 38%)",
          }}
        />

        <CardHeader className="relative">
          <CardTitle className="flex flex-col gap-1 text-slate-50">
            <span className="text-sm uppercase tracking-[0.2em] text-cyan-200/70">
              Operations • Website Intake
            </span>
            <span className="text-xl font-semibold md:text-2xl">
              Booking Leads
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="relative space-y-5">

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Total Results" value={total} />
            <MetricCard label="New On This Page" value={statusCounts.new} />
            <MetricCard label="Contacted" value={statusCounts.contacted} />
            <MetricCard label="Booked" value={statusCounts.booked} />
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-[760px]">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Search name, phone, ZIP, source, status…"
                  className="border-white/10 bg-slate-900/60 pl-9 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                title="Refresh"
              >
                <RefreshCw
                  className={[
                    "h-4 w-4",
                    isFetching ? "animate-spin text-cyan-200" : "",
                  ].join(" ")}
                />
                Refresh
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-slate-400">Showing</span>
                <span className="font-medium text-slate-100">
                  {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)}
                </span>
                <span className="text-slate-400">of</span>
                <span className="font-medium text-slate-100">{total}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PageButton disabled={!canPrev} onClick={() => setPage(1)}>
                  First
                </PageButton>

                <PageButton
                  disabled={!canPrev}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Prev
                </PageButton>

                <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
                  Page <span className="font-semibold">{page}</span> /{" "}
                  <span className="font-semibold">{totalPages}</span>
                </div>

                <PageButton
                  disabled={!canNext}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Next
                </PageButton>

                <PageButton
                  disabled={!canNext}
                  onClick={() => setPage(totalPages)}
                >
                  Last
                </PageButton>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <Card className="border border-rose-500/40 bg-slate-950/80 text-sm text-rose-100">
          <CardContent className="py-6">
            Could not load booking leads. Check RLS, table columns, or Supabase
            connection.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="border border-slate-700/60 bg-slate-950/80">
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-slate-200">
            <RefreshCw className="h-4 w-4 animate-spin text-cyan-200" />
            Loading booking leads…
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card className="border border-white/10 bg-slate-950/80">
          <CardContent className="py-10 text-sm text-slate-300">
            No booking leads found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {leads.map((lead: any) => {
            const id = safeString(lead?.id);
            const name = pickLeadName(lead);
            const phone = pickLeadPhone(lead);
            const zip = pickLeadZip(lead);
            const source = pickLeadSource(lead);
            const status = pickLeadStatus(lead);
            const statusMeta = STATUS_META[status];
            const StatusIcon = statusMeta.icon;
            const createdAt = safeString(lead?.created_at);
            const age = formatAge(createdAt);
            const chips = pickChips(lead);
            const slot = safeString(lead?.slot);
            const photoUrl = safeString(lead?.photo_url);
            const href = id ? `/admin/portal/bookingleads/${id}` : "#";

            return (
              <button
                key={id || createdAt || `${name}-${phone}`}
                type="button"
                onClick={() => {
                  if (id) router.push(href);
                }}
                className="text-left"
              >
                <Card className="group overflow-hidden border border-white/10 bg-slate-950/70 shadow-[0_18px_70px_rgba(2,6,23,0.65)] backdrop-blur-xl transition hover:border-cyan-300/45 hover:bg-slate-950/90">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                            <UserRound className="h-4 w-4 text-cyan-200" />
                          </span>

                          <div className="min-w-0">
                            <div className="truncate text-lg font-semibold text-slate-50">
                              {name}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <StatusBadge status={status} />

                              <Badge className="border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                                {source}
                              </Badge>

                              {chips ? (
                                <Badge className="border border-amber-300/20 bg-amber-400/15 text-amber-200">
                                  {chips} chip{Number(chips) === 1 ? "" : "s"}
                                </Badge>
                              ) : null}

                              {photoUrl ? (
                                <Badge className="border border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-200">
                                  <Camera className="mr-1 h-3 w-3" />
                                  Photo
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                          <DataPill
                            icon={Clock}
                            label="Received"
                            value={age}
                            subValue={formatDateTime(createdAt)}
                          />

                          <DataPill
                            icon={MapPin}
                            label="ZIP"
                            value={zip || "—"}
                          />

                          <DataPill
                            icon={Phone}
                            label="Phone"
                            value={phone || "—"}
                          />

                          <DataPill
                            icon={CalendarClock}
                            label="Requested Slot"
                            value={slot || "—"}
                          />
                        </div>
                      </div>

                      <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition group-hover:border-cyan-300/30 group-hover:bg-cyan-400/10 sm:inline-flex">
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex items-center gap-2">
                        <ListFilter className="h-3.5 w-3.5" />
                        Lead ID: {id || "—"}
                      </span>

                      <div className="flex items-center gap-3">
                        {phone ? (
                          <Link
                            href={`tel:${phone}`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-cyan-200 underline underline-offset-4 transition hover:text-cyan-100"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call
                          </Link>
                        ) : null}

                        <span className="inline-flex items-center gap-1 text-slate-300 sm:hidden">
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>

                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">
        {value}
      </div>
    </div>
  );
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-md border px-3 py-2 text-sm backdrop-blur transition",
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500"
          : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        meta.className,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", meta.dotClassName].join(" ")} />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function DataPill({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
      </div>

      <div className="truncate font-medium text-slate-100">{value}</div>

      {subValue ? (
        <div className="mt-0.5 truncate text-[10px] text-slate-500">
          {subValue}
        </div>
      ) : null}
    </div>
  );
}