// app/admin/(protected)/portal/invoices/newinvoice/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  Wrench,
} from "lucide-react";

import { ServicesPerformed } from "@/components/tech/invoice/ServicesPerformed";
const ServicesPerformedAny = ServicesPerformed as any;
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

/* ---------- Types ---------- */

type AnyObj = Record<string, any>;

type TechInvoice = {
  id: string;
  services_json: any | null;
  windshield_repairs_json: any[] | null;
  technician_email: string | null;
  vehicle_id: string | null;
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
};

type ClientRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes?: string | null;
};

type ClientVehicleRow = {
  id: string;
  client_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  vin: string | null;
  stock_ro?: string | null;
  license_plate?: string | null;
  vehicle_type?: string | null;
  trim?: string | null;
};

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

// Mirrors your tech behavior (unique + stable)
function makeInvoiceNumber() {
  return `INV-${Date.now()}`;
}

/* ---------- Page ---------- */

export default function AdminNewInvoicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Mirror tech page: DO NOT create row on mount.
  const [invoice, setInvoice] = React.useState<TechInvoice | null>(null);

  const [adminEmail, setAdminEmail] = React.useState<string | null>(null);
  const [technicianEmail, setTechnicianEmail] = React.useState<string>(""); // admin override -> technician_email on invoice
  const [authReady, setAuthReady] = React.useState(false);

  const [totalsSnapshot, setTotalsSnapshot] = React.useState<{
    subtotalDollars: number;
    discountDollars: number;
    taxDollars: number;
    totalDollars: number;
  } | null>(null);

  // Admin selects client + vehicle (mirrors tech “customer+vehicle selection”)
  const [selectedClientId, setSelectedClientId] = React.useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string>("");

  // mirror tech “manual email override”
  const [selectedCustomerEmail, setSelectedCustomerEmail] = React.useState<string>("");

  const [localServiceAddress, setLocalServiceAddress] = React.useState<string>("");
  const [localNotes, setLocalNotes] = React.useState<string>("");
  const [localInvoiceDate, setLocalInvoiceDate] = React.useState<string>(todayISO());

  /* ---------- Auth: admin only (table-backed) ---------- */

  React.useEffect(() => {
    let alive = true;

    async function verifyAdminByEmail(email: string) {
      const { data, error } = await supabaseClient
        .from("admins")
        .select("role, is_active")
        .eq("email", email)
        .maybeSingle();

      if (!alive) return;

      const ok =
        !error &&
        !!data &&
        data.is_active === true &&
        (data.role === "admin" || data.role === "support");

      if (!ok) {
        router.replace(`/admin/login?redirect=${encodeURIComponent("/admin/portal/invoices/newinvoice")}`);
        return;
      }

      setAdminEmail(email);
      setTechnicianEmail(email); // default tech assignment = admin email (can override)
      setAuthReady(true);
    }

    (async () => {
      const { data: sessData } = await supabaseClient.auth.getSession();
      const user = sessData?.session?.user ?? null;
      const email = user?.email ?? null;

      if (!alive) return;

      if (!user || !email) {
        await new Promise((r) => setTimeout(r, 150));
        if (!alive) return;

        const { data: sessData2 } = await supabaseClient.auth.getSession();
        const user2 = sessData2?.session?.user ?? null;
        const email2 = user2?.email ?? null;

        if (!user2 || !email2) {
          router.replace(`/admin/login?redirect=${encodeURIComponent("/admin/portal/invoices/newinvoice")}`);
          return;
        }

        await verifyAdminByEmail(email2);
        return;
      }

      await verifyAdminByEmail(email);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  /* ---------- Queries (mirrors tech pattern) ---------- */

  const {
    data: clients,
    isLoading: loadingClients,
    error: clientsErr,
  } = useQuery({
    queryKey: ["admin:newinvoice:clients"],
    enabled: authReady,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("clients")
        .select("id, full_name, phone, email, address_line1, city, state, zip, notes")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
    staleTime: 30_000,
  });

  const selectedClient: ClientRow | null = React.useMemo(() => {
    if (!clients || !selectedClientId) return null;
    return clients.find((c) => c.id === selectedClientId) ?? null;
  }, [clients, selectedClientId]);

  const {
    data: clientVehicles,
    isLoading: loadingVehicles,
    error: vehiclesErr,
  } = useQuery({
    queryKey: ["admin:newinvoice:client_vehicles", selectedClientId],
    enabled: authReady && !!selectedClientId,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("client_vehicles")
        .select("id, client_id, year, make, model, color, vin, stock_ro, license_plate, vehicle_type, trim")
        .eq("client_id", selectedClientId)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientVehicleRow[];
    },
    staleTime: 30_000,
  });

  /* ---------- Create Draft (ONLY on click) ---------- */

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      if (!adminEmail) throw new Error("Missing admin session email.");

      const effectiveTechEmail = technicianEmail?.trim() || adminEmail;
      if (!effectiveTechEmail) throw new Error("Technician email required.");

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

      const resolvedCustomerEmail =
        (selectedCustomerEmail || selectedClient?.email || "").trim() || null;

      const resolvedServiceAddress =
        localServiceAddress?.trim() ||
        (selectedClient?.address_line1
          ? `${selectedClient.address_line1}${selectedClient.city ? `, ${selectedClient.city}` : ""}${
              selectedClient.state ? `, ${selectedClient.state}` : ""
            }${selectedClient.zip ? ` ${selectedClient.zip}` : ""}`
          : "") ||
        null;

      const payload: AnyObj = {
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

        technician_email: effectiveTechEmail,

        // mirror tech fields
        customer_email: resolvedCustomerEmail,
        vehicle_id: selectedVehicleId || null,
        service_address: resolvedServiceAddress,
        appointment_snapshot: {
          notes_customer: localNotes || null,
          admin_created: true,
          admin_email: adminEmail,
          client_id: selectedClientId || null,
        },

        // Optional analytics flag (if your table has it)
        created_by_admin_email: adminEmail,
        client_id: selectedClientId || null, // if your tech_invoices has this column; safe if exists
      };

      // IMPORTANT: if your tech_invoices table does NOT have client_id, remove the line above.
      // If it errors in your env, delete `client_id` from payload.

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .insert(payload)
        .select(
          "id, invoice_number, services_json, windshield_repairs_json, technician_email, vehicle_id, invoice_date, status, customer_email, service_address, subtotal_cents, discount_percent, discount_cents, tax_rate_percent, tax_cents, total_cents, appointment_snapshot"
        )
        .single();

      if (error) {
        console.error("[Admin NewInvoice] insert tech_invoices error:", error);
        throw error;
      }

      return data as TechInvoice;
    },
    onSuccess: (row) => {
      setInvoice(row);
      queryClient.invalidateQueries({ queryKey: ["admin:tech_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tech-invoices:latest"] });
    },
  });

  /* ---------- Meta updater (ONLY if invoice exists) ---------- */

  const updateMetaMutation = useMutation({
    mutationFn: async (patch: Partial<TechInvoice> & { technician_email?: string | null }) => {
      if (!invoice?.id) throw new Error("Missing invoice id");

      const { error } = await supabaseClient
        .from("tech_invoices")
        .update({
          ...("customer_email" in patch ? { customer_email: patch.customer_email } : null),
          ...("vehicle_id" in patch ? { vehicle_id: patch.vehicle_id } : null),
          ...("service_address" in patch ? { service_address: patch.service_address } : null),
          ...("invoice_date" in patch ? { invoice_date: patch.invoice_date } : null),
          ...("appointment_snapshot" in patch ? { appointment_snapshot: patch.appointment_snapshot } : null),
          ...("technician_email" in patch ? { technician_email: patch.technician_email } : null),
        })
        .eq("id", invoice.id);

      if (error) {
        console.error("[Admin NewInvoice] updateMeta error:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      if (!invoice?.id) return;

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select(
          "id, invoice_number, services_json, windshield_repairs_json, technician_email, vehicle_id, invoice_date, status, customer_email, service_address, subtotal_cents, discount_percent, discount_cents, tax_rate_percent, tax_cents, total_cents, appointment_snapshot"
        )
        .eq("id", invoice.id)
        .single();

      if (!error && data) setInvoice(data as TechInvoice);

      queryClient.invalidateQueries({ queryKey: ["admin:tech_invoices"] });
    },
  });

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedVehicleId("");

    const c = clients?.find((x) => x.id === clientId) ?? null;

    // keep manual override in sync, mirroring tech page input behavior
    const nextEmail = (c?.email || "").trim();
    setSelectedCustomerEmail(nextEmail);

    if (invoice?.id) {
      updateMetaMutation.mutate({
        customer_email: nextEmail || null,
        vehicle_id: null,
        appointment_snapshot: {
          ...(invoice.appointment_snapshot || {}),
          client_id: clientId || null,
        },
      });
    }
  };

  const handleVehicleChange = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);

    if (invoice?.id) {
      updateMetaMutation.mutate({
        vehicle_id: vehicleId || null,
      });
    }
  };

  const handleBasicMetaSave = () => {
    if (!invoice?.id) return;

    const resolvedCustomerEmail =
      (selectedCustomerEmail || selectedClient?.email || "").trim() || null;

    const snapshot = {
      ...(invoice.appointment_snapshot || {}),
      notes_customer: localNotes || null,
      client_id: selectedClientId || null,
    };

    updateMetaMutation.mutate({
      customer_email: resolvedCustomerEmail,
      service_address: localServiceAddress || invoice.service_address || null,
      invoice_date: localInvoiceDate || invoice.invoice_date || null,
      appointment_snapshot: snapshot,
      technician_email: (technicianEmail?.trim() || adminEmail || null) as any,
    });
  };

  /* ---------- Totals capture (same as tech) ---------- */

  const handleTotalsChange = React.useCallback((totals: any) => {
    setTotalsSnapshot((prev) => {
      const next = {
        subtotalDollars: totals.subtotalDollars ?? 0,
        discountDollars: totals.discountDollars ?? 0,
        taxDollars: totals.taxDollars ?? 0,
        totalDollars:
          totals.totalDollars ??
          ((totals.subtotalDollars ?? 0) - (totals.discountDollars ?? 0) + (totals.taxDollars ?? 0)),
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
    };
  }, [invoice]);

  const computeMoneyFromSnapshot = React.useCallback(() => {
    const subtotal_cents =
      totalsSnapshot != null ? Math.round(totalsSnapshot.subtotalDollars * 100) : effectiveInvoice?.subtotal_cents ?? 0;

    const discount_cents =
      totalsSnapshot != null ? Math.round(totalsSnapshot.discountDollars * 100) : effectiveInvoice?.discount_cents ?? 0;

    const tax_cents =
      totalsSnapshot != null ? Math.round(totalsSnapshot.taxDollars * 100) : effectiveInvoice?.tax_cents ?? 0;

    const total_cents =
      totalsSnapshot != null ? Math.round(totalsSnapshot.totalDollars * 100) : effectiveInvoice?.total_cents ?? 0;

    return { subtotal_cents, discount_cents, tax_cents, total_cents };
  }, [
    totalsSnapshot,
    effectiveInvoice?.subtotal_cents,
    effectiveInvoice?.discount_cents,
    effectiveInvoice?.tax_cents,
    effectiveInvoice?.total_cents,
  ]);

  /* ---------- Send / Paid (same behavior as tech, but admin screen) ---------- */

  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveInvoice?.id) throw new Error("Missing invoice id");

      const todayIso = todayISO();
      const { subtotal_cents, discount_cents, tax_cents, total_cents } = computeMoneyFromSnapshot();

      const { error } = await supabaseClient
        .from("tech_invoices")
        .update({
          invoice_date: localInvoiceDate || effectiveInvoice.invoice_date || todayIso,
          status: "sent",
          subtotal_cents,
          discount_percent: effectiveInvoice?.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice?.tax_rate_percent ?? null,
          tax_cents,
          total_cents,
        })
        .eq("id", effectiveInvoice.id);

      if (error) {
        console.error("[Admin SendInvoice] error updating tech_invoices:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin:tech_invoices"] });
      if (invoice) setInvoice({ ...invoice, status: "sent" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveInvoice?.id) throw new Error("Missing invoice id");

      const todayIso = todayISO();
      const { subtotal_cents, discount_cents, tax_cents, total_cents } = computeMoneyFromSnapshot();

      const { error } = await supabaseClient
        .from("tech_invoices")
        .update({
          invoice_date: localInvoiceDate || effectiveInvoice.invoice_date || todayIso,
          status: "paid",
          subtotal_cents,
          discount_percent: effectiveInvoice?.discount_percent ?? null,
          discount_cents,
          tax_rate_percent: effectiveInvoice?.tax_rate_percent ?? null,
          tax_cents,
          total_cents,
        })
        .eq("id", effectiveInvoice.id);

      if (error) {
        console.error("[Admin MarkPaid] error updating tech_invoices:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin:tech_invoices"] });
      if (invoice) setInvoice({ ...invoice, status: "paid" });
    },
  });

  /* ---------- Loading ---------- */

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/40 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-sky-600/40 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4 text-slate-100">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-300" />
          <p className="text-sm tracking-[0.25em] uppercase text-slate-400">Loading</p>
        </div>
      </div>
    );
  }

  const status = invoice?.status ?? "draft";
  const warrantyEnd = addYears(localInvoiceDate || invoice?.invoice_date || todayISO(), 1);
  const draftExists = !!invoice?.id;

  /* ---------- UI (mirrors Tech New Invoice) ---------- */

  return (
    <div className="min-h-screen relative bg-slate-950 p-4 md:p-8 print:bg-white print:p-4 overflow-hidden">
      {/* background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-80 print:hidden">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[22rem] w-[22rem] rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(8,47,73,0.75),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(30,64,175,0.9),transparent_55%)]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Actions */}
        <div className="flex items-center justify-between mb-2 print:hidden">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/portal/invoices")}
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
                disabled={createDraftMutation.isPending || !adminEmail}
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

        {/* Header */}
        <Card className="border border-slate-700/80 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/90 backdrop-blur-xl shadow-[0_28px_80px_rgba(15,23,42,0.9)] print:bg-white print:border-slate-200 print:shadow-none">
          <CardContent className="p-6 md:p-8">
            <div className="grid md:grid-cols-[1.8fr_1.4fr] gap-8 items-start">
              {/* Business */}
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
                      Glass Guardian · Admin
                    </p>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-50 leading-tight">
                      New Tech Invoice
                    </h1>
                    <p className="text-xs text-slate-400">
                      Create a tech invoice from Admin · Same layout as Tech New Invoice
                    </p>
                  </div>
                </div>

                {!draftExists && (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-amber-300" />
                      <p>
                        This invoice is currently <span className="font-semibold">not saved</span>. Fill details if you
                        want, then click <span className="font-semibold">Start Draft</span> to create the row in Supabase.
                      </p>
                    </div>
                  </div>
                )}

                {/* Technician assignment (admin only) */}
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-cyan-300" />
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Technician Assignment</p>
                  </div>
                  <Input
                    value={technicianEmail}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setTechnicianEmail(v);
                      if (invoice?.id) updateMetaMutation.mutate({ technician_email: v || null });
                    }}
                    placeholder="tech@email.com"
                    className="h-9 bg-slate-900/70 border-slate-600 text-xs text-slate-100"
                  />
                  <p className="text-[11px] text-slate-400 mt-2">
                    This value writes to <code className="text-slate-300">tech_invoices.technician_email</code>.
                  </p>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-300 print:text-slate-700">
                  <p>Web: glassguardianchipandcrackrepair.com</p>
                  <p>Admin: {adminEmail}</p>
                </div>
              </div>

              {/* Invoice specifics */}
              <div className="md:text-right space-y-4">
                <div className="inline-flex md:flex md:flex-col items-start md:items-end gap-2">
                  <p className="text-[0.65rem] font-semibold text-slate-400 tracking-[0.22em] uppercase">Invoice</p>
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
                          setLocalInvoiceDate(e.target.value);
                          if (invoice?.id) updateMetaMutation.mutate({ invoice_date: e.target.value || null });
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
                        <span className="font-semibold text-emerald-300 print:text-emerald-700">{warrantyEnd}</span>
                      </span>
                    </span>
                  )}
                </div>

                <Separator className="my-3 border-slate-700/70 md:ml-auto md:w-64 print:border-slate-200" />

                <div className="space-y-1 text-xs md:text-sm text-slate-200 print:text-slate-800">
                  <p className="text-[0.65rem] tracking-[0.2em] uppercase text-slate-400">Assigned Tech</p>
                  <p className="font-semibold">{technicianEmail || invoice?.technician_email || "Technician"}</p>
                  {(clientsErr || vehiclesErr) && (
                    <p className="mt-2 text-[11px] text-amber-300">
                      Note: client/vehicle data failed to load. You can still create a manual invoice.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selections (mirror tech two-column) */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Bill To */}
          <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.8)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                Bill To
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-100 print:text-slate-800">
              {/* Client select */}
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  Client
                </label>
                <select
                  className="w-full h-9 rounded-md bg-slate-900/70 border border-slate-600 text-xs text-slate-100 px-2"
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                >
                  <option value="">{loadingClients ? "Loading clients…" : "Select client"}</option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.full_name || "Unnamed") + (c.email ? ` · ${c.email}` : "")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email override (manual) */}
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email (override / manual)
                </label>
                <Input
                  value={selectedCustomerEmail}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setSelectedCustomerEmail(v);
                    if (invoice?.id) updateMetaMutation.mutate({ customer_email: v || null });
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
                  onChange={(e) => setLocalServiceAddress(e.target.value)}
                  rows={3}
                  className="bg-slate-900/70 border-slate-600 text-xs resize-none"
                  placeholder="Street, city, state, ZIP"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Customer Notes</label>
                <Textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
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

          {/* Vehicle */}
          <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.8)] print:bg-white print:border-slate-200 print:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
                <Car className="w-4 h-4 text-cyan-300" />
                Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-100 print:text-slate-800">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Vehicle (filtered by client)</label>
                <select
                  className="w-full h-9 rounded-md bg-slate-900/70 border border-slate-600 text-xs text-slate-100 px-2"
                  value={selectedVehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  disabled={!selectedClientId}
                >
                  {!selectedClientId && <option value="">Select client first</option>}
                  {selectedClientId && (
                    <>
                      <option value="">{loadingVehicles ? "Loading vehicles…" : "Select vehicle"}</option>
                      {(clientVehicles ?? []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.year ?? ""} {v.make ?? ""} {v.model ?? ""} {v.color ? `· ${v.color}` : ""}{" "}
                          {v.vin ? `· VIN: ${v.vin.slice(0, 8)}…` : ""}
                          {v.stock_ro ? ` · RO: ${v.stock_ro}` : ""}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {selectedVehicleId && (
                <p className="text-xs text-slate-300">
                  This vehicle will be attached to the invoice in <code>tech_invoices.vehicle_id</code>
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
            }}
            onTotalsChange={handleTotalsChange}
          />
        ) : (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.85)]">
            <CardContent className="p-5 text-sm text-slate-200">
              <p className="text-slate-300">
                Services Performed will appear after you click <span className="font-semibold">Start Draft</span>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Windshield Repair Map */}
        {effectiveInvoice ? (
          <WindshieldRepairMap invoice={effectiveInvoice as any} />
        ) : (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.85)]">
            <CardContent className="p-5 text-sm text-slate-200">
              <p className="text-slate-300">
                Windshield Repair Map will appear after you click <span className="font-semibold">Start Draft</span>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Repair Details */}
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
                if (!invoice?.id) return;
                const snapshot = { ...(invoice.appointment_snapshot || {}), damage_description: e.target.value || null };
                updateMetaMutation.mutate({ appointment_snapshot: snapshot });
              }}
              defaultValue={invoice?.appointment_snapshot?.damage_description ?? ""}
              disabled={!draftExists}
            />
          </CardContent>
        </Card>

        {/* Send / Paid */}
        {effectiveInvoice && (
          <Card className="border border-slate-700/80 bg-slate-900/80 backdrop-blur-2xl shadow-[0_20px_60px_rgba(15,23,42,0.85)] print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-slate-50">
                <Send className="w-4 h-4 text-emerald-300" />
                Send Invoice (Standalone)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-slate-200">
              <p className="text-xs md:text-sm text-slate-300 max-w-xl">
                When you&apos;re done entering services and mapping the repair, you can either{" "}
                <span className="font-semibold text-emerald-300">Send Invoice</span> or{" "}
                <span className="font-semibold text-emerald-300">Mark Paid &amp; Send</span>.
              </p>
              <div className="flex flex-col items-stretch gap-1">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    disabled={sendInvoiceMutation.isPending || markPaidMutation.isPending}
                    onClick={() => sendInvoiceMutation.mutate()}
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
                    disabled={sendInvoiceMutation.isPending || markPaidMutation.isPending}
                    onClick={() => markPaidMutation.mutate()}
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warranty */}
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
            <p>This invoice serves as the official Glass Guardian warranty record for the windshield repair performed.</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <span className="font-semibold">Coverage:</span> 1 year from the service date for the repaired damage only.
              </li>
              <li>Warranty does not cover new damage or unrelated issues.</li>
            </ul>
          </CardContent>
        </Card>

        <div className="hidden print:block text-center text-[10px] text-slate-500 mt-4">
          Glass Guardian Chip &amp; Crack Repair — {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

