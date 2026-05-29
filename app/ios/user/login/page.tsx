// app/ios/user/login/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { supabaseClient } from "@/lib/supabaseClient";
import { CosmicScene, usePageVisible } from "@/components/home/app/cosmic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  Sparkles,
  User,
  ShieldCheck,
  CalendarDays,
  ReceiptText,
  HeartHandshake,
} from "lucide-react";

const DASHBOARD_ROUTE = "/ios/user/dashboard";
const HOME_ROUTE = "/ios"; // optional fallback if you want a "Back to Home" link
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

function cn(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function tinyHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.(10);
    }
  } catch {}
}

export default function UserLoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion ?? true;
  const pageVisible = usePageVisible();

  const [ambientReady, setAmbientReady] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      setAmbientReady(true);
    };
    const ric = (window as any).requestIdleCallback?.(go, { timeout: 950 });
    const t = window.setTimeout(go, 700);
    return () => {
      cancelled = true;
      try {
        (window as any).cancelIdleCallback?.(ric);
      } catch {}
      window.clearTimeout(t);
    };
  }, []);

  const enableAmbient = !reduce && pageVisible && ambientReady;

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // If already logged in, bounce to dashboard
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (cancelled) return;
        if (data?.session) {
          router.replace(DASHBOARD_ROUTE);
          router.refresh?.();
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (submitting) return;

      setErrorMsg(null);

      const eNorm = String(email ?? "").trim().toLowerCase();
      const pw = String(password ?? "");

      if (!eNorm) return setErrorMsg("Enter your email.");
      if (!pw) return setErrorMsg("Enter your password.");
      if (!(eNorm.includes("@") && eNorm.includes(".")))
        return setErrorMsg("Please use a valid email.");

      tinyHaptic();
      setSubmitting(true);

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: eNorm,
          password: pw,
        });

        if (error) {
          setErrorMsg(error.message || "Login failed. Please try again.");
          setSubmitting(false);
          return;
        }

        router.replace(DASHBOARD_ROUTE);
        router.refresh?.();
      } catch (err: any) {
        setErrorMsg(String(err?.message || "Login failed. Please try again."));
        setSubmitting(false);
      }
    },
    [email, password, router, submitting]
  );

  return (
    <LazyMotion features={domAnimation} strict>
      <main
        className="relative min-h-screen overflow-hidden bg-black text-white"
        role="main"
        aria-label="Glass Guardian user login"
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <CosmicScene
          intensity="rich"
          animated={enableAmbient}
        />

        {/* Taller layout: center area + bottom trust + extra spacing */}
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-4 pb-14 pt-8 sm:px-5 sm:pt-10">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-[20px] border border-cyan-300/35 bg-black/70 backdrop-blur-xl shadow-[0_24px_120px_rgba(0,0,0,0.95)]">
                <ShieldCheck className="h-5 w-5 text-cyan-50" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] text-cyan-100/70">Glass Guardian</div>
                <div className="text-[16px] font-semibold text-cyan-50">
                  User Login
                </div>
              </div>
            </div>

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

          {/* Middle content */}
          <m.div
            initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(10px)" }}
            animate={reduce ? {} : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.75, ease: easeOutExpo }}
            className="mt-6 flex flex-1 flex-col"
            style={{ willChange: "transform, opacity, filter" }}
          >
            {/* Header */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-50/80">
                <Sparkles className="h-3 w-3" />
                <span>Secure access</span>
              </div>
              <h1 className="mt-3 text-[22px] font-semibold text-cyan-50">
                Sign in to continue
              </h1>
              <p className="mt-1 text-[12px] text-cyan-100/70">
                Appointments • invoices • warranty — all in one place.
              </p>
            </div>

            {/* Feature strip (adds height + looks premium) */}
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
                <div className="pointer-events-none absolute -inset-28 bg-[radial-gradient(circle_at_30%_20%,rgba(96,220,255,0.18),transparent_55%)]" />
                <div className="relative flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-cyan-50" />
                  <div className="text-[11px] text-cyan-100/80">Appointments</div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
                <div className="pointer-events-none absolute -inset-28 bg-[radial-gradient(circle_at_40%_30%,rgba(255,110,220,0.14),transparent_60%)]" />
                <div className="relative flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-cyan-50" />
                  <div className="text-[11px] text-cyan-100/80">Invoices</div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
                <div className="pointer-events-none absolute -inset-28 bg-[radial-gradient(circle_at_35%_25%,rgba(96,220,255,0.14),transparent_60%)]" />
                <div className="relative flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-cyan-50" />
                  <div className="text-[11px] text-cyan-100/80">Warranty</div>
                </div>
              </div>
            </div>

            {/* Form card */}
            <m.form
              onSubmit={handleLogin}
              className="relative overflow-hidden rounded-[30px] border border-cyan-300/30 bg-black/75 backdrop-blur-[24px] px-5 py-6 shadow-[0_40px_220px_rgba(0,0,0,0.98)] transform-gpu"
              style={{ willChange: "transform, opacity" }}
              aria-label="Login form"
            >
              <div className="pointer-events-none absolute inset-0 rounded-[30px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
              <div className="pointer-events-none absolute -inset-36 bg-[radial-gradient(circle_at_25%_20%,rgba(96,220,255,0.22),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,110,220,0.18),transparent_50%)]" />

              {enableAmbient && (
                <m.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-2"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 18%, rgba(96,220,255,0.22) 32%, transparent 52%)",
                    opacity: 0.26,
                    filter: "blur(3px)",
                    willChange: "transform",
                  }}
                  animate={{ x: ["-60%", "160%"] }}
                  transition={{
                    duration: 3.0,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatDelay: 1.5,
                  }}
                />
              )}

              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-cyan-50/90">
                    Glass Guardian ID
                  </div>
                  <Badge className="border-white/10 bg-white/5 text-cyan-50/80">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    Encrypted
                  </Badge>
                </div>

                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100/60" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="email"
                    autoComplete="email"
                    className={cn(
                      "pl-10 bg-cyan-500/5 border-cyan-300/40 text-cyan-50 placeholder:text-cyan-100/45 rounded-2xl h-11",
                      "text-[16px] sm:text-[13px] leading-normal", // ✅ helps iOS not zoom + looks better
                      "focus-visible:ring-cyan-300/70 focus-visible:ring-offset-0"
                    )}
                  />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100/60" />
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    className={cn(
                      "pl-10 bg-cyan-500/5 border-cyan-300/40 text-cyan-50 placeholder:text-cyan-100/45 rounded-2xl h-11",
                      "text-[16px] sm:text-[13px] leading-normal", // ✅ helps iOS not zoom + consistent
                      "focus-visible:ring-cyan-300/70 focus-visible:ring-offset-0"
                    )}
                  />
                </div>

                <AnimatePresence>
                  {errorMsg && (
                    <m.div
                      key="err"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="rounded-2xl border border-red-400/45 bg-red-500/10 px-3 py-2 text-[11px] text-red-100"
                      role="alert"
                    >
                      {errorMsg}
                    </m.div>
                  )}
                </AnimatePresence>

                <m.div whileTap={reduce ? {} : { scale: 0.985 }}>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="mt-1 w-full rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-100 to-pink-300 text-black font-semibold text-[13px] h-11 hover:from-cyan-200 hover:via-cyan-50 hover:to-pink-200 disabled:opacity-70 shadow-[0_10px_34px_rgba(96,220,255,0.75)]"
                    onPointerDown={() => tinyHaptic()}
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Logging in…</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </m.div>

                {/* Small helper row (adds “height” + polish) */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-cyan-100/65">
                  <span>Secure session after login.</span>
                  {/* Placeholder link (wire later if you want) */}
                  <button
                    type="button"
                    onClick={() => {
                      tinyHaptic();
                      setErrorMsg("Password reset is coming next.");
                    }}
                    className="text-cyan-100/70 hover:text-cyan-50 transition-colors"
                  >
                    Forgot?
                  </button>
                </div>
              </div>
            </m.form>

            {/* Extra bottom card to avoid “short” feel */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="relative overflow-hidden rounded-[26px] border border-cyan-300/20 bg-black/60 backdrop-blur-[18px] px-4 py-4 shadow-[0_24px_150px_rgba(0,0,0,0.96)]">
                <div className="pointer-events-none absolute -inset-36 bg-[radial-gradient(circle_at_25%_20%,rgba(96,220,255,0.16),transparent_50%)]" />
                <div className="relative flex items-start gap-3">
                  <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                    <ShieldCheck className="h-4 w-4 text-cyan-50" />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-cyan-50">
                      Protected access
                    </div>
                    <div className="mt-1 text-[11px] text-cyan-100/75">
                      Your dashboard stays locked until you authenticate.
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[26px] border border-cyan-300/20 bg-black/60 backdrop-blur-[18px] px-4 py-4 shadow-[0_24px_150px_rgba(0,0,0,0.96)]">
                <div className="pointer-events-none absolute -inset-36 bg-[radial-gradient(circle_at_70%_70%,rgba(255,110,220,0.12),transparent_55%)]" />
                <div className="relative flex items-start gap-3">
                  <div className="mt-0.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                    <Sparkles className="h-4 w-4 text-cyan-50" />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-cyan-50">
                      Smooth iOS mode
                    </div>
                    <div className="mt-1 text-[11px] text-cyan-100/75">
                      Effects are deferred for performance on mobile.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spacer to keep it feeling tall */}
            <div className="h-6 sm:h-8" />

            {/* Optional subtle link row */}
            <div className="mt-auto flex items-center justify-center">
              <Link
                href={HOME_ROUTE}
                className="text-[11px] text-cyan-100/60 hover:text-cyan-50 transition-colors"
                onClick={() => tinyHaptic()}
              >
                Back to Home
              </Link>
            </div>
          </m.div>

          {/* Bottom trust strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-cyan-100/65">
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