// app/ios/book/BookElitePublicClient.tsx
"use client";

import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  User,
  AlertCircle,
} from "lucide-react";
import confetti from "canvas-confetti";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { CosmicScene, usePageVisible } from "@/components/home/app/cosmic";

// ────────────────────────────────────────────────
// Helpers
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

function cn(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function isLikelyEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? "").trim());
}

function clampStr(s: string, max: number) {
  const x = (s ?? "").toString().trim();
  return x.length > max ? x.slice(0, max) : x;
}

function tinyHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.(10);
    }
  } catch {}
}

// Auto defaults: today + next quarter-hour
function nextQuarterHourLocal(): { date: string; time: string } {
  const d = new Date();
  d.setSeconds(0);
  d.setMilliseconds(0);
  const m = d.getMinutes();
  const next = Math.ceil(m / 15) * 15;
  if (next === 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  } else {
    d.setMinutes(next);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ────────────────────────────────────────────────
// iOS-friendly input styling + no-zoom
const inputBase =
  "border-cyan-300/35 bg-cyan-500/5 text-cyan-50 placeholder:text-cyan-100/45 rounded-2xl h-10 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-0 appearance-none [-webkit-appearance:none]";

const inputNoZoom = "text-[16px] leading-normal sm:text-[13px]"; // ✅ iOS no-zoom + keep desktop size

// Extra date/time styling for better iOS/Safari look
const dateTimeStyles = `
  input[type="date"],
  input[type="time"] {
    padding: 0 12px;
    color-scheme: dark;
  }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator {
    filter: invert(0.9) brightness(1.3) hue-rotate(170deg);
    opacity: 0.85;
    cursor: pointer;
  }
  input[type="date"]::-webkit-datetime-edit,
  input[type="time"]::-webkit-datetime-edit {
    color: #f0f9ff;
  }
  input[type="date"]::-webkit-datetime-edit-fields-wrapper,
  input[type="time"]::-webkit-datetime-edit-fields-wrapper {
    color: #f0f9ff;
  }
  input[type="date"]::-webkit-datetime-edit-text,
  input[type="time"]::-webkit-datetime-edit-text {
    color: #a5f3fc;
  }
`;

function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-cyan-50/85 text-xs font-medium">{label}</Label>
      {children}
      {error ? (
        <div className="text-xs text-red-300/90 flex items-center gap-1.5 mt-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      ) : hint ? (
        <div className="text-xs text-cyan-100/55 mt-1">{hint}</div>
      ) : null}
    </div>
  );
}

