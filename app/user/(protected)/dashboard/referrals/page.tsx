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
} from "lucide-react";

type AnyObj = Record<string, any>;

const REFERRAL_DOMAIN = "https://glassguardianchipandcrackrepair.com";

export default function ReferralProgramPage() {
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [referralCode, setReferralCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Load session + ensure a referral code exists on the user
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!session) return;

      const email = session.user.email ?? null;
      const currentCode =
        (session.user.user_metadata as AnyObj)?.referral_code ?? null;

      if (!mounted) return;
      setUserEmail(email);

      // If user already has a code, just use it
      if (currentCode) {
        setReferralCode(currentCode);
        // also ensure mapping row exists
        if (email) {
          await supabaseClient.from("referral_codes").upsert(
            {
              referral_code: currentCode,
              referrer_email: email,
            },
            { onConflict: "referral_code" }
          );
        }
        return;
      }

      // Otherwise generate & store
      if (email) {
        const prefix = email
          .split("@")[0]
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const code = `GG${prefix}${rand}`;

        const { data: upd, error } = await supabaseClient.auth.updateUser({
          data: { referral_code: code },
        });

        if (!error) {
          const finalCode =
            (upd?.user?.user_metadata as AnyObj)?.referral_code ?? code;
          setReferralCode(finalCode);

          // persist mapping
          await supabaseClient.from("referral_codes").upsert(
            {
              referral_code: finalCode,
              referrer_email: email,
            },
            { onConflict: "referral_code" }
          );
        } else {
          setReferralCode(code);
          await supabaseClient.from("referral_codes").upsert(
            {
              referral_code: code,
              referrer_email: email,
            },
            { onConflict: "referral_code" }
          );
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const referralLink =
    referralCode && userEmail
      ? `${REFERRAL_DOMAIN}?ref=${encodeURIComponent(referralCode)}`
      : "";

  // Pull my referrals (by referrer_email)
  const { data: referrals = [] } = useQuery({
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
    .filter((r: AnyObj) => r.status === "credited")
    .reduce((sum: number, r: AnyObj) => sum + (Number(r.credit_amount) || 0), 0);

  const pendingCredits = referrals
    .filter((r: AnyObj) => r.status === "pending" || r.status === "completed")
    .reduce((sum: number, r: AnyObj) => sum + (Number(r.credit_amount) || 0), 0);

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShareEmail = () => {
    if (!referralLink) return;
    const subject = encodeURIComponent("Get $10 off your windshield repair!");
    const body = encodeURIComponent(
      `Hi! I wanted to share Glass Guardian with you. They do amazing windshield repairs and come right to your location.\n\nUse my referral link to get $10 off your first service:\n${referralLink}\n\nPlus, I get a $15 credit after your service is complete. Highly recommend!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareSMS = () => {
    if (!referralLink) return;
    const message = encodeURIComponent(
      `Check out Glass Guardian for mobile windshield repair. Use my link to get $10 off your first repair and I'll earn a $15 credit after your service: ${referralLink}`
    );
    window.location.href = `sms:?&body=${message}`;
  };

  const heroMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.5, ease: "easeOut" },
      };

  const cardMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: "easeOut" },
      };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 md:px-8 text-slate-50">
      {/* 3D-ish background glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-gradient-to-br from-sky-500/40 via-cyan-400/30 to-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gradient-to-tr from-emerald-500/40 via-sky-500/30 to-indigo-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25)_0,_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(15,23,42,0.9),rgba(15,23,42,0.95))]" />

      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        {/* Hero / Header */}
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
              Your friend gets{" "}
              <span className="font-semibold text-emerald-300">
                $10 off their first repair
              </span>
              . You get{" "}
              <span className="font-semibold text-sky-300">
                $15 credit
              </span>{" "}
              after their service is complete. No limits on how many
              credits you can earn.
            </p>
          </div>

          {/* Floating 3D-ish referral HUD */}
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

              {/* Minimal "3D car" plate */}
              <div className="relative mb-4 h-24 w-full rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-[0_15px_35px_rgba(15,23,42,0.9)]">
                <div className="absolute inset-x-6 top-4 h-2 rounded-full bg-gradient-to-r from-sky-400/60 via-cyan-300/70 to-emerald-400/60 blur-[2px]" />
                <div className="absolute left-6 right-6 top-6 h-10 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-[0_10px_25px_rgba(15,23,42,0.9)]" />
                <div className="absolute inset-x-12 bottom-4 h-3 rounded-full bg-black/70 blur-md" />

                {/* car silhouette */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-10 w-32">
                    <div className="absolute inset-x-3 top-1 h-4 rounded-full bg-gradient-to-r from-slate-500 via-slate-300 to-slate-500" />
                    <div className="absolute inset-x-1 bottom-1 h-5 rounded-[999px] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-600/60" />
                    <div className="absolute left-4 bottom-0 h-4 w-4 rounded-full bg-slate-900 border border-slate-500 shadow-[0_0_0_2px_rgba(15,23,42,1)]" />
                    <div className="absolute right-4 bottom-0 h-4 w-4 rounded-full bg-slate-900 border border-slate-500 shadow-[0_0_0_2px_rgba(15,23,42,1)]" />
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

        {/* Main content grid */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
          {/* Left column */}
          <motion.div {...cardMotion} className="space-y-6">
            {/* How It Works */}
            <Card className="border border-slate-700/70 bg-slate-900/80 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <CardContent className="p-6 md:p-7">
                <h2 className="text-xl font-semibold text-slate-50 md:text-2xl">
                  How it works
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Share your link in under 10 seconds. Every completed referral
                  drops more credit into your Glass Guardian wallet.
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
                      Text, email, socials — whatever’s easiest. Your link tracks
                      referrals automatically.
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 shadow-[0_18px_40px_rgba(16,185,129,0.55)]">
                      <Users className="h-7 w-7 text-slate-950" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-50">
                      2. They book repair
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      Your friend gets{" "}
                      <span className="font-semibold text-emerald-300">
                        $10 off
                      </span>{" "}
                      their first Glass Guardian repair.
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
                      After their service is complete,{" "}
                      <span className="font-semibold text-sky-300">$15</span>{" "}
                      credit is added to your account.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referral History */}
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
                {referrals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 py-10">
                    <Users className="mb-3 h-10 w-10 text-slate-500" />
                    <p className="text-sm font-medium text-slate-200">
                      No referrals yet
                    </p>
                    <p className="mt-1 max-w-xs text-center text-xs text-slate-400">
                      Share your link a couple of times — most credits come from
                      friends you text directly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((ref: AnyObj) => (
                      <div
                        key={ref.id}
                        className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.9)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-50">
                              {ref.referred_email}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Referred{" "}
                              {new Date(
                                ref.created_at ?? ref.created_date
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge
                              className={
                                ref.status === "credited"
                                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                                  : ref.status === "completed"
                                  ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
                                  : "border-amber-400/40 bg-amber-500/15 text-amber-100"
                              }
                            >
                              {ref.status}
                            </Badge>
                            <p className="mt-1 text-xs font-semibold text-slate-200">
                              ${Number(ref.credit_amount || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right column: link + share */}
          <motion.div {...cardMotion} className="space-y-6">
            {/* Referral Link */}
            <Card className="border border-sky-500/40 bg-slate-900/90 shadow-[0_24px_60px_rgba(8,47,73,0.95)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-50 md:text-lg">
                  <Share2 className="h-5 w-5 text-sky-300" />
                  Your referral link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    value={referralLink}
                    readOnly
                    className="flex-1 bg-slate-950/70 font-mono text-xs text-black-200 ring-1 ring-sky-500/40 placeholder:text-slate-500"
                    placeholder="Generating your unique referral link..."
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
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

                <div className="flex flex-col gap-2 md:flex-row">
                  <Button
                    onClick={handleShareEmail}
                    variant="outline"
                    className="flex-1 border-emerald-400/40 bg-slate-900/80 text-slate-50 hover:bg-emerald-500/20 hover:text-emerald-50"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Share via email
                  </Button>
                  <Button
                    onClick={handleShareSMS}
                    variant="outline"
                    className="flex-1 border-sky-400/40 bg-slate-900/80 text-slate-50 hover:bg-sky-500/20 hover:text-sky-50"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Share via SMS
                  </Button>
                </div>

                <Alert className="border-sky-500/30 bg-sky-500/10 text-black-100">
                  <AlertDescription className="text-xs md:text-sm">
                    💡 <span className="font-semibold">Pro tip:</span> Drop your
                    link with a quick personal note. Referrals convert way more
                    when they know you actually used Glass Guardian.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
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
                    Total referrals
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    {referrals.length}
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