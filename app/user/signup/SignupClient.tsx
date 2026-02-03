// app/user/signup/SignupClient.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Hash,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

/** Ensure a profiles row exists after auth (service route on your server) */
async function ensureProfile(defaultRole: "user" | "tech" | "admin" = "user") {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return;
  await fetch("/api/profile/ensure", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ defaultRole }),
  }).catch(() => {});
}

export default function SignupClient() {
  const router = useRouter();
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const qpEmail = (qp.get("email") || "").trim();
  const qpCode = (qp.get("code") || "").trim();
  const qpName = (qp.get("name") || "").trim();

  const [fullName, setFullName] = React.useState(qpName);
  const [email, setEmail] = React.useState(qpEmail);
  const [userCode, setUserCode] = React.useState(qpCode); // 7-digit code from invite
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const passwordsMatch = password.length >= 6 && password === confirm;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);

    if (!userCode.trim()) {
      setErr("User ID code is required.");
      return;
    }
    if (!passwordsMatch) {
      setErr("Passwords do not match (min 6 chars).");
      return;
    }

    if (!email.trim()) {
      setErr("Email is required.");
      return;
    }

    if (!fullName.trim()) {
      setErr("Full name is required.");
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedCode = userCode.trim();

      // Dumb split of full name into first/last for the from-invite API
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ");

      // 1) Supabase auth signup
      const { data, error } = await supabaseClient.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            role: "user",
            full_name: fullName.trim(),
            invite_code: trimmedCode,
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/user/login`
              : undefined,
        },
      });

      if (error) throw error;

      // 2) Ensure profiles row (non-blocking)
      if (data.user?.id) {
        try {
          await ensureProfile("user");
        } catch {
          /* non-blocking */
        }
      }

      // 3) Tell backend to materialize app_users row from invite
      try {
        const res = await fetch("/api/user/from-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: trimmedCode,
            email: trimmedEmail,
            first_name: firstName,
            last_name: lastName,
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          // If invite is invalid/expired, show message but still let them know
          // the account was created in auth. You can tune this UX later.
          console.error("from-invite error:", json);
          setNotice(
            "Your account was created, but the invite link may be invalid or expired. Please contact your technician if something looks off."
          );
        }
      } catch (e) {
        // Silent fail on this call; no hard crash for the user
        console.error("Failed to call /api/user/from-invite:", e);
      }

      // 4) Redirect back to login with success flag + prefilled fields
      const params = new URLSearchParams();
      params.set("created", "1");
      if (userCode.trim()) params.set("code", userCode.trim());
      if (trimmedEmail) params.set("email", trimmedEmail);
      if (fullName.trim()) params.set("name", fullName.trim());

      router.replace(`/user/login?${params.toString()}`);
    } catch (e: any) {
      setErr(e?.message ?? "Could not complete signup.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !!fullName.trim() &&
    !!email.trim() &&
    !!userCode.trim() &&
    passwordsMatch &&
    !loading;

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Create account
              </h1>
              <p className="text-sm text-slate-600">
                Finish setting up your Glass Guardian profile
              </p>
            </div>
            <div className="rounded-xl p-2 bg-emerald-50 text-emerald-700 shadow-inner ring-1 ring-emerald-200/60">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>

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

          <form onSubmit={onSubmit} className="space-y-4">
            {/* User ID Code */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                User ID Code
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value.trim())}
                  className="w-full rounded-lg border border-slate-300 bg-white/90 pl-9 pr-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tracking-[0.25em]"
                  placeholder="1234567"
                  inputMode="numeric"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                This comes from the invite email your technician sent you.
              </p>
            </div>

            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full name
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/90 pl-9 pr-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Alex Driver"
                  autoComplete="name"
                />
              </div>
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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/90 pl-9 pr-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/90 pl-9 pr-10 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  autoComplete="new-password"
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

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/90 pl-9 pr-10 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!passwordsMatch && confirm.length > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Passwords must match and be at least 6 characters.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Creating account…" : "Create account"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="mt-6 text-sm text-slate-600 flex items-center justify-between">
            <Link
              href="/user/login"
              className="inline-flex items-center gap-2 hover:underline underline-offset-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
            <Link href="/" className="hover:underline underline-offset-4">
              Home
            </Link>
          </div>
        </motion.div>

        <p className="text-center text-xs text-slate-500 mt-4">
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
    </div>
  );
}