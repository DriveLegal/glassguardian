// app/auth/update-password/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

/** Prevent static generation: this page depends on URL tokens + live auth */
export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-slate-600">Loading…</div>}>
      <UpdatePasswordInner />
    </Suspense>
  );
}

function UpdatePasswordInner() {
  const router = useRouter();
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const fromEmailLink =
    !!qp.get("access_token") || !!qp.get("refresh_token") || !!qp.get("type");

  const canSubmit = password.length >= 6 && confirm === password && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      // If opened via Supabase recovery link, user is considered authenticated here
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;

      setOk("Password updated successfully.");
      setTimeout(() => {
        router.replace("/login"); // or "/admin/login" if preferred
      }, 900);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update password.");
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
          <div className="absolute -inset-[1.5px] rounded-[22px] bg-[conic-gradient(from_130deg_at_50%_50%,#60a5fa,transparent_25%,#34d399_50%,transparent_75%,#93c5fd_100%)] opacity-70 blur-[2px] group-hover:opacity-100 transition-opacity" />
          <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl [mask-image:linear-gradient(#000,#000,transparent)]" />

          <div className="relative rounded-[20px] border border-white/30 bg-white/60 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl">
            <div className="rounded-[20px] p-6 sm:p-7 bg-gradient-to-br from-white/70 via-white/55 to-white/30">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    {fromEmailLink ? "Set your new password" : "Update password"}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Choose a strong password (min 6 characters)
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-blue-50 text-blue-700 shadow-inner ring-1 ring-blue-200/60">
                  <Lock className="w-5 h-5" />
                </div>
              </div>

              {err && (
                <div className="mb-3 rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 shadow-sm">
                  {err}
                </div>
              )}
              {ok && (
                <div className="mb-3 rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800 shadow-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {ok}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    New password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/85 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 shadow-inner"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={6}
                    className="w-full rounded-xl border border-slate-300/80 bg-white/85 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 shadow-inner"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
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