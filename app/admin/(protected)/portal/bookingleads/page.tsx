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
} from "lucide-react";

import type { BookingLead } from "@/components/admin/portal/AdminBookingLeadsPanel";

type FetchArgs = {
  page: number; // 1-indexed
  pageSize: number;
  q: string;
};

function safeString(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function pickLeadName(lead: any) {
  return (
    safeString(lead?.full_name) ||
    safeString(lead?.name) ||
    safeString(lead?.customer_name) ||
    safeString(lead?.first_name || lead?.last_name
      ? `${safeString(lead?.first_name)} ${safeString(lead?.last_name)}`.trim()
      : "") ||
    "Unknown"
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
    ""
  );
}

function formatAge(createdAt?: string | null) {
  if (!createdAt) return "";
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.max(0, Math.round(diff / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

async function fetchBookingLeads({ page, pageSize, q }: FetchArgs): Promise<{
  leads: BookingLead[];
  total: number;
}> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // NOTE:
  // The page now renders a clickable ALL-LEADS list directly here,
  // so you are not stuck in the old "queue" UI inside AdminBookingLeadsPanel.
  let query = supabaseClient
    .from("booking_leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  const term = q.trim();
  if (term) {
    // Best-effort search across common fields (won't break if some don't exist)
    // Supabase will error if a column truly doesn't exist in the table,
    // so we keep this conservative with likely columns.
    query = query.or(
      [
        `full_name.ilike.%${term}%`,
        `name.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
        `mobile.ilike.%${term}%`,
        `zip.ilike.%${term}%`,
        `email.ilike.%${term}%`,
      ].join(",")
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

  const pageSize = 50;

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    // Reset to page 1 when searching
    setPage(1);
  }, [debouncedQ]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin:booking_leads", { page, pageSize, q: debouncedQ }],
    queryFn: () => fetchBookingLeads({ page, pageSize, q: debouncedQ }),
    staleTime: 10_000,
  });

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-slate-950/80 border border-white/10 shadow-[0_24px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex flex-col gap-1 text-slate-50">
            <span className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Operations • Website Intake
            </span>
            <span className="text-xl md:text-2xl font-semibold">
              Booking leads
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300 max-w-2xl">
            Full lead list (click any lead to open details). This replaces the old
            “queue-only” panel so you can access everything.
          </p>

          {/* Controls row */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:max-w-[720px]">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, phone, zip, email…"
                  className="pl-9 bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10"
                title="Refresh"
              >
                <RefreshCw className={["h-4 w-4", isFetching ? "animate-spin" : ""].join(" ")} />
                Refresh
              </button>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-slate-400">Showing</span>
                <span className="text-slate-100 font-medium">
                  {total === 0 ? 0 : (page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, total)}
                </span>
                <span className="text-slate-400">of</span>
                <span className="text-slate-100 font-medium">{total}</span>
                {isFetching && !isLoading ? (
                  <span className="ml-2 text-xs text-slate-400">Updating…</span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={!canPrev}
                  className={[
                    "px-3 py-2 rounded-md text-sm border backdrop-blur",
                    canPrev
                      ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      : "border-white/5 bg-white/[0.03] text-slate-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  First
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  className={[
                    "px-3 py-2 rounded-md text-sm border backdrop-blur",
                    canPrev
                      ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      : "border-white/5 bg-white/[0.03] text-slate-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  Prev
                </button>

                <div className="px-3 py-2 rounded-md text-sm border border-white/10 bg-white/5 text-slate-100">
                  Page <span className="font-semibold">{page}</span> /{" "}
                  <span className="font-semibold">{totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!canNext}
                  className={[
                    "px-3 py-2 rounded-md text-sm border backdrop-blur",
                    canNext
                      ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      : "border-white/5 bg-white/[0.03] text-slate-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  Next
                </button>

                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={!canNext}
                  className={[
                    "px-3 py-2 rounded-md text-sm border backdrop-blur",
                    canNext
                      ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      : "border-white/5 bg-white/[0.03] text-slate-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isError ? (
        <Card className="bg-slate-950/80 border border-rose-500/40 text-sm text-rose-100">
          <CardContent className="py-6">
            Could not load booking leads. Check RLS / connection.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="bg-slate-950/80 border border-slate-700/60">
          <CardContent className="py-10 flex items-center justify-center text-sm text-slate-200">
            Loading booking leads…
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card className="bg-slate-950/80 border border-white/10">
          <CardContent className="py-10 text-sm text-slate-300">
            No leads found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {leads.map((lead: any) => {
            const id = safeString(lead?.id);
            const name = pickLeadName(lead);
            const phone = pickLeadPhone(lead);
            const zip = pickLeadZip(lead);
            const src = pickLeadSource(lead);
            const createdAt = safeString(lead?.created_at);
            const age = formatAge(createdAt);

            // chips / damage count (best effort)
            const chips =
              lead?.chips ??
              lead?.chip_count ??
              lead?.damage_count ??
              lead?.num_chips ??
              null;

            const href = id ? `/admin/portal/bookingleads/${id}` : "#";

            return (
              <button
                key={id || createdAt || Math.random()}
                type="button"
                onClick={() => {
                  if (!id) return;
                  router.push(href);
                }}
                className="text-left"
              >
                <Card className="group bg-slate-950/70 border border-white/10 hover:border-cyan-300/40 hover:bg-slate-950/80 transition shadow-[0_18px_70px_rgba(2,6,23,0.65)] backdrop-blur-xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-slate-50 truncate">
                            {name}
                          </div>
                          {chips != null && chips !== "" ? (
                            <Badge className="bg-amber-400/15 text-amber-200 border border-amber-300/20">
                              {safeString(chips)} chip{Number(chips) === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                          {src ? (
                            <Badge className="bg-cyan-400/10 text-cyan-200 border border-cyan-300/20">
                              {src}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-col gap-1 text-sm text-slate-300">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              {age || "—"}
                            </span>

                            {zip ? (
                              <span className="inline-flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                ZIP {zip}
                              </span>
                            ) : null}
                          </div>

                          {phone ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-2">
                                <Phone className="h-4 w-4 text-slate-400" />
                                {phone}
                              </span>

                              {/* quick call (doesn't navigate) */}
                              <Link
                                href={`tel:${phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-cyan-200 hover:text-cyan-100 underline underline-offset-4"
                              >
                                Call
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 group-hover:border-cyan-300/30 group-hover:bg-cyan-400/10 transition">
                        Review lead
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>

                    {/* subtle bottom meta */}
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <ListFilter className="h-3.5 w-3.5" />
                        Lead ID: {id || "—"}
                      </span>
                      <span>{createdAt ? new Date(createdAt).toLocaleString() : ""}</span>
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