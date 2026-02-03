// app/tech/signup/page.tsx
"use client";

import * as React from "react";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { UserPlus, Mail, Lock, Phone, MapPin, ArrowRight, Hash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function TechSignupPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-slate-600">Loading…</div>}>
      <TechSignupInner />
    </Suspense>
  );
}

function TechSignupInner() {
  const router = useRouter();
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [serviceArea, setServiceArea] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [techIdCode, setTechIdCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // 🔹 Optional redirect (not used now, but kept if you ever want it)
  const redirect = qp.get("redirect");

  // 🔹 Prefill email/code from invite link
  useEffect(() => {
    const qEmail = qp.get("email");
    const qCode = qp.get("code");
    if (qEmail && !email) setEmail(qEmail);
    if (qCode && !techIdCode) setTechIdCode(qCode.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp]);

  const canSubmit =
    fullName.trim().length > 1 &&
    email.trim().length > 3 &&
    password.length >= 6 &&
    password === passwordConfirm &&
    techIdCode.trim().length > 0 &&
    !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (password !== passwordConfirm) {
      setErr("Passwords do not match.");
      return;
    }

    setErr(null);
    setNotice(null);
    setLoading(true);

    try {
      // 1) Validate invite in DB (anon read allowed by policy/RLS)
      const code = techIdCode.toUpperCase();
      const nowIso = new Date().toISOString();

      const { data: invites, error: invErr } = await supabaseClient
        .from("tech_invites")
        .select("id, code, email, expires_at, used_at")
        .eq("code", code)
        .eq("email", email.toLowerCase())
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .limit(1);

      if (invErr) throw invErr;
      if (!invites || invites.length === 0) {
        throw new Error("Invalid or expired Tech ID for this email.");
      }

      // 2) Proceed with sign up (attach code to user_metadata)
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "technician", // ← tag auth user as technician
            full_name: fullName,
            phone,
            service_area: serviceArea,
            tech_invite_code: code,
          },
          // No emailRedirectTo here; Supabase will use project defaults if email confirmation is on
        },
      });
      if (error) throw error;

      // ✅ We no longer try to consume the invite here.
      //    It will be consumed on first login by /tech/login (maybeConsumeInvite).

      // ✅ After successful signup, always send tech back to tech login
      //    (They can simply log in from there.)
      router.replace("/tech/login");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create account.");
    } finally {
      setLoading(false);
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
          <div className="absolute -inset-[1.5px] rounded-[22px] bg-[conic-gradient(from_130deg_at_50%_50%,#60a5fa,transparent_25%,#34d399_50%,transparent_75%,#93c5fd_100%)] opacity-70 blur-[2px] group-hover:opacity-100 transition-opacity" />
          <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl [mask-image:linear-gradient(#000,#000,transparent)]" />

          <div className="relative rounded-[20px] border border-white/30 bg-white/60 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl">
            <div className="rounded-[20px] p-6 sm:p-7 bg-gradient-to-br from-white/70 via-white/55 to-white/30">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Tech Sign up
                  </h1>
                  <p className="text-sm text-slate-600">
                    Create your technician account
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-emerald-50 text-emerald-700 shadow-inner ring-1 ring-emerald-200/60">
                  <UserPlus className="w-5 h-5" />
                </div>
              </div>

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
                {/* Full name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/85 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 shadow-inner"
                    placeholder="Alex Tech"
                    required
                  />
                </div>

                {/* Email */}
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

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 shadow-inner"
                      placeholder="(555) 555-5555"
                    />
                  </div>
                </div>

                {/* Service area */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Service area (optional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={serviceArea}
                      onChange={(e) => setServiceArea(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 shadow-inner"
                      placeholder="Los Angeles, CA"
                    />
                  </div>
                </div>

                {/* Tech ID Code (required) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tech ID Code
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={techIdCode}
                      onChange={(e) => setTechIdCode(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 shadow-inner tracking-widest"
                      placeholder="GG-123456"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter the code provided by your admin (must match your email).
                  </p>
                </div>

                {/* Password */}
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

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={passwordConfirm}
                      minLength={6}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 shadow-inner"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Make sure this matches your password above.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-[0_12px_24px_rgba(16,185,129,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                      Creating…
                    </span>
                  ) : (
                    <>
                      Create tech account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-slate-600">
                  By signing up you agree to our{" "}
                  <Link className="underline underline-offset-2" href="/legal/terms">
                    Terms
                  </Link>{" "}
                  &{" "}
                  <Link className="underline underline-offset-2" href="/legal/privacy">
                    Privacy Policy
                  </Link>.
                </p>
              </form>

              <div className="mt-6 text-sm text-slate-600 flex items-center justify-between">
                <Link href="/tech/login" className="hover:underline underline-offset-4">
                  Already have an account? Sign in
                </Link>
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
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')",
        }}
      />
    </div>
  );
}