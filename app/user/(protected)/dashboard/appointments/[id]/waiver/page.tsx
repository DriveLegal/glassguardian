//app/user/(protected)/dashboard/appointments/[id]/waiver/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignatureCanvas from "@/components/forms/SignatureCanvas";
import { buildGlassGuardianWaiverText } from "@/lib/waivers/glassGuardianWaiver";

function isoDateInTZ(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function useAppointment(id: string) {
  return useQuery({
    queryKey: ["appointment", id],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Appointment not found");
      return data;
    },
    enabled: !!id,
  });
}

type WaiverDisplay = {
  id: string;
  signed_at: string;
  full_name: string;
  initials: string;
  signature_png_path?: string | null;
  signature_name?: string | null;
};

function useWaiver(appointmentId: string) {
  return useQuery({
    queryKey: ["appointment_waiver", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointment_waivers")
        .select("id, signed_at, signer_name, initials, signature_png_path, signature_name")
        .eq("appointment_id", appointmentId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const mapped: WaiverDisplay = {
        id: String((data as any).id),
        signed_at: String((data as any).signed_at),
        full_name: String((data as any).signer_name ?? ""),
        initials: String((data as any).initials ?? ""),
        signature_png_path: (data as any).signature_png_path ?? null,
        signature_name: (data as any).signature_name ?? null,
      };

      return mapped;
    },
    enabled: !!appointmentId,
  });
}

export default function AppointmentWaiverPage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) || "";
  const router = useRouter();
  const qc = useQueryClient();

  const { data: appt, isLoading: apptLoading, error: apptErr } = useAppointment(id);
  const { data: waiver, isLoading: waiverLoading } = useWaiver(id);

  const [fullName, setFullName] = React.useState("");
  const [initials, setInitials] = React.useState("");
  const [agree, setAgree] = React.useState(false);

  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  const tz = "America/Los_Angeles";
  const waiverText = React.useMemo(() => buildGlassGuardianWaiverText(60), []);

  const dayGate = React.useMemo(() => {
    const today = isoDateInTZ(new Date(), tz);

    let apptDay: string | null = null;
    if (appt?.scheduled_at) {
      try {
        apptDay = isoDateInTZ(new Date(appt.scheduled_at), tz);
      } catch {
        apptDay = null;
      }
    }
    if (!apptDay && appt?.scheduled_date) apptDay = String(appt.scheduled_date).slice(0, 10);

    if (!apptDay) return { allowed: false, reason: "Missing appointment time/date." };

    if (today !== apptDay) {
      return {
        allowed: false,
        reason: `Waiver is only available on the appointment day (${apptDay}).`,
      };
    }

    return { allowed: true, reason: null as string | null };
  }, [appt, tz]);

  async function submit() {
    setErr(null);
    setOk(false);

    if (!dayGate.allowed) {
      setErr(dayGate.reason || "Not allowed today.");
      return;
    }
    if (!agree) {
      setErr("Please confirm you agree to the waiver.");
      return;
    }
    if (fullName.trim().length < 2) {
      setErr("Please enter your full name.");
      return;
    }
    if (initials.trim().length < 1) {
      setErr("Please enter your initials.");
      return;
    }

    setSubmitting(true);

    try {
      const signature_type = signatureDataUrl ? "drawn" : "typed";
      const signature_payload = signatureDataUrl ? signatureDataUrl : null;

      const res = await fetch(`/api/appointments/${id}/waiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          initials: initials.trim(),
          signature_type,
          signature_payload,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to submit waiver.");

      setOk(true);
      await qc.invalidateQueries({ queryKey: ["appointment_waiver", id] });

      setTimeout(() => router.push(`/user/dashboard/appointments/${id}`), 700);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const loading = apptLoading || waiverLoading;

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
        <div className="absolute -top-44 -left-40 h-96 w-96 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -bottom-52 -right-44 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.9),rgba(2,6,23,0.98))]" />
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Button
            variant="secondary"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-2 text-slate-200">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <span className="font-semibold">Day-of Waiver</span>
          </div>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          <CardHeader>
            <CardTitle className="text-slate-100">Sign before service begins</CardTitle>
            <div className="text-sm text-slate-300">
              Required on the day of your appointment to authorize Glass Guardian to work on your vehicle.
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-3 text-slate-200">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading waiver…
              </div>
            ) : apptErr ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                Failed to load appointment.
              </div>
            ) : waiver ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-200 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  Waiver signed
                </div>
                <div className="text-sm text-slate-200 mt-1">
                  Signed by <span className="font-semibold">{waiver.full_name}</span> ({waiver.initials}) —{" "}
                  {new Date(waiver.signed_at).toLocaleString()}
                </div>
                <div className="mt-4">
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
                    onClick={() => router.push(`/user/dashboard/appointments/${id}`)}
                  >
                    Return to appointment
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {!dayGate.allowed && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-5 w-5" />
                      Not available yet
                    </div>
                    <div className="text-sm mt-1">{dayGate.reason}</div>
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Waiver Preview
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
                    {waiverText}
                  </pre>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Full name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full legal name"
                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                      disabled={!dayGate.allowed || submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Initials</Label>
                    <Input
                      value={initials}
                      onChange={(e) => setInitials(e.target.value.toUpperCase())}
                      placeholder="e.g., LH"
                      className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                      maxLength={5}
                      disabled={!dayGate.allowed || submitting}
                    />
                  </div>
                </div>

                <SignatureCanvas
                  valueDataUrl={signatureDataUrl}
                  onChangeDataUrl={setSignatureDataUrl}
                  disabled={!dayGate.allowed || submitting}
                />

                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-emerald-400"
                    disabled={!dayGate.allowed || submitting}
                  />
                  <div className="text-sm text-slate-200">
                    I have read and agree to the waiver above. I am signing this on the day of my appointment.
                  </div>
                </label>

                <AnimatePresence>
                  {err && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200 text-sm"
                    >
                      {err}
                    </motion.div>
                  )}
                  {ok && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200 text-sm"
                    >
                      Waiver saved. Returning to your appointment…
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
                    onClick={submit}
                    disabled={!dayGate.allowed || submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Sign & Continue
                      </>
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100"
                    onClick={() => router.push(`/user/dashboard/appointments/${id}`)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}