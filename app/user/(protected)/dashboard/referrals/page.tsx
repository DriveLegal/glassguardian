// app/user/(protected)/dashboard/referrals/page.tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Gift,
  Copy,
  CheckCircle,
  Mail,
  DollarSign,
  Share2,
  MessageCircle,
  Link2,
  Loader2,
  Phone,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type AnyObj = Record<string, any>;

const REFERRAL_DOMAIN = "https://glassguardianchipandcrackrepair.com";

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeName(v: unknown) {
  return String(v ?? "").trim();
}

function makeReferralCodeFromEmail(email: string) {
  const prefix = email
    .split("@")[0]
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);

  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GG${prefix}${rand}`;
}

function displayPhone(v: unknown) {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(v ?? "");
}

function displayStatus(status: unknown) {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return "pending";
  return s.replaceAll("_", " ");
}

function isCredited(status: unknown) {
  return String(status ?? "").trim().toLowerCase() === "credited";
}

function isPendingLike(status: unknown) {
  const s = String(status ?? "").trim().toLowerCase();
  return (
    s === "pending" ||
    s === "completed" ||
    s === "signed_up" ||
    s === "joined" ||
    s === "booked"
  );
}

function statusBadgeClass(status: unknown) {
  const s = String(status ?? "").trim().toLowerCase();

  if (s === "credited") {
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
  }

  if (s === "completed") {
    return "border-sky-400/40 bg-sky-500/15 text-sky-200";
  }

  if (s === "signed_up" || s === "joined" || s === "booked") {
    return "border-violet-400/40 bg-violet-500/15 text-violet-200";
  }

  return "border-amber-400/40 bg-amber-500/15 text-amber-100";
}

export default function ReferralProgramPage() {
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [referralCode, setReferralCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [initializing, setInitializing] = React.useState(true);
  const [showLegacyLink, setShowLegacyLink] = React.useState(false);

  const prefersReducedMotion = useReducedMotion();

  React.useEffect(() => {
    let mounted = true;

    async function loadAndEnsureReferralCode() {
      try {
        const { data } = await supabaseClient.auth.getSession();
        const session = data?.session ?? null;
        const user = session?.user ?? null;

        if (!user || !mounted) {
          if (mounted) setInitializing(false);
          return;
        }

        const email = normalizeEmail(user.email);
        const uid = String(user.id ?? "").trim() || null;

        const meta = (user.user_metadata ?? {}) as AnyObj;
        const appMeta = (user.app_metadata ?? {}) as AnyObj;

        const fullName =
          normalizeName(meta.full_name) ||
          normalizeName(meta.name) ||
          normalizeName(appMeta.full_name) ||
          normalizeName(appMeta.name) ||
          email.split("@")[0];

        setUserEmail(email || null);
        setUserId(uid);
        setUserName(fullName || null);

        let finalCode =
          normalizeName(meta.referral_code) ||
          normalizeName(appMeta.referral_code) ||
          "";

        if (!finalCode && email) {
          const { data: existingCodeRow } = await supabaseClient
            .from("referral_codes")
            .select("referral_code, referrer_name, referrer_user_id, referrer_email")
            .eq("referrer_email", email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          finalCode = normalizeName(existingCodeRow?.referral_code);
        }

        if (!finalCode && email) {
          finalCode = makeReferralCodeFromEmail(email);

          const { error: authUpdateError } = await supabaseClient.auth.updateUser({
            data: { referral_code: finalCode },
          });

          if (authUpdateError) {
            // table persistence below still handles the mapping
          }
        }

        if (finalCode && mounted) {
          setReferralCode(finalCode);
        }

        if (email && finalCode) {
          await supabaseClient.from("referral_codes").upsert(
            {
              referral_code: finalCode,
              referrer_email: email,
              referrer_user_id: uid,
              referrer_name: fullName,
            },
            { onConflict: "referral_code" }
          );
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    }

    loadAndEnsureReferralCode();

    return () => {
      mounted = false;
    };
  }, []);

  const referralLink = referralCode
    ? `${REFERRAL_DOMAIN}/referral/${encodeURIComponent(referralCode)}`
    : "";

  const legacyReferralLink = referralCode
    ? `${REFERRAL_DOMAIN}?ref=${encodeURIComponent(referralCode)}`
    : "";

  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["referrals:mine", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      if (!userEmail) return [];

      const { data, error } = await supabaseClient
        .from("referrals")
        .select("*")
        .eq("referrer_email", userEmail)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 10_000,
  });

  const totalEarned = referrals
    .filter((r: AnyObj) => isCredited(r.status))
    .reduce((sum: number, r: AnyObj) => sum + (Number(r.credit_amount) || 0), 0);

  const pendingCredits = referrals
    .filter((r: AnyObj) => isPendingLike(r.status) && !isCredited(r.status))
    .reduce((sum: number, r: AnyObj) => sum + (Number(r.credit_amount) || 0), 0);

  const totalPossibleCredits = referrals.reduce(
    (sum: number, r: AnyObj) => sum + (Number(r.credit_amount) || 0),
    0
  );

  const completedOrCreditedCount = referrals.filter((r: AnyObj) => {
    const s = String(r.status ?? "").trim().toLowerCase();
    return s === "completed" || s === "credited";
  }).length;

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShareEmail = () => {
    if (!referralLink) return;

    const subject = encodeURIComponent("Get $10 off your windshield repair");
    const body = encodeURIComponent(
      `Hi! I wanted to share Glass Guardian with you. They do mobile windshield chip and crack repair and come right to your location.

