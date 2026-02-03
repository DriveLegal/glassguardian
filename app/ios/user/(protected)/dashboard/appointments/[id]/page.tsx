// app/user/(protected)/dashboard/appointments/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  Car,
  DollarSign,
  Shield,
  FileText,
  Image as ImageIcon,
  ArrowLeft,
  XCircle,
  TriangleAlert,
  HeartHandshake,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Loader2,
  PenLine,
} from "lucide-react";
import { format } from "date-fns";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImageLightbox from "@/components/media/ImageLightbox";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignatureCanvas from "@/components/forms/SignatureCanvas";

// ✅ Reuse your tech 10-step component (read-only on user side)
import ServiceProgress, {
  type ServiceStatusKey,
} from "@/components/tech/schedule/tenstep/ServiceProgress";

// ✅ NEW extracted helpers + hook + components
import {
  type AnyObj,
  type WaiverRow,
  CANCELLABLE_STATUSES,
  canCancelStatus,
  buildWaiverText,
  getWaiverSigningWindow,
  getStatusVisuals,
  getBillingMeta,
  isCrackOut,
  crackOutSummary,
  normalizeInitials,
  normalizeName,
} from "@/lib/appointments/helpers";

import { useAppointmentRealtime } from "@/lib/hooks/useAppointmentRealtime";

import { CrackOutTrustDialog } from "@/components/shared/appointments/CrackOutTrustDialog";
import { WaiverCard } from "@/components/shared/appointments/WaiverCard";
import { TechnicianCard } from "@/components/shared/appointments/TechnicianCard";

async function getAccessTokenBestEffort(): Promise<string> {
  const { data: s1 } = await supabaseClient.auth.getSession();
  let tok = s1?.session?.access_token || "";
  if (!tok) {
    await supabaseClient.auth.refreshSession().catch(() => {});
    const { data: s2 } = await supabaseClient.auth.getSession();
    tok = s2?.session?.access_token || "";
  }
  return tok;
}

/* -----------------------------------------------------------
   iOS / App-mode elite UI helpers
----------------------------------------------------------- */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useScrollY() {
  const [y, setY] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setY(window.scrollY || 0));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return y;
}

const V = {
  page: {
    hidden: { opacity: 0, y: 10 },
    show: (reduced: boolean) => ({
      opacity: 1,
      y: 0,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
    }),
  },
  float: {
    hidden: { opacity: 0, y: 18, scale: 0.98 },
    show: (reduced: boolean) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
    }),
    exit: (reduced: boolean) => ({
      opacity: 0,
      y: 18,
      scale: 0.98,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
    }),
  },
  card: {
    hidden: { opacity: 0, y: 14 },
    show: (reduced: boolean) => ({
      opacity: 1,
      y: 0,
      transition: reduced
        ? { duration: 0.01 }
        : { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    }),
  },
};

function LiquidBackdrop() {
  // Pure CSS / gradients – no deps.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(900px_560px_at_85%_10%,rgba(56,189,248,0.16),transparent_55%),radial-gradient(900px_600px_at_50%_110%,rgba(16,185,129,0.10),transparent_58%)]" />
      {/* liquid blobs */}
      <div className="absolute -top-32 -left-28 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
      <div className="absolute -top-28 -right-32 h-[460px] w-[460px] rounded-full bg-sky-500/10 blur-3xl animate-[pulse_7.5s_ease-in-out_infinite]" />
      <div className="absolute -bottom-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/8 blur-3xl animate-[pulse_8.5s_ease-in-out_infinite]" />
      {/* subtle noise-ish grid */}
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:44px_44px]" />
      {/* top sheen */}
      <div className="absolute -top-24 left-0 right-0 h-48 bg-gradient-to-b from-white/7 via-white/0 to-transparent blur-2xl" />
    </div>
  );
}

