// app/admin/login/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, Mail, Lock, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

// Disable static generation for login to keep auth + search params happy
export const dynamic = "force-dynamic";

type AdminRow = { role: string | null; is_active: boolean | null };

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

  return (
    !!data &&
    active &&
    (role === "admin" || role === "support")
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
    <div className="relative min-h-[100dvh] grid place-items-center overflow-hidden bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(99,102,241,0.12),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(59,130,246,0.10),transparent_60%)]">
      <div className="w-full max-w-md px-4">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="group relative"
        >
          <div className="absolute -inset-[1.5px] rounded-[22px] bg-[conic-gradient(from_150deg_at_50%_50%,#818cf8,transparent_25%,#60a5fa_50%,transparent_75%,#93c5fd_100%)] opacity-70 blur-[2px] group-hover:opacity-100 transition-opacity" />
          <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl [mask-image:linear-gradient(#000,#000,transparent)]" />

          <div className="relative rounded-[20px] border border-white/30 bg-white/60 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl">
            <div className="rounded-[20px] p-6 sm:p-7 bg-gradient-to-br from-white/70 via-white/55 to-white/30">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Admin sign in
                  </h1>
                  <p className="text-sm text-slate-600">
                    Restricted access — authorized admin only
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-indigo-50 text-indigo-700 shadow-inner ring-1 ring-indigo-200/60">
                  <Shield className="w-5 h-5" />
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

              <form onSubmit={signIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Admin email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/70 shadow-inner"
                      placeholder="you@company.com"
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
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/70 shadow-inner"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    onClick={sendPasswordSetup}
                    className="inline-flex items-center gap-2 h-10 bg-white text-indigo-700 ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    Set / reset password
                  </Button>

                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-2 h-10 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                  >
                    {loading ? "Signing in…" : "Sign in"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-sm text-slate-600 flex items-center justify-between">
                <Link href="/" className="hover:underline underline-offset-4">
                  Back to home
                </Link>
                <span className="text-xs text-slate-500">Admin only</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
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

export default function AdminLoginPage() {
  // Wrap inner component with Suspense to satisfy Next.js CSR bailout rule for useSearchParams()
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] grid place-items-center text-slate-600">
          Loading login…
        </div>
      }
    >
      <AdminLoginInner />
    </Suspense>
  );
}