Use my referral link to get $10 off your first service:
${referralLink}

After your successful appointment, I earn a $15 Glass Guardian credit too.`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareSMS = () => {
    if (!referralLink) return;

    const message = encodeURIComponent(
      `Check out Glass Guardian for mobile windshield repair. Use my link to get $10 off your first repair: ${referralLink}`
    );

    window.location.href = `sms:?&body=${message}`;
  };

  const heroMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.5, ease: "easeOut" as const },
      };

  const cardMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: "easeOut" as const },
      };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-slate-50 md:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-gradient-to-br from-sky-500/40 via-cyan-400/30 to-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gradient-to-tr from-emerald-500/40 via-sky-500/30 to-indigo-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25)_0,_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(15,23,42,0.9),rgba(15,23,42,0.95))]" />

      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <motion.div
          {...heroMotion}
          className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.35)] backdrop-blur">
              <Gift className="h-4 w-4" />
              <span>Invite &amp; Earn Glass Guardian Credits</span>
            </div>

            <h1 className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-sky-400 to-cyan-500 shadow-[0_18px_40px_rgba(56,189,248,0.45)]">
                <Gift className="h-6 w-6 text-slate-950" />
              </span>
              Glass Guardian Referral Program
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-300 md:text-base">
              Your referral gets{" "}
              <span className="font-semibold text-emerald-300">$10 off</span> their first repair.
              You get{" "}
              <span className="font-semibold text-sky-300">$15 credit</span> after their
              appointment is completed successfully.
            </p>

            {userName ? (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                Sharing as {userName}
              </p>
            ) : null}
          </div>

          <motion.div
            {...cardMotion}
            className="relative mt-4 w-full max-w-sm self-end md:mt-0"
          >
            <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-br from-emerald-400/70 via-sky-500/70 to-cyan-400/70 opacity-60 blur-xl" />
            <div className="relative rounded-3xl bg-slate-900/90 p-4 shadow-[0_25px_60px_rgba(15,23,42,0.9)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Referral HUD
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/40">
                  LIVE
                </span>
              </div>

              <div className="relative mb-4 h-24 w-full rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-[0_15px_35px_rgba(15,23,42,0.9)]">
                <div className="absolute inset-x-6 top-4 h-2 rounded-full bg-gradient-to-r from-sky-400/60 via-cyan-300/70 to-emerald-400/60 blur-[2px]" />
                <div className="absolute left-6 right-6 top-6 h-10 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-[0_10px_25px_rgba(15,23,42,0.9)]" />
                <div className="absolute inset-x-12 bottom-4 h-3 rounded-full bg-black/70 blur-md" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-10 w-32">
                    <div className="absolute inset-x-3 top-1 h-4 rounded-full bg-gradient-to-r from-slate-500 via-slate-300 to-slate-500" />
                    <div className="absolute inset-x-1 bottom-1 h-5 rounded-[999px] border border-slate-600/60 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
                    <div className="absolute left-4 bottom-0 h-4 w-4 rounded-full border border-slate-500 bg-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,1)]" />
                    <div className="absolute right-4 bottom-0 h-4 w-4 rounded-full border border-slate-500 bg-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,1)]" />
                    <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
                    <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                    Available Credit
                  </p>
                  <p className="text-2xl font-semibold text-emerald-300">
                    ${totalEarned.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    +${pendingCredits.toFixed(2)} pending
                  </p>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  <p>Referrals</p>
                  <p className="text-lg font-semibold text-sky-300">
                    {referrals.length}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
          <motion.div {...cardMotion} className="space-y-6">
            <Card className="border border-slate-700/70 bg-slate-900/80 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <CardContent className="p-6 md:p-7">
                <h2 className="text-xl font-semibold text-slate-50 md:text-2xl">
                  How it works
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Share your link. When someone fills out their referral page and completes a
                  successful appointment, your Glass Guardian credit is tracked here.
                </p>

                <div className="mt-6 grid gap-5 md:grid-cols-3">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-[0_18px_40px_rgba(56,189,248,0.55)]">
                      <Share2 className="h-7 w-7 text-slate-950" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-50">
                      1. Share your link
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      Your custom referral page carries your code automatically.
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 shadow-[0_18px_40px_rgba(16,185,129,0.55)]">
                      <Users className="h-7 w-7 text-slate-950" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-50">
                      2. They request invite
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      Their name, email, and phone are attached to your referral code.
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 shadow-[0_18px_40px_rgba(129,140,248,0.55)]">
                      <DollarSign className="h-7 w-7 text-slate-950" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-50">
                      3. You earn $15
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      Once their job is completed successfully, your credit can be awarded.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-700/70 bg-slate-900/80 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base font-semibold text-slate-50 md:text-lg">
                  <span>Referral history</span>
                  <span className="text-xs font-medium text-slate-400">
                    {referrals.length} total
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                {referralsLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 py-10">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-300">Loading referrals...</span>
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 py-10">
                    <Users className="mb-3 h-10 w-10 text-slate-500" />
                    <p className="text-sm font-medium text-slate-200">No referrals yet</p>
                    <p className="mt-1 max-w-xs text-center text-xs text-slate-400">
                      Share your link and new referral requests will show up here with their
                      contact info and status.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((ref: AnyObj) => {
                      const displayName =
                        String(ref.referred_name ?? "").trim() || "Unnamed referral";
                      const displayEmail =
                        String(ref.referred_email ?? "").trim() || "No email";
                      const displayTel = displayPhone(ref.referred_phone);

                      const createdAtValue = ref.created_at ?? ref.created_date ?? null;
                      const createdLabel = createdAtValue
                        ? new Date(createdAtValue).toLocaleDateString()
                        : "Unknown date";

                      return (
                        <div
                          key={ref.id}
                          className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.9)]"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <p className="truncate text-sm font-semibold text-slate-50">
                                  {displayName}
                                </p>
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <Mail className="h-4 w-4 text-slate-500" />
                                <p className="truncate text-xs text-slate-300">
                                  {displayEmail}
                                </p>
                              </div>

                              <div className="mt-1 flex items-center gap-2">
                                <Phone className="h-4 w-4 text-slate-500" />
                                <p className="text-xs text-slate-300">{displayTel}</p>
                              </div>

                              <p className="mt-2 text-[11px] text-slate-400">
                                Referred {createdLabel}
                              </p>
                            </div>

                            <div className="text-left md:text-right">
                              <Badge className={statusBadgeClass(ref.status)}>
                                {displayStatus(ref.status)}
                              </Badge>

                              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                                Credit value
                              </p>
                              <p className="text-sm font-semibold text-slate-200">
                                ${Number(ref.credit_amount || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...cardMotion} className="space-y-6">
            <Card className="border border-sky-500/40 bg-slate-900/90 shadow-[0_24px_60px_rgba(8,47,73,0.95)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-50 md:text-lg">
                  <Share2 className="h-5 w-5 text-sky-300" />
                  Your referral link
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Share this link
                  </p>
                  <div className="flex gap-3">
                    <Input
                      value={referralLink}
                      readOnly
                      className="flex-1 bg-slate-950/70 font-mono text-xs text-slate-200 ring-1 ring-sky-500/40 placeholder:text-slate-500"
                      placeholder={
                        initializing
                          ? "Generating your referral link..."
                          : "Referral link unavailable"
                      }
                    />
                    <Button
                      onClick={handleCopyLink}
                      variant="outline"
                      disabled={!referralLink}
                      className="border-sky-500/50 bg-slate-900/80 text-slate-50 hover:bg-sky-500/20 hover:text-sky-50"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:flex-row">
                  <Button
                    onClick={handleShareEmail}
                    disabled={!referralLink}
                    variant="outline"
                    className="flex-1 border-emerald-400/40 bg-slate-900/80 text-slate-50 hover:bg-emerald-500/20 hover:text-emerald-50"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Share via email
                  </Button>

                  <Button
                    onClick={handleShareSMS}
                    disabled={!referralLink}
                    variant="outline"
                    className="flex-1 border-sky-400/40 bg-slate-900/80 text-slate-50 hover:bg-sky-500/20 hover:text-sky-50"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Share via SMS
                  </Button>
                </div>

                <div className="rounded-xl border border-sky-500/30 bg-slate-950/80 p-4 shadow-[0_12px_30px_rgba(8,47,73,0.35)]">
  <p className="text-xs leading-6 text-slate-200 md:text-sm">
    <span className="font-semibold text-sky-200">Pro tip:</span>{" "}
    Just copy the link above and send it. That one route handles everything and
    connects the referral back to your account automatically.
  </p>
</div>

                <div className="rounded-xl border border-slate-700/70 bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => setShowLegacyLink((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-300">
                        Need the legacy format?
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Only use this if an older system specifically asks for it
                      </p>
                    </div>

                    {showLegacyLink ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {showLegacyLink ? (
                    <div className="border-t border-slate-700/70 px-4 pb-4 pt-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Legacy link
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-slate-400">
                        {legacyReferralLink || "Unavailable"}
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              <Card className="border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-slate-950/90 text-emerald-50 shadow-[0_24px_60px_rgba(6,95,70,0.9)] backdrop-blur-xl">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/90">
                    Total earned
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    ${totalEarned.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-sky-400/40 bg-gradient-to-br from-sky-500/20 via-sky-600/10 to-slate-950/90 text-sky-50 shadow-[0_24px_60px_rgba(7,89,133,0.9)] backdrop-blur-xl">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/90">
                    Pending credit
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    ${pendingCredits.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-violet-400/40 bg-gradient-to-br from-violet-500/20 via-indigo-600/10 to-slate-950/90 text-violet-50 shadow-[0_24px_60px_rgba(49,46,129,0.9)] backdrop-blur-xl">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/90">
                    Total possible
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    ${totalPossibleCredits.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-amber-400/40 bg-gradient-to-br from-amber-500/20 via-yellow-600/10 to-slate-950/90 text-amber-50 shadow-[0_24px_60px_rgba(120,53,15,0.9)] backdrop-blur-xl">
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200/90">
                    Completed / credited
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    {completedOrCreditedCount}
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}