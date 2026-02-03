// components/tech/schedule/waiver/WaiverGate.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  ShieldCheck,
  CheckCircle,
  TriangleAlert,
  Loader2,
  PenLine,
  Save,
  Clock,
} from "lucide-react";
import SignatureCanvas from "@/components/forms/SignatureCanvas";

/* ---------------- Types ---------------- */

export type WaiverRow = {
  id: string;
  appointment_id: string;
  signer_name: string;
  initials: string;
  signature_storage_path?: string | null;
};

type ViewerRole = "tech" | "user";

/* ---------------- Helpers ---------------- */

function normalizeInitials(v: string) {
  return String(v ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

function normalizeName(v: string) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function safeDateOnly(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  if (s.includes("T")) return s.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // try parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

function formatNiceDate(yyyyMmDd: string) {
  // yyyy-mm-dd -> "Jan 24, 2026" (local)
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * ✅ Rule requested:
 * - User can PREP/sign ahead of time (draft saved locally)
 * - BUT the waiver can only be SUBMITTED (i.e. actually signed in DB) on the service day.
 * - "Be mindful of time": service day is determined in the viewer's local timezone as:
 *    startOfDay(serviceDate) <= now <= endOfDay(serviceDate)
 *
 * Service day is taken from:
 * 1) appointment.actual_start_time date (if present)
 * 2) appointment.scheduled_date date
 */
function getServiceDayInfo(appt: any) {
  const actualDay = safeDateOnly(appt?.actual_start_time);
  const scheduledDay = safeDateOnly(appt?.scheduled_date);
  const serviceDay = actualDay || scheduledDay;

  if (!serviceDay) {
    return {
      serviceDay: null as string | null,
      isServiceDay: true, // if we don't know, don't block hard
      label: "today",
      reason: null as string | null,
    };
  }

  const now = new Date();
  const [yy, mm, dd] = serviceDay.split("-").map((x) => Number(x));
  const start = new Date(yy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0);
  const end = new Date(yy, (mm || 1) - 1, dd || 1, 23, 59, 59, 999);

  const isServiceDay = now >= start && now <= end;

  return {
    serviceDay,
    isServiceDay,
    label: formatNiceDate(serviceDay),
    reason: isServiceDay
      ? null
      : `Waiver must be submitted on the service day (${formatNiceDate(serviceDay)}). You can save your signature now and submit it on that day.`,
  };
}

function buildWaiverText(appt: any) {
  return [
    "GLASS GUARDIAN SERVICE WAIVER (v1)",
    "",
    `Service: ${String(appt?.service_type ?? "")
      .replace(/_/g, " ")
      .toUpperCase()}`,
    `Appointment ID: ${String(appt?.id ?? "").slice(0, 8)}`,
    "",
    "I acknowledge that Glass Guardian will be working on my vehicle.",
    "Windshield repair is structural, not cosmetic.",
    "There is a risk of crack-out during repair.",
    "If a crack-out occurs during repair, the repair fee will be refunded.",
    "",
    "By signing below, I accept these terms.",
  ].join("\n");
}

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

/* ---------------- Draft storage (local) ---------------- */

function draftKey(apptId: string) {
  return `gg_waiver_draft_${apptId}`;
}

type WaiverDraft = {
  name: string;
  initials: string;
  signature: string | null;
  savedAt: string; // ISO
};

function loadDraft(apptId: string): WaiverDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(apptId));
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return null;
    return {
      name: typeof j.name === "string" ? j.name : "",
      initials: typeof j.initials === "string" ? j.initials : "",
      signature: typeof j.signature === "string" ? j.signature : null,
      savedAt: typeof j.savedAt === "string" ? j.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function saveDraft(apptId: string, d: WaiverDraft) {
  try {
    window.localStorage.setItem(draftKey(apptId), JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(apptId: string) {
  try {
    window.localStorage.removeItem(draftKey(apptId));
  } catch {}
}

/* ---------------- Component ---------------- */

export default function WaiverGate(props: {
  appointment: any;
  open: boolean;
  onOpenChangeAction: (v: boolean) => void;
  onSatisfiedAction: () => void;
  /**
   * ✅ NEW:
   * - "tech": old behavior + portal option
   * - "user": shows waiver in user portal + allows saving draft ahead of time
   *           but only allows SUBMIT on service day
   */
  viewerRole?: ViewerRole;
}) {
  const {
    appointment,
    open,
    onOpenChangeAction,
    onSatisfiedAction,
    viewerRole = "tech",
  } = props;

  const qc = useQueryClient();

  const [mode, setMode] = useState<"device" | "portal">("device");

  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const waiverText = useMemo(() => buildWaiverText(appointment), [appointment]);

  const serviceDayInfo = useMemo(() => getServiceDayInfo(appointment), [appointment]);

  // ✅ Allow pre-signing UX, but enforce "submit on service day"
  const canSubmitToday = serviceDayInfo.isServiceDay;

  const { data: waiver } = useQuery({
    queryKey: ["appointment-waiver", appointment?.id],
    enabled: !!appointment?.id,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointment_waivers")
        .select("id,appointment_id,signer_name,initials,signature_storage_path")
        .eq("appointment_id", appointment.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WaiverRow | null;
    },
  });

  const waiverSigned = !!waiver;

  // ✅ If it's already signed, satisfy parent immediately (avoids "signed but still locked" moments)
  useEffect(() => {
    if (open && waiverSigned) {
      onSatisfiedAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, waiverSigned]);

  // ✅ Load draft when opened (user flow)
  useEffect(() => {
    if (!open) return;
    if (!appointment?.id) return;

    setError(null);

    // reset tech portal mode when opening
    if (viewerRole === "tech") setMode("device");

    if (viewerRole === "user") {
      const d = loadDraft(String(appointment.id));
      if (d) {
        if (!name) setName(d.name || "");
        if (!initials) setInitials(d.initials || "");
        if (!signature) setSignature(d.signature || null);
        setToast("Loaded saved waiver draft");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id, viewerRole]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const portalModeMutation = useMutation({
    mutationFn: async () => {
      setError(null);

      const { error } = await supabaseClient
        .from("appointments")
        .update({
          waiver_signing_mode: "portal",
          waiver_deferred_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointment", appointment.id] });
      qc.invalidateQueries({ queryKey: ["appointment-waiver-exists", appointment.id] });
      onSatisfiedAction();
      onOpenChangeAction(false);
    },
    onError: (e: any) => setError(e?.message ?? "Failed to set portal mode."),
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      setError(null);

      const n = normalizeName(name);
      const i = normalizeInitials(initials);

      if (n.length < 2) throw new Error("Name required");
      if (i.length < 2) throw new Error("Initials required");
      if (!signature) throw new Error("Signature required");

      // ✅ USER RULE: must be submitted on service day
      // (Tech can also be restricted; keeps policy consistent.)
      if (!canSubmitToday) {
        throw new Error(serviceDayInfo.reason || "Waiver can only be submitted on the service day.");
      }

      const token = await getAccessTokenBestEffort();
      if (!token) throw new Error("Session expired. Please re-login.");

      const res = await fetch(`/api/appointments/${appointment.id}/waiver`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          signer_name: n,
          initials: i,
          signer_email: appointment.customer_email ?? null,
          waiver_version: "v1",
          waiver_text: waiverText,
          signature_data_url: signature,
          signature_type: "drawn",
          signer_role: "user",
          signature_name: n,
          // ✅ OPTIONAL metadata (route can ignore if it doesn't use it)
          client_service_day: serviceDayInfo.serviceDay ?? null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to sign waiver.");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointment-waiver", appointment.id] });
      qc.invalidateQueries({ queryKey: ["appointment-waiver-exists", appointment.id] });
      qc.invalidateQueries({ queryKey: ["appointment", appointment.id] });

      // clear local draft once it's officially signed
      clearDraft(String(appointment.id));

      onSatisfiedAction();
      onOpenChangeAction(false);
    },
    onError: (e: any) => setError(e?.message ?? "Failed to sign waiver."),
  });

  const saveDraftAction = () => {
    if (!appointment?.id) return;
    const n = normalizeName(name);
    const i = normalizeInitials(initials);

    // allow saving partial, but require at least something
    if (!n && !i && !signature) {
      setToast("Nothing to save yet");
      return;
    }

    const ok = saveDraft(String(appointment.id), {
      name: n,
      initials: i,
      signature: signature ?? null,
      savedAt: new Date().toISOString(),
    });

    setToast(ok ? "Waiver draft saved" : "Could not save draft");
  };

  const showPortalOption = viewerRole === "tech";

  const submitLabel =
    viewerRole === "user" ? "Submit Waiver (Service Day)" : "Sign Waiver";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setError(null);
          if (viewerRole === "tech") setMode("device");
        }
        onOpenChangeAction(v);
      }}
    >
      <DialogContent className="max-w-lg bg-slate-950 text-slate-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-300" />
            Customer Waiver
          </DialogTitle>
        </DialogHeader>

        {toast && (
          <div className="rounded border border-slate-700 bg-slate-900/60 p-2 text-xs text-slate-200">
            {toast}
          </div>
        )}

        {/* Service day rule notice (user-focused) */}
        {serviceDayInfo.serviceDay && (
          <div
            className={`rounded border p-3 text-xs ${
              canSubmitToday
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
                : "border-amber-400/35 bg-amber-500/10 text-amber-100"
            }`}
          >
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 opacity-90" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Waiver submission is required on the service day: {serviceDayInfo.label}
                </p>
                {!canSubmitToday ? (
                  <p className="opacity-90">
                    You can save your signature now, then submit it on {serviceDayInfo.label}.
                  </p>
                ) : (
                  <p className="opacity-90">You can submit the waiver today.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <pre className="max-h-40 overflow-y-auto text-xs text-slate-300 border border-slate-800 rounded p-3 bg-slate-900/60">
          {waiverText}
        </pre>

        {waiverSigned ? (
          <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3">
            <CheckCircle className="inline w-4 h-4 mr-1 text-emerald-300" />
            Waiver already signed by {waiver?.signer_name}
          </div>
        ) : showPortalOption && mode === "portal" ? (
          <div className="space-y-3">
            <div className="rounded border border-amber-400/40 bg-amber-500/10 p-3 text-xs">
              Customer will sign in portal
            </div>

            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <TriangleAlert className="w-3 h-3" />
                {error}
              </p>
            )}

            <Button
              onClick={() => portalModeMutation.mutate()}
              className="w-full bg-amber-500 text-slate-950"
              disabled={portalModeMutation.isPending}
            >
              {portalModeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm Portal Signing"
              )}
            </Button>

            <Button variant="outline" onClick={() => setMode("device")} className="w-full">
              Back to device signing
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Initials</Label>
                <Input value={initials} onChange={(e) => setInitials(e.target.value)} />
              </div>
            </div>

            <SignatureCanvas
              label={viewerRole === "user" ? "Your Signature" : "Customer Signature"}
              valueDataUrl={signature}
              onChangeDataUrl={setSignature}
            />

            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <TriangleAlert className="w-3 h-3" />
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {/* USER: Save draft (sign ahead of time) */}
              {viewerRole === "user" && (
                <Button
                  variant="outline"
                  onClick={saveDraftAction}
                  className="flex-1 border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save for later
                </Button>
              )}

              {/* TECH: Portal option */}
              {showPortalOption && (
                <Button
                  variant="outline"
                  onClick={() => setMode("portal")}
                  className="flex-1"
                >
                  Portal Instead
                </Button>
              )}

              <Button
                onClick={() => signMutation.mutate()}
                className="flex-1 bg-cyan-500 text-slate-950"
                disabled={signMutation.isPending || !canSubmitToday}
                title={
                  canSubmitToday
                    ? "Submit waiver"
                    : serviceDayInfo.reason || "Waiver must be submitted on the service day."
                }
              >
                {signMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    {submitLabel} <PenLine className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>

            {/* Extra hint for user when disabled */}
            {viewerRole === "user" && !canSubmitToday && (
              <div className="mt-2 rounded border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                Tip: save your signature now. On {serviceDayInfo.label}, come back here and
                press <span className="text-slate-100 font-semibold">Submit Waiver</span>.
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}