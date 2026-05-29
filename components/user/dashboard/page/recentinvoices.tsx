"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import { ArrowRight, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TechInvoice } from "@/components/user/dashboard/page/useDashboardData";

function fireMicroHaptic() {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator)) return;

  try {
    navigator.vibrate(7);
  } catch {}
}

function centsToDollars(cents?: number | null) {
  if (typeof cents !== "number") return null;
  return (cents / 100).toFixed(2);
}

function GlassCard({
  children,
  className = "",
  glow = "graphite",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "graphite" | "warm";
}) {
  const prefersReducedMotion = useReducedMotion();
  const glowClass = glow === "warm" ? "gg-card-warm" : "gg-card-graphite";

  return (
    <motion.article
      whileHover={prefersReducedMotion ? undefined : { y: -5, scale: 1.006 }}
      transition={{ type: "spring", stiffness: 230, damping: 26, mass: 0.8 }}
      className={`gg-glass-card ${glowClass} ${className}`}
      role="region"
      onMouseEnter={fireMicroHaptic}
    >
      <div className="gg-card-particles" aria-hidden="true" />
      <div className="pointer-events-none absolute -inset-x-8 -top-24 h-44 bg-gradient-to-tr from-white/16 to-transparent opacity-18 blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.12),transparent_34%),radial-gradient(circle_at_90%_90%,rgba(226,232,240,0.08),transparent_38%)]" />
      <div className="relative z-10 p-4 md:p-6">{children}</div>
    </motion.article>
  );
}

export default function RecentInvoicesPanel({
  invoices,
  loadingInvoices,
}: {
  invoices: TechInvoice[];
  loadingInvoices: boolean;
}) {
  if (!invoices || invoices.length === 0) return null;

  return (
    <GlassCard className="mb-8" glow="graphite">
      <Card className="border-none bg-transparent">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
            <FileText className="w-4 h-4 text-slate-300" />
            Recent Invoices
          </CardTitle>

          <Link href="/user/dashboard/pay">
            <Button
              variant="ghost"
              size="sm"
              className="text-[0.7rem] text-slate-100 hover:text-slate-100 border border-slate-600/70 hover:bg-slate-900/60 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="space-y-3 text-xs">
          {loadingInvoices && <div className="text-slate-400">Refreshing invoices…</div>}

          {invoices.slice(0, 5).map((invoice) => {
            const total = centsToDollars(invoice.total_cents);
            const paid = centsToDollars(invoice.final_paid_cents);
            const status = (invoice.status ?? "unknown").replace(/_/g, " ");
            const isPaid = (invoice.status ?? "").toLowerCase() === "paid";

            return (
              <Link
                key={invoice.id}
                href={`/user/dashboard/pay/${invoice.id}`}
                className="block focus:outline-none"
                aria-label={`Open invoice ${invoice.invoice_number ?? invoice.id}`}
              >
                <div className="gg-status-card gg-status-graphite rounded-xl border border-slate-700/70 bg-slate-900/60 hover:bg-slate-900/75 transition px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-slate-50 font-semibold text-[0.78rem] truncate">
                        {invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice"}
                      </div>

                      <div className="mt-1 text-[0.7rem] text-slate-300">
                        {invoice.invoice_date
                          ? format(new Date(invoice.invoice_date), "MMM d, yyyy")
                          : invoice.created_at
                          ? format(new Date(invoice.created_at), "MMM d, yyyy")
                          : "Date"}
                        {invoice.service_address ? (
                          <span className="text-slate-400"> · {invoice.service_address}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="text-slate-50 font-semibold tabular-nums">
                        {total ? `$${total}` : "—"}
                      </div>

                      <div
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${
                          isPaid
                            ? "bg-white/[0.06] border-white/14 text-slate-200"
                            : "bg-white/[0.045] border-white/12 text-slate-300"
                        }`}
                      >
                        {status.toUpperCase()}
                      </div>

                      {paid && isPaid ? (
                        <div className="text-[0.65rem] text-slate-300">Paid ${paid}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </GlassCard>
  );
}