// app/partner/login/PartnerLoginClient.tsx  (Client Component)
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

/** tiny helper */
const cls = (...x: (string | false | null | undefined)[]) => x.filter(Boolean).join(" ");

export default function PartnerLoginClient() {
  const router = useRouter();
  const qp = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Optional redirect (?redirect=/partner/claims)
  const rawRedirect = qp.get("redirect");
  const redirect = rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : "/partner/claims";

  /** After sign-in, verify this email is authorized in insurance_partners */
  const verifyAndRoute = React.useCallback(
    async (signedInEmail: string | null | undefined) => {
      if (!signedInEmail) {
        throw new Error("No email on session.");
      }

      const { data, error } = await supabaseClient
        .from("insurance_partners")
        .select("id, company_name")
        .eq("portal_access_email", signedInEmail)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // not authorized — sign out and tell them
        await supabaseClient.auth.signOut();
        throw new Error(
          "This account is not authorized for the partner portal. Please contact your Glass Guardian rep."
        );
      }

      // ok — route to claims (or a provided redirect)
      router.replace(redirect);
    },
    [redirect, router]
  );

  /** Submit handler */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      await verifyAndRoute(data.user?.email);
    } catch (e: any) {
      setErr(e?.message ?? "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  /** Reset password via Supabase */
  const onResetPassword = async () => {
    setErr(null);
    setNotice(null);
    setLoading(true);
    try {
      if (!email) throw new Error("Enter your email to receive a reset link.");
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/partner/login` : undefined,
      });
      if (error) throw error;
      setNotice("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      setErr(e?.message ?? "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* 3D shell */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={cls(
            "relative rounded-3xl p-[1px]",
            "shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]",
            "bg-[linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0)_35%,rgba(59,130,246,0.25)_100%)]"
          )}
        >
          <div
            className={cls(
              "rounded-3xl bg-white/95 backdrop-blur-xl p-6",
              "border border-white/40",
              "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3),0_10px_30px_-10px_rgba(2,6,23,0.3)]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  Partner sign in
                </h1>
                <p className="text-sm text-slate-600">
                  Insurance adjusters & partners only
                </p>
              </div>
              <div className="rounded-xl p-2 bg-blue-50 text-blue-700 shadow-inner">
                <Shield className="w-5 h-5" />
              </div>
            </div>

            {/* Alerts */}
            {err && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
            {notice && (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cls(
                      "w-full rounded-xl border bg-white/90 pl-9 pr-3 py-2 text-slate-900 outline-none",
                      "border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                      "shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)]"
                    )}
                    placeholder="adjuster@carrier.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cls(
                      "w-full rounded-xl border bg-white/90 pl-9 pr-10 py-2 text-slate-900 outline-none",
                      "border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                      "shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)]"
                    )}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className={cls(
                  "w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
                  "rounded-xl shadow-[0_12px_28px_-10px_rgba(37,99,235,.55)]"
                )}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Footer row */}
            <div className="mt-5 flex items-center justify-between text-sm">
              <button
                onClick={onResetPassword}
                disabled={loading}
                className="text-blue-700 hover:text-blue-800 underline underline-offset-4 disabled:opacity-50"
              >
                Forgot password?
              </button>

              <Link href="/" className="text-slate-600 hover:underline underline-offset-4">
                Back to home
              </Link>
            </div>
          </div>

          {/* subtle corner light */}
          <div className="pointer-events-none absolute -inset-px rounded-3xl [mask-image:radial-gradient(60%_60%_at_100%_0%,black,transparent)] bg-gradient-to-br from-white/70 via-transparent to-transparent" />
        </motion.div>

        {/* Tiny legal note */}
        <p className="text-center text-xs text-white/70 mt-4">
          By continuing you agree to our{" "}
          <Link href="/legal/terms" className="underline underline-offset-2">Terms</Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}