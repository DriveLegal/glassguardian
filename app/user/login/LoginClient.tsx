// app/user/login/LoginClient.tsx
"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  LogIn,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseClient } from "@/lib/supabaseClient";

/* -------------------------------------------------------
   Small helpers
------------------------------------------------------- */

function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === "undefined") return;
  const parts = [`${name}=${encodeURIComponent(value)}`, "path=/"];
  if (maxAgeSeconds != null) parts.push(`Max-Age=${maxAgeSeconds}`);
  document.cookie = parts.join("; ");
}

function safeRedirect(path: string) {
  try {
    window.location.assign(path);
  } catch {
    window.location.href = path;
  }
}

async function safeFetchJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
  try {
    const r = await fetch(url, init);
    const text = await r.text().catch(() => "");
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    return { ok: r.ok, status: r.status, json };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      json: {},
      error: e?.message || "Failed to fetch",
    };
  }
}

/** ✅ Ensure app_users exists + auth_user_id linked (server route, service role). */
async function bootstrapAppUser(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const res = await safeFetchJson("/api/user/bootstrap", { method: "POST" });

  if (!res.ok) {
    return {
      ok: false,
      error:
        res.error ||
        res.json?.error ||
        `bootstrap failed (${res.status || "network"})`,
    };
  }

  if (res.json?.ok !== true) {
    return { ok: false, error: res.json?.error || "bootstrap returned not ok" };
  }

  return { ok: true };
}

/** ✅ NEW: Always stamp portal_activated_at after login (idempotent server route). */
async function activatePortal(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { ok: false, error: "Missing session token" };

  const res = await safeFetchJson("/api/user/activate-portal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    return {
      ok: false,
      error:
        res.error ||
        res.json?.error ||
        `activate-portal failed (${res.status || "network"})`,
    };
  }

  if (res.json?.ok !== true) {
    return {
      ok: false,
      error: res.json?.error || "activate-portal returned not ok",
    };
  }

  return { ok: true };
}

/** (Optional legacy hook) Ensure profiles row exists; best-effort only. */
async function ensureProfile(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { ok: false, error: "Missing access token" };

  const res = await safeFetchJson("/api/profile/ensure", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ defaultRole: "user" }),
  });

  if (!res.ok) {
    return {
      ok: false,
      error:
        res.error ||
        res.json?.error ||
        `Profile ensure failed (${res.status || "network"})`,
    };
  }

  return { ok: true };
}

/** Resend confirmation email if user isn't confirmed yet */
async function resendConfirmation(email: string) {
  if (!email) return;
  try {
    await supabaseClient.auth.resend({ type: "signup", email });
  } catch (err) {
    console.error("Failed to resend confirmation email:", err);
  }
}

/* -------------------------------------------------------
   Page component
------------------------------------------------------- */

