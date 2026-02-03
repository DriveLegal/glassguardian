// app/user/old-client/create-password/OldClientCreatePasswordClient.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  User,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function normalizeName(name: string | null | undefined) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function parseFriendlyAuthError(e: any) {
  const msg = String(e?.message || e?.error_description || "").trim();
  const lower = msg.toLowerCase();

  if (
    lower.includes("email not confirmed") ||
    lower.includes("email_not_confirmed") ||
    lower.includes("confirm your email")
  ) {
    return "Your email isn’t confirmed yet. Please open the confirmation email and click verify, then come back and sign in.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Invalid login credentials. Double-check your email and password.";
  }

  return msg || "Something went wrong. Please try again.";
}

/**
 * ✅ Best practice: for old-client setup, DO NOT do client-side signUp.
 * We:
 *  1) call server: /api/user/old-client-create-password (service role creates auth + links app_users)
 *  2) sign in (cookie session created)
 *  3) activate portal server-side: /api/user/activate-portal
 *  4) ensure display name in auth metadata (optional polish)
 */
async function activatePortalOnServer() {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { ok: false as const, error: "Missing session token." };

  try {
    const r = await fetch("/api/user/activate-portal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false as const, error: j?.error || `activate-portal failed (${r.status})` };
    if (j?.ok !== true) return { ok: false as const, error: j?.error || "activate-portal returned not ok" };
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "activate-portal request failed" };
  }
}

/**
 * Ensure the Auth user has a display name:
 * 1) Prefer Auth metadata
 * 2) Fallback to email prefix
 * (We avoid reading app_users directly here because RLS may block pre-policy.)
 */
async function ensureAuthDisplayNameMinimal(email: string) {
  const effectiveEmail = email.trim().toLowerCase();
  if (!effectiveEmail) return { displayName: "there", source: "fallback" as const };

  const { data: uRes, error: uErr } = await supabaseClient.auth.getUser();
  const user = uRes?.user ?? null;

  if (uErr || !user) {
    const prefix = effectiveEmail.split("@")[0] || "there";
    return { displayName: prefix, source: "email_prefix" as const };
  }

  const metaName =
    normalizeName((user.user_metadata as any)?.full_name) ||
    normalizeName((user.user_metadata as any)?.name) ||
    normalizeName((user.user_metadata as any)?.display_name);

  if (metaName) {
    return { displayName: metaName, source: "auth_metadata" as const };
  }

  const prefix = effectiveEmail.split("@")[0] || "there";
  const pretty = prefix
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const finalName = pretty || prefix || "there";

  await supabaseClient.auth.updateUser({
    data: { full_name: finalName },
  });

  return { displayName: finalName, source: "email_prefix" as const };
}

export default function OldClientCreatePasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromUrl = (searchParams.get("email") || "").toLowerCase();

  const [email, setEmail] = React.useState(emailFromUrl);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [resolvedName, setResolvedName] = React.useState<string | null>(null);

  // Non-blocking debug banner (helps you see why a user might be "stuck")
  const [warnMsg, setWarnMsg] = React.useState<string | null>(null);

  const effectiveEmail = email.trim().toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setWarnMsg(null);
    setSuccessMsg(null);
    setResolvedName(null);

    if (!effectiveEmail) {
      setErrorMsg("Email is required.");
      return;
    }

    if (!password || password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please double-check.");
      return;
    }

    try {
      setBusy(true);

      // 1) Server creates auth user + links app_users (service role)
      const createRes = await fetch("/api/user/old-client-create-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: effectiveEmail, password }),
      });

      const createJson = await createRes.json().catch(() => ({}));

      if (!createRes.ok || createJson?.ok === false) {
        const msg = createJson?.error || `Failed to create secure login (${createRes.status}).`;
        throw new Error(msg);
      }

      // 2) Now sign in (creates cookie session locally)
      const { data: signInData, error: signInError } =
        await supabaseClient.auth.signInWithPassword({
          email: effectiveEmail,
          password,
        });

      if (signInError || !signInData?.session) {
        throw signInError || new Error("Unable to sign in after creating password.");
      }

      // 3) Mark portal activated (server-side service role; reliable)
      const activated = await activatePortalOnServer();
      if (!activated.ok) {
        // non-blocking but visible (you can still route in)
        setWarnMsg(`Heads up: portal activation had an issue (${activated.error}).`);
      }

      // 4) Ensure display name exists (nice polish)
      const { displayName } = await ensureAuthDisplayNameMinimal(effectiveEmail);
      setResolvedName(displayName);

      setSuccessMsg("Your password has been created and your portal is ready. Redirecting you now…");

      // 5) Enter dashboard
      setTimeout(() => {
        router.replace("/user/dashboard");
      }, 650);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(parseFriendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950/95 px-4 py-8 flex items-center justify-center">
      {/* BG FX */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-40 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.6),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9),_black_70%)]" />
      </div>

      <Card className="relative w-full max-w-md border-slate-800/80 bg-slate-950/90 shadow-[0_22px_70px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200 mb-2">
            <Lock className="h-3.5 w-3.5" />
            Secure portal setup
          </div>
          <CardTitle className="text-lg font-semibold text-slate-50">
            Create your Glass Guardian password
          </CardTitle>
          <p className="mt-1 text-xs text-slate-400">
            This turns your existing Glass Guardian record into a secure login.
            Your username will be your email address.
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pb-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email (username)
              </label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="bg-slate-950/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  placeholder="you@example.com"
                  disabled={busy}
                />
                <div className="flex items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 px-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                This should match the address we sent your portal invite to.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="bg-slate-950/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                placeholder="At least 8 characters"
                disabled={busy}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirm password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="bg-slate-950/80 border-slate-700 text-slate-100 placeholder:text-slate-500"
                placeholder="Re-type your password"
                disabled={busy}
              />
            </div>

            {resolvedName && !errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                <User className="mt-0.5 h-3.5 w-3.5 text-cyan-200" />
                <p>
                  We’ll greet you as{" "}
                  <span className="font-semibold text-cyan-50">{resolvedName}</span>{" "}
                  in your portal.
                </p>
              </div>
            )}

            {warnMsg && !errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                <p>{warnMsg}</p>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
                <p>{successMsg}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-cyan-400"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Securing your portal…
                </span>
              ) : (
                "Create password & enter portal"
              )}
            </Button>

            <p className="text-[11px] text-center text-slate-500 mt-1">
              By continuing, you’re securing access to your Glass Guardian
              warranty and repair history.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}