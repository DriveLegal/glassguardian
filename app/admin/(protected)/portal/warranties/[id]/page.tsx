// app/admin/(protected)/portal/warranties/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Shield,
  ArrowLeft,
  Mail,
  Car,
  Calendar,
  MapPin,
  ExternalLink,
  Save,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { GenerateMagicLinkButton } from "@/components/admin/GenerateMagicLinkButton";
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

/* ----------------------------- Types ----------------------------- */

type WarrantyRow = {
  id: string;
  warranty_number?: string | null;
  customer_email?: string | null;
  status?: string | null;

  service_performed?: string | null;
  service_date?: string | null;
  coverage_type?: string | null;
  expiration_date?: string | null;

  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_plate?: string | null;

  notes?: string | null;

  // This may point to a tech invoice or appointment id depending on your schema
  invoice_id?: string | null;

  // optional future fields you may have
  tech_invoice_id?: string | null;
  appointment_id?: string | null;
  job_id?: string | null;

  created_at?: string | null;

  // optional column if you add it later
  windshield_repairs_json?: any[] | null;

  [key: string]: any;
};

type InvoiceLike = {
  id: string;
  windshield_repairs_json: any[] | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getStatusColor(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  const colors: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-100 border-emerald-400/60",
    claimed: "bg-sky-500/15 text-sky-100 border-sky-400/60",
    expired: "bg-slate-700/40 text-slate-200 border-slate-500/70",
    transferred: "bg-violet-500/15 text-violet-100 border-violet-400/60",
    voided: "bg-rose-500/15 text-rose-100 border-rose-400/70",
  };
  return (
    colors[normalized] ||
    "bg-slate-700/50 text-slate-200 border-slate-500/70"
  );
}

function stableJson(v: any) {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return String(v ?? "");
  }
}

function isPermissionDenied(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  // Supabase/PostgREST common permission errors
  return (
    code === "42501" ||
    msg.toLowerCase().includes("permission") ||
    msg.toLowerCase().includes("not allowed") ||
    msg.toLowerCase().includes("row level security")
  );
}

function isMissingColumn(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  return (
    code === "42703" ||
    (msg.toLowerCase().includes("column") && msg.toLowerCase().includes("does not exist"))
  );
}

/* ----------------------------- Data ----------------------------- */

async function fetchWarrantyById(id: string): Promise<WarrantyRow | null> {
  const { data, error } = await supabaseClient
    .from("warranties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as WarrantyRow) ?? null;
}

/**
 * Mirror tech behavior:
 * Try reading the map from the canonical table first.
 * - tech_invoices.windshield_repairs_json
 * - invoices.windshield_repairs_json (fallback)
 */
async function fetchInvoiceLike(invoiceId: string): Promise<InvoiceLike | null> {
  // 1) tech_invoices
  {
    const { data, error } = await supabaseClient
      .from("tech_invoices")
      .select("id, windshield_repairs_json")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!error && data) return data as InvoiceLike;
  }

  // 2) invoices fallback
  {
    const { data, error } = await supabaseClient
      .from("invoices")
      .select("id, windshield_repairs_json")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!error && data) return data as InvoiceLike;
  }

  return null;
}

/**
 * Save map EXACTLY like tech would (but admin-safe fallback):
 * 1) Update tech_invoices.windshield_repairs_json
 * 2) Else update invoices.windshield_repairs_json
 * 3) Else update warranties.windshield_repairs_json (optional column)
 */
async function saveInvoiceMap(params: {
  invoiceId: string;
  repairs: any[];
  warrantyId: string;
}) {
  const repairs_json = Array.isArray(params.repairs) ? params.repairs : [];

  // 1) tech_invoices (primary)
  {
    const { data, error } = await supabaseClient
      .from("tech_invoices")
      .update({ windshield_repairs_json: repairs_json })
      .eq("id", params.invoiceId)
      .select("id, windshield_repairs_json")
      .maybeSingle();

    if (!error && data) {
      return { savedTo: "tech_invoices" as const, row: data as InvoiceLike };
    }

    // if it exists but blocked, surface the real reason
    if (error && isPermissionDenied(error)) throw error;
    // otherwise continue fallback (table missing / row not found / column missing)
  }

  // 2) invoices (fallback)
  {
    const { data, error } = await supabaseClient
      .from("invoices")
      .update({ windshield_repairs_json: repairs_json })
      .eq("id", params.invoiceId)
      .select("id, windshield_repairs_json")
      .maybeSingle();

    if (!error && data) {
      return { savedTo: "invoices" as const, row: data as InvoiceLike };
    }

    if (error && isPermissionDenied(error)) throw error;
  }

  // 3) warranties (optional)
  {
    const { data, error } = await supabaseClient
      .from("warranties")
      .update({ windshield_repairs_json: repairs_json as any })
      .eq("id", params.warrantyId)
      .select("id, windshield_repairs_json")
      .maybeSingle();

    if (!error && data) {
      return { savedTo: "warranties" as const, row: data as any };
    }

    if (error) {
      if (isMissingColumn(error)) {
        throw new Error(
          "Could not save map: no invoice row found to update, and warranties.windshield_repairs_json column is not enabled."
        );
      }
      if (isPermissionDenied(error)) throw error;
      throw error;
    }
  }

  throw new Error("Save failed: no matching invoice/warranty row updated.");
}

