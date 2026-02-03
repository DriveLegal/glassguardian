"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Phone,
  MapPin,
  AlertTriangle,
  Clock,
  Camera,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
};

interface AdminBookingLeadsPanelProps {
  leads: BookingLead[];
}

export function AdminBookingLeadsPanel({ leads }: AdminBookingLeadsPanelProps) {
  const hasLeads = leads && leads.length > 0;
  const latest = hasLeads ? leads[0] : null;
  const rest = hasLeads ? leads.slice(1, 4) : [];

  const latestTime =
    latest?.created_at
      ? formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })
      : null;

  return (
    <div className="relative">
      {/* Glow halo behind whole panel */}
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
        className="relative rounded-2xl border border-cyan-400/40 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 shadow-[0_24px_80px_rgba(15,23,42,0.9)]"
      >
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between gap-3">
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
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-medium text-slate-100">
                  Priority: New site bookings
                </span>
                {hasLeads && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                    <AlertTriangle className="h-3 w-3 text-emerald-300" />
                    Action recommended
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end text-right">
            <div className="text-xs text-slate-400">Queue</div>
            <div className="text-lg font-semibold text-slate-50 tabular-nums">
              {leads.length.toString().padStart(2, "0")}
            </div>
          </div>
        </div>

        {/* Content */}
        {hasLeads ? (
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Hero lead card */}
            <motion.div
              whileHover={{ y: -2, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
              className="flex-1 rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-slate-900/80 via-slate-950/95 to-slate-950/100 p-4 shadow-[0_18px_50px_rgba(8,47,73,0.9)]"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-50">
                      {latest?.full_name}
                    </span>
                    {latest?.chips && latest.chips > 0 && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                        {latest.chips} chip{latest.chips > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-sky-300" />
                      {latestTime ?? "Just now"}
                    </span>
                    {latest?.slot && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-100">
                        <CalendarIcon className="h-3 w-3" />
                        {latest.slot}
                      </span>
                    )}
                    {latest?.source && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        {latest.source}
                      </span>
                    )}
                  </div>
                </div>
                {latest?.photo_url && (
                  <div className="relative h-12 w-16 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/80">
                    {/* Framing that we have media – can swap to real img later */}
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-slate-300">
                      <Camera className="h-4 w-4 text-slate-100" />
                      <span>Photo</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Phone className="h-3.5 w-3.5 text-cyan-300" />
                    Contact
                  </div>
                  <div className="font-mono text-[11px] text-slate-100">
                    {latest?.phone}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                    ZIP
                  </div>
                  <div className="font-mono text-[11px] text-slate-100">
                    {latest?.zip}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                  <span>Ready to be claimed</span>
                </div>
                {latest && (
                  <Link
                    href={`/admin/portal/bookingleads/${latest.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-300/60 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/20 hover:shadow-[0_0_18px_rgba(56,189,248,0.8)] transition"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Review lead
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Mini queue list */}
            <div className="w-full min-w-[0] md:w-60">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Queue</span>
                <span>{leads.length} total</span>
              </div>
              <div className="space-y-2">
                {rest.length === 0 && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-3 text-[11px] text-slate-300">
                    No other leads waiting. You’re caught up ✅
                  </div>
                )}
                {rest.map((lead) => (
                  <motion.div
                    key={lead.id}
                    whileHover={{ y: -1, scale: 1.01 }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-slate-100">
                        {lead.full_name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <span>{lead.zip}</span>
                        {lead.chips > 0 && (
                          <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                            {lead.chips} chip{lead.chips > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-[10px] text-slate-400">
                      {lead.slot && <span>{lead.slot}</span>}
                      <span>
                        {formatDistanceToNow(new Date(lead.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </motion.div>
                ))}
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
                  No live web leads yet
                </div>
                <div className="text-[11px] text-slate-400">
                  As soon as someone books from the website, they’ll light up
                  here with a priority card.
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

/* tiny inline helper to avoid importing Calendar just for this */
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