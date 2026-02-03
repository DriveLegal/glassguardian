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
import { motion, useReducedMotion } from "framer-motion";

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400" />
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

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
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
          <DialogContent className="max-w-lg border border-slate-800 bg-slate-950/95 text-slate-50 backdrop-blur-xl shadow-[0_30px_120px_rgba(2,132,199,0.12)]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-300" />
                Service Waiver
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                You can review anytime. Signing is available only on the day of service (local
                time).
              </DialogDescription>
            </DialogHeader>

            <pre className="max-h-44 overflow-y-auto text-xs text-slate-300 border border-slate-800 rounded p-3 bg-slate-900/60">
              {waiverText}
            </pre>

            {waiverSigned ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
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
                            {format(new Date(String(waiverRow.created_at)), "MMM d, yyyy")}
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
                  <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-100">
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
                    <Input value={waiverName} onChange={(e) => setWaiverName(e.target.value)} />
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
                    className="w-full sm:w-auto border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
                    onClick={() => setWaiverOpen(false)}
                  >
                    Close
                  </Button>

                  <Button
                    onClick={() => waiverSignMutation.mutate()}
                    className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold"
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

        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <Link href="/user/dashboard/appointments">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Appointments
            </Button>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {/* Waiver quick action */}
            {requiresWaiver && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWaiverOpen(true)}
                className={`rounded-full border ${
                  waiverSigned
                    ? "border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/10"
                    : "border-amber-400/60 text-amber-100 hover:bg-amber-500/10"
                }`}
                title="Review waiver"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                {waiverSigned ? "Waiver Signed" : "Waiver"}
              </Button>
            )}

            {/* Only show if invoice exists */}
            {canViewInvoice && (
              <Link href={`/user/dashboard/pay/${appointment.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full border border-slate-600/70 text-slate-100 hover:text-slate-100 hover:bg-slate-900/70"
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
                className="flex items-center gap-2 rounded-full border border-red-500/60 text-red-200 hover:text-red-100 hover:bg-red-500/20 transition"
              >
                <XCircle className="w-4 h-4" />
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Appointment"}
              </Button>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-bold text-slate-50 mb-2">
                  {(appointment.service_type ?? "").replace(/_/g, " ").toUpperCase()}
                </h1>

                {crackOut && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-400/50 px-3 py-1 text-[0.7rem] font-semibold text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.25)]">
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    Crack-out documented
                  </span>
                )}

                {showWaiverBadge && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-400/45 px-3 py-1 text-[0.7rem] font-semibold text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.18)]">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-200" />
                    Waiver required
                  </span>
                )}

                {waiverSigned && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-400/45 px-3 py-1 text-[0.7rem] font-semibold text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
                    <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-200" />
                    Waiver signed
                  </span>
                )}
              </div>

              <p className="text-slate-400 text-sm">
                Appointment #{String(appointment.id).slice(0, 8)}
              </p>

              {/* Waiver notification (portal requested) */}
              {requiresWaiver && !waiverSigned && portalRequested && (
                <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 mt-0.5 text-cyan-200" />
                    <div className="space-y-1">
                      <p className="font-semibold">Waiver requested in your portal</p>
                      <p className="text-cyan-100/90">
                        You can review now. Signing opens on the day of service (local time).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge className={statusVisuals.badge}>
                {(appointment.status ?? "").replace(/_/g, " ").toUpperCase()}
              </Badge>

              {crackOut && (
                <Badge className="border border-amber-400/40 bg-amber-500/10 text-amber-100 text-[0.75rem] px-3 py-1 rounded-full">
                  {appointment.replacement_required
                    ? "Replacement may be required"
                    : "Next steps included"}
                </Badge>
              )}

              {!canViewInvoice && (
                <span className="text-[0.7rem] text-slate-400">
                  Invoice will appear once created by your technician
                </span>
              )}

              {requiresWaiver && !waiverSigned && waiverRules.hasSchedule && (
                <span className="text-[0.7rem] text-slate-400 text-right">
                  Waiver signing: day-of service only
                </span>
              )}
            </div>
          </div>

          {cancelError && <p className="mt-2 text-sm text-red-400">{cancelError}</p>}
          {!cancellable && appointment.status !== "cancelled" && (
            <p className="mt-2 text-xs text-slate-400">
              Once your technician is en route or on-site, the appointment can no longer be
              cancelled online. Please call us if you need help.
            </p>
          )}
        </div>

        {/* Crack-out banner */}
        {crackOut && (
          <Card className="mb-8 border border-amber-400/35 bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950 shadow-[0_20px_70px_rgba(251,191,36,0.12)]">
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
                  document everything, communicate clearly, and guide you through next steps so you
                  can trust the outcome.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold text-slate-200 mb-1">Occurred</p>
                  <p className="text-sm text-slate-100">{crack?.occurredAt ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold text-slate-200 mb-1">Replacement</p>
                  <p className="text-sm text-slate-100">
                    {appointment.replacement_required ? "May be required" : "Not required / TBD"}
                  </p>
                </div>
              </div>

              {(crack?.cause || crack?.notes) && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold text-slate-200 mb-2">Notes</p>
                  <p className="text-xs text-slate-300">
                    {crack?.cause ? `Cause: ${crack.cause}. ` : ""}
                    {crack?.notes ? crack.notes : ""}
                  </p>
                </div>
              )}

              {appointment.crack_out_photo_url && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold text-slate-200 mb-2">Photo documentation</p>
                  <div className="relative overflow-hidden rounded-lg border border-slate-700/70">
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
        )}

        {/* Status Timeline (read-only) */}
        <ServiceProgress
  status={appointment.status ?? null}
  busy={false}
  className="mb-8"
  readOnly
  onStatusClickAction={(() => {}) as (next: ServiceStatusKey) => void}
/>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Details */}
            <Card className={statusVisuals.card}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-50">
                  <FileText className="w-5 h-5" />
                  Service Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-slate-100">
                {vehicle && (
                  <div className="flex items-center gap-3 p-4 bg-slate-900/80 rounded-lg border border-slate-700">
                    <Car className="w-8 h-8 text-sky-400" />
                    <div>
                      <p className="font-semibold">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      {vehicle.color && <p className="text-sm text-slate-300">{vehicle.color}</p>}
                      {vehicle.license_plate && (
                        <p className="text-sm text-slate-300">Plate: {vehicle.license_plate}</p>
                      )}
                    </div>
                  </div>
                )}

                {appointment.scheduled_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-slate-300 mt-0.5" />
                    <div>
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
                    <MapPin className="w-5 h-5 text-slate-300 mt-0.5" />
                    <p className="text-sm text-slate-200">{appointment.service_address}</p>
                  </div>
                )}

                {appointment.damage_description && (
                  <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-400/50">
                    <p className="text-sm font-medium text-amber-200 mb-1">Damage Description:</p>
                    <p className="text-sm text-amber-100">{appointment.damage_description}</p>
                  </div>
                )}

                {appointment.notes_customer && (
                  <div className="p-4 bg-sky-500/10 rounded-lg border border-sky-400/50">
                    <p className="text-sm font-medium text-sky-200 mb-1">
                      Special Instructions:
                    </p>
                    <p className="text-sm text-sky-100">{appointment.notes_customer}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Damage Photos */}
            {photos.length > 0 && (
              <Card className="border border-slate-800 bg-slate-950/80 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-50">
                    <ImageIcon className="w-5 h-5" />
                    Damage Photos ({photos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo, idx) => (
                      <motion.div
                        key={(photo.id as string | undefined) ?? `${idx}`}
                        initial={
                          prefersReducedMotion
                            ? { opacity: 1, scale: 1 }
                            : { opacity: 0, scale: 0.9 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.06 }}
                        whileHover={prefersReducedMotion ? undefined : { scale: 1.05, zIndex: 10 }}
                        onClick={() => openLightbox(idx)}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-slate-700 hover:border-sky-400 transition-all cursor-pointer shadow-lg hover:shadow-sky-500/30"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={String(photo.file_url ?? "")}
                          alt={String(photo.photo_type ?? "Damage photo")}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex items-end p-3">
                          <div className="w-full">
                            <span className="text-white text-xs font-semibold block mb-1">
                              {String(photo.photo_type ?? "").replace(/_/g, " ")}
                            </span>
                            <span className="text-white/80 text-xs">Tap to enlarge</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
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
              <Card className={billingMeta.cardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-white">
                    <span className="inline-flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      {billingMeta.heading}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-black/20 border border-white/30">
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
                          className="w-full border-white/40 text-white hover:bg-white/10"
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
              <Card className="border border-slate-800 bg-slate-950/80 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-50">
                    <Shield className="w-5 h-5 text-emerald-400" />
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
                      className="w-full border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/10"
                    >
                      View Warranty Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {crackOut && (
              <Card className="border border-amber-400/30 bg-slate-950/80 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-100">
                    <TriangleAlert className="w-5 h-5 text-amber-300" />
                    Crack-out Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {canViewInvoice && (
                    <Link href={`/user/dashboard/pay/${appointment.id}`}>
                      <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                        Open Invoice &amp; Documentation
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  )}

                  <Button
                    variant="outline"
                    className="w-full border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
                    onClick={() => setTrustOpen(true)}
                  >
                    Read our note
                    <Sparkles className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
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
  );
}