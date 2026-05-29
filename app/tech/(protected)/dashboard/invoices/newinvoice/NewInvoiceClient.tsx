// app/tech/(protected)/dashboard/invoices/newinvoice/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import {
  MapPin,
  Mail,
  Printer,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  Sparkles,
  Loader2,
  FileText,
  Send,
  CheckCircle,
  User as UserIcon,
  Car,
  AlertCircle,
  CreditCard,
} from "lucide-react";

import { ServicesPerformed } from "@/components/tech/invoice/ServicesPerformed";
const ServicesPerformedAny =
  ServicesPerformed as unknown as React.ComponentType<any>;
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

/* ---------- Types ---------- */

type TechInvoice = {
  id: string;
  services_json: any | null;
  windshield_repairs_json: any[] | null;
  technician_email: string | null;
  vehicle_id: string | null;
  appointment_id?: string | null;
  invoice_date: string | null;
  status: string | null;

  customer_email?: string | null;
  service_address?: string | null;
  appointment_snapshot?: any | null;

  invoice_number?: string | null;

  discount_percent?: number | null;
  discount_cents?: number | null;
  tax_rate_percent?: number | null;
  tax_cents?: number | null;
  subtotal_cents?: number | null;
  total_cents?: number | null;

  deposit_request_id?: string | null;
  deposit_cents?: number | null;
  deposit_applied_at?: string | null;

  final_paid_cents?: number | null;
  paid_at?: string | null;
  payment_method?: string | null;
};

type VehicleRow = {
  id: string;
  owner_email: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
};

type AppointmentRow = {
  id: string;
  customer_email: string | null;
  vehicle_id: string | null;
  service_address: string | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  status: string | null;
  service_type: string | null;
  notes_customer: string | null;
  damage_description: string | null;
  deposit_request_id: string | null;
  deposit_cents: number | null;
  deposit_status: string | null;
  deposit_paid_at: string | null;
};

type ActionFeedback = {
  type: "success" | "error";
  message: string;
} | null;

/* ---------- Helpers ---------- */

function addYears(dateStr: string | null | undefined, years: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function nowIso() {
  return new Date().toISOString();
}

function makeInvoiceNumber() {
  return `INV-${Date.now()}`;
}

function centsToDollars(cents: number | null | undefined) {
  return ((Number(cents || 0) || 0) / 100).toFixed(2);
}

function getErrorMessage(error: unknown) {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const err = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      error_description?: string;
    };

    const parts = [
      err.message,
      err.details,
      err.hint,
      err.error_description,
      err.code ? `Code: ${err.code}` : null,
    ].filter(Boolean);

    if (parts.length) return parts.join(" ");
  }

  return "Something went wrong.";
}

function appointmentCustomerName(appt: AppointmentRow | null | undefined) {
  if (!appt) return null;
  return appt.customer_email || null;
}

function appointmentPhone(_appt: AppointmentRow | null | undefined) {
  return null;
}

function isPaidDepositStatus(status: string | null | undefined) {
  return String(status || "").toLowerCase() === "paid";
}

/* ---------- Page wrapper ---------- */

export default function NewInvoiceClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/40 blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-sky-600/40 blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col items-center gap-4 text-slate-100">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-300" />
            <p className="text-sm tracking-[0.25em] uppercase text-slate-400">
              Loading invoice builder
            </p>
          </div>
        </div>
      }
    >
      <TechNewInvoicePageContent />
    </Suspense>
  );
}

/* ---------- Main component ---------- */

function TechNewInvoicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const linkedAppointmentId = searchParams.get("appointment_id") || "";
  const linkedInvoiceId = searchParams.get("invoice_id") || "";
  const fromCompletedJob = searchParams.get("from_completed_job") === "1";

  const redirectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autoDraftAttemptedRef = React.useRef(false);
  const autoHydratedAppointmentRef = React.useRef<string | null>(null);

  const [invoice, setInvoice] = React.useState<TechInvoice | null>(null);

  const [techEmail, setTechEmail] = React.useState<string | null>(null);
  const [authReady, setAuthReady] = React.useState(false);

  const [actionFeedback, setActionFeedback] =
    React.useState<ActionFeedback>(null);

  const [totalsSnapshot, setTotalsSnapshot] = React.useState<{
    subtotalDollars: number;
    discountDollars: number;
    taxDollars: number;
    totalDollars: number;
  } | null>(null);

  const [selectedCustomerEmail, setSelectedCustomerEmail] =
    React.useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string>("");
  const [selectedAppointmentId, setSelectedAppointmentId] =
    React.useState<string>("");

  const [localServiceAddress, setLocalServiceAddress] =
    React.useState<string>("");
  const [localNotes, setLocalNotes] = React.useState<string>("");
  const [localInvoiceDate, setLocalInvoiceDate] =
    React.useState<string>(todayISO());

  React.useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  const clearFeedback = React.useCallback(() => {
    setActionFeedback(null);
  }, []);

  const showSuccessAndRedirect = React.useCallback(
    (message: string) => {
      setActionFeedback({ type: "success", message });

      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);

      redirectTimeoutRef.current = setTimeout(() => {
        router.push("/tech/dashboard/invoices");
      }, 1400);
    },
    [router]
  );

  const showError = React.useCallback((message: string) => {
    setActionFeedback({ type: "error", message });
  }, []);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const email = data?.session?.user?.email ?? null;

      if (!mounted) return;

      setTechEmail(email);
      setAuthReady(true);

      if (!email) {
        router.replace(
          `/tech/login?redirect=${encodeURIComponent(
            "/tech/dashboard/invoices/newinvoice"
          )}`
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const {
    data: existingLinkedInvoice,
    isLoading: loadingLinkedInvoice,
    error: linkedInvoiceErr,
  } = useQuery({
    queryKey: ["tech-invoice-existing-newinvoice", linkedInvoiceId],
    enabled: authReady && !!linkedInvoiceId,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          [
            "id",
            "invoice_number",
            "services_json",
            "windshield_repairs_json",
            "technician_email",
            "vehicle_id",
            "appointment_id",
            "invoice_date",
            "status",
            "customer_email",
            "service_address",
            "subtotal_cents",
            "discount_percent",
            "discount_cents",
            "tax_rate_percent",
            "tax_cents",
            "total_cents",
            "deposit_request_id",
            "deposit_cents",
            "deposit_applied_at",
            "final_paid_cents",
            "paid_at",
            "payment_method",
            "appointment_snapshot",
          ].join(", ")
        )
        .eq("id", linkedInvoiceId)
        .maybeSingle();

      if (error) {
        console.error("[NewInvoice] existing invoice lookup error:", error);
        throw error;
      }

      return (data ?? null) as TechInvoice | null;
    },
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (!existingLinkedInvoice?.id) return;

    setInvoice(existingLinkedInvoice);
    setSelectedCustomerEmail(existingLinkedInvoice.customer_email || "");
    setSelectedVehicleId(existingLinkedInvoice.vehicle_id || "");
    setSelectedAppointmentId(
      existingLinkedInvoice.appointment_id || linkedAppointmentId || ""
    );
    setLocalServiceAddress(existingLinkedInvoice.service_address || "");
    setLocalInvoiceDate(existingLinkedInvoice.invoice_date || todayISO());
    setLocalNotes(
      existingLinkedInvoice.appointment_snapshot?.notes_customer ||
        existingLinkedInvoice.appointment_snapshot?.damage_description ||
        ""
    );
  }, [existingLinkedInvoice, linkedAppointmentId]);

  const {
    data: vehicles,
    isLoading: loadingVehicles,
    error: vehiclesErr,
  } = useQuery({
    queryKey: ["vehicles-for-invoicing"],
    enabled: authReady,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select("id, owner_email, make, model, year, color, vin");

      if (error) {
        console.error("[NewInvoice] Supabase select vehicles error:", error);
        throw error;
      }

      return (data ?? []) as VehicleRow[];
    },
    staleTime: 30_000,
  });

  const {
    data: appointments,
    isLoading: loadingAppointments,
    error: appointmentsErr,
  } = useQuery({
    queryKey: ["appointments-for-standalone-invoice", techEmail],
    enabled: authReady && !!techEmail,
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select(
          [
            "id",
            "customer_email",
            "vehicle_id",
            "service_address",
            "scheduled_date",
            "scheduled_time_start",
            "scheduled_time_end",
            "status",
            "service_type",
            "notes_customer",
            "damage_description",
            "deposit_request_id",
            "deposit_cents",
            "deposit_status",
            "deposit_paid_at",
          ].join(", ")
        )
        .or(`technician_email.eq.${techEmail},technician_email.is.null`)
        .order("scheduled_date", { ascending: false })
        .limit(75);

      if (error) {
        console.error("[NewInvoice] Supabase select appointments error:", error);
        throw error;
      }

      return (data ?? []) as unknown as AppointmentRow[];
    },
    staleTime: 30_000,
  });

  const updateMetaMutation = useMutation({
    mutationFn: async (patch: Partial<TechInvoice>) => {
      if (!invoice?.id) throw new Error("Missing invoice id");

      const { error } = await supabaseClient
        .from("tech_invoices")
        .update({
          ...("customer_email" in patch
            ? { customer_email: patch.customer_email }
            : null),
          ...("vehicle_id" in patch ? { vehicle_id: patch.vehicle_id } : null),
          ...("appointment_id" in patch
            ? { appointment_id: patch.appointment_id }
            : null),
          ...("service_address" in patch
            ? { service_address: patch.service_address }
            : null),
          ...("invoice_date" in patch
            ? { invoice_date: patch.invoice_date }
            : null),
          ...("appointment_snapshot" in patch
            ? { appointment_snapshot: patch.appointment_snapshot }
            : null),
          ...("deposit_request_id" in patch
            ? { deposit_request_id: patch.deposit_request_id }
            : null),
          ...("deposit_cents" in patch
            ? { deposit_cents: patch.deposit_cents }
            : null),
          ...("deposit_applied_at" in patch
            ? { deposit_applied_at: patch.deposit_applied_at }
            : null),
        })
        .eq("id", invoice.id);

      if (error) {
        console.error("[NewInvoice] updateMeta error:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      if (!invoice?.id) return;

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          [
            "id",
            "invoice_number",
            "services_json",
            "windshield_repairs_json",
            "technician_email",
            "vehicle_id",
            "appointment_id",
            "invoice_date",
            "status",
            "customer_email",
            "service_address",
            "subtotal_cents",
            "discount_percent",
            "discount_cents",
            "tax_rate_percent",
            "tax_cents",
            "total_cents",
            "deposit_request_id",
            "deposit_cents",
            "deposit_applied_at",
            "final_paid_cents",
            "paid_at",
            "payment_method",
            "appointment_snapshot",
          ].join(", ")
        )
        .eq("id", invoice.id)
        .single();

      if (!error && data) setInvoice(data as unknown as TechInvoice);
      queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
    },
  });

  const customerOptions = React.useMemo(() => {
    if (!vehicles) return [] as { email: string; vehicles: VehicleRow[] }[];
    const map = new Map<string, VehicleRow[]>();

    for (const v of vehicles) {
      if (!v.owner_email) continue;
      if (!map.has(v.owner_email)) map.set(v.owner_email, []);
      map.get(v.owner_email)!.push(v);
    }

    return Array.from(map.entries()).map(([email, vs]) => ({
      email,
      vehicles: vs,
    }));
  }, [vehicles]);

  const vehiclesForCustomer = React.useMemo(() => {
    if (!selectedCustomerEmail) return [];
    return (
      customerOptions.find((c) => c.email === selectedCustomerEmail)?.vehicles ??
      []
    );
  }, [customerOptions, selectedCustomerEmail]);

  const appointmentOptions = React.useMemo(() => {
    if (!appointments) return [] as AppointmentRow[];

    return appointments.filter((a) => {
      if (selectedCustomerEmail) {
        const email = String(a.customer_email || "").toLowerCase();
        if (email && email !== selectedCustomerEmail.toLowerCase()) return false;
      }

      if (selectedVehicleId && a.vehicle_id && a.vehicle_id !== selectedVehicleId) {
        return false;
      }

      return true;
    });
  }, [appointments, selectedCustomerEmail, selectedVehicleId]);

  const selectedAppointment = React.useMemo(() => {
    if (!selectedAppointmentId || !appointments) return null;
    return appointments.find((a) => a.id === selectedAppointmentId) ?? null;
  }, [appointments, selectedAppointmentId]);

  const hydrateFromAppointment = React.useCallback(
    (appt: AppointmentRow, opts?: { updateExistingInvoice?: boolean }) => {
      const email = appt.customer_email || selectedCustomerEmail;
      const vehicleId = appt.vehicle_id || selectedVehicleId;
      const address = appt.service_address || localServiceAddress;
      const notes = appt.damage_description || appt.notes_customer || localNotes;

      setSelectedAppointmentId(appt.id);
      setSelectedCustomerEmail(email || "");
      setSelectedVehicleId(vehicleId || "");
      setLocalServiceAddress(address || "");
      setLocalNotes(notes || "");

      const paidDepositCents = isPaidDepositStatus(appt.deposit_status)
        ? Number(appt.deposit_cents || 0)
        : 0;

      const snapshot = {
        ...(invoice?.appointment_snapshot || {}),
        notes_customer:
          notes || appt.notes_customer || invoice?.appointment_snapshot?.notes_customer || null,
        damage_description:
          appt.damage_description ||
          invoice?.appointment_snapshot?.damage_description ||
          null,
        appointment_status: appt.status || null,
        scheduled_date: appt.scheduled_date || null,
        scheduled_time_start: appt.scheduled_time_start || null,
        scheduled_time_end: appt.scheduled_time_end || null,
        service_type: appt.service_type || null,
        customer_name: appointmentCustomerName(appt) || null,
        customer_phone: appointmentPhone(appt) || null,
      };

      if (opts?.updateExistingInvoice && invoice?.id) {
        updateMetaMutation.mutate({
          appointment_id: appt.id,
          customer_email: email || null,
          vehicle_id: vehicleId || null,
          service_address: address || null,
          appointment_snapshot: snapshot,
          deposit_request_id: paidDepositCents > 0 ? appt.deposit_request_id : null,
          deposit_cents: paidDepositCents,
          deposit_applied_at:
            paidDepositCents > 0 ? appt.deposit_paid_at || nowIso() : null,
        });
      }
    },
    [
      selectedCustomerEmail,
      selectedVehicleId,
      localServiceAddress,
      localNotes,
      invoice,
      updateMetaMutation,
    ]
  );

  React.useEffect(() => {
    if (!linkedAppointmentId) return;
    if (!appointments?.length) return;
    if (autoHydratedAppointmentRef.current === linkedAppointmentId) return;

    const appt = appointments.find((a) => a.id === linkedAppointmentId);
    if (!appt) return;

    autoHydratedAppointmentRef.current = linkedAppointmentId;
    hydrateFromAppointment(appt, { updateExistingInvoice: !!invoice?.id });
  }, [linkedAppointmentId, appointments, hydrateFromAppointment, invoice?.id]);

  const selectedAppointmentPaidDepositCents = React.useMemo(() => {
    if (!selectedAppointment) return 0;
    if (!isPaidDepositStatus(selectedAppointment.deposit_status)) return 0;
    return Number(selectedAppointment.deposit_cents || 0);
  }, [selectedAppointment]);

  const existingInvoiceDepositCents = React.useMemo(() => {
    return Number(invoice?.deposit_cents || 0);
  }, [invoice?.deposit_cents]);

  const activeDepositCents = React.useMemo(() => {
    if (selectedAppointmentPaidDepositCents > 0) {
      return selectedAppointmentPaidDepositCents;
    }

    return existingInvoiceDepositCents;
  }, [selectedAppointmentPaidDepositCents, existingInvoiceDepositCents]);

  const activeDepositRequestId = React.useMemo(() => {
    return (
      selectedAppointment?.deposit_request_id ||
      invoice?.deposit_request_id ||
      null
    );
  }, [selectedAppointment?.deposit_request_id, invoice?.deposit_request_id]);

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      if (!techEmail) throw new Error("Missing technician session email.");

      const defaultServices = {
        chip_count: 0,
        small_crack_count: 0,
        insurance_covered: false,
        rni_rnr_total: 0,
        parts_total: 0,
        misc_total: 0,
        glass_total: 0,
      };

      const invoice_number = makeInvoiceNumber();

      const appointmentSnapshot = {
        notes_customer: localNotes || selectedAppointment?.notes_customer || null,
        damage_description: selectedAppointment?.damage_description || null,
        appointment_status: selectedAppointment?.status || null,
        scheduled_date: selectedAppointment?.scheduled_date || null,
        scheduled_time_start: selectedAppointment?.scheduled_time_start || null,
        scheduled_time_end: selectedAppointment?.scheduled_time_end || null,
        service_type: selectedAppointment?.service_type || null,
        customer_name: appointmentCustomerName(selectedAppointment) || null,
        customer_phone: appointmentPhone(selectedAppointment) || null,
      };

      const paidDepositCents = selectedAppointmentPaidDepositCents;
      const depositAppliedAt =
        paidDepositCents > 0 ? selectedAppointment?.deposit_paid_at || nowIso() : null;

      const payload: any = {
        invoice_number,
        status: "draft",
        invoice_date: localInvoiceDate || todayISO(),
        services_json: defaultServices,
        windshield_repairs_json: [],
        subtotal_cents: 0,
        discount_percent: null,
        discount_cents: 0,
        tax_rate_percent: null,
        tax_cents: 0,
        total_cents: 0,
        deposit_request_id: paidDepositCents > 0 ? activeDepositRequestId : null,
        deposit_cents: paidDepositCents,
        deposit_applied_at: depositAppliedAt,
        final_paid_cents: null,
        paid_at: null,
        payment_method: null,
        technician_email: techEmail,
        appointment_id: selectedAppointmentId || null,
        customer_email:
          selectedCustomerEmail || selectedAppointment?.customer_email || null,
        vehicle_id: selectedVehicleId || selectedAppointment?.vehicle_id || null,
        service_address:
          localServiceAddress || selectedAppointment?.service_address || null,
        appointment_snapshot: appointmentSnapshot,
      };

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .insert(payload)
        .select(
          [
            "id",
            "invoice_number",
            "services_json",
            "windshield_repairs_json",
            "technician_email",
            "vehicle_id",
            "appointment_id",
            "invoice_date",
            "status",
            "customer_email",
            "service_address",
            "subtotal_cents",
            "discount_percent",
            "discount_cents",
            "tax_rate_percent",
            "tax_cents",
            "total_cents",
            "deposit_request_id",
            "deposit_cents",
            "deposit_applied_at",
            "final_paid_cents",
            "paid_at",
            "payment_method",
            "appointment_snapshot",
          ].join(", ")
        )
        .single();

      if (error) {
        console.error("[NewInvoice] insert tech_invoices error:", error);
        throw error;
      }

      return data as unknown as TechInvoice;
    },
    onSuccess: (row) => {
      clearFeedback();
      setInvoice(row);
      queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
    },
    onError: (error) => {
      showError(`Failed to start draft. ${getErrorMessage(error)}`);
    },
  });

  React.useEffect(() => {
    if (!fromCompletedJob) return;
    if (!linkedAppointmentId) return;
    if (!techEmail) return;
    if (!selectedAppointment) return;
    if (invoice?.id) return;
    if (linkedInvoiceId && loadingLinkedInvoice) return;
    if (createDraftMutation.isPending) return;
    if (autoDraftAttemptedRef.current) return;

    autoDraftAttemptedRef.current = true;
    createDraftMutation.mutate();
  }, [
    fromCompletedJob,
    linkedAppointmentId,
    linkedInvoiceId,
    loadingLinkedInvoice,
    techEmail,
    selectedAppointment,
    invoice?.id,
    createDraftMutation,
  ]);

  const handleCustomerChange = (email: string) => {
    clearFeedback();
    setSelectedCustomerEmail(email);
    setSelectedVehicleId("");
    setSelectedAppointmentId("");

    if (invoice?.id) {
      updateMetaMutation.mutate({
        customer_email: email || null,
        vehicle_id: null,
        appointment_id: null,
        deposit_request_id: null,
        deposit_cents: 0,
        deposit_applied_at: null,
      });
    }
  };

  const handleVehicleChange = (vehicleId: string) => {
    clearFeedback();
    setSelectedVehicleId(vehicleId);
    setSelectedAppointmentId("");

    if (invoice?.id) {
      updateMetaMutation.mutate({
        vehicle_id: vehicleId || null,
        appointment_id: null,
        deposit_request_id: null,
        deposit_cents: 0,
        deposit_applied_at: null,
      });
    }
  };

  const handleAppointmentChange = (appointmentId: string) => {
    clearFeedback();
    setSelectedAppointmentId(appointmentId);

    const appt = appointments?.find((a) => a.id === appointmentId) ?? null;

    if (appt) {
      hydrateFromAppointment(appt, { updateExistingInvoice: true });
    } else if (invoice?.id) {
      updateMetaMutation.mutate({
        appointment_id: null,
        deposit_request_id: null,
        deposit_cents: 0,
        deposit_applied_at: null,
      });
    }
  };

  const handleBasicMetaSave = () => {
    clearFeedback();
    if (!invoice?.id) return;

    const snapshot = {
      ...(invoice.appointment_snapshot || {}),
      notes_customer: localNotes || null,
    };

    updateMetaMutation.mutate({
      service_address: localServiceAddress || null,
      invoice_date: localInvoiceDate || invoice.invoice_date || null,
      appointment_snapshot: snapshot,
    });
  };

  const handleTotalsChange = React.useCallback((totals: any) => {
  setTotalsSnapshot((prev) => {
    const subtotalDollars =
      totals.subtotalDollars ??
      totals.subtotal ??
      (typeof totals.subtotal_cents === "number" ? totals.subtotal_cents / 100 : 0);

    const discountDollars =
      totals.discountDollars ??
      totals.discount ??
      (typeof totals.discount_cents === "number" ? totals.discount_cents / 100 : 0);

    const taxDollars =
      totals.taxDollars ??
      totals.tax ??
      (typeof totals.tax_cents === "number" ? totals.tax_cents / 100 : 0);

    const totalDollars =
      totals.totalDollars ??
      totals.total ??
      (typeof totals.total_cents === "number"
        ? totals.total_cents / 100
        : subtotalDollars - discountDollars + taxDollars);

    const next = {
      subtotalDollars,
      discountDollars,
      taxDollars,
      totalDollars,
    };

    if (
      prev &&
      prev.subtotalDollars === next.subtotalDollars &&
      prev.discountDollars === next.discountDollars &&
      prev.taxDollars === next.taxDollars &&
      prev.totalDollars === next.totalDollars
    ) {
      return prev;
    }

    return next;
  });
}, []);

  const effectiveInvoice: TechInvoice | null = React.useMemo(() => {
    if (!invoice) return null;

    return {
      ...invoice,
      discount_percent: invoice.discount_percent ?? null,
      discount_cents: invoice.discount_cents ?? 0,
      tax_rate_percent: invoice.tax_rate_percent ?? null,
      tax_cents: invoice.tax_cents ?? 0,
      subtotal_cents: invoice.subtotal_cents ?? 0,
      total_cents: invoice.total_cents ?? 0,
      deposit_request_id: invoice.deposit_request_id ?? null,
      deposit_cents: invoice.deposit_cents ?? 0,
      deposit_applied_at: invoice.deposit_applied_at ?? null,
      final_paid_cents: invoice.final_paid_cents ?? null,
      paid_at: invoice.paid_at ?? null,
      payment_method: invoice.payment_method ?? null,
    };
  }, [invoice]);

  const computeMoneyFromSnapshot = React.useCallback(() => {
    const subtotal_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.subtotalDollars * 100)
        : effectiveInvoice?.subtotal_cents ?? 0;

    const discount_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.discountDollars * 100)
        : effectiveInvoice?.discount_cents ?? 0;

    const tax_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.taxDollars * 100)
        : effectiveInvoice?.tax_cents ?? 0;

    const total_cents =
      totalsSnapshot != null
        ? Math.round(totalsSnapshot.totalDollars * 100)
        : effectiveInvoice?.total_cents ?? 0;

    return { subtotal_cents, discount_cents, tax_cents, total_cents };
  }, [
    totalsSnapshot,
    effectiveInvoice?.subtotal_cents,
    effectiveInvoice?.discount_cents,
    effectiveInvoice?.tax_cents,
    effectiveInvoice?.total_cents,
  ]);

  const invoicePreviewMoney = React.useMemo(() => {
    const money = computeMoneyFromSnapshot();
    const serviceTotalCents = money.total_cents;
    const depositCents = Math.min(activeDepositCents, serviceTotalCents);
    const customerDueCents = Math.max(0, serviceTotalCents - depositCents);

    return {
      ...money,
      serviceTotalCents,
      depositCents,
      customerDueCents,
    };
  }, [computeMoneyFromSnapshot, activeDepositCents]);

  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveInvoice?.id) throw new Error("Missing invoice id");

      const todayIso = todayISO();
      const { subtotal_cents, discount_cents, tax_cents, total_cents } =
        computeMoneyFromSnapshot();

      const deposit_cents = Math.min(activeDepositCents, total_cents);
      const deposit_applied_at =
        deposit_cents > 0
          ? selectedAppointment?.deposit_paid_at ||
            effectiveInvoice.deposit_applied_at ||
            nowIso()
          : null;

      const { error } = await supabaseClient
        .from("tech_invoices")
        .update({
          invoice_date:
            localInvoiceDate || effectiveInvoice.invoice_date || todayIso,
          status: "sent",
          appointment_id: selectedAppointmentId || effectiveInvoice.appointment_id || null,
          subtotal_cents,
          discount_percent: effectiveInvoice.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
          tax_cents,
          total_cents,
          deposit_request_id: deposit_cents > 0 ? activeDepositRequestId : null,
          deposit_cents,
          deposit_applied_at,
          final_paid_cents: null,
          paid_at: null,
          payment_method: null,
        })
        .eq("id", effectiveInvoice.id);

      if (error) {
        console.error("[SendInvoice] error updating tech_invoices:", error);
        throw error;
      }

      return { total_cents, deposit_cents, deposit_applied_at };
    },
    onSuccess: ({ total_cents, deposit_cents, deposit_applied_at }) => {
      queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
      if (invoice) {
        setInvoice({
          ...invoice,
          status: "sent",
          total_cents,
          deposit_request_id: deposit_cents > 0 ? activeDepositRequestId : null,
          deposit_cents,
          deposit_applied_at,
          final_paid_cents: null,
          paid_at: null,
          payment_method: null,
        });
      }
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveInvoice?.id) throw new Error("Missing invoice id");

      const todayIso = todayISO();
      const paidAt = nowIso();

      const { subtotal_cents, discount_cents, tax_cents, total_cents } =
        computeMoneyFromSnapshot();

      const deposit_cents = Math.min(activeDepositCents, total_cents);
      const customerDueCents = Math.max(0, total_cents - deposit_cents);
      const deposit_applied_at =
        deposit_cents > 0
          ? selectedAppointment?.deposit_paid_at ||
            effectiveInvoice.deposit_applied_at ||
            nowIso()
          : null;

      const { error } = await supabaseClient
        .from("tech_invoices")
        .update({
          invoice_date:
            localInvoiceDate || effectiveInvoice.invoice_date || todayIso,
          status: "paid",
          appointment_id: selectedAppointmentId || effectiveInvoice.appointment_id || null,
          subtotal_cents,
          discount_percent: effectiveInvoice.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
          tax_cents,
          total_cents,
          deposit_request_id: deposit_cents > 0 ? activeDepositRequestId : null,
          deposit_cents,
          deposit_applied_at,
          final_paid_cents: customerDueCents,
          paid_at: paidAt,
          payment_method: "tech_marked_paid",
        })
        .eq("id", effectiveInvoice.id);

      if (error) {
        console.error("[MarkPaid] error updating tech_invoices:", error);
        throw error;
      }

      return { paidAt, total_cents, deposit_cents, deposit_applied_at, customerDueCents };
    },
    onSuccess: ({ paidAt, total_cents, deposit_cents, deposit_applied_at, customerDueCents }) => {
      queryClient.invalidateQueries({ queryKey: ["tech-dashboard-invoices"] });
      if (invoice) {
        setInvoice({
          ...invoice,
          status: "paid",
          total_cents,
          deposit_request_id: deposit_cents > 0 ? activeDepositRequestId : null,
          deposit_cents,
          deposit_applied_at,
          final_paid_cents: customerDueCents,
          paid_at: paidAt,
          payment_method: "tech_marked_paid",
        });
      }
    },
  });

  const handleSendInvoice = async () => {
    clearFeedback();

    try {
      await sendInvoiceMutation.mutateAsync();
      showSuccessAndRedirect(
        "Invoice sent successfully. Redirecting to Tech Invoices..."
      );
    } catch (error) {
      showError(`Failed to send invoice. ${getErrorMessage(error)}`);
    }
  };

  const handleMarkPaidAndSend = async () => {
    clearFeedback();

    try {
      await markPaidMutation.mutateAsync();
      showSuccessAndRedirect(
        "Invoice marked paid successfully. Redirecting to Tech Invoices..."
      );
    } catch (error) {
      showError(`Failed to mark invoice paid. ${getErrorMessage(error)}`);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/40 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-sky-600/40 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4 text-slate-100">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-300" />
          <p className="text-sm tracking-[0.25em] uppercase text-slate-400">
            Loading
          </p>
        </div>
      </div>
    );
  }

  const status = invoice?.status ?? "draft";
  const warrantyEnd = addYears(
    localInvoiceDate || invoice?.invoice_date || todayISO(),
    1
  );
  const draftExists = !!invoice?.id;

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 print:bg-white print:p-4 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80 print:hidden">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(30,64,175,0.9),transparent_55%)]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        <div className="flex items-center justify-between mb-2 print:hidden">
          <Button
            variant="outline"
            onClick={() => router.push("/tech/dashboard/invoices")}
            className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>

          <div className="flex items-center gap-3">
            <Badge
              className={cx(
                "border text-xs px-3 py-1 tracking-[0.18em] uppercase",
                !draftExists
                  ? "bg-slate-800/80 text-slate-200 border-slate-500"
                  : status === "paid"
                  ? "bg-emerald-500/10 text-emerald-200 border-emerald-400/60"
                  : status === "sent"
                  ? "bg-amber-500/10 text-amber-200 border-amber-300/70"
                  : "bg-slate-800/80 text-slate-200 border-slate-500"
              )}
            >
              {draftExists ? status.toUpperCase() : "NOT SAVED"}
            </Badge>

            {fromCompletedJob && !draftExists && (
              <Badge className="border border-sky-400/60 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-sky-100">
                From Completed Job
              </Badge>
            )}

            {activeDepositCents > 0 && (
              <Badge className="border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-100">
                Deposit Applied
              </Badge>
            )}

            <Button
              onClick={() => window.print()}
              className="bg-slate-900/80 border border-slate-600 text-slate-50 hover:bg-slate-800"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>

            {!draftExists && (
              <Button
                onClick={() => createDraftMutation.mutate()}
                disabled={createDraftMutation.isPending || !techEmail}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold shadow-[0_16px_40px_rgba(45,212,191,0.65)]"
              >
                {createDraftMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Start Draft
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {(linkedInvoiceErr || (linkedInvoiceId && !loadingLinkedInvoice && !existingLinkedInvoice && !invoice)) && (
          <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 print:hidden">
            Existing invoice link could not be loaded. You can still start a new draft from the appointment.
          </div>
        )}

        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cx(
              "rounded-2xl border px-4 py-3 shadow-lg print:hidden",
              actionFeedback.type === "success"
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/50 bg-red-500/10 text-red-100"
            )}
          >
            <div className="flex items-start gap-3">
              {actionFeedback.type === "success" ? (
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-300 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 text-red-300 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {actionFeedback.type === "success" ? "Success" : "Error"}
                </p>
                <p className="text-sm opacity-95">{actionFeedback.message}</p>
              </div>
              <button
                type="button"
                onClick={clearFeedback}
                className="text-xs opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        <Card className="border border-slate-700/80 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/90 backdrop-blur-xl shadow-[0_28px_80px_rgba(15,23,42,0.9)] print:bg-white print:border-slate-200 print:shadow-none">
          <CardContent className="p-6 md:p-8">
            <div className="grid md:grid-cols-[1.8fr_1.4fr] gap-8 items-start">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ rotateX: 25, rotateY: -25, opacity: 0 }}
                    animate={{ rotateX: 0, rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 shadow-[0_18px_45px_rgba(56,189,248,0.7)] flex items-center justify-center overflow-hidden"
                  >
                    <div className="absolute inset-1 rounded-xl bg-slate-950/70 backdrop-blur-xl border border-cyan-200/70" />
                    <div className="relative w-10 h-8 border-2 border-cyan-300/80 rounded-t-[1.2rem] rounded-b-lg bg-gradient-to-b from-sky-400/40 to-slate-900/80 shadow-[0_10px_25px_rgba(15,23,42,0.8)]" />
                  </motion.div>

                  <div className="space-y-1">
                    <p className="text-[0.7rem] tracking-[0.25em] uppercase text-cyan-200/80">
                      Glass Guardian
                    </p>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-50 leading-tight">
                      Chip &amp; Crack Repair
                    </h1>
                    <p className="text-xs text-slate-400">
                      Mobile windshield specialists · Rock chip &amp; crack
                      stabilization · Lifetime craftsmanship on repairs
                    </p>
                  </div>
                </div>

                {!draftExists && (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-amber-300" />
                      <p>
                        This invoice is currently{" "}
                        <span className="font-semibold">not saved</span>. Fill
                        details if you want, then click{" "}
                        <span className="font-semibold">Start Draft</span> to
                        create the row in Supabase.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-1 text-xs text-slate-300 print:text-slate-700">
                  <p>Serving: Wasatch Front &amp; surrounding areas</p>
                  <p>Phone: (555) 555-0199 · Email: support@glassguardian.com</p>
                  <p>Web: glassguardianchipandcrackrepair.com</p>
                </div>
              </div>

              <div className="md:text-right space-y-4">
                <div className="inline-flex md:flex md:flex-col items-start md:items-end gap-2">
                  <p className="text-[0.65rem] font-semibold text-slate-400 tracking-[0.22em] uppercase">
                    New Invoice
                  </p>
                  <p className="text-xl md:text-2xl font-extrabold text-slate-50 md:leading-none">
                    #{invoice?.invoice_number || (draftExists ? invoice?.id : "—")}
                  </p>
                </div>

                <div className="flex md:justify-end flex-wrap gap-3 text-xs md:text-sm text-slate-200 print:text-slate-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-sky-300" />
                    <span>
                      Service Date:{" "}
                      <Input
                        type="date"
                        value={localInvoiceDate}
                        onChange={(e) => {
                          clearFeedback();
                          setLocalInvoiceDate(e.target.value);
                          if (invoice?.id) {
                            updateMetaMutation.mutate({
                              invoice_date: e.target.value || null,
                            });
                          }
                        }}
                        className="ml-1 h-7 w-36 bg-slate-900/60 border-slate-600 text-slate-50 text-xs"
                      />
                    </span>
                  </span>

                  {warrantyEnd && (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>
                        Warranty Through{" "}
                        <span className="font-semibold text-emerald-300 print:text-emerald-700">
                          {warrantyEnd}
                        </span>
                      </span>
                    </span>
                  )}
                </div>

                <Separator className="my-3 border-slate-700/70 md:ml-auto md:w-64 print:border-slate-200" />

                <div className="space-y-1 text-xs md:text-sm text-slate-200 print:text-slate-800">
                  <p className="text-[0.65rem] tracking-[0.2em] uppercase text-slate-400">
                    Technician
                  </p>
                  <p className="font-semibold">
                    {techEmail || invoice?.technician_email || "Technician"}
                  </p>
                  <p className="text-slate-400 text-xs">
                    Build a standalone invoice for any Glass Guardian customer.
                  </p>
                </div>

                {vehiclesErr && (
                  <p className="mt-2 text-[11px] text-amber-300">
                    Note: vehicles failed to load. You can still create a manual
                    invoice.
                  </p>
                )}

                {appointmentsErr && (
                  <p className="mt-2 text-[11px] text-amber-300">
                    Note: appointments failed to load. Deposits can still be
                    applied manually later.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.8)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                Bill To
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-sm text-slate-100 print:text-slate-800">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  Customer Email
                </label>

                <select
                  className="w-full h-9 rounded-md bg-slate-900/70 border border-slate-600 text-xs text-slate-100 px-2"
                  value={selectedCustomerEmail}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                >
                  <option value="">Select customer (by email)</option>
                  {customerOptions.map((c) => (
                    <option key={c.email} value={c.email}>
                      {c.email}
                      {c.vehicles[0]
                        ? ` · ${c.vehicles[0].year ?? ""} ${
                            c.vehicles[0].make ?? ""
                          } ${c.vehicles[0].model ?? ""}`
                        : ""}
                    </option>
                  ))}
                </select>

                {loadingVehicles && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Loading vehicles…
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email (override / manual)
                </label>

                <Input
                  value={selectedCustomerEmail}
                  onChange={(e) => {
                    clearFeedback();
                    const v = e.target.value.trim();
                    setSelectedCustomerEmail(v);
                    setSelectedAppointmentId("");
                    if (invoice?.id) {
                      updateMetaMutation.mutate({
                        customer_email: v || null,
                        appointment_id: null,
                        deposit_request_id: null,
                        deposit_cents: 0,
                        deposit_applied_at: null,
                      });
                    }
                  }}
                  placeholder="customer@email.com"
                  className="h-9 bg-slate-900/70 border-slate-600 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Service Address
                </label>

                <Textarea
                  value={localServiceAddress}
                  onChange={(e) => {
                    clearFeedback();
                    setLocalServiceAddress(e.target.value);
                  }}
                  rows={3}
                  className="bg-slate-900/70 border-slate-600 text-xs resize-none"
                  placeholder="Street, city, state, ZIP"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Customer Notes
                </label>

                <Textarea
                  value={localNotes}
                  onChange={(e) => {
                    clearFeedback();
                    setLocalNotes(e.target.value);
                  }}
                  rows={3}
                  className="bg-slate-900/70 border-slate-600 text-xs resize-none"
                  placeholder="Optional: what the customer reported, extra instructions, gate codes, etc."
                />
              </div>

              <Button
                size="sm"
                onClick={handleBasicMetaSave}
                disabled={!draftExists || updateMetaMutation.isPending}
                className={cx(
                  "mt-2 inline-flex items-center gap-2 text-xs font-semibold",
                  !draftExists
                    ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-sky-500/90 hover:bg-sky-400 text-slate-950"
                )}
                title={!draftExists ? "Click Start Draft first" : "Save to Supabase"}
              >
                {updateMetaMutation.isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Save Customer &amp; Details
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.8)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <Car className="w-4 h-4 text-cyan-300" />
                Vehicle & Appointment
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-sm text-slate-100 print:text-slate-800">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Vehicle (filtered by customer)
                </label>

                <select
                  className="w-full h-9 rounded-md bg-slate-900/70 border border-slate-600 text-xs text-slate-100 px-2"
                  value={selectedVehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  disabled={!selectedCustomerEmail}
                >
                  {!selectedCustomerEmail && (
                    <option value="">Select customer first</option>
                  )}

                  {selectedCustomerEmail && (
                    <>
                      <option value="">Select vehicle</option>
                      {vehiclesForCustomer.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.year ?? ""} {v.make ?? ""} {v.model ?? ""}{" "}
                          {v.color ? `· ${v.color}` : ""}{" "}
                          {v.vin ? `· VIN: ${v.vin.slice(0, 8)}…` : ""}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Link Appointment / Deposit
                </label>

                <select
                  className="w-full h-9 rounded-md bg-slate-900/70 border border-slate-600 text-xs text-slate-100 px-2"
                  value={selectedAppointmentId}
                  onChange={(e) => handleAppointmentChange(e.target.value)}
                >
                  <option value="">No linked appointment</option>

                  {appointmentOptions.map((a) => {
                    const depositLabel = isPaidDepositStatus(a.deposit_status)
                      ? ` · Deposit paid $${centsToDollars(a.deposit_cents)}`
                      : a.deposit_status === "pending"
                      ? " · Deposit pending"
                      : "";

                    return (
                      <option key={a.id} value={a.id}>
                        {a.scheduled_date || "No date"}{" "}
                        {a.scheduled_time_start
                          ? `· ${a.scheduled_time_start}`
                          : ""}
                        {" · "}
                        {a.service_type || "Service"}
                        {depositLabel}
                      </option>
                    );
                  })}
                </select>

                {loadingAppointments && (
                  <p className="text-[11px] text-slate-400">
                    Loading appointments…
                  </p>
                )}
              </div>

              {selectedAppointment && (
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-300">
                  <p className="font-semibold text-slate-100">
                    Appointment #{selectedAppointment.id.slice(0, 8)}
                  </p>

                  <p className="mt-1">
                    {appointmentCustomerName(selectedAppointment) || "Customer"}
                    {appointmentPhone(selectedAppointment)
                      ? ` · ${appointmentPhone(selectedAppointment)}`
                      : ""}
                  </p>

                  {selectedAppointment.service_address && (
                    <p className="mt-1 text-slate-400">
                      {selectedAppointment.service_address}
                    </p>
                  )}

                  {isPaidDepositStatus(selectedAppointment.deposit_status) ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                      <CreditCard className="h-4 w-4 text-emerald-300" />
                      <span>
                        Deposit paid: $
                        {centsToDollars(selectedAppointment.deposit_cents)}
                      </span>
                    </div>
                  ) : selectedAppointment.deposit_status === "pending" ? (
                    <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-100">
                      Deposit pending — it will not deduct until paid.
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-slate-400">
                      No paid deposit attached to this appointment.
                    </div>
                  )}
                </div>
              )}

              {activeDepositCents > 0 && (
                <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <CreditCard className="h-4 w-4 text-emerald-300" />
                    Deposit will be applied
                  </div>
                  <p className="mt-1">
                    -${centsToDollars(activeDepositCents)} will be deducted from
                    the final customer balance.
                  </p>
                </div>
              )}

              {selectedVehicleId && (
                <p className="text-xs text-slate-300">
                  This vehicle will be attached to the invoice in{" "}
                  <code>tech_invoices.vehicle_id</code>
                  {!draftExists ? " once you click Start Draft." : "."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {effectiveInvoice ? (
          <ServicesPerformedAny
  invoice={{
    id: effectiveInvoice.id,
    services_json: effectiveInvoice.services_json ?? null,
    discount_percent: effectiveInvoice.discount_percent ?? null,
    discount_cents: effectiveInvoice.discount_cents ?? 0,
    tax_rate_percent: effectiveInvoice.tax_rate_percent ?? null,
    tax_cents: effectiveInvoice.tax_cents ?? 0,
    subtotal_cents: effectiveInvoice.subtotal_cents ?? 0,
    total_cents: effectiveInvoice.total_cents ?? 0,
  }}
  onTotalsChange={handleTotalsChange}
/>
        ) : (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.85)]">
            <CardContent className="p-5 text-sm text-slate-200">
              <p className="text-slate-300">
                Services Performed will appear after you click{" "}
                <span className="font-semibold">Start Draft</span>.
              </p>
            </CardContent>
          </Card>
        )}

        {effectiveInvoice ? (
          <WindshieldRepairMap invoice={effectiveInvoice as any} />
        ) : (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.85)]">
            <CardContent className="p-5 text-sm text-slate-200">
              <p className="text-slate-300">
                Windshield Repair Map will appear after you click{" "}
                <span className="font-semibold">Start Draft</span>.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.9)] print:bg-white print:border-slate-200 print:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
              <FileText className="w-4 h-4 text-sky-300" />
              Repair Details
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-100 print:text-slate-800">
            <p className="text-xs text-slate-300">
              This section is your free-text summary on the printed invoice.
              {!draftExists ? " (Will save after Start Draft.)" : ""}
            </p>

            <Textarea
              rows={4}
              className="bg-slate-900/70 border-slate-700 text-xs resize-none mt-2"
              placeholder="Example: Repaired 2 rock chips on driver side area of windshield..."
              onChange={(e) => {
                clearFeedback();
                if (!invoice?.id) return;

                const snapshot = {
                  ...(invoice.appointment_snapshot || {}),
                  damage_description: e.target.value || null,
                };

                updateMetaMutation.mutate({ appointment_snapshot: snapshot });
              }}
              defaultValue={invoice?.appointment_snapshot?.damage_description ?? ""}
              disabled={!draftExists}
            />
          </CardContent>
        </Card>

        {effectiveInvoice && (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_20px_60px_rgba(15,23,42,0.85)] print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-slate-50">
                <Send className="w-4 h-4 text-emerald-300" />
                Send Invoice
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-slate-200">
              <div className="max-w-xl space-y-3">
                <p className="text-xs md:text-sm text-slate-300">
                  When you&apos;re done entering services and mapping the repair,
                  you can either{" "}
                  <span className="font-semibold text-emerald-300">
                    Send Invoice
                  </span>{" "}
                  or{" "}
                  <span className="font-semibold text-emerald-300">
                    Mark Paid &amp; Send
                  </span>
                  .
                </p>

                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Service Total</span>
                    <span className="font-semibold text-slate-100">
                      ${centsToDollars(invoicePreviewMoney.serviceTotalCents)}
                    </span>
                  </div>

                  {invoicePreviewMoney.depositCents > 0 && (
                    <div className="mt-1 flex items-center justify-between text-emerald-200">
                      <span>Deposit Applied</span>
                      <span className="font-semibold">
                        -${centsToDollars(invoicePreviewMoney.depositCents)}
                      </span>
                    </div>
                  )}

                  <Separator className="my-2 bg-slate-700" />

                  <div className="flex items-center justify-between text-slate-50">
                    <span className="font-semibold">Customer Balance</span>
                    <span className="text-lg font-extrabold text-emerald-300">
                      ${centsToDollars(invoicePreviewMoney.customerDueCents)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    disabled={
                      sendInvoiceMutation.isPending ||
                      markPaidMutation.isPending
                    }
                    onClick={handleSendInvoice}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold shadow-[0_16px_40px_rgba(45,212,191,0.65)]"
                  >
                    {sendInvoiceMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Invoice
                      </>
                    )}
                  </Button>

                  <Button
                    disabled={
                      sendInvoiceMutation.isPending ||
                      markPaidMutation.isPending
                    }
                    onClick={handleMarkPaidAndSend}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-slate-50 font-semibold shadow-[0_16px_40px_rgba(45,212,191,0.75)]"
                  >
                    {markPaidMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Marking…
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Mark Paid &amp; Send
                      </>
                    )}
                  </Button>
                </div>

                {actionFeedback && (
                  <div
                    className={cx(
                      "rounded-xl border px-3 py-2 text-xs",
                      actionFeedback.type === "success"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                        : "border-red-400/40 bg-red-500/10 text-red-100"
                    )}
                  >
                    {actionFeedback.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-emerald-500/50 bg-gradient-to-br from-emerald-500/15 via-slate-900/80 to-emerald-700/30 backdrop-blur-2xl shadow-[0_24px_80px_rgba(16,185,129,0.7)] print:bg-white print:border-emerald-300 print:shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              Windshield Repair Warranty
            </CardTitle>

            {localInvoiceDate && warrantyEnd && (
              <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/70 text-[11px] print:bg-emerald-100 print:text-emerald-800">
                {localInvoiceDate} → {warrantyEnd}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-2 text-xs md:text-sm text-emerald-50 print:text-emerald-900">
            <p>
              This invoice serves as the official Glass Guardian warranty record
              for the windshield repair performed.
            </p>

            <ul className="list-disc ml-5 space-y-1">
              <li>
                <span className="font-semibold">Coverage:</span> 1 year from the
                service date for the repaired damage only.
              </li>
              <li>Warranty does not cover new damage or unrelated issues.</li>
            </ul>
          </CardContent>
        </Card>

        <div className="hidden print:block text-center text-[10px] text-slate-500 mt-4">
          Glass Guardian Chip &amp; Crack Repair —{" "}
          {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}