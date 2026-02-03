"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import WaiverGate from "@/components/tech/schedule/waiver/WaiverGate";

// ✅ 10-step progress component
import TenStepProgress from "@/components/tech/schedule/tenstep/ServiceProgress";

// ✅ 6-step workflow component + shared exports
import TechWorkflow, {
  WORKFLOW_STEPS,
  CRACK_OUT_CAUSES,
  clampWorkflowStep,
  statusToWorkflowStep,
  type RepairOutcome,
  type PhotosByStage,
} from "@/components/tech/schedule/workflow/TechWorkflow";

import {
  CheckCircle,
  MapPin,
  AlertCircle,
  ArrowLeft,
  Navigation,
  TriangleAlert,
  ShieldCheck,
  Copy,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";

/* ----------------------------------------------
   Helpers (Supabase notifications + photo upload)
-----------------------------------------------*/

async function notifyCustomer(params: {
  recipient_email: string;
  notification_type:
    | "tech_arrived"
    | "repair_started"
    | "repair_curing"
    | "repair_completed"
    | "warranty_issued";
  appointment_id: string;
  custom_data?: Record<string, any>;
}) {
  const { error } = await supabaseClient.from("notifications").insert({
    recipient_email: params.recipient_email,
    notification_type: params.notification_type,
    appointment_id: params.appointment_id,
    payload: params.custom_data ?? {},
    sent_at: new Date().toISOString(),
  });

  if (error) console.warn("notifyCustomer error:", error.message);
}

async function uploadJobPhoto(
  jobId: string,
  file: File,
  type: string,
  uploadedByEmail: string | null
) {
  const safeName = file.name.replace(/\s+/g, "_");
  const path = `${jobId}/${type}-${Date.now()}-${safeName}`;

  const { error: upErr } = await supabaseClient.storage
    .from("job-photos")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (upErr) throw upErr;

  const { data: pub } = supabaseClient.storage
    .from("job-photos")
    .getPublicUrl(path);
  const file_url = pub?.publicUrl ?? null;

  const { error: insErr } = await supabaseClient.from("photos").insert({
    appointment_id: jobId,
    photo_type: type,
    file_url,
    uploaded_by: uploadedByEmail,
    timestamp: new Date().toISOString(),
  });

  if (insErr) throw insErr;

  return file_url;
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}

/* ----------------------------------------------
   Status config types
-----------------------------------------------*/

type ServiceStatusKey =
  | "requested"
  | "estimating"
  | "estimate_sent"
  | "approved"
  | "scheduled"
  | "en_route"
  | "on_site"
  | "in_progress"
  | "curing"
  | "completed";

function mapsUrl(addr?: string | null) {
  const q = encodeURIComponent(addr || "");
  return `https://maps.google.com/?q=${q}`;
}

async function safeCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- Signature helpers ---------------- */

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return { blob: new Blob([bytes], { type: mime }), mime };
}

async function signatureStringToBlob(
  sig: string
): Promise<{ blob: Blob; mime: string }> {
  if (sig.startsWith("data:image/")) return dataUrlToBlob(sig);

  // If it's a URL (signed/public), fetch -> blob
  const res = await fetch(sig);
  if (!res.ok) throw new Error("Unable to read signature image.");
  const blob = await res.blob();
  const mime = blob.type || "image/png";
  return { blob, mime };
}

