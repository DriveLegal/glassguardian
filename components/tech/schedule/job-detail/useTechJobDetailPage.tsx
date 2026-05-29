"use client";

import * as React from "react";
import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabaseClient } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import {
  WORKFLOW_STEPS,
  CRACK_OUT_CAUSES,
  clampWorkflowStep,
  type RepairOutcome,
  type PhotosByStage,
} from "@/components/tech/schedule/workflow/TechWorkflow";

import {
  CheckCircle,
  Copy,
  FileText,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Navigation,
  PenSquare,
  Phone,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

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

type AppUserLite = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type CustomerProfileResponse = {
  customer?: AppUserLite | null;
  error?: string;
};

const SIGNATURE_BUCKET_CANDIDATES = [
  "waivers",
  "signatures",
  "appointment-waivers",
  "appointment_waivers",
  "job-signatures",
  "tech-signatures",
] as const;

const cardIn = {
  initial: { opacity: 0, y: 10, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
};

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

function normalizeEmail(email?: string | null) {
  return String(email ?? "").trim().toLowerCase();
}

function displayEmail(email?: string | null) {
  return String(email ?? "").trim();
}

function asCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeHttpUrl(value?: string | null) {
  return /^https?:\/\//i.test(String(value ?? "").trim());
}

function looksLikeDataUrl(value?: string | null) {
  return /^data:image\//i.test(String(value ?? "").trim());
}

function looksLikeStoragePath(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (looksLikeHttpUrl(v) || looksLikeDataUrl(v)) return false;
  return v.includes("/") || /\.(png|jpg|jpeg|webp|svg)$/i.test(v);
}

async function makeSignedUrlFromCandidateBuckets(
  path: string,
  expiresSeconds = 60 * 60
): Promise<string | null> {
  const cleanPath = asCleanString(path);
  if (!cleanPath) return null;

  for (const bucket of SIGNATURE_BUCKET_CANDIDATES) {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresSeconds);

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return null;
}

async function resolveSignatureValue(value?: string | null): Promise<string | null> {
  const v = asCleanString(value);
  if (!v) return null;
  if (looksLikeHttpUrl(v) || looksLikeDataUrl(v)) return v;
  if (looksLikeStoragePath(v)) return makeSignedUrlFromCandidateBuckets(v);
  return null;
}

function readFirstNonEmptyString(
  source: Record<string, any> | null | undefined,
  keys: string[]
) {
  if (!source) return "";
  for (const key of keys) {
    const value = asCleanString(source[key]);
    if (value) return value;
  }
  return "";
}

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

function resolveCustomerName(customer: AppUserLite | null) {
  return String(customer?.full_name ?? "").trim();
}

function resolveCustomerPhone(customer: AppUserLite | null) {
  return String(customer?.phone ?? "").trim();
}

function resolveCustomerEmail(
  customer: AppUserLite | null | undefined,
  customerEmail: string
) {
  return displayEmail(customer?.email ?? customerEmail ?? "");
}

function statusSupportsWorkflowSync(
  status?: string | null
): status is ServiceStatusKey {
  return (
    status === "on_site" ||
    status === "in_progress" ||
    status === "curing" ||
    status === "completed"
  );
}

function statusToCanonicalWorkflowStep(status?: string | null): number | null {
  if (!statusSupportsWorkflowSync(status)) return null;
  if (status === "on_site") return 0;
  if (status === "in_progress") return 2;
  if (status === "curing") return 3;
  if (status === "completed") return clampWorkflowStep(WORKFLOW_STEPS.length - 1);
  return null;
}

function workflowStepToSyncedStatus(step: number): ServiceStatusKey | null {
  const s = clampWorkflowStep(step);
  if (s === 0) return "on_site";
  if (s === 1) return "on_site";
  if (s === 2) return "in_progress";
  if (s === 3) return "curing";
  if (s === 4) return "curing";
  if (s >= 5) return "completed";
  return null;
}

function resolveInvoiceId(appointment: any, createdInvoiceId: string | null) {
  return (
    String(
      createdInvoiceId ||
        appointment?.invoice_id ||
        appointment?.tech_invoice_id ||
        appointment?.invoiceId ||
        ""
    ).trim() || null
  );
}

function extractJobPhotosPathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/storage/v1/object/public/job-photos/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return u.pathname.slice(idx + marker.length);
  } catch {
    const marker = "/storage/v1/object/public/job-photos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  }
}

export function useTechJobDetailPage(jobId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<PhotosByStage>({
    before: [],
    during: [],
    after: [],
  });

  const [customerSignatureDataUrl, setCustomerSignatureDataUrl] = useState<string | null>(
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

  const [waiverOpen, setWaiverOpen] = useState(false);
  const [waiverSatisfied, setWaiverSatisfied] = useState(false);

  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [customer, setCustomer] = useState<AppUserLite | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  const [signaturePreview, setSignaturePreview] = useState<{
    title: string;
    url: string;
  } | null>(null);

  const claimAttemptedRef = useRef(false);

  const {
    data: appointment,
    isLoading,
    error: appointmentError,
  } = useQuery({
    queryKey: ["appointment", jobId],
    enabled: !!jobId,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
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

  const { data: waiverRecord } = useQuery({
    queryKey: ["appointment-waiver-record", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointment_waivers")
        .select("*")
        .eq("appointment_id", jobId)
        .maybeSingle();

      if (error) {
        console.warn("appointment_waivers lookup error:", error.message);
        return null;
      }

      return (data ?? null) as Record<string, any> | null;
    },
  });

  const customerEmail = useMemo(() => {
    return displayEmail(appointment?.customer_email ?? "");
  }, [appointment?.customer_email]);

  const normalizedCustomerEmail = useMemo(() => {
    return normalizeEmail(customerEmail);
  }, [customerEmail]);

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
    let alive = true;
    const controller = new AbortController();

    async function loadCustomer() {
      if (!normalizedCustomerEmail) {
        if (alive) {
          setCustomer(null);
          setCustomerError(null);
        }
        return;
      }

      try {
        setCustomerError(null);

        const res = await fetch(
          `/api/tech/customer-profile?email=${encodeURIComponent(
            normalizedCustomerEmail
          )}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const json = (await res.json().catch(() => null)) as
          | CustomerProfileResponse
          | null;

        if (!alive) return;

        if (!res.ok) {
          const message =
            json?.error || `Customer lookup failed with status ${res.status}`;
          console.warn("customer-profile api failed:", message);
          setCustomer(null);
          setCustomerError(message);
          return;
        }

        setCustomer((json?.customer ?? null) as AppUserLite | null);
      } catch (err: any) {
        if (!alive || err?.name === "AbortError") return;
        console.warn("customer-profile api unexpected error:", err?.message ?? err);
        setCustomer(null);
        setCustomerError(err?.message ?? "Customer lookup failed");
      }
    }

    loadCustomer();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [normalizedCustomerEmail]);

  useEffect(() => {
    if (!jobId) return;

    if (waiverExists) {
      setWaiverSatisfied(true);
      return;
    }

    const dbMode = String(appointment?.waiver_signing_mode ?? "");
    if (dbMode === "portal") {
      setWaiverSatisfied(true);
      return;
    }

    setWaiverSatisfied(false);
  }, [jobId, waiverExists, appointment?.waiver_signing_mode]);

  const invoiceId = useMemo(
    () => resolveInvoiceId(appointment, createdInvoiceId),
    [appointment, createdInvoiceId]
  );

  const jobLocked = useMemo(() => {
    if (!appointment) return false;
    return String(appointment.status ?? "") === "completed";
  }, [appointment]);

  const workflowLocked = useMemo(() => {
    if (!appointment) return true;
    if (jobLocked) return true;
    return currentStep >= 1 && !waiverSatisfied;
  }, [appointment, currentStep, waiverSatisfied, jobLocked]);

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
          "id, owner_email, year, make, model, color, vin, license_plate, insurance_carrier, is_default, body_type"
        )
        .eq("id", appointment!.vehicle_id)
        .maybeSingle();

      if (error) console.warn("vehicle lookup error", error);
      return (data ?? null) as any;
    },
  });

  const garageOwnerEmail = useMemo(() => {
    return normalizeEmail(customer?.email ?? customerEmail);
  }, [customer?.email, customerEmail]);

  const {
    data: garageVehicles = [],
    isLoading: loadingGarage,
    error: garageVehiclesError,
  } = useQuery({
    queryKey: ["garage-vehicles", garageOwnerEmail],
    enabled: !!garageOwnerEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select(
          "id, owner_email, year, make, model, color, vin, license_plate, insurance_carrier, is_default, body_type"
        )
        .eq("owner_email", garageOwnerEmail);

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

  useEffect(() => {
    if (!appointment) return;

    const persisted = Number.isFinite(Number(appointment.tech_workflow_step))
      ? clampWorkflowStep(Number(appointment.tech_workflow_step))
      : null;

    const syncedFromStatus = statusToCanonicalWorkflowStep(appointment.status);
    const hydrated = syncedFromStatus ?? persisted ?? 0;

    setCurrentStep(hydrated);
  }, [appointment?.id, appointment?.status, appointment?.tech_workflow_step]);

  useEffect(() => {
    if (!appointment) return;

    const dbOutcome: RepairOutcome =
      appointment.repair_outcome === "crack_out" ? "crack_out" : "completed";

    setRepairOutcome(dbOutcome);

    if (appointment.crack_out_cause) setCrackOutCause(appointment.crack_out_cause);
    if (appointment.crack_out_notes) setCrackOutNotes(appointment.crack_out_notes);
    if (appointment.crack_out_photo_url) setCrackOutPhotoUrl(appointment.crack_out_photo_url);

    if (appointment.notes_tech && !workNotes) setWorkNotes(appointment.notes_tech);
    if (appointment.resin_type && !resinUsed) setResinUsed(appointment.resin_type);
    if (appointment.cure_duration_minutes && cureTime === 30) {
      setCureTime(appointment.cure_duration_minutes);
    }
  }, [appointment?.id, workNotes, resinUsed, cureTime, appointment]);

  useEffect(() => {
    let alive = true;

    async function hydrateSignatures() {
      if (!appointment && !waiverRecord) return;

      if (!customerSignatureDataUrl) {
        const customerCandidate = readFirstNonEmptyString(appointment, [
          "customer_signature_storage_path",
          "waiver_signature_storage_path",
          "customer_signature_url",
          "waiver_signature_url",
          "customer_signature",
          "user_signature",
        ]);

        const waiverCandidate = readFirstNonEmptyString(waiverRecord, [
          "signature_storage_path",
          "waiver_signature_storage_path",
          "customer_signature_storage_path",
          "signature_url",
          "waiver_signature_url",
          "customer_signature_url",
          "signature",
          "customer_signature",
        ]);

        const resolved =
          (await resolveSignatureValue(customerCandidate)) ||
          (await resolveSignatureValue(waiverCandidate));

        if (alive && resolved) setCustomerSignatureDataUrl(resolved);
      }
    }

    hydrateSignatures();

    return () => {
      alive = false;
    };
  }, [appointment, waiverRecord, customerSignatureDataUrl]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const goToNewInvoiceForAppointment = useCallback(
    (newInvoiceId?: string | null) => {
      if (!jobId) return;

      const params = new URLSearchParams();
      params.set("appointment_id", jobId);
      params.set("from_completed_job", "1");

      if (newInvoiceId) {
        params.set("invoice_id", newInvoiceId);
      }

      router.push(`/tech/dashboard/invoices/newinvoice?${params.toString()}`);
    },
    [jobId, router]
  );

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
    mutationFn: async (payload: {
      status: ServiceStatusKey;
      updates?: Record<string, any>;
      stepOverride?: number | null;
    }) => {
      if (!jobId) return;

      const nextStep =
        typeof payload.stepOverride === "number"
          ? clampWorkflowStep(payload.stepOverride)
          : statusToCanonicalWorkflowStep(payload.status);

      const updateData: Record<string, any> = {
        status: payload.status,
        ...(payload.updates ?? {}),
      };

      if (typeof nextStep === "number") {
        updateData.tech_workflow_step = nextStep;
        updateData.tech_workflow_updated_at = new Date().toISOString();
      }

      const { data, error } = await supabaseClient
        .from("appointments")
        .update(updateData)
        .eq("id", jobId)
        .select("id,status,technician_email,tech_workflow_step")
        .maybeSingle();

      if (error) throw error;

      if (!data?.id) {
        throw new Error(
          "RLS blocked this update (job not assigned to your technician_email)."
        );
      }

      const notifyEmail = resolveCustomerEmail(customer, customerEmail);

      if (notifyEmail) {
        if (payload.status === "on_site") {
          const { data: me } = await supabaseClient.auth.getUser();
          await notifyCustomer({
            recipient_email: notifyEmail,
            notification_type: "tech_arrived",
            appointment_id: jobId,
            custom_data: {
              techName: me?.user?.user_metadata?.full_name || "Your Technician",
              address: appointment?.service_address,
            },
          });
        } else if (payload.status === "in_progress") {
          await notifyCustomer({
            recipient_email: notifyEmail,
            notification_type: "repair_started",
            appointment_id: jobId,
            custom_data: { estimatedTime: 30 },
          });
        } else if (payload.status === "curing") {
          await notifyCustomer({
            recipient_email: notifyEmail,
            notification_type: "repair_curing",
            appointment_id: jobId,
            custom_data: { cureTime },
          });
        }
      }

      return data;
    },
    onSuccess: async (data) => {
      const nextStep = Number.isFinite(Number(data?.tech_workflow_step))
        ? clampWorkflowStep(Number(data?.tech_workflow_step))
        : statusToCanonicalWorkflowStep(data?.status) ?? currentStep;

      setCurrentStep(nextStep);

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
      queryClient.invalidateQueries({
        queryKey: ["vehicle", appointment?.vehicle_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["garage-vehicles", garageOwnerEmail],
      });
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

  const completeJobMutation = useMutation({
    mutationFn: async (): Promise<{ invoice_id?: string | null }> => {
      if (!appointment) return { invoice_id: null };

      const isCrackOut = repairOutcome === "crack_out";

      if (isCrackOut) {
        if (!crackOutCause) throw new Error("Crack-out cause is required.");
        if (!crackOutNotes || crackOutNotes.trim().length < 10) {
          throw new Error("Crack-out notes (min 10 chars) are required.");
        }
        if (!crackOutPhotoUrl) throw new Error("Crack-out photo is required.");
      }

      const nowIso = new Date().toISOString();

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
          status: "completed",
          actual_end_time: nowIso,
          notes_tech: workNotes || null,
          resin_type: resinUsed || null,
          cure_duration_minutes: cureTime || null,
          tech_workflow_step: clampWorkflowStep(WORKFLOW_STEPS.length - 1),
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

      const j = (await res.json().catch(() => null)) as any;

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(
            j?.error ||
              "Forbidden. Your tech session/role is not authorized for this appointment (or the route's tech-check/RLS blocked it)."
          );
        }
        throw new Error(j?.error || "Failed to complete job.");
      }

      const notifyEmail = resolveCustomerEmail(customer, customerEmail);

      if (notifyEmail) {
        const serviceDate = new Date().toISOString().split("T")[0];

        await notifyCustomer({
          recipient_email: notifyEmail,
          notification_type: "repair_completed",
          appointment_id: jobId,
          custom_data: {
            outcome: isCrackOut ? "crack_out" : "completed",
            replacementRequired: isCrackOut,
          },
        });

        if (!isCrackOut) {
          await notifyCustomer({
            recipient_email: notifyEmail,
            notification_type: "warranty_issued",
            appointment_id: jobId,
            custom_data: {
              serviceDate,
              warrantyEnd: addYears(serviceDate, 1),
            },
          });
        }
      }

      return { invoice_id: j?.invoice_id ?? null };
    },
    onSuccess: async (data) => {
      const newInvoiceId = data?.invoice_id ? String(data.invoice_id) : null;

      setCreatedInvoiceId(newInvoiceId);
      setCurrentStep(clampWorkflowStep(WORKFLOW_STEPS.length - 1));

      await queryClient.invalidateQueries({ queryKey: ["appointment", jobId] });
      await queryClient.refetchQueries({ queryKey: ["appointment", jobId] });
      await queryClient.invalidateQueries({
        queryKey: ["appointment-waiver-record", jobId],
      });

      setToast("Job completed — opening invoice");
      goToNewInvoiceForAppointment(newInvoiceId);
    },
    onError: (err: any) => {
      console.error("completeJobMutation error RAW:", err);
      setToast(
        typeof err?.message === "string" ? err.message : "Failed to complete job."
      );
      alert(
        typeof err?.message === "string" ? err.message : "Failed to complete job."
      );
    },
  });

  const onWaiverSatisfied = useCallback(async () => {
    setWaiverSatisfied(true);
    setWaiverOpen(false);
    setToast("Waiver signed");

    await queryClient.invalidateQueries({
      queryKey: ["appointment-waiver-exists", jobId],
    });
    await queryClient.refetchQueries({
      queryKey: ["appointment-waiver-exists", jobId],
    });

    await queryClient.invalidateQueries({
      queryKey: ["appointment-waiver-record", jobId],
    });
    await queryClient.invalidateQueries({ queryKey: ["appointment", jobId] });
    await queryClient.refetchQueries({ queryKey: ["appointment", jobId] });
  }, [jobId, queryClient]);

  const setAndPersistStep = useCallback(
    async (next: number) => {
      if (jobLocked) {
        setToast("Job is locked after completion");
        return;
      }

      const clamped = clampWorkflowStep(next);

      if (clamped >= 1 && !waiverSatisfied) {
        setToast("Waiver required before proceeding");
        setWaiverOpen(true);
        return;
      }

      const mappedStatus = workflowStepToSyncedStatus(clamped);

      setCurrentStep(clamped);

      if (mappedStatus) {
        const extra: Record<string, any> = {};
        if (mappedStatus === "on_site" && !appointment?.actual_start_time) {
          extra.actual_start_time = new Date().toISOString();
        }

        updateStatusMutation.mutate({
          status: mappedStatus,
          updates: extra,
          stepOverride: clamped,
        });
        return;
      }

      if (jobId) updateWorkflowStepMutation.mutate(clamped);
    },
    [
      jobId,
      jobLocked,
      updateWorkflowStepMutation,
      updateStatusMutation,
      waiverSatisfied,
      appointment?.actual_start_time,
    ]
  );

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    photoType: string,
    stage: keyof PhotosByStage
  ) => {
    if (jobLocked) {
      setToast("Job is locked after completion");
      return;
    }

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
      if (jobLocked) {
        setToast("Job is locked after completion");
        return;
      }

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
    [jobId, jobLocked, queryClient]
  );

  const handleCrackOutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (jobLocked) {
      setToast("Job is locked after completion");
      return;
    }

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

    if (jobLocked) {
      setToast("Job is locked after completion");
      return;
    }

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

    const nextStep = statusToCanonicalWorkflowStep(nextStatus);

    if (typeof nextStep === "number") setCurrentStep(nextStep);

    updateStatusMutation.mutate({
      status: nextStatus,
      updates: extra,
      stepOverride: nextStep,
    });
  };

  const handleNextStep = async () => {
    if (!appointment) return;

    if (jobLocked) {
      setToast("Job is locked after completion");
      return;
    }

    if (currentStep >= WORKFLOW_STEPS.length - 1) return;

    await setAndPersistStep(currentStep + 1);
  };

  const canComplete = useMemo(() => {
    if (jobLocked) return false;

    const isCrackOut = repairOutcome === "crack_out";

    if (isCrackOut) {
      if (!crackOutCause) return false;
      if (!crackOutNotes || crackOutNotes.trim().length < 10) return false;
      if (!crackOutPhotoUrl) return false;
    }

    return true;
  }, [jobLocked, repairOutcome, crackOutCause, crackOutNotes, crackOutPhotoUrl]);

  const handleComplete = () => {
    if (jobLocked) {
      setToast("Job is already completed");
      return;
    }

    completeJobMutation.mutate();
  };

  const handleOpenUserSignature = () => {
    if (!customerSignatureDataUrl) {
      setToast("User signature not found");
      return;
    }

    setSignaturePreview({
      title: "User Waiver Signature",
      url: customerSignatureDataUrl,
    });
  };

  const handleGoToInvoice = () => {
    if (!invoiceId) {
      if (appointment?.id) {
        goToNewInvoiceForAppointment(null);
        return;
      }

      setToast("Invoice not found yet");
      return;
    }

    router.push(`/tech/dashboard/invoices/invoice/${invoiceId}`);
  };

  const goBack = () => {
    router.replace("/tech/dashboard/schedule/jobs");
  };

  const busy =
    updateStatusMutation.isPending ||
    uploadPhotoMutation.isPending ||
    completeJobMutation.isPending ||
    updateWorkflowStepMutation.isPending;

  const isAssignedToMe =
    !!appointment?.technician_email &&
    !!meEmail &&
    String(appointment.technician_email).toLowerCase() ===
      String(meEmail).toLowerCase();

  const customerDisplayName = resolveCustomerName(customer);
  const customerDisplayPhone = resolveCustomerPhone(customer);
  const customerDisplayEmail = resolveCustomerEmail(customer, customerEmail);

  const headerActions = useMemo(() => {
    if (!appointment) return null;

    return (
      <div className="flex flex-wrap items-center gap-2">
        {jobLocked ? (
          <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
            <Lock className="mr-1 h-4 w-4" />
            Job Locked
          </span>
        ) : !waiverSatisfied ? (
          <Button
            onClick={() => setWaiverOpen(true)}
            className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-600"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Waiver Required
          </Button>
        ) : (
          <span className="inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
            <CheckCircle className="mr-1 h-4 w-4" />
            Waiver Satisfied
          </span>
        )}

        {jobLocked && (
          <>
            <Button
              variant="outline"
              onClick={invoiceId ? handleGoToInvoice : () => goToNewInvoiceForAppointment(null)}
              className="border-slate-600 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
            >
              <PenSquare className="mr-2 h-4 w-4" />
              {invoiceId ? "Edit Invoice" : "Create Invoice"}
            </Button>

            {invoiceId && (
              <Button
                variant="outline"
                onClick={handleGoToInvoice}
                className="border-slate-600 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
              >
                <FileText className="mr-2 h-4 w-4" />
                View Invoice
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleOpenUserSignature}
              className="border-slate-600 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
            >
              <FileText className="mr-2 h-4 w-4" />
              View User Signature
            </Button>
          </>
        )}

        {appointment?.service_address && (
          <>
            <Button
              variant="outline"
              className="border-slate-600 bg-slate-900/70 text-slate-50 transition-all hover:bg-slate-800"
              onClick={async () => {
                const ok = await safeCopy(String(appointment.service_address));
                setToast(ok ? "Address copied" : "Copy failed");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>

            <Button
              variant="outline"
              className="border-slate-600 bg-slate-900/70 text-slate-50 transition-all hover:bg-slate-800"
              onClick={() =>
                window.open(mapsUrl(appointment.service_address), "_blank")
              }
            >
              <Navigation className="mr-2 h-4 w-4" />
              Navigate
            </Button>
          </>
        )}
      </div>
    );
  }, [
    appointment,
    jobLocked,
    waiverSatisfied,
    invoiceId,
    customerSignatureDataUrl,
    goToNewInvoiceForAppointment,
  ]);

  const infoCard = useMemo(() => {
    if (!appointment) return null;

    return (
      <motion.div {...cardIn} transition={{ duration: 0.35, ease: "easeOut" }}>
        <Card className="mb-6 overflow-hidden border border-slate-700/70 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-50 shadow-2xl">
          <div className="pointer-events-none h-1 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-400 opacity-70" />

          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="mb-2 text-2xl text-slate-50">
                  {appointment.service_type?.replace(/_/g, " ").toUpperCase()}
                </CardTitle>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-sky-600/90 text-slate-50 shadow-[0_0_18px_rgba(56,189,248,0.25)]">
                    Step {currentStep + 1} of {WORKFLOW_STEPS.length}
                  </Badge>

                  <Badge
                    variant="outline"
                    className="bg-slate-900/60 text-xs text-sky-200 border-sky-500/70"
                  >
                    Status:{" "}
                    {String(appointment.status ?? "")
                      .replace(/_/g, " ")
                      .toUpperCase()}
                  </Badge>

                  {workflowLocked && (
                    <Badge className="border border-amber-300 bg-amber-500/90 text-slate-950">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      WAIVER LOCK
                    </Badge>
                  )}

                  {(appointment.crack_out_occurred || repairOutcome === "crack_out") && (
                    <Badge className="border border-amber-300 bg-amber-500/90 text-slate-950">
                      <TriangleAlert className="mr-1 h-3.5 w-3.5" />
                      CRACK-OUT
                    </Badge>
                  )}

                  {busy && (
                    <Badge className="border border-slate-600 bg-slate-800 text-slate-200">
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      Syncing
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {customerDisplayPhone && (
                  <a
                    href={`tel:${customerDisplayPhone}`}
                    className="inline-flex"
                    aria-label="Call customer"
                  >
                    <Button
                      variant="outline"
                      className="border-slate-600 bg-slate-900/80 text-slate-50 transition-all hover:bg-slate-800"
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </Button>
                  </a>
                )}

                {customerDisplayEmail && (
                  <a
                    href={`mailto:${customerDisplayEmail}`}
                    className="inline-flex"
                    aria-label="Email customer"
                  >
                    <Button
                      variant="outline"
                      className="border-slate-600 bg-slate-900/80 text-slate-50 transition-all hover:bg-slate-800"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-700/80 bg-gradient-to-r from-slate-900/90 to-slate-800/80 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                    Customer
                  </p>

                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-50">
                      Name: {customerDisplayName || "No name on file"}
                    </p>
                    <p className="text-sm text-slate-300">
                      Phone: {customerDisplayPhone || "No phone on file"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Email: {customerDisplayEmail || "No email on file"}
                    </p>
                  </div>

                  {!!customerError && (
                    <p className="mt-2 text-[11px] text-amber-200">
                      Customer profile lookup failed.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                    Vehicle
                  </p>

                  {effectiveVehicle ? (
                    <>
                      <p className="font-semibold text-slate-50">
                        {effectiveVehicle.year} {effectiveVehicle.make}{" "}
                        {effectiveVehicle.model}
                      </p>
                      {effectiveVehicle.color && (
                        <p className="text-sm text-slate-300">
                          {effectiveVehicle.color}
                        </p>
                      )}
                      {effectiveVehicle.license_plate && (
                        <p className="text-xs text-slate-400">
                          Plate: {effectiveVehicle.license_plate}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        No vehicle is currently attached to this appointment.
                      </p>

                      {loadingGarage ? (
                        <p className="text-xs text-slate-400">
                          Loading customer garage…
                        </p>
                      ) : garageVehiclesError ? (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                          <p className="text-xs font-semibold text-red-200">
                            Vehicles query failed
                          </p>
                          <p className="mt-1 text-[11px] text-slate-300">
                            {String(
                              (garageVehiclesError as any)?.message ??
                                garageVehiclesError
                            )}
                          </p>
                        </div>
                      ) : garageVehicles.length > 0 ? (
                        <div className="space-y-1">
                          <Label
                            htmlFor="select-vehicle"
                            className="text-xs text-slate-300"
                          >
                            Select vehicle from customer&apos;s garage
                          </Label>

                          <select
                            id="select-vehicle"
                            className="w-full rounded-md border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-50"
                            defaultValue=""
                            disabled={updateVehicleMutation.isPending}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              updateVehicleMutation.mutate(val);
                            }}
                          >
                            <option value="" disabled>
                              Choose vehicle…
                            </option>

                            {garageVehicles.map((v: any) => (
                              <option
                                key={v.id}
                                value={v.id}
                                className="bg-slate-900 text-slate-50"
                              >
                                {[
                                  v.year,
                                  v.make,
                                  v.model,
                                  v.color ? `(${v.color})` : null,
                                  v.license_plate ? `• ${v.license_plate}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              </option>
                            ))}
                          </select>

                          {updateVehicleMutation.isPending && (
                            <p className="text-[10px] text-slate-400">
                              Attaching vehicle…
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          No vehicles found in this customer&apos;s garage.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {appointment.service_address && (
              <div className="flex items-start gap-2 text-slate-200">
                <MapPin className="mt-0.5 h-5 w-5 text-sky-400" />
                <p>{appointment.service_address}</p>
              </div>
            )}

            {appointment.damage_description && (
              <div className="rounded-xl border border-sky-700/70 bg-slate-900/80 px-4 py-3 text-slate-100">
                <div className="text-sm leading-relaxed">
                  <strong>Damage:</strong> {appointment.damage_description}
                </div>
              </div>
            )}

            {appointment.notes_customer && (
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-slate-100">
                <div className="text-sm leading-relaxed">
                  <strong>Customer Notes:</strong> {appointment.notes_customer}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }, [
    appointment,
    currentStep,
    workflowLocked,
    busy,
    customerDisplayName,
    customerDisplayPhone,
    customerDisplayEmail,
    customerError,
    effectiveVehicle,
    garageVehicles,
    garageVehiclesError,
    loadingGarage,
    repairOutcome,
    updateVehicleMutation,
  ]);

  return {
    appointment,
    appointmentError,
    isLoading,
    loadingWaiver,
    waiverOpen,
    setWaiverOpen,
    waiverSatisfied,
    currentStep,
    photos,
    customerSignatureDataUrl,
    workNotes,
    setWorkNotes,
    resinUsed,
    setResinUsed,
    cureTime,
    setCureTime,
    uploading,
    toast,
    repairOutcome,
    setRepairOutcome,
    crackOutCause,
    setCrackOutCause,
    crackOutNotes,
    setCrackOutNotes,
    crackOutPhotoUrl,
    crackOutUploading,
    meEmail,
    customer,
    customerError,
    invoiceId,
    jobLocked,
    workflowLocked,
    effectiveVehicle,
    isAssignedToMe,
    customerDisplayName,
    customerDisplayPhone,
    customerDisplayEmail,
    busy,
    updateStatusPending: updateStatusMutation.isPending,
    completing: completeJobMutation.isPending,
    canComplete,
    signaturePreview,
    setSignaturePreview,
    handleOpenUserSignature,
    onWaiverSatisfied,
    setAndPersistStep,
    handlePhotoUpload,
    removePhoto,
    handleCrackOutUpload,
    handleStatusClick,
    handleNextStep,
    handleComplete,
    handleGoToInvoice,
    goBack,
    headerActions,
    infoCard,
    openWaiverAction: () => {
      if (jobLocked) {
        setToast("Job is locked after completion");
        return;
      }
      setWaiverOpen(true);
    },
  };
}