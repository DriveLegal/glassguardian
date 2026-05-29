// app/user/signup/SignupClient.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
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
  Sparkles,
  Crown,
  Shield,
  CheckCircle2,
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

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

/**
 * ✅ Supabase can redirect back with MULTIPLE hash fragments like:
 *   /user/signup#invite=...#access_token=...&refresh_token=...&type=invite
 * We must parse *all* segments after '#' (split by '#') and merge params.
 */
function readMultiHashParams() {
  if (typeof window === "undefined") {
    return {
      inviteId: "",
      access_token: "",
      refresh_token: "",
      expires_at: "",
      expires_in: "",
      token_type: "",
      type: "",
      error: "",
      error_description: "",
      error_code: "",
    };
  }

  const rawHash = (window.location.hash || "").replace(/^#/, "");
  const hashSegs = rawHash ? rawHash.split("#") : [];
  const search = window.location.search ? window.location.search.replace(/^\?/, "") : "";

  const buckets: URLSearchParams[] = [];
  if (search) buckets.push(new URLSearchParams(search));
  for (const seg of hashSegs) if (seg) buckets.push(new URLSearchParams(seg));

  const getFirst = (key: string) => {
    for (const b of buckets) {
      const v = (b.get(key) || "").trim();
      if (v) return v;
    }
    return "";
  };

  return {
    inviteId: getFirst("invite"),
    access_token: getFirst("access_token"),
    refresh_token: getFirst("refresh_token"),
    expires_at: getFirst("expires_at"),
    expires_in: getFirst("expires_in"),
    token_type: getFirst("token_type"),
    type: getFirst("type"),
    error: getFirst("error"),
    error_description: getFirst("error_description"),
    error_code: getFirst("error_code"),
  };
}

/* --------------------------- Elite UI helpers --------------------------- */

function GradientFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-[1.5px] rounded-[22px] opacity-80 blur-[6px]"
        style={{
          background:
            "conic-gradient(from 210deg at 50% 50%, rgba(56,189,248,0.85), transparent 16%, rgba(37,99,235,0.85) 40%, transparent 62%, rgba(34,197,94,0.8) 92%, rgba(56,189,248,0.85) 100%)",
          filter: "saturate(140%)",
          zIndex: 0,
        }}
      />
      <div className="relative z-10 rounded-[22px]">{children}</div>
    </div>
  );
}

