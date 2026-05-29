//components/admin/portal/AdminBookingLeadsPanel.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Phone,
  MapPin,
  AlertTriangle,
  Clock,
  Camera,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MessageCircle,
  CalendarCheck,
  Ban,
  StickyNote,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { supabaseClient } from "@/lib/supabaseClient";

export type LeadStatus =
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

export type BookingLead = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  zip: string;
  chips: number;
  slot: string | null;
  photo_url: string | null;
  source: string | null;
  status?: LeadStatus | null;
  notes?: string | null;
  last_contacted_at?: string | null;
};

interface AdminBookingLeadsPanelProps {
  leads: BookingLead[];
}

const STATUS_META: Record<
  LeadStatus,
  {
    label: string;
    short: string;
    description: string;
    className: string;
    dotClassName: string;
  }
> = {
  new: {
    label: "New",
    short: "New",
    description: "Needs first contact",
    className: "border-amber-300/40 bg-amber-400/10 text-amber-100",
    dotClassName: "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]",
  },
  contacted: {
    label: "Contacted",
    short: "Reached out",
    description: "Already called/texted",
    className: "border-sky-300/40 bg-sky-400/10 text-sky-100",
    dotClassName: "bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.9)]",
  },
  booked: {
    label: "Booked",
    short: "Booked",
    description: "Appointment scheduled",
    className: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    dotClassName: "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]",
  },
  completed: {
    label: "Completed",
    short: "Done",
    description: "Repair completed",
    className: "border-green-300/40 bg-green-400/10 text-green-100",
    dotClassName: "bg-green-300 shadow-[0_0_12px_rgba(134,239,172,0.9)]",
  },
  no_response: {
    label: "No Response",
    short: "No response",
    description: "No answer yet",
    className: "border-slate-500/60 bg-slate-500/10 text-slate-200",
    dotClassName: "bg-slate-400",
  },
  not_interested: {
    label: "Not Interested",
    short: "Declined",
    description: "Customer declined",
    className: "border-red-300/40 bg-red-400/10 text-red-100",
    dotClassName: "bg-red-300 shadow-[0_0_12px_rgba(252,165,165,0.75)]",
  },
  could_help: {
    label: "Could Help",
    short: "Could help",
    description: "Repairable / good fit",
    className: "border-cyan-300/40 bg-cyan-400/10 text-cyan-100",
    dotClassName: "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]",
  },
  repair_not_done: {
    label: "Repair Not Done",
    short: "Not done",
    description: "Customer did not complete repair",
    className: "border-orange-300/40 bg-orange-400/10 text-orange-100",
    dotClassName: "bg-orange-300 shadow-[0_0_12px_rgba(253,186,116,0.8)]",
  },
  canceled: {
    label: "Canceled",
    short: "Canceled",
    description: "Booking canceled",
    className: "border-rose-300/40 bg-rose-400/10 text-rose-100",
    dotClassName: "bg-rose-300 shadow-[0_0_12px_rgba(253,164,175,0.75)]",
  },
  invalid: {
    label: "Invalid",
    short: "Invalid",
    description: "Bad/duplicate lead",
    className: "border-zinc-400/40 bg-zinc-400/10 text-zinc-100",
    dotClassName: "bg-zinc-300",
  },
};

const FILTERS: Array<{ value: "all" | LeadStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "no_response", label: "No Response" },
  { value: "could_help", label: "Could Help" },
  { value: "repair_not_done", label: "Not Done" },
  { value: "canceled", label: "Canceled" },
];

function getLeadStatus(lead: BookingLead): LeadStatus {
  return lead.status || "new";
}

function getStatusMeta(status: LeadStatus) {
  return STATUS_META[status] || STATUS_META.new;
}

function safeTime(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return formatDistanceToNow(date, { addSuffix: true });
}

