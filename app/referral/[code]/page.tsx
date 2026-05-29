// app/referral/[code]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  Sparkles,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Loader2,
  Gift,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type LookupState = {
  loading: boolean;
  referrerName: string | null;
  referrerEmail: string | null;
  isValid: boolean | null;
  message?: string | null;
};

function normalizePhone(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

async function lookupReferralCode(referralCode: string) {
  const queryPromise = supabaseClient
    .from("referral_codes")
    .select("referrer_email, referral_code")
    .eq("referral_code", referralCode)
    .maybeSingle();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Referral lookup timed out."));
    }, 10000);
  });

  return Promise.race([queryPromise, timeoutPromise]);
}

function ReferralLookupStatus({
  lookup,
  reduceMotion,
}: {
  lookup: LookupState;
  reduceMotion: boolean;
}) {
  return (
    <div className="mt-6 min-h-[56px]">
      <AnimatePresence mode="wait" initial={false}>
        {lookup.loading ? (
          <motion.div
            key="lookup-loading"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.985 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: reduceMotion ? 0.18 : 0.28, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/60"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking referral link...
          </motion.div>
        ) : lookup.isValid === false ? (
          <motion.div
            key="lookup-invalid"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: reduceMotion ? 0.18 : 0.28, ease: "easeOut" }}
            className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />
              <p>
                {lookup.message ||
                  "This referral link looks invalid or inactive. You can still contact us directly from the home page."}
              </p>
            </div>
          </motion.div>
        ) : lookup.isValid === true ? (
          <motion.div
            key="lookup-verified"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            animate={
              reduceMotion
                ? { opacity: 1 }
                : {
                    opacity: 1,
                    y: 0,
                    scale: [0.97, 1.02, 1],
                    boxShadow: [
                      "0 0 0 rgba(16,185,129,0)",
                      "0 0 0 6px rgba(16,185,129,0.08)",
                      "0 0 0 rgba(16,185,129,0)",
                    ],
                  }
            }
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            transition={{
              duration: reduceMotion ? 0.18 : 0.55,
              ease: "easeOut",
              times: reduceMotion ? undefined : [0, 0.55, 1],
            }}
            className="relative inline-flex flex-wrap items-center gap-2 overflow-hidden rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200"
          >
            {!reduceMotion ? (
              <>
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.75, 0] }}
                  transition={{ duration: 1.15, ease: "easeOut" }}
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(52,211,153,0.20) 0%, rgba(52,211,153,0.08) 38%, rgba(52,211,153,0) 72%)",
                  }}
                />
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
                  initial={{ x: "-120%", opacity: 0 }}
                  animate={{ x: "420%", opacity: [0, 0.45, 0] }}
                  transition={{ duration: 0.75, ease: "easeOut", delay: 0.08 }}
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
                    filter: "blur(8px)",
                  }}
                />
              </>
            ) : null}

            <motion.span
              initial={reduceMotion ? { opacity: 1 } : { scale: 0.7, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { scale: [0.7, 1.14, 1], opacity: 1 }}
              transition={{ duration: reduceMotion ? 0.18 : 0.42, ease: "easeOut", delay: 0.04 }}
              className="relative z-[1] flex items-center"
            >
              <CheckCircle2 className="h-4 w-4" />
            </motion.span>

            <span className="relative z-[1] font-medium">Referral link verified</span>

            {lookup.referrerName || lookup.referrerEmail ? (
              <span className="relative z-[1] text-white/70">
                • {lookup.referrerName || lookup.referrerEmail}
              </span>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="lookup-unknown"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100"
          >
            We couldn’t verify this referral link right now. Please refresh and try again.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReferralLandingPage() {
  const params = useParams<{ code: string }>();
  const reduceMotion = useReducedMotion();

  const referralCode = String(params?.code ?? "").trim();

  const [lookup, setLookup] = React.useState<LookupState>({
    loading: true,
    referrerName: null,
    referrerEmail: null,
    isValid: null,
    message: null,
  });

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    async function run() {
      if (!referralCode) {
        if (!alive) return;
        setLookup({
          loading: false,
          referrerName: null,
          referrerEmail: null,
          isValid: false,
          message: "No referral code was found in this link.",
        });
        return;
      }

      setLookup({
        loading: true,
        referrerName: null,
        referrerEmail: null,
        isValid: null,
        message: null,
      });

      try {
        const result = (await lookupReferralCode(referralCode)) as {
          data: any;
          error: any;
        };

        if (!alive) return;

        const { data, error } = result;

        if (error || !data) {
          setLookup({
            loading: false,
            referrerName: null,
            referrerEmail: null,
            isValid: false,
            message: "This referral link looks invalid or inactive.",
          });
          return;
        }

        setLookup({
          loading: false,
          referrerName: null,
          referrerEmail: String(data?.referrer_email ?? "").trim() || null,
          isValid: true,
          message: null,
        });
      } catch (err: any) {
        if (!alive) return;
        setLookup({
          loading: false,
          referrerName: null,
          referrerEmail: null,
          isValid: false,
          message:
            err?.message === "Referral lookup timed out."
              ? "Referral verification took too long. Please refresh and try again."
              : "We couldn’t verify this referral link right now. Please try again.",
        });
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [referralCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanName || cleanName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }

    if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (lookup.loading || lookup.isValid !== true) {
      setError("Please wait until the referral link is verified before continuing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/referrals/request-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          referral_code: referralCode || null,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Unable to submit your referral request.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,199,94,0.16),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,220,120,0.10),transparent_22%),linear-gradient(180deg,#06070b_0%,#090b11_45%,#05060a_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.35),rgba(0,0,0,0.7))]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:34px_34px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8 lg:p-10"
          >
            <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" />
            <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-yellow-200/5 blur-3xl" />

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Badge className="border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100 hover:bg-amber-300/10">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Referral Access
              </Badge>

              {referralCode ? (
                <Badge className="border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-[0.18em] text-white/80 hover:bg-white/5">
                  {referralCode}
                </Badge>
              ) : null}
            </div>

            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-100">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/80">
                    Glass Guardian
                  </p>
                  <p className="text-sm text-white/55">Chip &amp; crack repair</p>
                </div>
              </div>

              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
                Awesome — you were referred to the best mobile windshield repair in Southern California.
              </h1>

              <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/72 sm:text-base">
                {lookup.referrerName
                  ? `${lookup.referrerName} recommended Glass Guardian for fast, professional mobile windshield chip and crack repair.`
                  : "A friend or family member recommended Glass Guardian for fast, professional mobile windshield chip and crack repair."}{" "}
                We come to you, keep it simple, and help protect your glass before the damage spreads.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Service</p>
                  <p className="mt-2 font-medium text-white">Mobile repair</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Typical time</p>
                  <p className="mt-2 font-medium text-white">15–30 minutes</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Coverage</p>
                  <p className="mt-2 font-medium text-white">Southern California</p>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm text-amber-50/90">
                <div className="flex items-start gap-3">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                  <p className="leading-6">
                    Submit your information and our team will send your profile invite. Once your appointment is completed successfully, the person who referred you can be credited automatically.
                  </p>
                </div>
              </div>

              <ReferralLookupStatus lookup={lookup} reduceMotion={!!reduceMotion} />
            </div>
          </motion.section>

          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: reduceMotion ? 0 : 0.05 }}
          >
            <Card className="overflow-hidden rounded-[28px] border-white/10 bg-[#0b0d13]/90 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <CardContent className="p-6 sm:p-8">
                {!success ? (
                  <>
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-100/80">
                        Claim your invite
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Enter your information
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        This goes to our admin referral workflow so we can send your invite and connect your referral correctly.
                      </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Full name</label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Your full name"
                            className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/30"
                            autoComplete="name"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Email address</label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/30"
                            autoComplete="email"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Phone number</label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                          <Input
                            value={phone}
                            onChange={(e) => setPhone(normalizePhone(e.target.value))}
                            placeholder="555-555-5555"
                            className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/30"
                            autoComplete="tel"
                            inputMode="tel"
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Referral code</p>
                        <p className="mt-2 break-all font-mono text-sm text-white/85">
                          {referralCode || "No code found"}
                        </p>
                      </div>

                      {error ? (
                        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                          {error}
                        </div>
                      ) : null}

                      <Button
                        type="submit"
                        disabled={submitting || lookup.loading || lookup.isValid !== true}
                        className="group h-12 w-full rounded-xl border border-amber-300/25 bg-[linear-gradient(135deg,rgba(245,199,94,0.24),rgba(255,214,102,0.14))] text-white shadow-[0_10px_35px_rgba(245,199,94,0.12)] transition hover:border-amber-200/35 hover:bg-[linear-gradient(135deg,rgba(245,199,94,0.28),rgba(255,214,102,0.16))] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending invite request...
                          </>
                        ) : lookup.loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying referral...
                          </>
                        ) : (
                          <>
                            Claim Your Invite
                            <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-xs leading-5 text-white/40">
                      By continuing, you agree to be contacted about your referral invite and booking setup.
                    </p>
                  </>
                ) : (
                  <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200/85">
                      You’re in
                    </p>

                    <h2 className="mt-3 text-3xl font-semibold text-white">
                      Your invite request was sent
                    </h2>

                    <p className="mt-4 max-w-md text-sm leading-7 text-white/65">
                      Our team received your information and will send your profile invite shortly. Your referral is now tied to this referral code in the system.
                    </p>

                    <div className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/45">Submitted</p>
                      <div className="mt-3 space-y-2 text-sm text-white/75">
                        <p>
                          <span className="text-white/45">Name:</span> {fullName}
                        </p>
                        <p>
                          <span className="text-white/45">Email:</span> {email}
                        </p>
                        <p>
                          <span className="text-white/45">Phone:</span> {phone}
                        </p>
                        <p className="break-all">
                          <span className="text-white/45">Referral:</span> {referralCode}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8">
                      <Link href="/">
                        <Button
                          variant="outline"
                          className="rounded-xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                        >
                          Back to Home
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </div>
    </main>
  );
}