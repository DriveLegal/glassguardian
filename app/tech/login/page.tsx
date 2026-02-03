// app/tech/login/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LogIn, Mail, Lock, ArrowRight, Info, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";
import { ensureTechProfile } from "@/lib/ensureTechProfile";

export const dynamic = "force-dynamic";

type AnyObj = Record<string, any>;

export default function TechLoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-slate-600">Loading…</div>}>
      <TechLoginInner />
    </Suspense>
  );
}

function TechLoginInner() {
  const router = useRouter();
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const redirect = qp.get("redirect");
  const inviteCodeFromQS = qp.get("code")?.toUpperCase() || null;

  const canSubmit = email.length > 3 && password.length >= 6 && !loading;

  async function maybeConsumeInvite(user: AnyObj) {
    try {
      const code =
        inviteCodeFromQS ||
        (user?.user_metadata && (user.user_metadata as any).tech_invite_code) ||
        null;

      if (!code || !user?.email) return;

      const { data: s } = await supabaseClient.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) return;

      await fetch("/api/admin/tech-invites/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: String(code).toUpperCase(),
          email: String(user.email).toLowerCase(),
        }),
      }).catch(() => {});
    } catch {
      // Non-fatal; ignore silently
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setNotice(null);
    setLoading(true);

    try {
      // Normalize email
      const trimmedEmail = email.trim().toLowerCase();
      setEmail(trimmedEmail);

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error("No user returned from sign in.");

      const meta = (user.user_metadata || {}) as AnyObj;

      // 🔹 Extra safety: must be tagged as technician in metadata
      const role = String(meta.role ?? "").toLowerCase();
if (!["technician", "tech"].includes(role)) {
  await supabaseClient.auth.signOut();
  throw new Error("This sign-in page is for technicians only...");
}

      // 🔹 FIRST: consume invite via API (this should upsert into technicians using service role)
      await maybeConsumeInvite(user);

      // 🔹 THEN: verify technician row exists and is active
      const { data: techRow, error: techError } = await supabaseClient
        .from("technicians")
        .select("id, is_active")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (techError) {
        console.error("Error checking technicians table:", techError);
        await supabaseClient.auth.signOut();
        throw new Error("Unable to verify technician profile. Please contact admin.");
      }

      if (!techRow || techRow.is_active !== true) {
        await supabaseClient.auth.signOut();
        throw new Error(
          "This sign-in page is for technicians only. Please use the customer or admin portal to log in."
        );
      }

      // 🔹 Keep existing profile sync helper
      await ensureTechProfile().catch(() => {});

      // 🔹 Redirect
      if (redirect && redirect.startsWith("/")) {
        router.replace(redirect);
      } else {
        router.replace("/tech/dashboard");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    setErr(null);
    setNotice(null);
    try {
      if (!email) {
        setErr("Enter your email first.");
        return;
      }
      const trimmedEmail = email.trim().toLowerCase();
      setEmail(trimmedEmail);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/update-password`
          : undefined;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo }
      );
      if (error) throw error;
      setNotice("If that email exists, we sent a secure link to reset your password.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send reset email.");
    }
  };

  return (
    <div className="relative min-h-[100dvh] grid place-items-center overflow-hidden bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(59,130,246,0.12),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(16,185,129,0.10),transparent_60%)]">
      <div className="w-full max-w-md px-4">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="group relative"
        >
          {/* Outer frame + glow */}
          <div className="absolute -inset-[1.5px] rounded-[22px] bg-[conic-gradient(from_140deg_at_50%_50%,#60a5fa,transparent_25%,#34d399_50%,transparent_75%,#93c5fd_100%)] opacity-70 blur-[2px] group-hover:opacity-100 transition-opacity" />
          <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl [mask-image:linear-gradient(#000,#000,transparent)]" />

          <div className="relative rounded-[20px] border border-white/30 bg-white/60 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl">
            <div className="rounded-[20px] p-6 sm:p-7 bg-gradient-to-br from-white/70 via-white/55 to-white/30">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Tech sign in
                  </h1>
                  <p className="text-sm text-slate-600">
                    Authorized technicians only
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-emerald-50 text-emerald-700 shadow-inner ring-1 ring-emerald-200/60">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              {/* Invite banner if QS had a ?code= */}
              {inviteCodeFromQS ? (
                <div className="mb-4 rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800 shadow-sm flex gap-2">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Tech ID <strong>{inviteCodeFromQS}</strong> detected. It will be
                    linked to your account on first login.
                  </span>
                </div>
              ) : null}

              {err && (
                <div className="mb-3 rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 shadow-sm">
                  {err}
                </div>
              )}
              {notice && (
                <div className="mb-3 rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800 shadow-sm">
                  {notice}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 shadow-inner"
                      placeholder="tech@example.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      minLength={6}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 shadow-inner"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-[0_12px_24px_rgba(16,185,129,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                      Signing in…
                    </span>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={sendPasswordReset}
                    className="text-emerald-700 hover:underline underline-offset-4"
                  >
                    Forgot password?
                  </button>
                  <Link
                    href={
                      inviteCodeFromQS
                        ? `/tech/signup?code=${encodeURIComponent(inviteCodeFromQS)}`
                        : "/tech/signup"
                    }
                    className="text-slate-700 hover:underline underline-offset-4 inline-flex items-center gap-1"
                  >
                    Create tech account
                    <LogIn className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </form>

              <div className="mt-6 text-sm text-slate-600 flex items-center justify-between">
                <Link href="/" className="hover:underline underline-offset-4">
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')`"
        }}
      />
    </div>
  );
}