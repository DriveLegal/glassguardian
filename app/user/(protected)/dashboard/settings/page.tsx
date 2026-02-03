// app/user/(protected)/dashboard/settings/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  User as UserIcon,
  Bell,
  MapPin,
  Save,
  Loader2,
  LogOut,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AnyObj = Record<string, any>;

const SETTINGS_ROUTE = "/user/dashboard/settings";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeErrorMessage(err: any) {
  return (
    err?.message ||
    err?.error_description ||
    err?.error ||
    "Something went wrong."
  );
}

/**
 * Lightweight phone normalization.
 */
function normalizePhone(input: string) {
  return input.replace(/[^\d()+\-\s]/g, "").trim();
}

function normalizeState(input: string) {
  return String(input ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}

function normalizeZip(input: string) {
  return String(input ?? "").replace(/[^\d\-]/g, "").slice(0, 10).trim();
}

export default function SettingsPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [userEmail, setUserEmail] = React.useState<string>("");
  const [authUserId, setAuthUserId] = React.useState<string>("");

  const [saved, setSaved] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  // WOW: "dirty" tracking + quick stats
  const initialRef = React.useRef<string>("");
  const [dirty, setDirty] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string>("");

  // WOW: live field validation state
  const [touched, setTouched] = React.useState<{ full_name: boolean }>({
    full_name: false,
  });

  const [formData, setFormData] = React.useState({
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    gate_notes: "",
    notification_email: true,
    notification_sms: true,
  });

  const handleLogout = React.useCallback(async () => {
    try {
      await supabaseClient.auth.signOut();
    } catch {
      // ignore, still route to login
    } finally {
      router.push("/user/login");
    }
  }, [router]);

  // Load authenticated user + profile
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabaseClient.auth.getSession();
        const session = data?.session ?? null;

        if (!session?.user) {
          router.replace(
            `/user/login?redirect=${encodeURIComponent(SETTINGS_ROUTE)}`
          );
          return;
        }

        const email = session.user.email ?? "";
        const uid = session.user.id ?? "";

        if (!alive) return;
        setUserEmail(email);
        setAuthUserId(uid);

        // Fetch profile row from app_users
        const { data: profile, error } = await supabaseClient
          .from("app_users")
          .select(
            "full_name,phone,address_line1,address_line2,city,state,zip,gate_notes,notification_email,notification_sms,updated_at"
          )
          .eq("email", email)
          .maybeSingle();

        if (error) {
          if (!alive) return;
          setErrorMsg(safeErrorMessage(error));
        } else if (profile) {
          const next = {
            full_name: profile.full_name ?? "",
            phone: profile.phone ?? "",
            address_line1: profile.address_line1 ?? "",
            address_line2: profile.address_line2 ?? "",
            city: profile.city ?? "",
            state: profile.state ?? "",
            zip: profile.zip ?? "",
            gate_notes: profile.gate_notes ?? "",
            notification_email: profile.notification_email !== false,
            notification_sms: profile.notification_sms !== false,
          };

          if (!alive) return;
          setFormData(next);
          initialRef.current = JSON.stringify(next);
          setDirty(false);

          if (profile.updated_at) {
            setLastSavedAt(new Date(profile.updated_at).toLocaleString());
          }
        } else {
          // No profile row yet — initialize baseline for dirty tracking
          const baseline = JSON.stringify(formData);
          initialRef.current = baseline;
          setDirty(false);
        }
      } catch (err: any) {
        if (!alive) return;
        setErrorMsg(safeErrorMessage(err) || "Failed to load profile.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Dirty tracking
  React.useEffect(() => {
    const baseline = initialRef.current;
    if (!baseline) return;
    const current = JSON.stringify(formData);
    setDirty(current !== baseline);
  }, [formData]);

  const profileCompleteness = React.useMemo(() => {
    const fields = [
      formData.full_name,
      formData.phone,
      formData.address_line1,
      formData.city,
      formData.state,
      formData.zip,
    ];
    const filled = fields.filter((v) => String(v || "").trim().length > 0)
      .length;
    const pct = Math.round((filled / fields.length) * 100);
    return { filled, total: fields.length, pct };
  }, [formData]);

  const quickTips = React.useMemo(() => {
    const tips: string[] = [];
    if (!formData.full_name.trim()) tips.push("Add your full name to save.");
    if (!formData.phone.trim()) tips.push("Add a phone number for SMS alerts.");
    if (!formData.address_line1.trim())
      tips.push("Add a service address for faster scheduling.");
    if (!formData.gate_notes.trim())
      tips.push("Gate notes help the tech arrive quicker.");
    if (tips.length === 0) tips.push("You’re all set — profile looks dialed in.");
    return tips.slice(0, 2);
  }, [formData]);

  // Validation: full_name is NOT NULL in DB, so we must enforce
  const fullNameOk = React.useMemo(
    () => formData.full_name.trim().length >= 2,
    [formData.full_name]
  );

  // Save/Upsert profile into app_users
  const updateMutation = useMutation({
    mutationFn: async (payload: AnyObj) => {
      if (!userEmail) throw new Error("Missing user email");
      if (!authUserId) throw new Error("Missing auth user id");

      const name = String(payload.full_name ?? "").trim();
      if (!name) {
        throw new Error("Full name is required.");
      }

      const sanitized = {
        ...payload,
        full_name: name,
        phone: normalizePhone(String(payload.phone ?? "")),
        state: normalizeState(payload.state),
        zip: normalizeZip(payload.zip),
      };

      const { error } = await supabaseClient.from("app_users").upsert(
        {
          // 🔥 IMPORTANT FOR RLS (recommended option #1)
          auth_user_id: authUserId,

          // Keep email as conflict target (you already have unique constraint)
          email: userEmail,

          ...sanitized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      setErrorMsg("");

      const baseline = JSON.stringify(formData);
      initialRef.current = baseline;
      setDirty(false);
      setLastSavedAt(new Date().toLocaleString());

      window.setTimeout(() => setSaved(false), 2600);
    },
    onError: (err: any) => {
      setErrorMsg(safeErrorMessage(err) || "Failed to update profile.");
    },
  });

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();

    // Touch name so user sees feedback
    setTouched((t) => ({ ...t, full_name: true }));

    if (!fullNameOk) {
      setErrorMsg("Please enter your full name before saving.");
      return;
    }

    updateMutation.mutate(formData);
  };

  const isSaving = updateMutation.isPending;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-slate-50 md:px-8">
      {/* WOW: Animated cosmic/glass background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -left-28 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-sky-500/40 via-cyan-400/25 to-emerald-400/20 blur-3xl"
          animate={
            reduceMotion ? undefined : { y: [0, -12, 0], x: [0, 10, 0] }
          }
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-gradient-to-tr from-emerald-500/35 via-sky-500/25 to-indigo-500/20 blur-3xl"
          animate={
            reduceMotion ? undefined : { y: [0, 14, 0], x: [0, -10, 0] }
          }
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-sky-500/35 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18)_0,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(2,6,23,0.82),rgba(15,23,42,0.92))]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {/* Header + Logout */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
                <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-400 to-emerald-400 shadow-[0_18px_40px_rgba(56,189,248,0.45)]">
                  <UserIcon className="h-6 w-6 text-slate-950" />
                  <span className="pointer-events-none absolute inset-x-1 top-0 h-2 rounded-t-2xl bg-white/35 blur-[1.5px]" />
                </span>
                Account Settings
              </h1>

              {/* Status chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1 text-[0.72rem] text-slate-200 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Secure Profile
                </span>

                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.72rem] shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl",
                    dirty
                      ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
                      : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                  )}
                >
                  {dirty ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                      Unsaved changes
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      Up to date
                    </>
                  )}
                </span>

                {!fullNameOk ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[0.72rem] text-rose-100 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <Wand2 className="h-4 w-4 text-rose-200" />
                    Add name to save
                  </span>
                ) : null}
              </div>
            </div>

            <p className="text-sm text-slate-300 md:text-base">
              Update your profile, service address, and notifications so every
              appointment runs smooth.
            </p>

            {/* Completeness micro-bar */}
            <div className="mt-1 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-300" />
                  Profile completeness
                </span>
                <span className="text-slate-300">
                  {profileCompleteness.pct}%{" "}
                  <span className="text-slate-500">
                    ({profileCompleteness.filled}/{profileCompleteness.total})
                  </span>
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-slate-700/80">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400"
                  initial={false}
                  animate={{ width: `${profileCompleteness.pct}%` }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.6,
                    ease: "easeOut",
                  }}
                />
              </div>

              {lastSavedAt ? (
                <p className="text-xs text-slate-400">
                  Last saved:{" "}
                  <span className="text-slate-300">{lastSavedAt}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Logout */}
          <motion.button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-600/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-3.5 py-2 text-xs font-medium text-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.95)] ring-1 ring-sky-500/0 hover:ring-sky-500/40 hover:shadow-[0_22px_55px_rgba(15,23,42,1)] backdrop-blur-xl transition-all"
            whileHover={reduceMotion ? undefined : { y: -1, scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97, y: 0 }}
          >
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 via-orange-300 to-amber-200 shadow-[0_10px_24px_rgba(248,113,113,0.75)]">
              <LogOut className="h-4 w-4 text-slate-950" />
              <span className="pointer-events-none absolute inset-x-1 top-0 h-2 rounded-t-2xl bg-white/35 blur-[1.5px]" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-300">
                Session
              </span>
              <span className="text-[0.8rem] font-semibold">Log out</span>
            </span>
          </motion.button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="mt-10 flex items-center justify-center">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.9)] backdrop-blur-xl">
              <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
              <span className="text-sm text-slate-200">
                Loading your settings…
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence initial={false}>
              {errorMsg ? (
                <motion.div
                  key="err"
                  initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <Alert variant="destructive" className="border-red-400/60">
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                </motion.div>
              ) : null}

              {saved ? (
                <motion.div
                  key="saved"
                  initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <Alert className="border-emerald-400/60 bg-emerald-500/10 text-emerald-100">
                    <AlertDescription>✓ Profile updated successfully.</AlertDescription>
                  </Alert>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Quick tips */}
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.85)] backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-400 to-emerald-300 text-slate-950 shadow-[0_14px_30px_rgba(56,189,248,0.45)]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-50">
                    Quick suggestions
                  </p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-300">
                    {quickTips.map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <Card className="border border-slate-700/80 bg-slate-900/80 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-50 md:text-lg">
                  <UserIcon className="h-5 w-5 text-sky-300" />
                  Personal Information
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label
                      htmlFor="full_name"
                      className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                    >
                      Full Name <span className="text-rose-300">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData({ ...formData, full_name: e.target.value })
                      }
                      onBlur={() =>
                        setTouched((t) => ({ ...t, full_name: true }))
                      }
                      placeholder="John Doe"
                      aria-invalid={touched.full_name && !fullNameOk}
                      className={cn(
                        "mt-1 bg-slate-950/70 text-sm text-slate-50 ring-1 placeholder:text-slate-500",
                        touched.full_name && !fullNameOk
                          ? "ring-rose-400/70"
                          : "ring-slate-700/80"
                      )}
                    />
                    <AnimatePresence initial={false}>
                      {touched.full_name && !fullNameOk ? (
                        <motion.p
                          initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                          transition={{ duration: 0.16 }}
                          className="mt-1 text-xs text-rose-200"
                        >
                          Full name is required to save your profile.
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <div>
                    <Label
                      htmlFor="phone"
                      className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                    >
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: normalizePhone(e.target.value),
                        })
                      }
                      placeholder="(555) 123-4567"
                      className="mt-1 bg-slate-950/70 text-sm text-slate-50 ring-1 ring-slate-700/80 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
                    Email
                  </Label>
                  <Input
                    value={userEmail}
                    disabled
                    className="mt-1 bg-slate-900/80 text-sm text-slate-200 ring-1 ring-slate-700/80"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Email is used for login and notifications and cannot be changed here.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card className="border border-slate-700/80 bg-slate-900/80 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-50 md:text-lg">
                  <MapPin className="h-5 w-5 text-emerald-300" />
                  Default Service Address
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <Label
                    htmlFor="address_line1"
                    className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                  >
                    Address Line 1
                  </Label>
                  <Input
                    id="address_line1"
                    value={formData.address_line1}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line1: e.target.value })
                    }
                    placeholder="123 Main Street"
                    className="mt-1 bg-slate-950/70 text-sm text-slate-50 ring-1 ring-slate-700/80 placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="address_line2"
                    className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                  >
                    Address Line 2
                  </Label>
                  <Input
                    id="address_line2"
                    value={formData.address_line2}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line2: e.target.value })
                    }
                    placeholder="Apt 4B"
                    className="mt-1 bg-slate-950/70 text-sm text-slate-50 ring-1 ring-slate-700/80 placeholder:text-slate-500"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label
                      htmlFor="city"
                      className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                    >
                      City
                    </Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="San Francisco"
                      className="mt-1 bg-slate-950/70 text-sm text-slate-50 ring-1 ring-slate-700/80 placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="state"
                      className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                    >
                      State
                    </Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: normalizeState(e.target.value) })
                      }
                      placeholder="CA"
                      maxLength={2}
                      className="mt-1 bg-slate-950/70 text-sm text-slate-50 ring-1 ring-slate-700/80 placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="zip"
                      className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                    >
                      ZIP Code
                    </Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) =>
                        setFormData({ ...formData, zip: normalizeZip(e.target.value) })
                      }
                      placeholder="94102"
                      inputMode="numeric"
                      className="mt-1 bg-slate-950/70 text-sm text-slate-50 ring-1 ring-slate-700/80 placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="gate_notes"
                    className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300"
                  >
                    Gate Code / Access Notes
                  </Label>
                  <Textarea
                    id="gate_notes"
                    value={formData.gate_notes}
                    onChange={(e) =>
                      setFormData({ ...formData, gate_notes: e.target.value })
                    }
                    placeholder="Gate code: #1234. Call when you arrive."
                    rows={2}
                    className="mt-1 bg-slate-950/70 text-sm text-black-50 ring-1 ring-slate-700/80 placeholder:text-slate-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="border border-slate-700/80 bg-slate-900/80 shadow-[0_24px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-50 md:text-lg">
                  <Bell className="h-5 w-5 text-amber-300" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-50">
                      Email Notifications
                    </p>
                    <p className="text-xs text-slate-400">
                      Appointment confirmations, updates and receipts.
                    </p>
                  </div>
                  <Switch
                    checked={formData.notification_email}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notification_email: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-50">
                      SMS Notifications
                    </p>
                    <p className="text-xs text-slate-400">
                      Tech on-the-way alerts and same-day reminders.
                    </p>
                  </div>
                  <Switch
                    checked={formData.notification_sms}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notification_sms: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold text-slate-950 shadow-[0_20px_40px_rgba(56,189,248,0.65)] transition-all",
                "bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 hover:opacity-95",
                dirty ? "ring-2 ring-sky-400/40" : "ring-1 ring-slate-700/30"
              )}
              disabled={isSaving || !dirty || !fullNameOk}
              title={
                !fullNameOk
                  ? "Add your full name to save"
                  : !dirty
                  ? "No changes to save"
                  : undefined
              }
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  {dirty ? "Save Changes" : "Saved"}
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}