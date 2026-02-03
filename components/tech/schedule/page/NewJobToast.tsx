// components/tech/schedule/page/NewJobToast.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Sparkles, X, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExecutionQueueHelpers } from "@/components/tech/schedule/page/ExecutionQueue";

export type QuickToast = {
  id: string;
  title: string;
  subtitle?: string | null;
  date?: string | null;
  time?: string | null;
  address?: string | null;
};

export default function NewJobToast({
  toast,
  onClose,
  onViewJob,
  prefersReducedMotion,
  className = "",
}: {
  toast: QuickToast | null;
  onClose: () => void;
  onViewJob: (jobId: string) => void;
  prefersReducedMotion?: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, x: 80, scale: 0.95 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 80, scale: 0.95 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={["fixed right-6 top-20 z-40 max-w-sm", className].join(" ")}
        >
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-950/95 via-sky-950/90 to-emerald-950/90 shadow-[0_36px_120px_rgba(2,6,23,0.95)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-400/30 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-emerald-400/24 blur-3xl" />

            <div className="relative p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 border border-sky-400/60 shadow-[0_0_36px_rgba(56,189,248,0.95)]">
                  <Sparkles className="w-5 h-5 text-sky-300" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/90">
                        NEW JOB ROUTED
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-50">{toast.title}</p>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="p-1 rounded-full bg-slate-900/80 border border-slate-500/70 text-slate-300 hover:text-slate-50 hover:bg-slate-800/90 transition"
                      aria-label="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {toast.subtitle && (
                    <p className="mt-1 text-xs text-slate-200/90 break-all">{toast.subtitle}</p>
                  )}

                  {toast.address && (
                    <p className="mt-1 text-xs text-slate-300/80 line-clamp-2">{toast.address}</p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300/80">
                      <Clock className="w-3 h-3" />
                      <span>
                        {toast.date ? ExecutionQueueHelpers.safeDateLabel(toast.date) : "Date TBA"}
                        {toast.time ? ` · ${toast.time}` : ""}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_32px_rgba(59,130,246,0.85)]"
                      onClick={() => onViewJob(toast.id)}
                    >
                      View Job
                      <ArrowRight className="w-3 h-3 ml-1.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}