async function makeSignedUrlFromPath(
  path: string,
  expiresSeconds = 60 * 60
): Promise<string | null> {
  const { data, error } = await supabaseClient.storage
    .from("waivers")
    .createSignedUrl(path, expiresSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/* ----------------------------------------------
   Photo delete helpers
-----------------------------------------------*/

function extractJobPhotosPathFromPublicUrl(url: string): string | null {
  // Typical: https://<proj>.supabase.co/storage/v1/object/public/job-photos/<path>
  try {
    const u = new URL(url);
    const marker = "/storage/v1/object/public/job-photos/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return u.pathname.slice(idx + marker.length);
  } catch {
    // fallback: try simple split
    const marker = "/storage/v1/object/public/job-photos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  }
}

/* ----------------------------------------------
   Tiny UI helpers
-----------------------------------------------*/

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const cardIn = {
  initial: { opacity: 0, y: 10, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
};

function isProbablyMissingColumn(err: any) {
  const msg = String(err?.message ?? err ?? "");
  return (
    msg.toLowerCase().includes("does not exist") &&
    msg.toLowerCase().includes("column")
  );
}

/* ----------------------------------------------
   Component
-----------------------------------------------*/

export default function TechJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);

  const [photos, setPhotos] = useState<PhotosByStage>({
    before: [],
    during: [],
    after: [],
  });

  // NOTE: SignatureCanvas uses this to display and edit.
  // It can be a dataUrl OR a signed URL (for viewing existing signature).
  const [techSignatureDataUrl, setTechSignatureDataUrl] = useState<string | null>(
    null
  );

  const [workNotes, setWorkNotes] = useState("");
  const [resinUsed, setResinUsed] = useState("");
  const [cureTime, setCureTime] = useState(30);
  const [uploading, setUploading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const [repairOutcome, setRepairOutcome] = useState<RepairOutcome>("completed");
  const [crackOutCause, setCrackOutCause] = useState<
    (typeof CRACK_OUT_CAUSES)[number]["value"] | ""
  >("");
  const [crackOutNotes, setCrackOutNotes] = useState("");
  const [crackOutPhotoUrl, setCrackOutPhotoUrl] = useState<string | null>(null);
  const [crackOutUploading, setCrackOutUploading] = useState(false);

  // ✅ Waiver (new component)
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [waiverSatisfied, setWaiverSatisfied] = useState(false);

  // ✅ tech identity (for claim + messages)
  const [meEmail, setMeEmail] = useState<string | null>(null);

  // ✅ prevent claim spam
  const claimAttemptedRef = useRef(false);

  /* -------------------- Queries -------------------- */

  const {
    data: appointment,
    isLoading,
    error: appointmentError,
  } = useQuery({
    queryKey: ["appointment", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (error) console.warn("appointment lookup error", error);
      return (data ?? null) as any;
    },
  });

  // ✅ Tiny waiver-exists check so the workflow unlocks instantly if already signed
  const { data: waiverExists, isLoading: loadingWaiver } = useQuery({
    queryKey: ["appointment-waiver-exists", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointment_waivers")
        .select("id")
        .eq("appointment_id", jobId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
  });

  // ✅ get tech email once
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabaseClient.auth.getUser();
      const email = data?.user?.email ?? null;
      if (alive) setMeEmail(email);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!jobId) return;

    // already signed
    if (waiverExists) {
      setWaiverSatisfied(true);
      return;
    }

    // portal override
    const dbMode = String(appointment?.waiver_signing_mode ?? "");
    if (dbMode === "portal") {
      setWaiverSatisfied(true);
      return;
    }

    // otherwise not satisfied
    setWaiverSatisfied(false);
  }, [jobId, waiverExists, appointment?.waiver_signing_mode]);

  const workflowLocked = useMemo(() => {
    if (!appointment) return true;
    return currentStep >= 1 && !waiverSatisfied;
  }, [appointment, currentStep, waiverSatisfied]);

  useQuery({
    queryKey: ["job-photos", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("photos")
        .select("photo_type,file_url,timestamp")
        .eq("appointment_id", jobId)
        .order("timestamp", { ascending: true });

      if (error) throw error;

      const before: string[] = [];
      const during: string[] = [];
      const after: string[] = [];
      let crack: string | null = null;

      for (const row of data ?? []) {
        const t = String(row.photo_type ?? "");
        const url = row.file_url as string | null;
        if (!url) continue;

        if (t === "crack_out") crack = crack ?? url;
        else if (t.includes("before")) before.push(url);
        else if (t.includes("after")) after.push(url);
        else during.push(url);
      }

      setPhotos((prev) => ({
        before: prev.before.length ? prev.before : before,
        during: prev.during.length ? prev.during : during,
        after: prev.after.length ? prev.after : after,
      }));

      if (!crackOutPhotoUrl && crack) setCrackOutPhotoUrl(crack);

      return true;
    },
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", appointment?.vehicle_id],
    enabled: !!appointment?.vehicle_id,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select(
          "id, owner_email, year, make, model, color, vin, license_plate, insurance_carrier, is_default, vehicle_type, trim"
        )
        .eq("id", appointment!.vehicle_id)
        .maybeSingle();

      if (error) console.warn("vehicle lookup error", error);
      return (data ?? null) as any;
    },
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", appointment?.customer_email],
    enabled: !!appointment?.customer_email,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("app_users")
        .select("*")
        .eq("email", appointment!.customer_email)
        .maybeSingle();
      if (error) console.warn("customer lookup error", error);
      return (data ?? null) as any;
    },
  });

  const { data: garageVehicles = [], isLoading: loadingGarage } = useQuery({
    queryKey: ["garage-vehicles", appointment?.customer_email],
    enabled: !!appointment?.customer_email,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select(
          "id, owner_email, year, make, model, color, vin, license_plate, insurance_carrier, is_default, vehicle_type, trim"
        )
        .eq("owner_email", appointment!.customer_email);

      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const effectiveVehicle =
    vehicle ||
    (appointment?.vehicle_id
      ? garageVehicles.find((v: any) => v.id === appointment.vehicle_id)
      : null) ||
    null;

  const vehicleLabel = useMemo(() => {
    return effectiveVehicle
      ? `${effectiveVehicle.year ?? ""} ${effectiveVehicle.make ?? ""} ${effectiveVehicle.model ?? ""}`.trim()
      : "";
  }, [effectiveVehicle]);

  /* -------------------- Claim job when unassigned -------------------- */
  useEffect(() => {
    if (!appointment?.id) return;
    if (!meEmail) return;
    if (appointment.technician_email) return;
    if (claimAttemptedRef.current) return;

    claimAttemptedRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabaseClient
          .from("appointments")
          .update({ technician_email: meEmail })
          .eq("id", appointment.id)
          .select("id, technician_email")
          .maybeSingle();

        if (error) {
          console.warn("claim appointment error:", error.message);
          setToast("Could not claim this job (RLS).");
          return;
        }

        if (!data?.id) {
          setToast("Could not claim this job (not allowed).");
          return;
        }

        setToast("Job claimed");
        await queryClient.invalidateQueries({ queryKey: ["appointment", jobId] });
        await queryClient.refetchQueries({ queryKey: ["appointment", jobId] });
      } catch (e: any) {
        console.warn("claim appointment failed:", e?.message ?? e);
        setToast("Could not claim this job.");
      }
    })();
  }, [appointment?.id, appointment?.technician_email, meEmail, jobId, queryClient]);

  /* -------------------- Step hydration -------------------- */
  useEffect(() => {
    if (!appointment) return;

    const persisted = Number.isFinite(Number(appointment.tech_workflow_step))
      ? clampWorkflowStep(Number(appointment.tech_workflow_step))
      : null;

    const derived = appointment.status
      ? clampWorkflowStep(statusToWorkflowStep(appointment.status))
      : 0;

    setCurrentStep(persisted ?? derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment?.id]);

  useEffect(() => {
    if (!appointment) return;

    const dbOutcome: RepairOutcome =
      appointment.repair_outcome === "crack_out" ? "crack_out" : "completed";

    setRepairOutcome(dbOutcome);
    if (appointment.crack_out_cause) setCrackOutCause(appointment.crack_out_cause);
    if (appointment.crack_out_notes) setCrackOutNotes(appointment.crack_out_notes);
    if (appointment.crack_out_photo_url)
      setCrackOutPhotoUrl(appointment.crack_out_photo_url);

    (async () => {
      if (techSignatureDataUrl) return;

      const p1 =
        typeof appointment.tech_signature_storage_path === "string"
          ? String(appointment.tech_signature_storage_path)
          : "";

      if (p1) {
        const signed = await makeSignedUrlFromPath(p1, 60 * 60);
        if (signed) {
          setTechSignatureDataUrl(signed);
          return;
        }
      }

      if (typeof appointment.customer_signature === "string") {
        const v = String(appointment.customer_signature);
        if (v.startsWith("data:image/")) {
          setTechSignatureDataUrl(v);
          return;
        }
        if (!v.startsWith("http") && v.includes("/")) {
          const signed = await makeSignedUrlFromPath(v, 60 * 60);
          if (signed) setTechSignatureDataUrl(signed);
        }
      }
    })();

    if (appointment.notes_tech && !workNotes) setWorkNotes(appointment.notes_tech);
    if (appointment.resin_type && !resinUsed) setResinUsed(appointment.resin_type);
    if (appointment.cure_duration_minutes && cureTime === 30)
      setCureTime(appointment.cure_duration_minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* -------------------- Mutations -------------------- */

  const updateWorkflowStepMutation = useMutation({
    mutationFn: async (nextStep: number) => {
      if (!jobId) return;
      const clamped = clampWorkflowStep(nextStep);

      const { data, error } = await supabaseClient
        .from("appointments")
        .update({
          tech_workflow_step: clamped,
          tech_workflow_updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select("id, tech_workflow_step")
        .maybeSingle();

      if (error) throw error;

      if (!data?.id) {
        throw new Error(
          "RLS blocked this update (job not assigned to your technician_email)."
        );
      }

      return clamped;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointment", jobId] });
      await queryClient.refetchQueries({ queryKey: ["appointment", jobId] });
    },
    onError: (e: any) => {
      console.warn("updateWorkflowStepMutation error:", e?.message ?? e);
      setToast(e?.message ?? "Failed to save step");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { status: string; updates?: Record<string, any> }) => {
      if (!jobId) return;

      const { data, error } = await supabaseClient
        .from("appointments")
        .update({ status: payload.status, ...(payload.updates ?? {}) })
        .eq("id", jobId)
        .select("id,status,technician_email")
        .maybeSingle();

      if (error) throw error;

      if (!data?.id) {
        throw new Error(
          "RLS blocked this update (job not assigned to your technician_email)."
        );
      }

      if (appointment?.customer_email) {
        if (payload.status === "on_site") {
          const { data: me } = await supabaseClient.auth.getUser();
          await notifyCustomer({
            recipient_email: appointment.customer_email,
            notification_type: "tech_arrived",
            appointment_id: jobId,
            custom_data: {
              techName: me?.user?.user_metadata?.full_name || "Your Technician",
              address: appointment.service_address,
            },
          });
        } else if (payload.status === "in_progress") {
          await notifyCustomer({
            recipient_email: appointment.customer_email,
            notification_type: "repair_started",
            appointment_id: jobId,
            custom_data: { vehicle: vehicleLabel, estimatedTime: 30 },
          });
        } else if (payload.status === "curing") {
          await notifyCustomer({
            recipient_email: appointment.customer_email,
            notification_type: "repair_curing",
            appointment_id: jobId,
            custom_data: { cureTime },
          });
        }
      }

      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointment", jobId] });
      await queryClient.refetchQueries({ queryKey: ["appointment", jobId] });
      setToast("Status updated");
    },
    onError: (e: any) => {
      console.error("updateStatusMutation error:", e);
      setToast(e?.message ?? "Failed to update status");
      alert(e?.message ?? "Failed to update status.");
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      if (!jobId) return;
      const { data, error } = await supabaseClient
        .from("appointments")
        .update({ vehicle_id: vehicleId })
        .eq("id", jobId)
        .select("id, vehicle_id")
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) {
        throw new Error(
          "RLS blocked this update (job not assigned to your technician_email)."
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment", jobId] });
      queryClient.invalidateQueries({ queryKey: ["vehicle", appointment?.vehicle_id] });
      setToast("Vehicle attached");
    },
    onError: (e: any) => {
      console.error("updateVehicleMutation error:", e);
      setToast(e?.message ?? "Failed to attach vehicle");
      alert(e?.message ?? "Failed to attach vehicle.");
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      const { data: me } = await supabaseClient.auth.getUser();
      const uploader = me?.user?.email ?? null;
      return uploadJobPhoto(jobId, file, type, uploader);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
    },
    onError: (e: any) => {
      setToast(e?.message ?? "Photo upload failed");
    },
  });

  const uploadCrackOutPhoto = async (file: File) => {
    setCrackOutUploading(true);
    try {
      const { data: me } = await supabaseClient.auth.getUser();
      const uploader = me?.user?.email ?? null;
      const url = await uploadJobPhoto(jobId, file, "crack_out", uploader);
      setCrackOutPhotoUrl(url);

      const { data, error } = await supabaseClient
        .from("appointments")
        .update({ crack_out_photo_url: url })
        .eq("id", jobId)
        .select("id, crack_out_photo_url")
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) {
        throw new Error(
          "RLS blocked this update (job not assigned to your technician_email)."
        );
      }

      setToast("Crack-out photo saved");
    } finally {
      setCrackOutUploading(false);
    }
  };

  /**
   * ✅ IMPORTANT FIX:
   * The API route now creates/updates tech_invoices and returns { invoice_id }.
   * So THIS page must redirect using invoice_id (not jobId).
   */
  const completeJobMutation = useMutation({
    mutationFn: async (): Promise<{ invoice_id: string }> => {
      if (!appointment) throw new Error("Missing appointment");

      const isCrackOut = repairOutcome === "crack_out";

      if (isCrackOut) {
        if (!crackOutCause) throw new Error("Crack-out cause is required.");
        if (!crackOutNotes || crackOutNotes.trim().length < 10)
          throw new Error("Crack-out notes (min 10 chars) are required.");
        if (!crackOutPhotoUrl) throw new Error("Crack-out photo is required.");
      }

      if (!techSignatureDataUrl) throw new Error("Tech signature is required.");

      // Ensure we send a DATA URL
      let signatureDataUrlToSend = techSignatureDataUrl;

      if (!signatureDataUrlToSend.startsWith("data:image/")) {
        const { blob } = await signatureStringToBlob(signatureDataUrlToSend);
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);

        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const b64 = btoa(binary);
        signatureDataUrlToSend = `data:${blob.type || "image/png"};base64,${b64}`;
      }

      const nowIso = new Date().toISOString();

      // ✅ access token (with one refresh attempt)
      let accessToken = "";
      {
        const { data: sess1 } = await supabaseClient.auth.getSession();
        accessToken = sess1?.session?.access_token || "";
      }
      if (!accessToken) {
        await supabaseClient.auth.refreshSession().catch(() => {});
        const { data: sess2 } = await supabaseClient.auth.getSession();
        accessToken = sess2?.session?.access_token || "";
      }
      if (!accessToken) throw new Error("Session expired. Please re-login.");

      const res = await fetch(`/api/tech/appointments/${jobId}/complete`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          appointment_id: jobId,

          signature_type: "drawn",
          signature_data_url: signatureDataUrlToSend,

          status: "completed",
          actual_end_time: nowIso,

          notes_tech: workNotes || null,
          resin_type: resinUsed || null,
          cure_duration_minutes: cureTime || null,

          tech_workflow_step: 5,
          tech_workflow_updated_at: nowIso,

          repair_outcome: isCrackOut ? "crack_out" : "completed",
          crack_out_occurred: isCrackOut,
          crack_out_cause: isCrackOut ? crackOutCause : null,
          crack_out_notes: isCrackOut ? crackOutNotes : null,
          crack_out_photo_url: isCrackOut ? crackOutPhotoUrl : null,
          crack_out_at: isCrackOut ? nowIso : null,
          replacement_required: isCrackOut,
        }),
      });

      const j = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(
            j?.error ||
              "Forbidden. Your tech session/role is not authorized for this appointment (or the route's tech-check/RLS blocked it)."
          );
        }
        throw new Error(j?.error || "Failed to complete job.");
      }

      const invoiceId = String(j?.invoice_id ?? "");
      if (!invoiceId) throw new Error("Job completed but invoice_id was not returned.");

      // Optional client-side notifications
      if (appointment.customer_email) {
        const serviceDate = new Date().toISOString().split("T")[0];

        await notifyCustomer({
          recipient_email: appointment.customer_email,
          notification_type: "repair_completed",
          appointment_id: jobId,
          custom_data: {
            outcome: isCrackOut ? "crack_out" : "completed",
            replacementRequired: isCrackOut,
          },
        });

        if (!isCrackOut) {
          await notifyCustomer({
            recipient_email: appointment.customer_email,
            notification_type: "warranty_issued",
            appointment_id: jobId,
            custom_data: { serviceDate, warrantyEnd: addYears(serviceDate, 1) },
          });
        }
      }

      return { invoice_id: invoiceId };
    },
    onSuccess: async ({ invoice_id }) => {
      await queryClient.invalidateQueries({ queryKey: ["appointment", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });

      // ✅ IMPORTANT: go to invoice by INVOICE ID
      router.replace(`/tech/dashboard/invoices/invoice/${invoice_id}`);
    },
    onError: (err: any) => {
      console.error("completeJobMutation error RAW:", err);
      setToast(
        typeof err?.message === "string" ? err.message : "Failed to complete job."
      );
      alert(typeof err?.message === "string" ? err.message : "Failed to complete job.");
    },
  });

  /* -------------------- Handlers -------------------- */

  const setAndPersistStep = useCallback(
    async (next: number) => {
      const clamped = clampWorkflowStep(next);

      if (clamped >= 1 && !waiverSatisfied) {
        setToast("Waiver required before proceeding");
        setWaiverOpen(true);
        return;
      }

      setCurrentStep(clamped);
      if (jobId) updateWorkflowStepMutation.mutate(clamped);
    },
    [jobId, updateWorkflowStepMutation, waiverSatisfied]
  );

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    photoType: string,
    stage: keyof PhotosByStage
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadPhotoMutation.mutateAsync({ file, type: photoType });
      if (url) {
        setPhotos((prev) => ({ ...prev, [stage]: [...prev[stage], url] }));
        setToast("Photo saved");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Photo upload failed. Try again.");
    }
    setUploading(false);
  };

  const removePhoto = useCallback(
    async (stage: keyof PhotosByStage, url: string) => {
      if (!jobId || !url) return;

      setPhotos((prev) => ({
        ...prev,
        [stage]: prev[stage].filter((u) => u !== url),
      }));

      try {
        const { error: delRowErr } = await supabaseClient
          .from("photos")
          .delete()
          .eq("appointment_id", jobId)
          .eq("file_url", url);

        if (delRowErr) {
          console.warn("delete photo row error:", delRowErr.message);
        }

        const path = extractJobPhotosPathFromPublicUrl(url);
        if (path) {
          const { error: delObjErr } = await supabaseClient.storage
            .from("job-photos")
            .remove([path]);
          if (delObjErr) {
            console.warn("delete storage object error:", delObjErr.message);
          }
        }

        queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
        setToast("Photo removed");
      } catch (e: any) {
        console.error("removePhoto failed:", e?.message ?? e);
        setToast("Could not remove photo");

        setPhotos((prev) => {
          if (prev[stage].includes(url)) return prev;
          return { ...prev, [stage]: [...prev[stage], url] };
        });
      }
    },
    [jobId, queryClient]
  );

  const handleCrackOutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadCrackOutPhoto(file);
    } catch (err) {
      console.error("Crack-out upload failed:", err);
      alert("Crack-out photo upload failed. Try again.");
    }
  };

  const handleStatusClick = (nextStatus: ServiceStatusKey) => {
    if (!appointment) return;
    if (updateStatusMutation.isPending) return;

    const lockedStatuses: ServiceStatusKey[] = ["in_progress", "curing", "completed"];
    if (!waiverSatisfied && lockedStatuses.includes(nextStatus)) {
      setToast("Waiver required before starting repair");
      setWaiverOpen(true);
      return;
    }

    const extra: Record<string, any> = {};
    if (nextStatus === "on_site" && !appointment.actual_start_time) {
      extra.actual_start_time = new Date().toISOString();
    }

    updateStatusMutation.mutate({ status: nextStatus, updates: extra });
  };

  const handleNextStep = async () => {
    if (!appointment) return;

    if (currentStep === 0) {
      updateStatusMutation.mutate({
        status: "on_site",
        updates: {
          actual_start_time: appointment.actual_start_time ?? new Date().toISOString(),
        },
      });
    } else if (currentStep === 1) {
      if (!waiverSatisfied) {
        setToast("Waiver required before starting repair");
        setWaiverOpen(true);
        return;
      }
      updateStatusMutation.mutate({ status: "in_progress", updates: {} });
    } else if (currentStep === 2) {
      updateStatusMutation.mutate({ status: "curing", updates: {} });
    }

    if (currentStep < WORKFLOW_STEPS.length - 1) {
      await setAndPersistStep(currentStep + 1);
    }
  };

  const canComplete = useMemo(() => {
    if (!techSignatureDataUrl) return false;

    const isCrackOut = repairOutcome === "crack_out";
    if (isCrackOut) {
      if (!crackOutCause) return false;
      if (!crackOutNotes || crackOutNotes.trim().length < 10) return false;
      if (!crackOutPhotoUrl) return false;
    }
    return true;
  }, [
    techSignatureDataUrl,
    repairOutcome,
    crackOutCause,
    crackOutNotes,
    crackOutPhotoUrl,
  ]);

  const handleComplete = () => {
    if (!techSignatureDataUrl) {
      alert("Tech signature required");
      return;
    }
    completeJobMutation.mutate();
  };

  /* -------------------- UI -------------------- */

  if (isLoading || loadingWaiver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-60 bg-sky-500/30 animate-pulse" />
          <div className="relative animate-spin rounded-full h-12 w-12 border-b-2 border-sky-300" />
        </div>
      </div>
    );
  }

  if (appointmentError) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-slate-950">
        <Card className="max-w-md border border-slate-700/80 bg-slate-950/95 text-slate-50">
          <CardContent className="py-8 text-center space-y-3">
            <h2 className="text-lg font-semibold text-slate-50">Error loading job</h2>
            <p className="text-sm text-slate-400">
              There was a problem loading this appointment. Check Supabase RLS /
              permissions for the technician.
            </p>
            <Button
              onClick={() => router.replace("/tech/dashboard/schedule/jobs")}
              className="bg-sky-500 hover:bg-sky-600 text-slate-950"
            >
              Back to Job Board
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-slate-950">
        <Card className="max-w-md border border-slate-700/80 bg-slate-950/95 text-slate-50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold mb-2 text-slate-50">Job Not Found</h2>
            <Button
              onClick={() => router.replace("/tech/dashboard/schedule/jobs")}
              className="bg-sky-500 hover:bg-sky-600 text-slate-950"
            >
              Back to Job Board
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCrackOut = repairOutcome === "crack_out";

  const busy =
    updateStatusMutation.isPending ||
    uploadPhotoMutation.isPending ||
    completeJobMutation.isPending ||
    updateWorkflowStepMutation.isPending;

  const isAssignedToMe =
    !!appointment?.technician_email &&
    !!meEmail &&
    String(appointment.technician_email).toLowerCase() === String(meEmail).toLowerCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <WaiverGate
        appointment={appointment}
        open={waiverOpen}
        onOpenChangeAction={setWaiverOpen}
        onSatisfiedAction={() => setWaiverSatisfied(true)}
      />

      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.4), transparent 55%), radial-gradient(circle at 50% 80%, rgba(59,130,246,0.55), transparent 55%), linear-gradient(to bottom, rgba(15,23,42,0.0), rgba(2,6,23,0.6))",
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(to_right,rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:42px_42px]" />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-screen p-4 md:p-8 bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-slate-950/95 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto text-slate-50">
          {/* ... REST OF YOUR UI IS UNCHANGED ... */}

          <TechWorkflow
            currentStep={currentStep}
            workflowLocked={workflowLocked}
            waiverSatisfied={waiverSatisfied}
            openWaiverAction={() => setWaiverOpen(true)}
            setAndPersistStepAction={(n) => setAndPersistStep(n)}
            handleNextStepAction={handleNextStep}
            isBusy={busy}
            isUploading={uploading}
            photos={photos}
            handlePhotoUploadAction={handlePhotoUpload}
            removePhotoAction={removePhoto}
            resinUsed={resinUsed}
            setResinUsedAction={setResinUsed}
            workNotes={workNotes}
            setWorkNotesAction={setWorkNotes}
            cureTime={cureTime}
            setCureTimeAction={setCureTime}
            repairOutcome={repairOutcome}
            setRepairOutcomeAction={setRepairOutcome}
            crackOutCause={crackOutCause}
            setCrackOutCauseAction={setCrackOutCause}
            crackOutNotes={crackOutNotes}
            setCrackOutNotesAction={setCrackOutNotes}
            crackOutPhotoUrl={crackOutPhotoUrl}
            crackOutUploading={crackOutUploading}
            handleCrackOutUploadAction={handleCrackOutUpload}
            techSignatureDataUrl={techSignatureDataUrl}
            setTechSignatureDataUrlAction={setTechSignatureDataUrl}
            canComplete={canComplete}
            completeJobAction={handleComplete}
            completing={completeJobMutation.isPending}
          />

          <div className="pb-10 text-center text-[11px] text-slate-500">
            Job ID:{" "}
            <span className="text-slate-400">{String(jobId).slice(0, 12)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}