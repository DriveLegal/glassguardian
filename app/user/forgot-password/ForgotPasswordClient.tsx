// app/user/forgot-password/ForgotPasswordClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  TriangleAlert,
  UserPlus,
  LogIn,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

/* -------------------------------------------------------
   VISUAL / LCP MIRROR (matches LoginClient.tsx)
------------------------------------------------------- */

const HEAVY_BG_DELAY_DESKTOP_MS = 650;
const HEAVY_BG_DELAY_MOBILE_MS = 2500;

const ENABLE_STARFIELD = false;
const AfterSunsetStarfield = ENABLE_STARFIELD
  ? dynamic(() => import("@/components/home/web/backgrounds/AfterSunsetStarfield"), { ssr: false })
  : null;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

/* -------------------------------------------------------
   Reset helpers
------------------------------------------------------- */

const RESET_REDIRECT_PATH = "/user/reset-password";

// Cooldown defaults:
// - 60s is the common per-user window on recover
// - If user hits rate limit repeatedly, we exponential-backoff up to 1 hour
const COOLDOWN_BASE_SEC = 60;
const COOLDOWN_MAX_SEC = 60 * 60;

const LS_UNTIL = "gg_fp_cooldown_until";
const LS_LEVEL = "gg_fp_backoff_level";
const LS_EMAIL = "gg_fp_last_email";