function GlassTopBar({
  title,
  subtitle,
  statusBadgeClass,
  statusText,
  backHref,
}: {
  title: string;
  subtitle: string;
  statusBadgeClass: string;
  statusText: string;
  backHref: string;
}) {
  return (
    <div className="sticky top-0 z-40 -mx-4 px-4 pt-[env(safe-area-inset-top)]">
      <div className="relative mt-2 rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl shadow-[0_18px_80px_rgba(2,132,199,0.10)]">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/7 via-transparent to-transparent opacity-70" />
        <div className="relative flex items-center gap-3 p-3">
          <Link href={backHref} className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 active:scale-[0.99]"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="truncate text-[0.95rem] font-semibold text-slate-50">
                {title}
              </h1>
              <Badge className={cx("shrink-0", statusBadgeClass)}>
                {statusText}
              </Badge>
            </div>
            <p className="truncate text-[0.72rem] text-slate-300/90">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const appointmentId = params?.id as string | undefined;

  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  // crack-out trust pop
  const [trustOpen, setTrustOpen] = React.useState(false);

  // waiver dialog + form
  const [waiverOpen, setWaiverOpen] = React.useState(false);
  const [waiverName, setWaiverName] = React.useState("");
  const [waiverInitials, setWaiverInitials] = React.useState("");
  const [waiverSignature, setWaiverSignature] = React.useState<string | null>(
    null
  );
  const [waiverError, setWaiverError] = React.useState<string | null>(null);

  // App-mode: floating action rail visibility
  const scrollY = useScrollY();
  const showFloatingRail = scrollY > 120;

  // Ensure authenticated user
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!session?.user) {
        router.replace(
          `/user/login?redirect=${encodeURIComponent(
            `/user/dashboard/appointments/${appointmentId ?? ""}`
          )}`
        );
        return;
      }
      setUserEmail(session.user.email ?? null);

      // prefill name best-effort
      const full =
        (session.user.user_metadata?.full_name as string | undefined) ??
        (session.user.user_metadata?.name as string | undefined) ??
        "";
      if (full && !waiverName) setWaiverName(String(full));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  /** Appointment */
  const {
    data: appointment,
    isLoading: loadingAppointment,
    error: appointmentErr,
  } = useQuery({
    queryKey: ["appointment", appointmentId],
    enabled: !!appointmentId && !!userEmail,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .limit(1)
        .single();
      if (error) throw error;
      return data as AnyObj;
    },
  });

  /** Waiver exists? */
  const { data: waiverRow = null } = useQuery({
    queryKey: ["appointment-waiver", appointmentId],
    enabled: !!appointmentId && !!userEmail,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 15000,
    queryFn: async () => {
      try {
        const { data, error } = await supabaseClient
          .from("appointment_waivers")
          .select(
            "id,appointment_id,signer_name,initials,signature_storage_path,created_at"
          )
          .eq("appointment_id", appointmentId)
          .maybeSingle();

        if (error) {
          if ((error as any)?.code === "PGRST205") return null;
          throw error;
        }
        return (data ?? null) as WaiverRow | null;
      } catch {
        return null;
      }
    },
  });

  const waiverSigned = !!waiverRow?.id;

  /**
   * ✅ Invoice 존재 여부
   * Only show "View Invoice" if an actual invoice row exists.
   */
  const { data: invoiceRow = null } = useQuery({
    queryKey: ["invoice_by_appt", appointmentId],
    enabled: !!appointmentId && !!userEmail,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 15000,
    queryFn: async () => {
      try {
        const { data, error } = await supabaseClient
          .from("tech_invoices")
          .select("id, appointment_id, status, total, created_at")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          if ((error as any)?.code === "PGRST205") return null;
          throw error;
        }
        return (data ?? null) as AnyObj | null;
      } catch {
        return null;
      }
    },
  });

  const canViewInvoice = !!invoiceRow?.id;

  /**
   * ✅ REALTIME: extracted hook (appointments + waivers)
   */
  useAppointmentRealtime({
    appointmentId,
    userEmail,
    queryClient,
  });

  /** Vehicle */
  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", appointment?.vehicle_id],
    enabled: !!appointment?.vehicle_id && !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select("*")
        .eq("id", appointment!.vehicle_id)
        .limit(1)
        .single();
      if (error) throw error;
      return data as AnyObj;
    },
  });

  /** Photos (tolerate missing table) */
  const { data: photos = [] } = useQuery({
    queryKey: ["photos", appointmentId],
    enabled: !!appointmentId && !!userEmail,
    queryFn: async () => {
      try {
        const { data, error } = await supabaseClient
          .from("photos")
          .select("*")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: true });

        if (error) {
          if ((error as any)?.code === "PGRST205") return [];
          throw error;
        }
        return (data ?? []) as AnyObj[];
      } catch {
        return [];
      }
    },
  });

  /** Technician */
  const { data: technician } = useQuery({
    queryKey: ["technician", appointment?.technician_email],
    enabled: !!appointment?.technician_email && !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("users_public")
        .select("*")
        .eq("email", appointment!.technician_email)
        .limit(1)
        .single();
      if (error) throw error;
      return data as AnyObj;
    },
  });

  /** Open trust dialog once per appointment if crack-out */
  React.useEffect(() => {
    if (!appointmentId || !appointment) return;
    if (!isCrackOut(appointment)) return;

    const key = `gg_ack_crackout_detail_${appointmentId}`;
    try {
      const already = window.localStorage.getItem(key) === "1";
      if (already) return;
      setTrustOpen(true);
      window.localStorage.setItem(key, "1");
    } catch {
      setTrustOpen(true);
    }
  }, [appointmentId, appointment]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      setCancelError(null);
      const { data, error } = await supabaseClient
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", [...CANCELLABLE_STATUSES])
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error(
          "Unable to cancel — your appointment may already be in progress or en route."
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["my-appointments", userEmail] });
    },
    onError: (err: any) => {
      setCancelError(err?.message ?? "Failed to cancel appointment.");
    },
  });

  const waiverSignMutation = useMutation({
    mutationFn: async () => {
      setWaiverError(null);

      if (!appointmentId || !appointment) throw new Error("Missing appointment.");

      const rules = getWaiverSigningWindow(appointment);
      if (!rules.canSignNow)
        throw new Error(rules.reason ?? "Waiver signing is not available yet.");

      const n = normalizeName(waiverName);
      const i = normalizeInitials(waiverInitials);

      if (n.length < 2) throw new Error("Name required");
      if (i.length < 2) throw new Error("Initials required");
      if (!waiverSignature) throw new Error("Signature required");

      const token = await getAccessTokenBestEffort();
      if (!token) throw new Error("Session expired. Please re-login.");

      const waiverText = buildWaiverText(appointment);

      const res = await fetch(`/api/appointments/${appointmentId}/waiver`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          signer_name: n,
          initials: i,
          signer_email: userEmail ?? null,
          waiver_version: "v1",
          waiver_text: waiverText,
          signature_data_url: waiverSignature,
          signature_type: "drawn",
          signer_role: "user",
          signature_name: n,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to sign waiver.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["appointment-waiver", appointmentId],
      });
      queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
      setWaiverOpen(false);
      setWaiverError(null);
    },
    onError: (e: any) => setWaiverError(e?.message ?? "Failed to sign waiver."),
  });

  const handleCancel = () => {
    if (!appointmentId || !appointment) return;
    if (!canCancelStatus(appointment.status)) return;

    const ok = window.confirm(
      "Are you sure you want to cancel this appointment? We’ll release your time slot."
    );
    if (!ok) return;

    cancelMutation.mutate(appointmentId);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (loadingAppointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-cyan-400/20" />
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-300" />
        </div>
      </div>
    );
  }

  if (appointmentErr) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <Card className="max-w-md border-red-500/40 bg-slate-900/90 text-slate-50 shadow-[0_18px_60px_rgba(248,113,113,0.25)]">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-bold mb-1">Couldn&apos;t load appointment</h2>
            <p className="text-sm text-slate-300">Please refresh and try again.</p>
            <Link href="/user/dashboard/appointments">
              <Button variant="outline" className="border-slate-600 text-slate-100">
                Back to Appointments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <Card className="max-w-md border-slate-800 bg-slate-900/90 text-slate-50">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-bold mb-1">Appointment Not Found</h2>
            <p className="text-sm text-slate-400 mb-4">
              The appointment you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link href="/user/dashboard/appointments">
              <Button variant="outline" className="border-slate-600 text-slate-100">
                Back to Appointments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cancellable = canCancelStatus(appointment.status);
  const statusVisuals = getStatusVisuals(appointment.status);
  const billingMeta = getBillingMeta(appointment);
  const crackOut = isCrackOut(appointment);
  const crack = crackOut ? crackOutSummary(appointment) : null;

  const waiverText = buildWaiverText(appointment);
  const waiverRules = getWaiverSigningWindow(appointment);

  const requiresWaiver =
    String(appointment?.status ?? "").toLowerCase() !== "cancelled";
  const showWaiverBadge = requiresWaiver && !waiverSigned;

  const portalRequested =
    String(appointment?.waiver_signing_mode ?? "").toLowerCase() === "portal" ||
    !!appointment?.waiver_deferred_at;

  const title = (appointment.service_type ?? "").replace(/_/g, " ").toUpperCase();
  const subtitle = `Appointment #${String(appointment.id).slice(0, 8)} • Glass Guardian`;
  const statusText = (appointment.status ?? "").replace(/_/g, " ").toUpperCase();

  const actionPrimary = (() => {
    if (requiresWaiver && !waiverSigned) return "waiver";
    if (canViewInvoice) return "invoice";
    return null;
  })();

  return (
    <motion.div
      className="min-h-screen bg-slate-950 text-slate-50"
      initial="hidden"
      animate="show"
      variants={V.page}
      custom={!!prefersReducedMotion}
    >
      {/* Elite liquid background */}
      <div className="relative min-h-screen">
        <LiquidBackdrop />

        <div className="relative">
          {/* iOS-style top bar */}
          <GlassTopBar
            title={title}
            subtitle={subtitle}
            statusBadgeClass={statusVisuals.badge}
            statusText={statusText}
            backHref="/user/dashboard/appointments"
          />

          <div className="px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3">
            <div className="max-w-3xl mx-auto">
              {/* Crack-out trust dialog */}
              {crackOut && (
                <CrackOutTrustDialog
                  appointment={appointment}
                  open={trustOpen}
                  onOpenChange={setTrustOpen}
                  canViewInvoice={canViewInvoice}
                />
              )}

              {/* Waiver dialog */}
              <Dialog
                open={waiverOpen}
                onOpenChange={(v) => {
                  if (!v) {
                    setWaiverError(null);
                    setWaiverSignature(null);
                  }
                  setWaiverOpen(v);
                }}
              >
                <DialogContent className="max-w-lg border border-white/12 bg-slate-950/92 text-slate-50 backdrop-blur-2xl shadow-[0_30px_120px_rgba(2,132,199,0.14)]">
                  <div className="absolute inset-0 -z-10 rounded-lg bg-[radial-gradient(900px_320px_at_10%_-10%,rgba(34,211,238,0.16),transparent_55%),radial-gradient(700px_280px_at_90%_0%,rgba(56,189,248,0.12),transparent_55%)]" />

                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-cyan-300" />
                      Service Waiver
                    </DialogTitle>
                    <DialogDescription className="text-slate-300">
                      You can review anytime. Signing is available only on the day of service
                      (local time).
                    </DialogDescription>
                  </DialogHeader>

                  <pre className="max-h-44 overflow-y-auto text-xs text-slate-300 border border-white/10 rounded-xl p-3 bg-white/5">
                    {waiverText}
                  </pre>

                  {waiverSigned ? (
                    <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-300 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold text-emerald-100">Waiver signed</p>
                          <p className="text-slate-200/90">
                            Signed by{" "}
                            <span className="font-semibold">{waiverRow?.signer_name}</span>
                            {waiverRow?.created_at ? (
                              <>
                                {" "}
                                on{" "}
                                <span className="font-semibold">
                                  {format(
                                    new Date(String(waiverRow.created_at)),
                                    "MMM d, yyyy"
                                  )}
                                </span>
                              </>
                            ) : null}
                            .
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {!waiverRules.canSignNow && (
                        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                          <div className="flex items-start gap-3">
                            <TriangleAlert className="w-5 h-5 text-amber-300 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-semibold">Signing not available yet</p>
                              <p className="text-amber-100/90">
                                {waiverRules.reason ??
                                  "You’ll be able to sign on the day of your appointment."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Name</Label>
                          <Input
                            value={waiverName}
                            onChange={(e) => setWaiverName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Initials</Label>
                          <Input
                            value={waiverInitials}
                            onChange={(e) => setWaiverInitials(e.target.value)}
                          />
                        </div>
                      </div>

                      <SignatureCanvas
                        label="Signature"
                        valueDataUrl={waiverSignature}
                        onChangeDataUrl={setWaiverSignature}
                      />

                      {waiverError && (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <TriangleAlert className="w-3 h-3" />
                          {waiverError}
                        </p>
                      )}

                      <DialogFooter className="gap-2 sm:gap-3">
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto border-white/15 bg-white/5 text-slate-50 hover:bg-white/10"
                          onClick={() => setWaiverOpen(false)}
                        >
                          Close
                        </Button>

                        <Button
                          onClick={() => waiverSignMutation.mutate()}
                          className="w-full sm:w-auto bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-semibold shadow-[0_10px_35px_rgba(34,211,238,0.22)]"
                          disabled={!waiverRules.canSignNow || waiverSignMutation.isPending}
                          title={
                            waiverRules.canSignNow
                              ? "Sign waiver"
                              : waiverRules.reason ?? "Signing not available yet"
                          }
                        >
                          {waiverSignMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Signing...
                            </>
                          ) : (
                            <>
                              Sign Now <PenLine className="w-4 h-4 ml-1" />
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>

              {/* Floating action rail (app-mode) */}
              <AnimatePresence>
                {showFloatingRail && (
                  <motion.div
                    variants={V.float}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    custom={!!prefersReducedMotion}
                    className="fixed left-0 right-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)] px-4"
                  >
                    <div className="mx-auto max-w-3xl">
                      <div className="relative rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl shadow-[0_22px_90px_rgba(2,132,199,0.14)]">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/7 via-transparent to-white/3 opacity-70" />
                        <div className="relative flex items-center gap-2 p-2">
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-[0.78rem] text-slate-200/90">
                              {vehicle
                                ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`
                                : "Your appointment"}
                            </p>
                            <p className="truncate text-[0.68rem] text-slate-400">
                              {appointment.scheduled_date
                                ? format(
                                    new Date(appointment.scheduled_date),
                                    "EEE, MMM d"
                                  )
                                : "Schedule pending"}{" "}
                              • {statusText}
                            </p>
                          </div>

                          {requiresWaiver && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setWaiverOpen(true)}
                              className={cx(
                                "h-10 rounded-xl border bg-white/5 hover:bg-white/10 active:scale-[0.99]",
                                waiverSigned
                                  ? "border-emerald-400/40 text-emerald-100"
                                  : "border-amber-400/40 text-amber-100"
                              )}
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              {waiverSigned ? "Signed" : "Waiver"}
                            </Button>
                          )}

                          {canViewInvoice && (
                            <Link href={`/user/dashboard/pay/${appointment.id}`}>
                              <Button
                                size="sm"
                                className="h-10 rounded-xl bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-semibold shadow-[0_10px_35px_rgba(34,211,238,0.20)] active:scale-[0.99]"
                              >
                                Invoice <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </Link>
                          )}

                          {!canViewInvoice && actionPrimary === "waiver" && (
                            <Button
                              size="sm"
                              onClick={() => setWaiverOpen(true)}
                              className="h-10 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-semibold shadow-[0_10px_35px_rgba(251,191,36,0.20)] active:scale-[0.99]"
                            >
                              Review <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick actions row (top, non-sticky) */}
              <motion.div
                variants={V.card}
                initial="hidden"
                animate="show"
                custom={!!prefersReducedMotion}
                className="mt-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {requiresWaiver && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setWaiverOpen(true)}
                      className={cx(
                        "rounded-full border bg-white/5 hover:bg-white/10 active:scale-[0.99]",
                        waiverSigned
                          ? "border-emerald-400/40 text-emerald-100"
                          : "border-amber-400/40 text-amber-100"
                      )}
                      title="Review waiver"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      {waiverSigned ? "Waiver Signed" : "Waiver"}
                    </Button>
                  )}

                  {canViewInvoice && (
                    <Link href={`/user/dashboard/pay/${appointment.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full border border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 active:scale-[0.99]"
                      >
                        View Invoice
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  )}

                  {cancellable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                      className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 text-red-200 hover:text-red-100 hover:bg-red-500/20 active:scale-[0.99] transition"
                    >
                      <XCircle className="w-4 h-4" />
                      {cancelMutation.isPending ? "Cancelling..." : "Cancel"}
                    </Button>
                  )}
                </div>
              </motion.div>

              {/* Hero header (elite) */}
              <motion.div
                variants={V.card}
                initial="hidden"
                animate="show"
                custom={!!prefersReducedMotion}
                className="mt-4"
              >
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_28px_120px_rgba(2,132,199,0.12)]">
                  <div className="absolute inset-0 bg-[radial-gradient(900px_360px_at_20%_-10%,rgba(34,211,238,0.20),transparent_60%),radial-gradient(780px_340px_at_90%_10%,rgba(56,189,248,0.14),transparent_60%),radial-gradient(800px_420px_at_50%_120%,rgba(16,185,129,0.10),transparent_62%)]" />
                  <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
                  <div className="absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />

                  <div className="relative p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-bold tracking-tight text-slate-50">
                            {title}
                          </h2>

                          {crackOut && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/12 border border-amber-400/35 px-3 py-1 text-[0.7rem] font-semibold text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.18)]">
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              Crack-out documented
                            </span>
                          )}

                          {showWaiverBadge && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-400/30 px-3 py-1 text-[0.7rem] font-semibold text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.14)]">
                              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-200" />
                              Waiver required
                            </span>
                          )}

                          {waiverSigned && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-400/30 px-3 py-1 text-[0.7rem] font-semibold text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.14)]">
                              <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-200" />
                              Waiver signed
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-slate-300/90">
                          Appointment #{String(appointment.id).slice(0, 8)}
                          {!canViewInvoice && (
                            <span className="text-slate-400">
                              {" "}
                              • Invoice appears after technician creates it
                            </span>
                          )}
                        </p>

                        {/* Waiver notification (portal requested) */}
                        {requiresWaiver && !waiverSigned && portalRequested && (
                          <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                            <div className="flex items-start gap-2">
                              <ShieldCheck className="w-4 h-4 mt-0.5 text-cyan-200" />
                              <div className="space-y-1">
                                <p className="font-semibold">Waiver requested in your portal</p>
                                <p className="text-cyan-100/90">
                                  You can review now. Signing opens on the day of service (local
                                  time).
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <Badge className={statusVisuals.badge}>{statusText}</Badge>

                        {crackOut && (
                          <div className="mt-2">
                            <Badge className="border border-amber-400/30 bg-amber-500/10 text-amber-100 text-[0.75rem] px-3 py-1 rounded-full">
                              {appointment.replacement_required
                                ? "Replacement may be required"
                                : "Next steps included"}
                            </Badge>
                          </div>
                        )}

                        {requiresWaiver && !waiverSigned && waiverRules.hasSchedule && (
                          <p className="mt-2 text-[0.7rem] text-slate-400">
                            Waiver signing: day-of service only
                          </p>
                        )}
                      </div>
                    </div>

                    {cancelError && (
                      <p className="mt-3 text-sm text-red-400">{cancelError}</p>
                    )}

                    {!cancellable && appointment.status !== "cancelled" && (
                      <p className="mt-3 text-xs text-slate-400">
                        Once your technician is en route or on-site, the appointment can no longer
                        be cancelled online. Please call us if you need help.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Crack-out banner */}
              {crackOut && (
                <motion.div
                  variants={V.card}
                  initial="hidden"
                  animate="show"
                  custom={!!prefersReducedMotion}
                  className="mt-6"
                >
                  <Card className="border border-amber-400/25 bg-gradient-to-br from-slate-950/80 via-amber-950/20 to-slate-950/80 backdrop-blur-2xl shadow-[0_20px_80px_rgba(251,191,36,0.10)]">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-amber-100">
                        <TriangleAlert className="w-5 h-5 text-amber-300" />
                        Crack-out transparency update
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-slate-200/90">
                      <div className="flex items-start gap-3">
                        <HeartHandshake className="w-5 h-5 mt-0.5 text-amber-300" />
                        <p>
                          We’re sorry this happened. Crack-outs are rare, and when they do happen we
                          document everything, communicate clearly, and guide you through next steps
                          so you can trust the outcome.
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold text-slate-200 mb-1">Occurred</p>
                          <p className="text-sm text-slate-100">{crack?.occurredAt ?? "—"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold text-slate-200 mb-1">Replacement</p>
                          <p className="text-sm text-slate-100">
                            {appointment.replacement_required ? "May be required" : "Not required / TBD"}
                          </p>
                        </div>
                      </div>

                      {(crack?.cause || crack?.notes) && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold text-slate-200 mb-2">Notes</p>
                          <p className="text-xs text-slate-300">
                            {crack?.cause ? `Cause: ${crack.cause}. ` : ""}
                            {crack?.notes ? crack.notes : ""}
                          </p>
                        </div>
                      )}

                      {appointment.crack_out_photo_url && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold text-slate-200 mb-2">Photo documentation</p>
                          <div className="relative overflow-hidden rounded-2xl border border-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={String(appointment.crack_out_photo_url)}
                              alt="Crack-out documentation"
                              className="w-full max-h-[280px] object-cover"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Status Timeline (read-only) */}
              <motion.div
                variants={V.card}
                initial="hidden"
                animate="show"
                custom={!!prefersReducedMotion}
                className="mt-6"
              >
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_22px_90px_rgba(2,132,199,0.10)]">
                  <div className="p-3">
                    <ServiceProgress
                      status={appointment.status ?? null}
                      busy={false}
                      className="mb-0"
                      readOnly
                      onStatusClickAction={(() => {}) as (next: ServiceStatusKey) => void}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Main stack (app-mode: single column with premium spacing) */}
              <div className="mt-6 space-y-6">
                {/* Service Details */}
                <motion.div
                  variants={V.card}
                  initial="hidden"
                  animate="show"
                  custom={!!prefersReducedMotion}
                >
                  <Card className={cx(statusVisuals.card, "border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_22px_90px_rgba(2,132,199,0.10)]")}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-slate-50">
                        <FileText className="w-5 h-5" />
                        Service Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-slate-100">
                      {vehicle && (
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="absolute inset-0 bg-[radial-gradient(520px_180px_at_10%_-10%,rgba(34,211,238,0.18),transparent_60%)]" />
                          <div className="relative flex items-center gap-3">
                            <div className="h-11 w-11 rounded-2xl border border-white/10 bg-slate-950/40 grid place-items-center">
                              <Car className="w-6 h-6 text-sky-300" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-300">
                                {vehicle.color && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                    {vehicle.color}
                                  </span>
                                )}
                                {vehicle.license_plate && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                    Plate: {vehicle.license_plate}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {appointment.scheduled_date && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-9 w-9 rounded-xl border border-white/10 bg-white/5 grid place-items-center">
                            <Calendar className="w-4 h-4 text-slate-200" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">
                              {format(new Date(appointment.scheduled_date), "EEEE, MMMM d, yyyy")}
                            </p>
                            {appointment.scheduled_time_start && (
                              <p className="text-sm text-slate-300">
                                {appointment.scheduled_time_start}
                                {appointment.scheduled_time_end
                                  ? ` - ${appointment.scheduled_time_end}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {appointment.service_address && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-9 w-9 rounded-xl border border-white/10 bg-white/5 grid place-items-center">
                            <MapPin className="w-4 h-4 text-slate-200" />
                          </div>
                          <p className="text-sm text-slate-200">{appointment.service_address}</p>
                        </div>
                      )}

                      {appointment.damage_description && (
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                          <p className="text-sm font-medium text-amber-200 mb-1">Damage Description</p>
                          <p className="text-sm text-amber-100">{appointment.damage_description}</p>
                        </div>
                      )}

                      {appointment.notes_customer && (
                        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
                          <p className="text-sm font-medium text-sky-200 mb-1">Special Instructions</p>
                          <p className="text-sm text-sky-100">{appointment.notes_customer}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Damage Photos */}
                {photos.length > 0 && (
                  <motion.div
                    variants={V.card}
                    initial="hidden"
                    animate="show"
                    custom={!!prefersReducedMotion}
                  >
                    <Card className="border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_22px_90px_rgba(2,132,199,0.10)]">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-50">
                          <ImageIcon className="w-5 h-5" />
                          Damage Photos ({photos.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          {photos.map((photo, idx) => (
                            <motion.button
                              type="button"
                              key={(photo.id as string | undefined) ?? `${idx}`}
                              initial={
                                prefersReducedMotion
                                  ? { opacity: 1, scale: 1 }
                                  : { opacity: 0, scale: 0.96 }
                              }
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: prefersReducedMotion ? 0 : idx * 0.04 }}
                              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                              onClick={() => openLightbox(idx)}
                              className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={String(photo.file_url ?? "")}
                                alt={String(photo.photo_type ?? "Damage photo")}
                                className="h-full w-full object-cover transition-transform duration-300 group-active:scale-[1.02]"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-100">
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <span className="text-white text-xs font-semibold block">
                                    {String(photo.photo_type ?? "").replace(/_/g, " ") || "Photo"}
                                  </span>
                                  <span className="text-white/75 text-[0.7rem]">
                                    Tap to enlarge
                                  </span>
                                </div>
                              </div>
                              <div className="absolute inset-0 ring-1 ring-white/0 group-active:ring-white/10 transition" />
                            </motion.button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Sidebar cards (stacked for app mode) */}
                <motion.div variants={V.card} initial="hidden" animate="show" custom={!!prefersReducedMotion}>
                  <div className="space-y-6">
                    <WaiverCard
                      requiresWaiver={requiresWaiver}
                      waiverSigned={waiverSigned}
                      waiverRulesReason={waiverSigned ? null : waiverRules.reason}
                      onOpenWaiver={() => setWaiverOpen(true)}
                      signerName={waiverRow?.signer_name ?? null}
                      initials={waiverRow?.initials ?? null}
                    />

                    <TechnicianCard technician={(technician ?? null) as any} />

                    {(billingMeta.hasAmount || billingMeta.phase === "cancelled") && (
                      <Card className={cx(billingMeta.cardClass, "border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_22px_90px_rgba(2,132,199,0.10)]")}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between gap-2 text-white">
                            <span className="inline-flex items-center gap-2">
                              <DollarSign className="w-5 h-5" />
                              {billingMeta.heading}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-black/20 border border-white/20">
                              {billingMeta.chip}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-4xl font-bold mb-2 tabular-nums">
                            {billingMeta.amount !== null
                              ? `$${billingMeta.amount.toFixed(2)}`
                              : billingMeta.phase === "cancelled"
                              ? "No Charges"
                              : "--"}
                          </p>
                          <p className="text-sm opacity-90">{billingMeta.subtitle}</p>

                          {canViewInvoice && (
                            <div className="mt-4">
                              <Link href={`/user/dashboard/pay/${appointment.id}`}>
                                <Button
                                  variant="outline"
                                  className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 active:scale-[0.99]"
                                >
                                  View Invoice
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </Link>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {appointment.warranty_id && (
                      <Card className="border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_22px_90px_rgba(2,132,199,0.10)]">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-slate-50">
                            <Shield className="w-5 h-5 text-emerald-300" />
                            Warranty Active
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-300 mb-3">
                            Your repair is covered by our warranty.
                          </p>
                          <Link href="/user/dashboard/garage">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15 active:scale-[0.99]"
                            >
                              View Warranty Details
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    )}

                    {crackOut && (
                      <Card className="border border-amber-400/20 bg-amber-500/5 backdrop-blur-2xl shadow-[0_22px_90px_rgba(251,191,36,0.08)]">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-amber-100">
                            <TriangleAlert className="w-5 h-5 text-amber-300" />
                            Crack-out Actions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {canViewInvoice && (
                            <Link href={`/user/dashboard/pay/${appointment.id}`}>
                              <Button className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-semibold shadow-[0_10px_35px_rgba(251,191,36,0.18)] active:scale-[0.99]">
                                Open Invoice &amp; Documentation
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </Link>
                          )}

                          <Button
                            variant="outline"
                            className="w-full border-white/12 bg-white/5 text-slate-50 hover:bg-white/10 active:scale-[0.99]"
                            onClick={() => setTrustOpen(true)}
                          >
                            Read our note
                            <Sparkles className="w-4 h-4 ml-2" />
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </motion.div>

                {/* Bottom spacer so floating rail never covers content */}
                <div className="h-16" />
              </div>

              {lightboxOpen && (
                 <ImageLightbox
                  images={photos.map((p) =>
                    typeof p === "string"
                      ? p
                      : {
                          file_url: p.file_url || p.url || "",
                          alt: p.caption || "",
                          thumb_url: p.thumb_url || p.file_url || "",
                        }
                  )}
                  initialIndex={lightboxIndex}
                  onClose={() => setLightboxOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}