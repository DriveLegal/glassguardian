// app/user/reset-password/ResetPasswordClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle2,
  TriangleAlert,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  LogIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

/* -------------------------------------------------------
   VISUAL / LCP MIRROR
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

function safeRedirect(path: string) {
  try {
    window.location.assign(path);
  } catch {
    window.location.href = path;
  }
}

/* -------------------------------------------------------
   Hash + Query Helpers
------------------------------------------------------- */

function readMultiHashParams() {
  if (typeof window === "undefined") {
    return {
      access_token: "",
      refresh_token: "",
      type: "",
      error: "",
      error_description: "",
    };
  }

  const rawHash = (window.location.hash || "").replace(/^#/, "");
  const segs = rawHash ? rawHash.split("#") : [];
  const buckets: URLSearchParams[] = [];

  for (const seg of segs) {
    if (seg) buckets.push(new URLSearchParams(seg));
  }

  const getFirst = (k: string) => {
    for (const b of buckets) {
      const v = (b.get(k) || "").trim();
      if (v) return v;
    }
    return "";
  };

  return {
    access_token: getFirst("access_token"),
    refresh_token: getFirst("refresh_token"),
    type: getFirst("type"),
    error: getFirst("error"),
    error_description: getFirst("error_description"),
  };
}

function clearUrlHash() {
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

function clearAuthQueryParams() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

export default function ResetPasswordClient() {
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [enhanced, setEnhanced] = React.useState(false);
  const [bgOn, setBgOn] = React.useState(false);

  const [ready, setReady] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const [showPass, setShowPass] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  /* -------------------------------------------------------
     Visual Enhancement Delay
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Bootstrap Recovery
  ------------------------------------------------------- */

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setErr(null);
        setNotice(null);
        setReady(false);

        const qErr = (qp.get("error") || "").trim();
        const qErrDesc = (qp.get("error_description") || "").trim();

        if (qErr) {
          if (!mounted) return;
          setErr(qErrDesc || qErr);
          return;
        }

        const code = (qp.get("code") || "").trim();
        if (code) {
          const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (error) {
            if (!mounted) return;
            setErr("This reset link is invalid or expired.");
            return;
          }

          clearAuthQueryParams();
          if (!mounted) return;

          setReady(true);
          setNotice("Recovery verified. Set your new password.");
          return;
        }

        const hp = readMultiHashParams();
        if (hp.access_token && hp.refresh_token) {
          await supabaseClient.auth.setSession({
            access_token: hp.access_token,
            refresh_token: hp.refresh_token,
          });

          clearUrlHash();

          if (!mounted) return;
          setReady(true);
          setNotice("Recovery verified. Set your new password.");
          return;
        }

        const { data } = await supabaseClient.auth.getSession();
        if (data?.session) {
          if (!mounted) return;
          setReady(true);
          return;
        }

        if (!mounted) return;
        setErr("This reset link is missing or expired.");
      } catch {
        if (!mounted) return;
        setErr("Something went wrong verifying your reset link.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [qp]);

  /* -------------------------------------------------------
     Form Logic
  ------------------------------------------------------- */

  const canSubmit =
    ready &&
    password.length >= 6 &&
    confirm.length >= 6 &&
    password === confirm &&
    !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErr(null);
    setNotice(null);

    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setNotice("Password updated successfully.");

      await supabaseClient.auth.signOut().catch(() => {});
    } catch (e: any) {
      setErr(e?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="relative min-h-[100dvh] grid place-items-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(16,185,129,0.14),transparent_60%),linear-gradient(to_bottom,rgba(2,6,23,1),rgba(2,6,23,0.96),rgba(2,6,23,1))]" />

      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={cardInitial as any}
          animate={cardAnimate as any}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl p-6 shadow-[0_15px_40px_rgba(0,0,0,0.4)]"
        >
          <h1 className="text-2xl font-bold text-white mb-2">
            Set a new password
          </h1>
          <p className="text-sm text-white/70 mb-4">
            Secure recovery • update your password
          </p>

          {err && (
            <div className="mb-3 text-sm text-red-200 bg-red-500/15 border border-red-400/30 px-3 py-2 rounded-lg">
              {err}
            </div>
          )}

          {notice && (
            <div className="mb-3 text-sm text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 px-3 py-2 rounded-lg">
              {notice}
            </div>
          )}

          {success ? (
            <Button
              className="w-full mt-2"
              onClick={() => safeRedirect("/user/login")}
            >
              Sign in
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-white"
                />
              </div>

              <div>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-white"
                />
              </div>

              <Button type="submit" disabled={!canSubmit} className="w-full">
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}