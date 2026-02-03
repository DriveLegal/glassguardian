// components/tech/TechToast.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TechToastVariant = "success" | "error" | "info";

/**
 * IMPORTANT:
 * - Keep this object SERIALIZABLE (no functions).
 * - Pass functions as separate props named ...Action to satisfy Next's rule.
 */
export type TechToastState = {
  open: boolean;
  title: string;
  message?: string | null;
  variant?: TechToastVariant;
  durationMs?: number;

  // optional action button (label only; handler is passed separately)
  actionLabel?: string;
};

export function TechToast({
  toast,
  onCloseAction,
  onActionAction,
}: {
  toast: TechToastState;
  onCloseAction: () => void;
  onActionAction?: (() => void) | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  React.useEffect(() => {
    if (!toast.open) return;
    const ms = toast.durationMs ?? 6000;
    const t = window.setTimeout(onCloseAction, ms);
    return () => window.clearTimeout(t);
  }, [toast.open, toast.durationMs, onCloseAction]);

  const variant = toast.variant ?? "info";
  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "error"
      ? AlertCircle
      : Info;

  const frame =
    variant === "success"
      ? "from-emerald-950/90 via-slate-950/92 to-sky-950/85 border-emerald-500/50"
      : variant === "error"
      ? "from-rose-950/90 via-slate-950/92 to-slate-950/90 border-rose-500/55"
      : "from-sky-950/90 via-slate-950/92 to-emerald-950/80 border-sky-500/45";

  const iconBg =
    variant === "success"
      ? "border-emerald-400/60 shadow-[0_0_36px_rgba(16,185,129,0.7)]"
      : variant === "error"
      ? "border-rose-400/60 shadow-[0_0_36px_rgba(244,63,94,0.55)]"
      : "border-sky-400/60 shadow-[0_0_36px_rgba(56,189,248,0.65)]";

  const showAction = !!toast.actionLabel && !!onActionAction;

  return (
    <AnimatePresence>
      {toast.open && (
        <motion.div
          initial={
            prefersReducedMotion
              ? undefined
              : { opacity: 0, y: -12, x: 60, scale: 0.96 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, x: 0, scale: 1 }
          }
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: -8, x: 60, scale: 0.98 }
          }
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="fixed right-4 md:right-6 top-16 md:top-20 z-[60] w-[92vw] max-w-sm"
        >
          <div
            className={[
              "relative overflow-hidden rounded-2xl border bg-gradient-to-br backdrop-blur-xl shadow-[0_40px_140px_rgba(2,6,23,0.92)]",
              frame,
            ].join(" ")}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/8 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-white/6 blur-3xl" />

            <div className="relative p-4">
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/70 border",
                    iconBg,
                  ].join(" ")}
                >
                  <Icon className="w-5 h-5 text-slate-50" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-50">
                        {toast.title}
                      </p>
                      {toast.message && (
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                          {toast.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={onCloseAction}
                      className="p-1 rounded-full bg-slate-950/60 border border-slate-600/60 text-slate-300 hover:text-slate-50 hover:bg-slate-900/70 transition"
                      aria-label="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {showAction && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_34px_rgba(56,189,248,0.55)]"
                        onClick={() => {
                          onActionAction?.();
                          onCloseAction();
                        }}
                      >
                        {toast.actionLabel}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}