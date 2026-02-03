// app/tech/forgot/ForgotTechClient.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, ArrowLeft, ArrowRight, Shield, Info } from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotTechClient() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setErr("Please enter your technician email.");
      return;
    }

    setLoading(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      // 🔹 Tech reset link will land on /tech/reset (your tech reset page)
      const redirectTo = origin
        ? `${origin}/tech/reset`
        : undefined;

      const { error } = await supabaseClient.auth.resetPasswordForEmail(
        trimmed,
        {
          redirectTo,
        }
      );

      if (error) throw error;

      setNotice(
        "If this email is registered as a technician, we sent a reset link. Check your inbox (and spam)."
      );
    } catch (e: any) {
      setErr(
        e?.message ||
          "We couldn't send the reset link. Please double-check your email and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-slate-900 via-slate-950 to-sky-900 px-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-2xl border border-slate-800/70 bg-slate-900/80 backdrop-blur-xl p-6 shadow-[0_24px_80px_rgba(15,23,42,0.8)]"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
                Reset tech password
              </h1>
              <p className="text-sm text-slate-400">
                Enter the email you use to sign into the tech portal.
              </p>
            </div>
            <div className="rounded-xl p-2 bg-sky-500/10 text-sky-300 shadow-inner ring-1 ring-sky-500/50">
              <Shield className="w-5 h-5" />
            </div>
          </div>

          {err && (
            <div className="mb-3 flex gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {notice && (
            <div className="mb-3 flex gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-100 mb-1">
                Technician email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tech@example.com"
                  className="pl-9 bg-slate-900/80 border-slate-700 text-slate-50 placeholder:text-slate-500"
                  autoComplete="email"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                We’ll email you a secure link to update your password.
              </p>
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 mr-2 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                  Sending link…
                </>
              ) : (
                <>
                  Send reset link
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-sm text-slate-400 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/tech/login")}
              className="inline-flex items-center gap-2 hover:text-slate-200 hover:underline underline-offset-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to tech sign in
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="hover:text-slate-200 hover:underline underline-offset-4"
            >
              Home
            </button>
          </div>
        </motion.div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Tech access is for verified Glass Guardian technicians only.
        </p>
      </div>
    </div>
  );
}