function GlassPanel({
  children,
  className = "",
  depth = 28,
}: {
  children: React.ReactNode;
  className?: string;
  depth?: number;
}) {
  const outerShadow = `0 ${Math.round(depth / 4)}px ${Math.round(depth * 1.9)}px rgba(2,6,23,0.88)`;

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[22px] border border-slate-700/80 bg-slate-950/70 backdrop-blur-xl",
        "shadow-[0_28px_110px_rgba(2,6,23,0.9)]",
        className,
      ].join(" ")}
      style={{
        boxShadow: outerShadow,
        transform: "translateZ(0)",
        willChange: "transform, box-shadow",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(148,163,184,0.16), rgba(2,6,23,0.12) 38%, transparent 82%)",
          mixBlendMode: "screen",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-200">{label}</label>
      <div className="relative">
        {icon ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
        ) : null}
        {children}
      </div>
      {hint ? <div className="text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-700/80 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 outline-none transition " +
  "focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/30 " +
  "shadow-[0_0_0_1px_rgba(148,163,184,0.06)]";

export default function SignupClient() {
  const router = useRouter();
  const qp = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const qpEmail = (qp.get("email") || "").trim();
  const qpCode = (qp.get("code") || "").trim();
  const qpName = (qp.get("name") || "").trim();
  const qpInviteId = (qp.get("invite") || "").trim(); // legacy query support

  // pull hash params once on first client render (safe for initial prefill)
  const hashParamsRef = React.useRef<ReturnType<typeof readMultiHashParams> | null>(null);
  if (hashParamsRef.current === null && typeof window !== "undefined") {
    hashParamsRef.current = readMultiHashParams();
  }
  const hp = hashParamsRef.current || {
    inviteId: "",
    access_token: "",
    refresh_token: "",
    expires_at: "",
    expires_in: "",
    token_type: "",
    type: "",
    error: "",
    error_description: "",
    error_code: "",
  };

  const initialInviteId = (qpInviteId || hp.inviteId || "").trim();

  const [fullName, setFullName] = React.useState(qpName);
  const [email, setEmail] = React.useState(qpEmail);
  const [userCode, setUserCode] = React.useState(qpCode);

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);

  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [refCode, setRefCode] = React.useState<string>("");

  // Invite-detected state
  const [inviteAuthed, setInviteAuthed] = React.useState(false);
  const [codeLocked, setCodeLocked] = React.useState(false);

  React.useEffect(() => {
    const c = (getCookie("gg_ref") || "").trim();
    if (c) setRefCode(c);
  }, []);

  /**
   * ✅ MAIN FIX:
   * 1) If Supabase returned tokens in the hash, set the session.
   * 2) Use invite id (from query OR hash) to call /api/user/invites/lookup?invite=<id>.
   * 3) Autofill email/full_name/code and lock the code field.
   * 4) Clean the URL so refresh doesn’t keep giant tokens.
   */
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setErr(null);

        const paramsNow = readMultiHashParams(); // always read live once mounted
        const inviteId = (qpInviteId || paramsNow.inviteId || "").trim();

        // Surface Supabase errors nicely (like otp_expired)
        if (paramsNow.error) {
          const desc = paramsNow.error_description
            ? decodeURIComponent(paramsNow.error_description.replace(/\+/g, " "))
            : paramsNow.error;
          if (mounted) {
            setErr(desc);
          }
        }

        // (1) If tokens exist, set session so updateUser() works later.
        const hasTokens = !!paramsNow.access_token && !!paramsNow.refresh_token;
        if (hasTokens) {
          await supabaseClient.auth
            .setSession({
              access_token: paramsNow.access_token,
              refresh_token: paramsNow.refresh_token,
            })
            .catch(() => {});
        }

        // (2) Look up invite by invite id (works for BOTH invite verify + legacy links)
        if (inviteId) {
          const res = await fetch(
            `/api/user/invites/lookup?invite=${encodeURIComponent(inviteId)}`,
            { method: "GET" }
          );

          const json = await res.json().catch(() => ({}));
          if (res.ok && mounted && json?.invite?.code) {
            const inv = json.invite;
            setInviteAuthed(true);
            setEmail(String(inv.email || qpEmail || ""));
            setFullName(String(inv.full_name || qpName || ""));
            setUserCode(String(inv.code || ""));
            setCodeLocked(true);
          }
        }

        // (3) Clean URL: keep ?invite=... (optional), remove hash tokens/errors
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.hash = "";
          if (inviteId) url.searchParams.set("invite", inviteId);
          // don’t force-set email/name/code into query — keep it clean
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        // non-blocking
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpInviteId, qpEmail, qpName]);

  const passwordsMatch = password.length >= 6 && password === confirm;

  const requestAccessCode = async () => {
    setErr(null);
    setNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (!trimmedEmail) {
      setErr("Email is required to request an access code.");
      return;
    }
    if (!trimmedName) {
      setErr("Full name is required to request an access code.");
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch("/api/referrals/request-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          full_name: trimmedName,
          referral_code: refCode || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not submit request.");

      setNotice(
        "Request received. A Glass Guardian team member will send you a User ID Code by email/text shortly."
      );
    } catch (e: any) {
      setErr(e?.message ?? "Could not submit request.");
    } finally {
      setRequesting(false);
    }
  };

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

      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ");

      // ✅ If invited via Supabase, the auth user already exists.
      // We set password via updateUser (no signUp).
      const { data: sess } = await supabaseClient.auth.getSession();
      const hasSession = !!sess?.session?.access_token;

      if (hasSession) {
        const { error: upErr } = await supabaseClient.auth.updateUser({
          password,
          data: {
            role: "user",
            full_name: fullName.trim(),
            invite_code: trimmedCode,
            pending_referral_code: refCode || null,
          },
        });
        if (upErr) throw upErr;

        try {
          await ensureProfile("user");
        } catch {
          /* non-blocking */
        }

        // consume invite / link data
        try {
          await fetch("/api/user/from-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: trimmedCode,
              email: trimmedEmail,
              first_name: firstName,
              last_name: lastName,
            }),
          }).catch(() => {});
        } catch {
          /* non-blocking */
        }

        const params = new URLSearchParams();
        params.set("created", "1");
        params.set("email", trimmedEmail);
        params.set("name", fullName.trim());
        router.replace(`/user/login?${params.toString()}`);
        return;
      }

      // Fallback: non-invite manual signup flow
      const { data, error } = await supabaseClient.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            role: "user",
            full_name: fullName.trim(),
            invite_code: trimmedCode,
            pending_referral_code: refCode || null,
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/user/login`
              : undefined,
        },
      });

      if (error) throw error;

      if (data.user?.id) {
        try {
          await ensureProfile("user");
        } catch {
          /* non-blocking */
        }
      }

      try {
        await fetch("/api/user/from-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: trimmedCode,
            email: trimmedEmail,
            first_name: firstName,
            last_name: lastName,
          }),
        }).catch(() => {});
      } catch {
        /* non-blocking */
      }

      const params = new URLSearchParams();
      params.set("created", "1");
      params.set("email", trimmedEmail);
      params.set("name", fullName.trim());
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

  const showReferralBanner = !!refCode;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 520px at -10% -10%, rgba(56,189,248,0.26), transparent 55%)," +
              "radial-gradient(760px 560px at 110% 0%, rgba(34,197,94,0.22), transparent 60%)," +
              "radial-gradient(900px 700px at 50% 120%, rgba(37,99,235,0.18), transparent 60%)," +
              "linear-gradient(180deg, #020617, #020617 45%, #020617 100%)",
          }}
        />
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-emerald-400/18 blur-3xl" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-160px] h-[420px] w-[780px] rounded-full bg-indigo-400/14 blur-3xl" />
      </div>

      <div className="min-h-[100dvh] grid place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <GradientFrame>
              <GlassPanel depth={40}>
                <div className="p-6">
                  {/* Top brand / header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/60 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                        <Crown className="h-3.5 w-3.5 text-sky-300" />
                        Glass Guardian Portal
                      </div>
                      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-50">
                        {inviteAuthed ? "Set your password" : "Create your account"}
                      </h1>
                      <p className="mt-1 text-sm text-slate-300">
                        {inviteAuthed
                          ? "Your invite is verified — set a password to finish."
                          : "Code, name, email, then set your password."}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <div
                        className="h-11 w-11 rounded-2xl grid place-items-center border border-sky-400/60 bg-sky-500/10 shadow-[0_0_44px_rgba(56,189,248,0.5)]"
                        aria-hidden
                      >
                        <UserPlus className="h-5 w-5 text-sky-200" />
                      </div>
                    </div>
                  </div>

                  {/* Tiny value props row */}
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                      { icon: <Shield className="h-4 w-4" />, label: "Secure" },
                      { icon: <Sparkles className="h-4 w-4" />, label: "Fast" },
                      { icon: <CheckCircle2 className="h-4 w-4" />, label: "Easy" },
                    ].map((x) => (
                      <div
                        key={x.label}
                        className="rounded-xl border border-slate-700/70 bg-slate-900/55 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 text-slate-200">
                          <span className="text-slate-400">{x.icon}</span>
                          <span className="text-xs font-semibold">{x.label}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">Portal access</p>
                      </div>
                    ))}
                  </div>

                  {/* Referral banner */}
                  {showReferralBanner && (
                    <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                      <div className="flex items-center gap-2 text-emerald-100">
                        <Sparkles className="h-4 w-4" />
                        <p className="text-sm font-semibold">Referral detected</p>
                      </div>
                      <p className="mt-2 text-xs text-emerald-100/80">
                        Code:{" "}
                        <span className="font-mono font-semibold tracking-[0.22em] text-emerald-50">
                          {refCode}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Alerts */}
                  <AnimatePresence initial={false}>
                    {err ? (
                      <motion.div
                        key="err"
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                      >
                        {err}
                      </motion.div>
                    ) : null}

                    {notice ? (
                      <motion.div
                        key="notice"
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                      >
                        {notice}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* Form */}
                  <form onSubmit={onSubmit} className="mt-5 space-y-4">
                    {/* User ID Code */}
                    <Field
                      label="User ID Code"
                      icon={<Hash className="h-4 w-4" />}
                      hint={
                        inviteAuthed ? (
                          <span>Your code was detected from your invite.</span>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <span>This comes from the invite your technician sent.</span>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={requesting}
                              onClick={requestAccessCode}
                              className="h-8 px-3 text-xs border-slate-600 text-slate-100 bg-slate-900/60 hover:border-sky-400/70 hover:text-sky-100"
                            >
                              {requesting ? "Requesting…" : "Request Access Code"}
                            </Button>
                          </div>
                        )
                      }
                    >
                      <input
                        type="text"
                        required
                        value={userCode}
                        onChange={(e) => setUserCode(e.target.value.trim())}
                        readOnly={codeLocked}
                        className={`${inputBase} pl-9 pr-3 py-2 tracking-[0.28em] ${
                          codeLocked ? "opacity-90 cursor-not-allowed" : ""
                        }`}
                        placeholder="1234567"
                        inputMode="numeric"
                      />
                    </Field>

                    {/* Full name */}
                    <Field label="Full name" icon={<ShieldCheck className="h-4 w-4" />}>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={`${inputBase} pl-9 pr-3 py-2`}
                        placeholder="Alex Driver"
                        autoComplete="name"
                      />
                    </Field>

                    {/* Email */}
                    <Field label="Email" icon={<Mail className="h-4 w-4" />}>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`${inputBase} pl-9 pr-3 py-2`}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </Field>

                    {/* Password */}
                    <Field label="Password" icon={<Lock className="h-4 w-4" />}>
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputBase} pl-9 pr-10 py-2`}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition"
                        aria-label={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </Field>

                    {/* Confirm password */}
                    <Field label="Confirm password" icon={<Lock className="h-4 w-4" />}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        required
                        minLength={6}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={`${inputBase} pl-9 pr-10 py-2`}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>

                      {!passwordsMatch && confirm.length > 0 ? (
                        <div className="mt-2 text-xs text-red-200">
                          Passwords must match and be at least 6 characters.
                        </div>
                      ) : null}
                    </Field>

                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full bg-gradient-to-r from-sky-500 via-blue-600 to-emerald-500 hover:opacity-95 text-white shadow-[0_18px_60px_rgba(37,99,235,0.45)]"
                    >
                      {loading ? "Saving…" : inviteAuthed ? "Finish setup" : "Create account"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>

                    <div className="mt-2 rounded-2xl border border-slate-700/70 bg-slate-900/55 px-4 py-3 text-xs text-slate-300">
                      After setup, you’ll be able to book future appointments, see updates, view warranties, and make
                      quick payments.
                    </div>
                  </form>

                  {/* Links */}
                  <div className="mt-6 flex items-center justify-between text-sm">
                    <Link
                      href="/user/login"
                      className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-50 transition"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to sign in
                    </Link>
                    <Link href="/" className="text-slate-300 hover:text-slate-50 transition">
                      Home
                    </Link>
                  </div>
                </div>
              </GlassPanel>
            </GradientFrame>
          </motion.div>

          <p className="text-center text-xs text-slate-500 mt-5">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="text-slate-300 hover:text-slate-50 underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-slate-300 hover:text-slate-50 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}