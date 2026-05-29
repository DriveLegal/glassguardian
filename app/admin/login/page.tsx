// app/admin/login/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Shield,
  Mail,
  Lock,
  KeyRound,
  ArrowRight,
  Sparkles,
  ChevronLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

// Disable static generation for login to keep auth + search params happy
export const dynamic = "force-dynamic";

type AdminRow = {
  role: string | null;
  is_active: boolean | null;
};

async function isAdmin(email: string): Promise<boolean> {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();

  const { data, error } = await supabaseClient
    .from("admins")
    .select("role, is_active")
    .eq("email", normalized) // CITEXT → case-insensitive
    .maybeSingle<AdminRow>();

  if (error) return false;

  const role = data?.role ?? "";
  const active = data?.is_active === true;

  return !!data && active && (role === "admin" || role === "support");
}

function AmbientOrb({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      initial={{ opacity: 0.5, scale: 0.96 }}
      animate={{
        opacity: [0.42, 0.65, 0.42],
        scale: [0.96, 1.05, 0.98],
        x: [0, 12, -8, 0],
        y: [0, -10, 8, 0],
      }}
      transition={{
        duration: 11,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

function AdminLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  // Sanitize redirect: allow only internal paths and never /admin/login
  const redirectRaw = params?.get("redirect") || "/admin/portal";
  const isSafeInternal = (p: string) => p.startsWith("/") && !p.startsWith("//");
  const redirect =
    isSafeInternal(redirectRaw) && redirectRaw !== "/admin/login"
      ? redirectRaw
      : "/admin/portal";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const canSubmit = email.length > 3 && password.length >= 6 && !loading;

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setNotice(null);
    setLoading(true);

    try {
      // Normalize email (trim + lowercase) just like user/tech routes
      const trimmedEmail = email.trim().toLowerCase();
      setEmail(trimmedEmail);

      // Normal email+password sign-in
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;

      // Verify against admins table
      const sessionRes = await supabaseClient.auth.getSession();
      const sessionEmail =
        sessionRes.data.session?.user?.email?.toLowerCase() ?? trimmedEmail;

      const allowed = await isAdmin(sessionEmail);
      if (!allowed) {
        await supabaseClient.auth.signOut();
        throw new Error("This account is not authorized for admin access.");
      }

      router.replace(redirect);
    } catch (e: any) {
      setErr(e?.message ?? "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordSetup = async () => {
    setErr(null);
    setNotice(null);

    try {
      if (!email) {
        setErr("Enter your admin email first.");
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

      setNotice("We sent you a secure link to set/reset your password.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send password setup email.");
    }
  };

  return (
    <div className="relative isolate min-h-[100dvh] overflow-hidden bg-[#060913] text-white">
      {/* Cinematic background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_650px_at_12%_-10%,rgba(76,104,255,0.28),transparent_58%),radial-gradient(980px_560px_at_110%_5%,rgba(56,189,248,0.16),transparent_58%),radial-gradient(800px_520px_at_50%_120%,rgba(91,33,182,0.18),transparent_60%),linear-gradient(180deg,#05070d_0%,#0a1020_45%,#070b16_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_46%,rgba(0,0,0,0.22)_100%)]" />

        <AmbientOrb className="absolute left-[-8%] top-[8%] h-[20rem] w-[20rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <AmbientOrb
          className="absolute right-[-6%] top-[16%] h-[18rem] w-[18rem] rounded-full bg-sky-400/14 blur-3xl"
          delay={0.8}
        />
        <AmbientOrb
          className="absolute bottom-[-8%] left-[24%] h-[16rem] w-[16rem] rounded-full bg-fuchsia-500/10 blur-3xl"
          delay={1.4}
        />

        <div className="absolute left-0 right-0 top-[12%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute left-0 right-0 bottom-[14%] h-px bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />
      </div>

      {/* top chrome */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-5 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium tracking-[0.18em] text-cyan-100 uppercase shadow-[0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5" />
          Admin access
        </div>
      </div>

      <div className="relative z-10 grid min-h-[calc(100dvh-68px)] place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1100px]">
          <div className="grid items-stretch gap-6 lg:grid-cols-[1.04fr_0.96fr]">
            {/* Left brand panel */}
            <motion.div
              initial={
                prefersReducedMotion ? false : { opacity: 0, x: -28, y: 12 }
              }
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative hidden overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] p-7 shadow-[0_25px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl lg:block"
            >
              <div className="absolute inset-0 bg-[radial-gradient(500px_220px_at_8%_6%,rgba(255,255,255,0.12),transparent_65%),radial-gradient(540px_260px_at_100%_0%,rgba(96,165,250,0.14),transparent_58%)]" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/12 to-transparent" />

              <div className="relative flex h-full flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                    <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/18 via-indigo-300/12 to-white/8 shadow-[0_10px_30px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.2)]">
                      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),transparent_42%)]" />
                      <Shield className="relative z-10 h-6 w-6 text-cyan-100 drop-shadow-[0_2px_10px_rgba(103,232,249,0.35)]" />
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                        Secure portal
                      </div>
                      <div className="text-sm text-white/70">
                        Restricted operational access
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 space-y-5">
                    <div className="space-y-3">
                      <h1 className="max-w-[13ch] text-4xl font-black leading-[0.94] tracking-[-0.04em] text-white xl:text-[3.4rem]">
                        Elite admin control surface
                      </h1>
                      <p className="max-w-xl text-sm leading-7 text-white/68 xl:text-base">
                        Sign in to manage invoices, scheduling, customer flows,
                        portal activity, and protected admin operations in one
                        clean secure workspace.
                      </p>
                    </div>

                    <div className="grid gap-3 pt-3">
                      {[
                        "Verified against your admins table",
                        "Case-normalized sign-in and protected redirect handling",
                        "Quick password setup/reset for authorized staff",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-sm text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        >
                          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.8)]" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-3 gap-3">
                  {[
                    { k: "Protected", v: "Admin only" },
                    { k: "Access", v: "Secure auth" },
                    { k: "Experience", v: "Production UI" },
                  ].map((stat) => (
                    <div
                      key={stat.k}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]"
                    >
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                        {stat.k}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/88">
                        {stat.v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right login card */}
            <motion.div
              initial={
                prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.985 }
              }
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
              className="group relative"
            >
              <div className="absolute -inset-[1.5px] rounded-[32px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(34,211,238,0.95),rgba(129,140,248,0.55),rgba(168,85,247,0.5),rgba(34,211,238,0.95))] opacity-60 blur-md transition duration-500 group-hover:opacity-90" />
              <div className="absolute -inset-[0.5px] rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))]" />

              <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(11,18,32,0.88),rgba(8,13,24,0.84))] shadow-[0_30px_100px_rgba(0,0,0,0.5),0_10px_30px_rgba(14,165,233,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(540px_220px_at_15%_0%,rgba(255,255,255,0.12),transparent_55%),radial-gradient(460px_240px_at_100%_0%,rgba(59,130,246,0.16),transparent_55%),linear-gradient(180deg,transparent,rgba(255,255,255,0.02))]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                <div className="absolute inset-x-10 top-[92px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="relative p-5 sm:p-7 md:p-8">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Secure admin sign in
                      </div>

                      <div>
                        <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-[2rem]">
                          Welcome back
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-white/62">
                          Restricted access for authorized admin and support
                          staff only.
                        </p>
                      </div>
                    </div>

                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl bg-cyan-300/20 blur-xl" />
                      <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] shadow-[0_16px_44px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.18)]">
                        <Shield className="h-6 w-6 text-cyan-100 drop-shadow-[0_4px_16px_rgba(103,232,249,0.35)]" />
                      </div>
                    </div>
                  </div>

                  {err && (
                    <div
                      className="mb-4 rounded-2xl border border-red-400/18 bg-[linear-gradient(180deg,rgba(127,29,29,0.42),rgba(69,10,10,0.3))] px-4 py-3 text-sm text-red-100 shadow-[0_10px_30px_rgba(127,29,29,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]"
                      aria-live="polite"
                    >
                      <div className="font-medium">Access error</div>
                      <div className="mt-0.5 text-red-100/85">{err}</div>
                    </div>
                  )}

                  {notice && (
                    <div
                      className="mb-4 rounded-2xl border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(6,78,59,0.42),rgba(2,44,34,0.3))] px-4 py-3 text-sm text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]"
                      aria-live="polite"
                    >
                      <div className="font-medium">Email sent</div>
                      <div className="mt-0.5 text-emerald-100/85">{notice}</div>
                    </div>
                  )}

                  <form onSubmit={signIn} className="space-y-5">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-white/78">
                        Admin email
                      </label>

                      <div className="group/input relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center">
                          <Mail className="h-4.5 w-4.5 text-white/38 transition-colors group-focus-within/input:text-cyan-200" />
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          inputMode="email"
                          className="h-14 w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] pl-12 pr-4 text-[15px] text-white shadow-[0_10px_28px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] outline-none placeholder:text-white/28 focus:border-cyan-300/35 focus:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] focus:ring-2 focus:ring-cyan-300/20"
                          placeholder="you@company.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-white/78">
                        Password
                      </label>

                      <div className="group/input relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center">
                          <Lock className="h-4.5 w-4.5 text-white/38 transition-colors group-focus-within/input:text-cyan-200" />
                        </div>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          className="h-14 w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] pl-12 pr-4 text-[15px] text-white shadow-[0_10px_28px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] outline-none placeholder:text-white/28 focus:border-cyan-300/35 focus:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] focus:ring-2 focus:ring-cyan-300/20"
                          placeholder="••••••••"
                          minLength={6}
                          required
                        />
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                          type="button"
                          onClick={sendPasswordSetup}
                          disabled={loading}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 text-white shadow-[0_10px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:bg-white/12"
                        >
                          <KeyRound className="h-4 w-4" />
                          Set / reset password
                        </Button>

                        <Button
                          type="submit"
                          disabled={!canSubmit}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(14,165,233,0.95),rgba(79,70,229,0.96))] px-5 text-white shadow-[0_18px_44px_rgba(14,165,233,0.22),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:brightness-110"
                        >
                          {loading ? "Signing in…" : "Sign in"}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </form>

                  <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/8 pt-5 text-sm">
                    <Link
                      href="/"
                      className="text-white/62 transition hover:text-white hover:underline underline-offset-4"
                    >
                      Return to website
                    </Link>

                    <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/38">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.7)]" />
                      Admin only
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-soft-light"
        aria-hidden="true"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.82%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.4%22/></svg>')",
        }}
      />
    </div>
  );
}

export default function AdminLoginPage() {
  // Wrap inner component with Suspense to satisfy Next.js CSR bailout rule for useSearchParams()
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[100dvh] place-items-center bg-[#070b14] text-white/70">
          Loading login…
        </div>
      }
    >
      <AdminLoginInner />
    </Suspense>
  );
}