/* ----------------------------- Page ----------------------------- */

export default function AdminWarrantyDetailPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const id = typeof params?.id === "string" ? params.id : "";

  const [toast, setToast] = React.useState<string | null>(null);

  // Map draft
  const [repairsDraft, setRepairsDraft] = React.useState<any[]>([]);
  const initialRef = React.useRef<any[]>([]);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const {
    data: warranty,
    isLoading: loadingWarranty,
    isError: warrantyError,
  } = useQuery({
    queryKey: ["admin:warranty-detail", id],
    enabled: !!id,
    queryFn: () => fetchWarrantyById(id),
  });

  // Resolve the correct invoice id (supports multiple schema variants)
  const invoiceId = React.useMemo(() => {
    if (!warranty) return "";
    const candidates = [
      warranty.invoice_id,
      warranty.tech_invoice_id,
      warranty.appointment_id,
      warranty.job_id,
    ]
      .map((v) => (typeof v === "string" ? v : ""))
      .filter(Boolean);

    return candidates[0] ?? "";
  }, [warranty]);

  const {
    data: invoiceLike,
    isLoading: loadingInvoice,
  } = useQuery({
    queryKey: ["admin:warranty-invoice-like", invoiceId],
    enabled: !!invoiceId,
    queryFn: () => fetchInvoiceLike(invoiceId),
  });

  // Hydrate map drafts from invoice first (mirror tech), else from warranty column if exists
  React.useEffect(() => {
    if (!warranty) return;

    const fromInvoice =
      invoiceLike && Array.isArray(invoiceLike.windshield_repairs_json)
        ? invoiceLike.windshield_repairs_json
        : null;

    const fromWarranty =
      Array.isArray((warranty as any)?.windshield_repairs_json)
        ? ((warranty as any).windshield_repairs_json as any[])
        : null;

    const initial = (fromInvoice ?? fromWarranty ?? []) as any[];

    initialRef.current = Array.isArray(initial) ? initial : [];
    setRepairsDraft(Array.isArray(initial) ? initial : []);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warranty?.id, invoiceLike?.id]);

  const isActuallyDirty = React.useMemo(() => {
    return stableJson(repairsDraft) !== stableJson(initialRef.current);
  }, [repairsDraft]);

  const busy = false;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!warranty) throw new Error("Missing warranty.");

      const repairs_json = Array.isArray(repairsDraft) ? repairsDraft : [];

      // If we have an invoiceId, we try to save there first (tech mirror).
      if (invoiceId) {
        return await saveInvoiceMap({
          invoiceId,
          repairs: repairs_json,
          warrantyId: warranty.id,
        });
      }

      // No invoiceId available -> only option is warranties column (optional)
      const { data, error } = await supabaseClient
        .from("warranties")
        .update({ windshield_repairs_json: repairs_json as any })
        .eq("id", warranty.id)
        .select("id, windshield_repairs_json")
        .maybeSingle();

      if (error) {
        if (isMissingColumn(error)) {
          throw new Error(
            "No invoice linked, and warranties.windshield_repairs_json is not enabled."
          );
        }
        if (isPermissionDenied(error)) throw error;
        throw error;
      }

      return { savedTo: "warranties" as const, row: data };
    },
    onSuccess: (res) => {
      // Confirm save by updating the “initial” snapshot
      initialRef.current = Array.isArray(repairsDraft) ? repairsDraft : [];
      setDirty(false);

      // Refetch
      queryClient.invalidateQueries({ queryKey: ["admin:warranty-detail", id] });
      queryClient.invalidateQueries({
        queryKey: ["admin:warranty-invoice-like", invoiceId],
      });

      setToast(
        res?.savedTo === "tech_invoices"
          ? "Saved ✅ (tech_invoices updated)"
          : res?.savedTo === "invoices"
          ? "Saved ✅ (invoices updated)"
          : "Saved ✅ (warranty updated)"
      );
    },
    onError: (e: any) => {
      console.error("Admin warranty map save error:", e);

      if (isPermissionDenied(e)) {
        setToast(
          "Save failed: blocked by RLS/permissions for this table. Add an admin update policy."
        );
        return;
      }

      setToast(e?.message ? `Save failed: ${e.message}` : "Save failed");
    },
  });

  const resetDrafts = () => {
    setRepairsDraft(Array.isArray(initialRef.current) ? initialRef.current : []);
    setDirty(false);
    setToast("Reverted changes");
  };

  const canSave = (dirty || isActuallyDirty) && !saveMutation.isPending;

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <Card className="max-w-md w-full border border-slate-700 bg-slate-950/80">
          <CardContent className="py-10 text-center space-y-4">
            <h2 className="text-lg font-semibold">Invalid warranty ID</h2>
            <p className="text-sm text-slate-400">
              This admin warranty view is missing an ID in the route.
            </p>
            <Button
              onClick={() => router.push("/admin/portal/warranties")}
              className="bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Back to Warranties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingWarranty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="mx-auto h-10 w-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shadow-[0_0_22px_rgba(16,185,129,0.8)]" />
      </div>
    );
  }

  if (warrantyError || !warranty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <Card className="max-w-md w-full border border-slate-700 bg-slate-950/80">
          <CardContent className="py-10 text-center space-y-4">
            <h2 className="text-lg font-semibold">Warranty not found</h2>
            <p className="text-sm text-slate-400">
              We couldn&apos;t load this warranty. It may have been deleted or the ID is incorrect.
            </p>
            <Button
              onClick={() => router.push("/admin/portal/warranties")}
              className="bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Back to Warranties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusLabel = String(warranty.status ?? "active")
    .replace(/_/g, " ")
    .toUpperCase();

  const serviceDate = warranty.service_date
    ? format(new Date(warranty.service_date), "MMM d, yyyy")
    : "—";

  const expirationDate = warranty.expiration_date
    ? format(new Date(warranty.expiration_date), "MMM d, yyyy")
    : "Lifetime";

  const coverageLabel = String(warranty.coverage_type ?? "lifetime")
    .replace(/_/g, " ")
    .toLowerCase();

  const vehicleLabel =
    (warranty.vehicle_year ? `${warranty.vehicle_year} ` : "") +
    (warranty.vehicle_make ?? "") +
    (warranty.vehicle_make || warranty.vehicle_model ? " " : "") +
    (warranty.vehicle_model ?? "");

  const plateLabel = warranty.vehicle_plate ?? "";
  const statusNormalized = (warranty.status ?? "active").toLowerCase();

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[radial-gradient(circle_at_top,_#020617_0,_#020617_45%,_#000000_100%)] text-slate-100">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur">
            {toast}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-950/80 text-slate-100 hover:border-slate-500 hover:bg-slate-900"
              onClick={() => router.push("/admin/portal/warranties")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Warranties
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-950/80 text-slate-100 hover:border-emerald-400 hover:bg-slate-900"
              onClick={() => router.push(`/user/warranties/${warranty.id}`)}
            >
              View as Customer
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-start md:justify-end">
            {warranty.customer_email && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `mailto:${warranty.customer_email}`;
                }}
                className="border-slate-700 bg-slate-950/80 text-slate-100 hover:border-emerald-400 hover:bg-slate-900"
              >
                <Mail className="w-3 h-3 mr-1" />
                Contact
              </Button>
            )}

            {warranty.customer_email && (
              <GenerateMagicLinkButton
                email={warranty.customer_email}
                warrantyId={warranty.id}
              />
            )}

            <Button
              size="sm"
              disabled={!canSave}
              onClick={() => saveMutation.mutate()}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-[0_0_22px_rgba(16,185,129,0.22)] disabled:opacity-60 disabled:hover:bg-emerald-500"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Map
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={saveMutation.isPending || !(dirty || isActuallyDirty)}
              onClick={resetDrafts}
              className="border-slate-700 bg-slate-950/80 text-slate-100 hover:border-slate-500 hover:bg-slate-900 disabled:opacity-60"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Summary card */}
        <Card className="border border-emerald-500/20 bg-slate-950/90 backdrop-blur-xl shadow-[0_0_60px_rgba(16,185,129,0.7)]">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/35 blur-xl" />
                  <div className="relative h-11 w-11 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-600 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.85)]">
                    <Shield className="w-6 h-6 text-slate-950" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-lg md:text-xl">
                    Warranty #{warranty.warranty_number ?? warranty.id}
                  </CardTitle>
                  <p className="text-xs md:text-sm text-slate-400">
                    Admin view — windshield map edits save like tech (invoice-first).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cx(
                    "text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.14em] border",
                    getStatusColor(warranty.status)
                  )}
                >
                  {statusLabel}
                </Badge>

                {(dirty || isActuallyDirty) && (
                  <Badge className="bg-amber-500/15 text-amber-100 border-amber-400/60">
                    <Sparkles className="w-3 h-3 mr-1" />
                    UNSAVED
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 md:p-6 space-y-5">
            {/* Basic rows */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Customer */}
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-cyan-400" />
                  Customer
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                  <p className="text-slate-100 break-all">
                    {warranty.customer_email ?? "No email on file"}
                  </p>
                </div>
              </div>

              {/* Vehicle */}
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                  <Car className="w-3 h-3 text-sky-400" />
                  Vehicle
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm space-y-1">
                  <p className="text-slate-100">
                    {vehicleLabel.trim().length > 0 ? vehicleLabel : "Vehicle on file"}
                  </p>
                  {plateLabel && (
                    <p className="text-[11px] text-slate-400">
                      Plate:{" "}
                      <span className="inline-flex items-center rounded-md border border-slate-600 px-1.5 py-0.5 uppercase tracking-[0.18em] text-[0.68rem]">
                        {plateLabel}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Save target */}
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  Save target
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm space-y-1">
                  <p className="text-slate-100">
                    {invoiceId ? "Invoice-first (tech mirror)" : "Warranty-only (fallback)"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    InvoiceId:{" "}
                    <span className="text-slate-300">{invoiceId ? invoiceId.slice(0, 12) : "—"}</span>
                  </p>
                  {loadingInvoice && invoiceId && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading invoice map…
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Windshield Map – EDITABLE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  Windshield Repair Map (admin edit)
                </p>

                <div className="flex items-center gap-2">
                  {invoiceId ? (
                    <Badge className="bg-emerald-500/15 text-emerald-100 border-emerald-400/60">
                      Invoice-first save
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-100 border-amber-400/60">
                      No invoice linked
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 md:p-4 space-y-2">
                <p className="text-xs text-slate-400">
                  Click/tap to place markers. Then hit{" "}
                  <span className="text-slate-100 font-semibold">Save Map</span>.
                </p>

                <div className="mt-2">
                  <WindshieldRepairMap
                    key={String(invoiceId || warranty.id)}
                    {...({
                      invoice: {
                        id: String(invoiceId || warranty.id),
                        windshield_repairs_json: repairsDraft,
                      },
                      readOnly: false,
                      mode: "edit",

                      // multiple aliases to match whichever your component uses
                      onChange: (next: any[]) => {
                        const arr = Array.isArray(next) ? next : [];
                        setRepairsDraft(arr);
                        setDirty(true);
                      },
                      onUpdate: (next: any[]) => {
                        const arr = Array.isArray(next) ? next : [];
                        setRepairsDraft(arr);
                        setDirty(true);
                      },
                      onRepairsChange: (next: any[]) => {
                        const arr = Array.isArray(next) ? next : [];
                        setRepairsDraft(arr);
                        setDirty(true);
                      },

                      value: repairsDraft,
                      repairs: repairsDraft,
                      markers: repairsDraft,
                    } as any)}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="text-[11px] text-slate-500">
                    Markers:{" "}
                    <span className="text-slate-300 font-semibold">
                      {Array.isArray(repairsDraft) ? repairsDraft.length : 0}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                    onClick={() => {
                      setRepairsDraft([]);
                      setDirty(true);
                      setToast("Map cleared (remember to Save Map)");
                    }}
                    disabled={saveMutation.isPending}
                  >
                    Clear Map
                  </Button>
                </div>
              </div>
            </div>

            {/* Service / coverage / expiration */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  Service date
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                  <p className="text-slate-100">{serviceDate}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Day the original repair was completed.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  Coverage
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                  <p className="text-slate-100 capitalize">{coverageLabel}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Based on your internal warranty settings.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  Expiration
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                  <p className="text-slate-100">{expirationDate}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Leave blank for lifetime-style coverage.
                  </p>
                </div>
              </div>
            </div>

            {/* Service details */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Service details
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm space-y-1.5">
                <p className="text-slate-100">
                  {warranty.service_performed ?? "Windshield chip / crack repair"}
                </p>
                {warranty.notes && (
                  <p className="text-[12px] text-slate-400 leading-snug">
                    {warranty.notes}
                  </p>
                )}
              </div>
            </div>

            {statusNormalized === "active" && (
              <div className="rounded-xl border border-emerald-500/55 bg-emerald-500/10 px-4 py-3">
                <p className="text-sm text-emerald-100">
                  ✓ This warranty is currently active. Saved markers should reflect
                  the exact repaired spot.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="pb-10 text-center text-[11px] text-slate-500">
          Warranty ID:{" "}
          <span className="text-slate-400">{String(warranty.id).slice(0, 12)}</span>
        </div>
      </div>
    </div>
  );
}