export function AdminBookingLeadsPanel({ leads }: AdminBookingLeadsPanelProps) {
  const queryClient = useQueryClient();

  const [filter, setFilter] = React.useState<"all" | LeadStatus>("all");
  const [savingLeadId, setSavingLeadId] = React.useState<string | null>(null);
  const [notesDraft, setNotesDraft] = React.useState<Record<string, string>>(
    {},
  );

  const normalizedLeads = React.useMemo(
    () =>
      [...(leads || [])].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [leads],
  );

  const filteredLeads = React.useMemo(() => {
    if (filter === "all") return normalizedLeads;

    return normalizedLeads.filter((lead) => getLeadStatus(lead) === filter);
  }, [filter, normalizedLeads]);

  const counts = React.useMemo(() => {
    const base: Record<LeadStatus | "all", number> = {
      all: normalizedLeads.length,
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

    normalizedLeads.forEach((lead) => {
      base[getLeadStatus(lead)] += 1;
    });

    return base;
  }, [normalizedLeads]);

  const hasLeads = filteredLeads.length > 0;
  const latest = hasLeads ? filteredLeads[0] : null;
  const rest = hasLeads ? filteredLeads.slice(1, 6) : [];

  const latestStatus = latest ? getLeadStatus(latest) : "new";
  const latestStatusMeta = getStatusMeta(latestStatus);
  const latestTime = safeTime(latest?.created_at);

  async function refreshLeads() {
    await queryClient.invalidateQueries({
      queryKey: ["booking-leads"],
      exact: false,
    });

    await queryClient.invalidateQueries({
      queryKey: ["admin-booking-leads"],
      exact: false,
    });
  }

  async function updateLead(
    leadId: string,
    patch: Partial<Pick<BookingLead, "status" | "notes" | "last_contacted_at">>,
  ) {
    setSavingLeadId(leadId);

    const { error } = await supabaseClient
      .from("booking_leads")
      .update(patch)
      .eq("id", leadId);

    setSavingLeadId(null);

    if (error) {
      console.error("Failed to update booking lead:", error);
      alert(`Could not update lead: ${error.message}`);
      return;
    }

    await refreshLeads();
  }

  async function updateStatus(lead: BookingLead, status: LeadStatus) {
    const patch: Partial<BookingLead> = { status };

    if (status === "contacted" || status === "booked") {
      patch.last_contacted_at = new Date().toISOString();
    }

    await updateLead(lead.id, patch);
  }

  async function saveNotes(lead: BookingLead) {
    const draft = notesDraft[lead.id];

    await updateLead(lead.id, {
      notes: typeof draft === "string" ? draft.trim() : lead.notes || "",
    });
  }

  function getNotesValue(lead: BookingLead) {
    return notesDraft[lead.id] ?? lead.notes ?? "";
  }

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-2 rounded-3xl opacity-60 blur-2xl"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, rgba(56,189,248,0.4), transparent 50%), radial-gradient(circle at 100% 100%, rgba(236,72,153,0.3), transparent 52%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative rounded-2xl border border-cyan-400/40 bg-slate-950/80 px-4 py-4 shadow-[0_24px_80px_rgba(15,23,42,0.9)] md:px-5 md:py-5"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]">
                <span className="h-2 w-2 rounded-full bg-slate-950" />
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                Live Web Leads
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="font-medium text-slate-100">
                  Priority: New site bookings
                </span>

                {counts.new > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                    <AlertTriangle className="h-3 w-3 text-amber-300" />
                    {counts.new} need outreach
                  </span>
                )}

                {counts.booked > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                    <CalendarCheck className="h-3 w-3 text-emerald-300" />
                    {counts.booked} booked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 text-left lg:items-end lg:text-right">
            <div className="text-xs text-slate-400">Pipeline</div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold tabular-nums text-slate-50">
                {counts.all.toString().padStart(2, "0")}
              </div>

              <button
                type="button"
                onClick={refreshLeads}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/10 hover:text-cyan-100"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            const count = counts[item.value];

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={[
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                  active
                    ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_rgba(56,189,248,0.35)]"
                    : "border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-cyan-300/40 hover:bg-slate-800/80",
                ].join(" ")}
              >
                {item.label}
                <span className="ml-1.5 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[10px] text-slate-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {hasLeads && latest ? (
          <div className="flex flex-col gap-4 xl:flex-row">
            <motion.div
              whileHover={{ y: -2, scale: 1.005 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
              className="flex-1 rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-slate-900/80 via-slate-950/95 to-slate-950/100 p-4 shadow-[0_18px_50px_rgba(8,47,73,0.9)]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-50">
                      {latest.full_name}
                    </span>

                    <StatusBadge status={latestStatus} />

                    {latest.chips > 0 && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                        {latest.chips} chip{latest.chips > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-sky-300" />
                      {latestTime ?? "Just now"}
                    </span>

                    {latest.slot && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-100">
                        <CalendarIcon className="h-3 w-3" />
                        {latest.slot}
                      </span>
                    )}

                    {latest.source && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        {latest.source}
                      </span>
                    )}

                    {latest.last_contacted_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-100">
                        <MessageCircle className="h-3 w-3" />
                        Contacted {safeTime(latest.last_contacted_at)}
                      </span>
                    )}
                  </div>
                </div>

                {latest.photo_url && (
                  <a
                    href={latest.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/80 transition hover:border-cyan-300/60"
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-slate-300">
                      <Camera className="h-4 w-4 text-slate-100" />
                      <span>Photo</span>
                    </div>
                  </a>
                )}
              </div>

              <div className="grid gap-3 text-xs text-slate-200 sm:grid-cols-2">
                <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Phone className="h-3.5 w-3.5 text-cyan-300" />
                    Contact
                  </div>
                  <a
                    href={`tel:${latest.phone}`}
                    className="font-mono text-[12px] text-slate-100 hover:text-cyan-200"
                  >
                    {latest.phone}
                  </a>
                </div>

                <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                    ZIP
                  </div>
                  <div className="font-mono text-[12px] text-slate-100">
                    {latest.zip}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-200">
                    <StickyNote className="h-3.5 w-3.5 text-cyan-300" />
                    Lead notes
                  </div>

                  <button
                    type="button"
                    onClick={() => saveNotes(latest)}
                    disabled={savingLeadId === latest.id}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-300/50 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingLeadId === latest.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Save notes
                  </button>
                </div>

                <textarea
                  value={getNotesValue(latest)}
                  onChange={(event) =>
                    setNotesDraft((current) => ({
                      ...current,
                      [latest.id]: event.target.value,
                    }))
                  }
                  placeholder="Example: Texted customer, waiting for photo. Said damage may be repairable."
                  className="min-h-[76px] w-full resize-none rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/10"
                />
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <QuickStatusButton
                    icon={<MessageCircle className="h-3 w-3" />}
                    label="Mark Contacted"
                    loading={savingLeadId === latest.id}
                    onClick={() => updateStatus(latest, "contacted")}
                  />

                  <QuickStatusButton
                    icon={<CalendarCheck className="h-3 w-3" />}
                    label="Booked"
                    loading={savingLeadId === latest.id}
                    onClick={() => updateStatus(latest, "booked")}
                  />

                  <QuickStatusButton
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    label="Completed"
                    loading={savingLeadId === latest.id}
                    onClick={() => updateStatus(latest, "completed")}
                  />

                  <QuickStatusButton
                    icon={<XCircle className="h-3 w-3" />}
                    label="No Response"
                    loading={savingLeadId === latest.id}
                    onClick={() => updateStatus(latest, "no_response")}
                  />

                  <QuickStatusButton
                    icon={<Ban className="h-3 w-3" />}
                    label="Canceled"
                    loading={savingLeadId === latest.id}
                    onClick={() => updateStatus(latest, "canceled")}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={latestStatus}
                    onChange={(event) =>
                      updateStatus(latest, event.target.value as LeadStatus)
                    }
                    disabled={savingLeadId === latest.id}
                    className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] font-medium text-slate-100 outline-none transition hover:border-cyan-300/60 focus:border-cyan-300/80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {Object.entries(STATUS_META).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>

                  <Link
                    href={`/admin/portal/bookingleads/${latest.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-300/60 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/20 hover:shadow-[0_0_18px_rgba(56,189,248,0.8)]"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Review lead
                  </Link>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-300">
                <span
                  className={[
                    "inline-flex h-1.5 w-1.5 rounded-full",
                    latestStatusMeta.dotClassName,
                    latestStatus === "new" ? "animate-pulse" : "",
                  ].join(" ")}
                />
                <span>{latestStatusMeta.description}</span>
              </div>
            </motion.div>

            <div className="w-full min-w-0 xl:w-[26rem]">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Filtered queue</span>
                <span>
                  {filteredLeads.length} of {leads.length} total
                </span>
              </div>

              <div className="space-y-2">
                {rest.length === 0 && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-3 text-[11px] text-slate-300">
                    No other leads in this view. You’re caught up ✅
                  </div>
                )}

                {rest.map((lead) => {
                  const status = getLeadStatus(lead);
                  const meta = getStatusMeta(status);

                  return (
                    <motion.div
                      key={lead.id}
                      whileHover={{ y: -1, scale: 1.005 }}
                      className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-[11px]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-slate-100">
                              {lead.full_name}
                            </div>
                            <StatusBadge status={status} compact />
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                            <span>{lead.zip}</span>

                            {lead.chips > 0 && (
                              <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                                {lead.chips} chip{lead.chips > 1 ? "s" : ""}
                              </span>
                            )}

                            {lead.last_contacted_at && (
                              <span className="rounded-full bg-blue-400/10 px-1.5 py-0.5 text-blue-100">
                                Contacted {safeTime(lead.last_contacted_at)}
                              </span>
                            )}
                          </div>

                          {lead.notes && (
                            <div className="mt-1 line-clamp-2 text-[10px] text-slate-400">
                              {lead.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] text-slate-400">
                          {lead.slot && <span>{lead.slot}</span>}
                          <span>{safeTime(lead.created_at)}</span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <select
                          value={status}
                          onChange={(event) =>
                            updateStatus(lead, event.target.value as LeadStatus)
                          }
                          disabled={savingLeadId === lead.id}
                          className={[
                            "max-w-full rounded-full border px-2.5 py-1 text-[10px] font-medium outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                            meta.className,
                          ].join(" ")}
                        >
                          {Object.entries(STATUS_META).map(([value, item]) => (
                            <option key={value} value={value}>
                              {item.label}
                            </option>
                          ))}
                        </select>

                        <Link
                          href={`/admin/portal/bookingleads/${lead.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-950/70 px-2.5 py-1 text-[10px] text-slate-200 transition hover:border-cyan-300/60 hover:text-cyan-100"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-slate-700/80 bg-slate-950/70 px-4 py-4 text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/80">
                <Sparkles className="h-4 w-4 text-slate-100" />
              </span>

              <div>
                <div className="font-medium text-slate-100">
                  {leads.length > 0
                    ? "No leads match this filter"
                    : "No live web leads yet"}
                </div>

                <div className="text-[11px] text-slate-400">
                  {leads.length > 0
                    ? "Switch filters to see the rest of the lead pipeline."
                    : "As soon as someone books from the website, they’ll light up here with a priority card."}
                </div>
              </div>
            </div>

            <div className="hidden text-[11px] text-slate-400 md:block">
              Watching for <span className="text-cyan-200">booking_leads</span>{" "}
              in real time.
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: LeadStatus;
  compact?: boolean;
}) {
  const meta = getStatusMeta(status);

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border font-medium",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        meta.className,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", meta.dotClassName].join(" ")} />
      {compact ? meta.short : meta.label}
    </span>
  );
}

function QuickStatusButton({
  icon,
  label,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
      className={["inline-block", props.className].filter(Boolean).join(" ")}
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
        ry="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="3"
        y1="10"
        x2="21"
        y2="10"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="9"
        y1="2"
        x2="9"
        y2="6"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="15"
        y1="2"
        x2="15"
        y2="6"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}