export default function LoginPage() {
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [warn, setWarn] = React.useState<string | null>(null);

  // redirect param
  const rawRedirect = qp.get("redirect");
  const redirect =
    rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : "/user/dashboard";

  // Invite params from email
  const inviteCode = qp.get("code") || "";
  const inviteEmail = qp.get("email") || "";
  const inviteName = qp.get("name") || "";
  const createdFlag = qp.get("created");

  React.useEffect(() => {
    if (inviteEmail && !email) setEmail(inviteEmail);
  }, [inviteEmail, email]);

  React.useEffect(() => {
    if (createdFlag === "1") setNotice("Account created. You can sign in now.");
  }, [createdFlag]);

  /* -----------------------------------------------------
     DevSim fast paths (?dev=user|off)
  ----------------------------------------------------- */
  React.useEffect(() => {
    const dev = qp.get("dev");
    if (!dev) return;

    if (dev === "off") {
      setCookie("gg_dev_role", "", 0);
      setNotice("DevSim disabled.");
      return;
    }

    if (dev === "user") {
      setCookie("gg_dev_role", dev, 60 * 60 * 24);
      safeRedirect(redirect);
    } else {
      setErr("Unknown dev role. Use dev=user or dev=off.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp]);

  /* -----------------------------------------------------
     After auth: bootstrap + activate + optional profile + hard nav
  ----------------------------------------------------- */
  const goAfterLogin = React.useCallback(
    async (normalizedEmail: string) => {
      // 1) Bootstrap app_users (service role route)
      const boot = await bootstrapAppUser();
      if (!boot.ok) {
        // keep login alive, warn only
        setWarn(`Signed in, but bootstrap had an issue (${boot.error}).`);
      }

      // ✅ Fallback: try claim RPC (non-blocking)
      try {
        await supabaseClient.rpc("claim_app_user_by_email");
      } catch (e) {
        console.warn("claim_app_user_by_email fallback failed:", e);
      }

      // ✅ NEW: Always stamp portal_activated_at (non-blocking)
      const activated = await activatePortal();
      if (!activated.ok) {
        setWarn((w) => w || `Signed in, but activation had an issue (${activated.error}).`);
      }

      // 2) Optional legacy profile ensure (non-blocking)
      const ensured = await ensureProfile();
      if (!ensured.ok)
        setWarn(
          (w) => w || `Heads up: profile sync had an issue (${ensured.error}).`
        );

      // 3) Remember cookie
      if (remember) {
        setCookie("gg_remember_user", normalizedEmail, 60 * 60 * 24 * 30);
      } else {
        setCookie("gg_remember_user", "", 0);
      }

      // 4) Hard navigation so protected pages load with a fully-hydrated session
      safeRedirect(redirect);
    },
    [redirect, remember]
  );

  /* -----------------------------------------------------
     Handlers
  ----------------------------------------------------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErr(null);
    setNotice(null);
    setWarn(null);
    setLoading(true);

    let normalizedEmail = "";

    try {
      normalizedEmail = email.trim().toLowerCase();
      setEmail(normalizedEmail);

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;

      const user = data?.user;
      if (!user) throw new Error("No user returned from auth.");

      // If they are not confirmed, surface message (don’t sign them out)
      if (user.email_confirmed_at == null && user.email?.length) {
        setNotice(
          "Check your email to confirm your account before continuing."
        );
        // You can choose to stop here if you want:
        // return;
      }

      // OPTIONAL: if invite code exists, attempt to sync it (non-blocking)
      if (inviteCode) {
        const nameParts = (inviteName || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ");

        const res = await safeFetchJson("/api/user/from-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: inviteCode.trim(),
            email: normalizedEmail,
            first_name: firstName,
            last_name: lastName,
          }),
        });

        if (!res.ok) {
          setWarn(
            `Invite sync warning: ${
              res.error ||
              res.json?.error ||
              `failed (${res.status || "network"})`
            }`
          );
        }
      }

      // ✅ Critical: bootstrap + activate + proceed
      await goAfterLogin(normalizedEmail);
    } catch (e: any) {
      if (e?.code === "email_not_confirmed") {
        await resendConfirmation(normalizedEmail);
        setNotice(
          "We found your account but your email isn’t confirmed yet. We just sent you a new confirmation link — please check your inbox and confirm before signing in."
        );
        setErr(null);
      } else {
        setErr(e?.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(!!e.getModifierState?.("CapsLock"));
  };

  const canSubmit = email.length > 3 && password.length >= 6 && !loading;

  const signupHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (inviteCode) params.set("code", inviteCode);
    if (inviteEmail) params.set("email", inviteEmail);
    if (inviteName) params.set("name", inviteName);
    return `/user/signup${params.toString() ? `?${params.toString()}` : ""}`;
  }, [inviteCode, inviteEmail, inviteName]);

  const showInviteBanner = inviteCode && createdFlag !== "1";

  return (
    <div className="relative min-h-[100dvh] grid place-items-center overflow-hidden bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(59,130,246,0.12),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(16,185,129,0.10),transparent_60%)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(60%_60%_at_50%_40%,#000,transparent_80%)]">
        <div className="absolute -top-24 -left-24 w-[38rem] h-[38rem] rounded-full blur-3xl bg-blue-300/20" />
        <div className="absolute -bottom-24 -right-16 w-[34rem] h-[34rem] rounded-full blur-3xl bg-emerald-300/20" />
      </div>

      <div className="w-full max-w-md px-4">
        <motion.div
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, y: 18, scale: 0.98 }
          }
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="group relative"
        >
          <div className="absolute -inset-[1.5px] rounded-[22px] bg-[conic-gradient(from_130deg_at_50%_50%,#60a5fa,transparent_25%,#34d399_50%,transparent_75%,#93c5fd_100%)] opacity-70 blur-[2px] group-hover:opacity-100 transition-opacity" />
          <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white/40 to-white/10 backdrop-blur-xl [mask-image:linear-gradient(#000,#000,transparent)]" />

          <motion.div
            whileHover={
              prefersReducedMotion ? {} : { rotateX: 0.5, rotateY: -0.5, y: -2 }
            }
            className="relative rounded-[20px] border border-white/30 bg-white/60 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl"
          >
            <div className="rounded-[20px] p-6 sm:p-7 bg-gradient-to-br from-white/70 via-white/55 to-white/30">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Sign in
                  </h1>
                  <p className="text-sm text-slate-600">
                    Welcome back — access your account
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-blue-50 text-blue-700 shadow-inner ring-1 ring-blue-200/60">
                  <LogIn className="w-5 h-5" />
                </div>
              </div>

              {showInviteBanner && (
                <div className="mb-3 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-800 shadow-sm">
                  We detected your invite code <strong>{inviteCode}</strong>. If
                  this is your first time, click{" "}
                  <strong>Create a new account</strong> below.
                </div>
              )}

              {err && (
                <div className="mb-3 rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 shadow-sm">
                  {err}
                </div>
              )}

              {warn && !err && (
                <div className="mb-3 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-800 shadow-sm">
                  {warn}
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
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 shadow-inner"
                      placeholder="you@example.com"
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Password
                    </label>
                    {capsLock && (
                      <span className="text-xs text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">
                        Caps Lock is ON
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={onPasswordKey}
                      onKeyDown={onPasswordKey}
                      className="w-full rounded-xl border border-slate-300/80 bg-white/85 pl-9 pr-10 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 shadow-inner"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/60"
                    />
                    Remember me
                  </label>
                  <Link
                    href="/forgot"
                    className="text-sm text-blue-700 hover:text-blue-800 underline underline-offset-4"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-[0_12px_24px_rgba(37,99,235,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
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
              </form>

              <div className="mt-6 text-sm text-slate-600 flex items-center justify-between">
                <Link
                  href={signupHref}
                  className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800 underline underline-offset-4"
                >
                  <UserPlus className="w-4 h-4" />
                  Create a new account
                </Link>

                <Link href="/" className="hover:underline underline-offset-4">
                  Back to home
                </Link>
              </div>
            </div>
          </motion.div>
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

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')",
        }}
      />
      <style jsx>{`
        :global(canvas),
        :global(img),
        :global(svg) {
          image-rendering: -webkit-optimize-contrast;
        }
      `}</style>
    </div>
  );
}