export default function BookElitePublicClient() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion ?? true;
  const pageVisible = usePageVisible();

  // Defer ambient loops until after paint/idle
  const [ambientReady, setAmbientReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      setAmbientReady(true);
    };
    const ric = (window as any).requestIdleCallback?.(go, { timeout: 900 });
    const t = window.setTimeout(go, 650);
    return () => {
      cancelled = true;
      try {
        (window as any).cancelIdleCallback?.(ric);
      } catch {}
      window.clearTimeout(t);
    };
  }, []);

  const enableAmbient = !reduce && pageVisible && ambientReady;

  const defaults = useMemo(() => nextQuarterHourLocal(), []);
  const today = useMemo(() => getTodayStr(), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);

  const [formErrors, setFormErrors] = useState<{
    name?: string;
    email?: string;
    date?: string;
    time?: string;
  }>({});

  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ✅ iOS "sticky zoom" helper: on blur, nudge Safari to restore visual viewport
  const handleBlurFix = React.useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const ua = navigator.userAgent || "";
      const isIOS =
        /iP(hone|od|ad)/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
      if (!isIOS) return;
      const y = window.scrollY;
      window.requestAnimationFrame(() => window.scrollTo(0, y));
    } catch {}
  }, []);

  const canSubmit = useMemo(() => {
    const nameOk = (fullName ?? "").trim().length >= 2;
    const emailOk = isLikelyEmail(email);
    const dateOk = !!date && date >= today;
    const timeOk = !!time;
    return nameOk && emailOk && dateOk && timeOk;
  }, [fullName, email, date, time, today]);

  const validate = React.useCallback(() => {
    const errs: typeof formErrors = {};

    if ((fullName ?? "").trim().length < 2) errs.name = "Please enter your full name";
    if (!isLikelyEmail(email)) errs.email = "Please enter a valid email";
    if (!date) errs.date = "Select a date";
    else if (date < today) errs.date = "Cannot book in the past";
    if (!time) errs.time = "Select a time";

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }, [fullName, email, date, time, today]);

  // Confetti burst on success
  useEffect(() => {
    if (!done) return;

    const colors = ["#67e8f9", "#a5f3fc", "#ff9ec1", "#fda4af", "#c084fc"];

    confetti({
      particleCount: reduce ? 60 : 100,
      spread: 70,
      startVelocity: 30,
      ticks: 200,
      origin: { y: 0.6 },
      colors,
      zIndex: 9999,
    });

    const t = window.setTimeout(() => {
      confetti({
        particleCount: reduce ? 40 : 70,
        angle: 60,
        spread: 55,
        origin: { x: 0.2, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: reduce ? 40 : 70,
        angle: 120,
        spread: 55,
        origin: { x: 0.8, y: 0.6 },
        colors,
      });
    }, 150);

    return () => window.clearTimeout(t);
  }, [done, reduce]);

  const submit = React.useCallback(async () => {
    if (submitting) return;
    setServerError(null);

    if (!validate()) return;

    tinyHaptic();
    setSubmitting(true);

    try {
      const payload = {
        fullName: clampStr(fullName, 120),
        email: clampStr(email.trim().toLowerCase(), 180),
        date,
        time,

        // required-by-table defaults (since UI is minimal)
        phone: "0000000000",
        zip: "00000",
        chips: 0,

        source: "app_home_quick_book",
      };

      const res = await fetch("/api/booking-leads/public", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Something went wrong. Try again.");

      setDone(true);
      window.setTimeout(() => router.back(), 2200);
    } catch (err: any) {
      setServerError(err?.message || "Failed to send booking.");
      setSubmitting(false);
    }
  }, [submitting, validate, fullName, email, date, time, router]);

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submit();
    },
    [submit]
  );

  // Clear field error as user fixes it (keeps UI feeling premium)
  useEffect(() => {
    setFormErrors((prev) => {
      if (!prev.name) return prev;
      if ((fullName ?? "").trim().length >= 2) {
        const { name, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, [fullName]);

  useEffect(() => {
    setFormErrors((prev) => {
      if (!prev.email) return prev;
      if (isLikelyEmail(email)) {
        const { email: _email, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, [email]);

  useEffect(() => {
    setFormErrors((prev) => {
      if (!prev.date) return prev;
      if (date && date >= today) {
        const { date: _date, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, [date, today]);

  useEffect(() => {
    setFormErrors((prev) => {
      if (!prev.time) return prev;
      if (time) {
        const { time: _time, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, [time]);

  return (
    <LazyMotion features={domAnimation} strict>
      <main
        className="relative min-h-screen overflow-hidden bg-black text-white"
        role="main"
        aria-label="Glass Guardian quick booking"
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        {/* ✅ Page-scoped CSS: iOS zoom + better date/time appearance */}
        <style jsx global>{`
          html,
          body {
            -webkit-text-size-adjust: 100%;
          }
          input,
          textarea,
          select {
            -webkit-text-size-adjust: 100%;
          }
          ${dateTimeStyles}
        `}</style>

        <CosmicScene
          animated={enableAmbient}
          intensity={enableAmbient ? "rich" : "lite"}
        />

        <div className="relative z-10 mx-auto w-full max-w-[560px] px-4 pb-14 pt-8 sm:px-5 sm:pt-10">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-[20px] border border-cyan-300/35 bg-black/70 backdrop-blur-xl shadow-[0_24px_120px_rgba(0,0,0,0.95)]">
                <CalendarClock className="h-5 w-5 text-cyan-50" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] text-cyan-100/70">Glass Guardian</div>
                <div className="text-[16px] font-semibold text-cyan-50">Quick Book</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="border-white/10 bg-white/5 text-cyan-50/85">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                No login
              </Badge>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  tinyHaptic();
                  router.back();
                }}
                className="h-9 rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>

          {/* Main */}
          <m.div
            initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(10px)" }}
            animate={reduce ? {} : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.75, ease: easeOutExpo }}
            className="mt-5"
            style={{ willChange: "transform, opacity, filter" }}
          >
            <Card className="relative overflow-hidden rounded-[30px] border border-cyan-300/30 bg-black/75 backdrop-blur-[24px] px-5 py-5 shadow-[0_40px_220px_rgba(0,0,0,0.98)] transform-gpu">
              <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
              <div className="pointer-events-none absolute -inset-36 bg-[radial-gradient(circle_at_25%_20%,rgba(96,220,255,0.22),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,110,220,0.18),transparent_50%)]" />

              <AnimatePresence>
                {serverError && !done && (
                  <m.div
                    key="err"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="mb-4"
                  >
                    <Alert className="border-red-400/45 bg-red-500/10 text-white">
                      <AlertDescription className="text-red-50 text-[12px]">
                        {serverError}
                      </AlertDescription>
                    </Alert>
                  </m.div>
                )}
              </AnimatePresence>

              {done ? (
                <div className="py-12 text-center space-y-3">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-[26px] border border-cyan-300/40 bg-cyan-500/10">
                    <CheckCircle2 className="h-9 w-9 text-cyan-50" />
                  </div>
                  <div className="text-[22px] font-semibold text-cyan-50">Booking Sent!</div>
                  <div className="text-[13px] text-cyan-100/80">
                    We’ll confirm your slot shortly. 🎉
                  </div>
                  <div className="text-[11px] text-cyan-200/60">
                    Redirecting you in a moment…
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[18px] font-semibold text-cyan-50">
                        One-tap booking
                      </div>
                      <div className="mt-1 text-[12px] text-cyan-100/70">
                        Name + email, pick a date & time — done.
                      </div>
                    </div>
                    <Badge className="border-white/10 bg-white/5 text-cyan-50/80">
                      <User className="mr-1 h-3.5 w-3.5" />
                      1 step
                    </Badge>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full name" error={formErrors.name}>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onBlur={handleBlurFix}
                        placeholder="Your name"
                        className={cn(inputBase, inputNoZoom)}
                        autoComplete="name"
                        inputMode="text"
                      />
                    </Field>

                    <Field label="Email" error={formErrors.email}>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={handleBlurFix}
                        placeholder="you@email.com"
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className={cn(inputBase, inputNoZoom)}
                        autoComplete="email"
                      />
                    </Field>

                    <Field label="Date" error={formErrors.date} hint="Earliest is today.">
                      <Input
                        type="date"
                        min={today}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        onBlur={handleBlurFix}
                        className={cn(inputBase, inputNoZoom)}
                      />
                    </Field>

                    <Field label="Time" error={formErrors.time}>
                      <Input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        onBlur={handleBlurFix}
                        className={cn(inputBase, inputNoZoom)}
                      />
                    </Field>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-cyan-100/60 inline-flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      No account required.
                    </div>

                    <m.div whileTap={{ scale: 0.985 }}>
                      <Button
                        type="submit"
                        disabled={submitting || !canSubmit}
                        className="h-10 rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-100 to-pink-300 text-black font-semibold text-[12px] hover:from-cyan-200 hover:via-cyan-50 hover:to-pink-200 shadow-[0_10px_34px_rgba(96,220,255,0.6)] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Sending…</span>
                          </span>
                        ) : (
                          <>
                            Book Now
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </m.div>
                  </div>
                </form>
              )}
            </Card>
          </m.div>

          {/* Trust strip */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-cyan-100/65">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              <CalendarDays className="h-3.5 w-3.5" />
              Fast scheduling
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              <Sparkles className="h-3.5 w-3.5" />
              Ultra clean
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Warranty-backed
            </span>
          </div>
        </div>
      </main>
    </LazyMotion>
  );
}