function isValidEmail(v: string) {
  const s = (v || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function stripTrailingSlash(s: string) {
  return (s || "").replace(/\/+$/, "");
}

/**
 * ✅ IMPORTANT:
 * If you test on preview domains, Supabase may reject the redirect and fall back to Site URL (home).
 * So we prefer NEXT_PUBLIC_SITE_URL if present, else window.origin.
 */
function getAuthRedirectBase(): string {
  const site =
    (process.env.NEXT_PUBLIC_SITE_URL && stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL)) ||
    "";

  const vercel =
    (process.env.NEXT_PUBLIC_VERCEL_URL && `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`) || "";

  try {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? stripTrailingSlash(window.location.origin)
        : "";
    return site || vercel || origin || "https://glassguardianchipandcrackrepair.com";
  } catch {
    return site || vercel || "https://glassguardianchipandcrackrepair.com";
  }
}

function getRedirectTo(): string {
  const base = getAuthRedirectBase();
  return `${base}${RESET_REDIRECT_PATH}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatCountdown(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return `${mm}:${ss}`;
}

function readCooldownUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(LS_UNTIL) || "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function writeCooldownUntil(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_UNTIL, String(ts));
}

function readBackoffLevel(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(LS_LEVEL) || "0";
  const n = Number(raw);
  return Number.isFinite(n) ? clamp(n, 0, 10) : 0;
}

function writeBackoffLevel(level: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_LEVEL, String(clamp(level, 0, 10)));
}

function setLastEmail(v: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_EMAIL, v || "");
}

function getLastEmail(): string {
  if (typeof window === "undefined") return "";
  return (window.localStorage.getItem(LS_EMAIL) || "").trim();
}

export default function ForgotPasswordClient() {
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [enhanced, setEnhanced] = React.useState(false);
  const [bgOn, setBgOn] = React.useState(false);

  // Cooldown
  const [cooldownUntil, setCooldownUntil] = React.useState<number>(0);
  const [cooldownLeft, setCooldownLeft] = React.useState<number>(0);

  React.useEffect(() => {
    const prefill = (qp.get("email") || "").trim();
    const last = getLastEmail();
    if (prefill) setEmail(prefill);
    else if (last) setEmail(last);

    // restore cooldown
    const until = readCooldownUntil();
    setCooldownUntil(until);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const mobile = isMobileViewport();
    const t = window.setTimeout(() => setEnhanced(true), mobile ? 900 : 420);
    return () => window.clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!ENABLE_STARFIELD) return;
    const mobile = isMobileViewport();
    const delay = mobile ? HEAVY_BG_DELAY_MOBILE_MS : HEAVY_BG_DELAY_DESKTOP_MS;
    const t = window.setTimeout(() => setBgOn(true), delay);
    return () => window.clearTimeout(t);
  }, []);

  // Tick countdown
  React.useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const left = Math.ceil((cooldownUntil - now) / 1000);
      setCooldownLeft(left > 0 ? left : 0);
      if (left <= 0 && cooldownUntil !== 0) {
        // clear persisted cooldown when done
        writeCooldownUntil(0);
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const startCooldown = React.useCallback((seconds: number) => {
    const sec = clamp(Math.floor(seconds), 1, COOLDOWN_MAX_SEC);
    const until = Date.now() + sec * 1000;
    setCooldownUntil(until);
    writeCooldownUntil(until);
  }, []);

  const cardInitial = prefersReducedMotion
    ? false
    : isMobileViewport()
      ? { opacity: 0 }
      : { opacity: 0, y: 18, scale: 0.98 };

  const cardAnimate = prefersReducedMotion
    ? {}
    : isMobileViewport()
      ? { opacity: 1 }
      : { opacity: 1, y: 0, scale: 1 };

  const canSubmit = email.trim().length > 3 && !loading && cooldownLeft === 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (cooldownLeft > 0) return;

    setErr(null);
    setNotice(null);

    const v = email.trim().toLowerCase();
    setEmail(v);
    setLastEmail(v);

    if (!isValidEmail(v)) {
      setErr("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = getRedirectTo(); // ✅ will go to /user/reset-password

      const { error } = await supabaseClient.auth.resetPasswordForEmail(v, {
        redirectTo,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const code = (error as any)?.code || "";

        // True invalid email formatting
        if (msg.includes("email") && msg.includes("invalid")) {
          setErr("That email address doesn’t look valid.");
          setLoading(false);
          return;
        }

        // Rate limit: show countdown + exponential backoff
        if (code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
          const prevLevel = readBackoffLevel();
          const nextLevel = clamp(prevLevel + 1, 0, 10);
          writeBackoffLevel(nextLevel);

          // 60s, 120s, 240s, ... up to 1 hour
          const seconds = clamp(
            COOLDOWN_BASE_SEC * Math.pow(2, Math.max(0, nextLevel - 1)),
            COOLDOWN_BASE_SEC,
            COOLDOWN_MAX_SEC
          );
          startCooldown(seconds);

          setNotice(
            `If an account exists for ${v}, we’ll email a reset link. You’ve hit a send limit — try again after the timer.`
          );
          setLoading(false);
          return;
        }

        // Generic (non-enumerating)
        setNotice(
          `If an account exists for ${v}, we sent a password reset link. Check spam/junk too.`
        );
        // Still cooldown to prevent spam-click
        writeBackoffLevel(0);
        startCooldown(COOLDOWN_BASE_SEC);
      } else {
        // Success: reset backoff and apply standard cooldown
        writeBackoffLevel(0);
        startCooldown(COOLDOWN_BASE_SEC);

        setNotice(
          `If an account exists for ${v}, we sent a password reset link. Check spam/junk too.`
        );
      }
    } catch {
      // Generic success + cooldown
      writeBackoffLevel(0);
      startCooldown(COOLDOWN_BASE_SEC);
      setNotice(
        `If an account exists for ${email.trim().toLowerCase()}, we sent a password reset link. Check spam/junk too.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] grid place-items-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(16,185,129,0.14),transparent_60%),linear-gradient(to_bottom,rgba(2,6,23,1),rgba(2,6,23,0.96),rgba(2,6,23,1))]" />

      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(60%_60%_at_50%_40%,#000,transparent_80%)]">
        <div
          className={
            enhanced
              ? "absolute -top-24 -left-24 w-[38rem] h-[38rem] rounded-full blur-3xl bg-blue-300/20"
              : "absolute -top-24 -left-24 w-[38rem] h-[38rem] rounded-full blur-2xl bg-blue-300/16"
          }
        />
        <div
          className={
            enhanced
              ? "absolute -bottom-24 -right-16 w-[34rem] h-[34rem] rounded-full blur-3xl bg-emerald-300/20"
              : "absolute -bottom-24 -right-16 w-[34rem] h-[34rem] rounded-full blur-2xl bg-emerald-300/16"
          }
        />
      </div>

      {ENABLE_STARFIELD && bgOn && AfterSunsetStarfield ? (
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <AfterSunsetStarfield />
        </div>
      ) : null}

      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={cardInitial as any}
          animate={cardAnimate as any}
          transition={{ duration: isMobileViewport() ? 0.28 : 0.45, ease: "easeOut" }}
          className="group relative"
        >
          <div
            className={
              enhanced
                ? "absolute -inset-[1.5px] rounded-[22px] bg-[conic-gradient(from_130deg_at_50%_50%,#60a5fa,transparent_25%,#34d399_50%,transparent_75%,#93c5fd_100%)] opacity-70 blur-[2px] group-hover:opacity-100 transition-opacity"
                : "absolute -inset-[1.5px] rounded-[22px] bg-[conic-gradient(from_130deg_at_50%_50%,#60a5fa,transparent_25%,#34d399_50%,transparent_75%,#93c5fd_100%)] opacity-60"
            }
          />

          <div
            className={
              enhanced
                ? "absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white/18 to-white/6 backdrop-blur-xl"
                : "absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white/14 to-white/6"
            }
          />

          <motion.div
            whileHover={prefersReducedMotion || isMobileViewport() ? {} : { rotateX: 0.5, rotateY: -0.5, y: -2 }}
            className={
              enhanced
                ? "relative rounded-[20px] border border-white/18 bg-white/12 shadow-[0_10px_30px_rgba(2,6,23,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
                : "relative rounded-[20px] border border-white/16 bg-white/10 shadow-[0_10px_24px_rgba(2,6,23,0.22),inset_0_1px_0_rgba(255,255,255,0.10)]"
            }
          >
            <div className="rounded-[20px] p-6 sm:p-7 bg-gradient-to-br from-white/16 via-white/10 to-white/6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-white">
                    Reset password
                  </h1>
                  <p className="text-sm text-white/70">We’ll email you a secure reset link</p>
                </div>
                <div className="rounded-xl p-2 bg-white/10 text-white shadow-inner ring-1 ring-white/15">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              {err && (
                <div className="mb-3 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-100 shadow-sm flex items-start gap-2">
                  <TriangleAlert className="w-4 h-4 mt-0.5 text-red-200" />
                  <span>{err}</span>
                </div>
              )}

              {notice && (
                <div className="mb-3 rounded-lg border border-emerald-300/30 bg-emerald-500/12 px-3 py-2 text-sm text-emerald-100 shadow-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-200" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Cooldown banner */}
              {cooldownLeft > 0 && !loading && (
                <div className="mb-3 rounded-lg border border-amber-300/30 bg-amber-500/12 px-3 py-2 text-sm text-amber-100 shadow-sm flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 text-amber-200" />
                  <span>
                    Please wait{" "}
                    <span className="font-semibold">{formatCountdown(cooldownLeft)}</span>{" "}
                    before sending again.
                  </span>
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-white/10 pl-9 pr-3 py-2.5 text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/60 shadow-inner"
                      placeholder="you@example.com"
                      autoComplete="email"
                      inputMode="email"
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-[0_12px_24px_rgba(37,99,235,0.28)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                      Sending…
                    </span>
                  ) : cooldownLeft > 0 ? (
                    <>
                      Try again in {formatCountdown(cooldownLeft)}
                      <Clock className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-sm text-white/70 flex items-center justify-between">
                <Link
                  href="/user/login"
                  className="inline-flex items-center gap-2 text-blue-200 hover:text-blue-100 underline underline-offset-4"
                >
                  <LogIn className="w-4 h-4" />
                  Back to sign in
                </Link>

                <Link
                  href="/user/signup"
                  className="inline-flex items-center gap-2 text-blue-200 hover:text-blue-100 underline underline-offset-4"
                >
                  <UserPlus className="w-4 h-4" />
                  Create account
                </Link>
              </div>

              <div className="mt-4 text-xs text-white/55">
                Reset links expire quickly for security. If you don’t see it, check spam/junk.
              </div>
            </div>
          </motion.div>
        </motion.div>

        <p className="text-center text-xs text-white/55 mt-4">
          By continuing you agree to our{" "}
          <Link href="/legal/terms" className="underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')",
        }}
      />

      <style jsx>{`
        :global(canvas),
        :global(img),
        :global(svg) {
          image-rendering: -webkit-optimize-contrast;
        }
      `}</style>
    </div>
  );
}