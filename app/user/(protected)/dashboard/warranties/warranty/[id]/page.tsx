// app/user/(protected)/dashboard/warranties/warranty/[id]/page.tsx
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Shield,
  ArrowLeft,
  Car,
  MapPin,
  Calendar,
  Download,
  Sparkles,
  BadgeCheck,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  Lock,
  Star,
  Wand2,
  ShieldAlert,
  Zap,
  ChevronRight,
  Printer,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ✅ keep old tech component path (works for tech + admin data as long as invoice-like payload has windshield_repairs_json)
import { WindshieldRepairMap } from "@/components/tech/invoice/WindshieldRepairMap";

/* ---------- Types ---------- */

type WarrantyRow = {
  id: string;
  warranty_number?: string | null;
  customer_email?: string | null;
  status?: string | null;

  service_performed?: string | null;
  service_date?: string | null;
  coverage_type?: string | null;
  expiration_date?: string | null;

  qr_code_url?: string | null;

  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_plate?: string | null;

  spot_location?: string | null;
  notes?: string | null;

  invoice_id?: string | null;
  tech_invoice_id?: string | null;
  appointment_id?: string | null;
  job_id?: string | null;
  warranty_id?: string | null;

  windshield_repairs_json?: any[] | null;

  [key: string]: any;
};

type InvoiceForMap = {
  id: string;
  invoice_number?: string | null;
  status?: string | null;
  windshield_repairs_json?: any[] | null;
  services_json?: any | null;
};

/* ---------- Utils ---------- */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getStatusColor(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  const colors: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-100 border-emerald-400/40",
    claimed: "bg-sky-500/15 text-sky-100 border-sky-400/40",
    expired: "bg-slate-400/15 text-slate-100 border-slate-300/30",
    transferred: "bg-violet-500/15 text-violet-100 border-violet-400/40",
    voided: "bg-rose-500/15 text-rose-100 border-rose-400/40",
  };
  return colors[normalized] || "bg-slate-400/15 text-slate-100 border-slate-300/30";
}

function hasMarkers(v: any): v is any[] {
  return Array.isArray(v) && v.length > 0;
}

function isIgnorableSupabaseError(err: any) {
  const code = String(err?.code ?? "");
  return code === "42703" || code === "42P01" || code === "PGRST116";
}

async function tryInvoiceLookupById(
  table: "invoices" | "tech_invoices" | "admin_invoices",
  id: string
): Promise<InvoiceForMap | null> {
  const { data, error } = await supabaseClient
    .from(table)
    .select("id, invoice_number, status, windshield_repairs_json, services_json")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isIgnorableSupabaseError(error)) return null;
    return null;
  }
  return (data ?? null) as InvoiceForMap | null;
}

async function tryInvoiceLookupByNumber(
  table: "invoices" | "tech_invoices" | "admin_invoices",
  invoiceNumber: string
): Promise<InvoiceForMap | null> {
  const { data, error } = await supabaseClient
    .from(table)
    .select("id, invoice_number, status, windshield_repairs_json, services_json")
    .eq("invoice_number", invoiceNumber)
    .limit(1);

  if (error) {
    if (isIgnorableSupabaseError(error)) return null;
    return null;
  }
  return (data?.[0] ?? null) as InvoiceForMap | null;
}

function titleCase(v: string) {
  return v
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function coveragePretty(v?: string | null) {
  const s = String(v ?? "lifetime").replace(/_/g, " ").trim().toLowerCase();
  if (!s) return "Lifetime";
  if (s.includes("life")) return "Lifetime";
  return titleCase(s);
}

function statusPretty(v?: string | null) {
  const s = String(v ?? "active").replace(/_/g, " ").trim();
  return s ? s.toUpperCase() : "ACTIVE";
}

function daysUntil(dateIso?: string | null) {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function safeDateLabel(iso?: string | null, fallback = "—") {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return format(d, "MMM d, yyyy");
}

/* ---------- Micro FX ---------- */

function useRafMouseGlow(enabled: boolean) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty("--mx", `${x}px`);
        el.style.setProperty("--my", `${y}px`);
      });
    };

    el.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
    };
  }, [enabled]);

  return ref;
}

export default function WarrantyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) ?? null;

  const [email, setEmail] = React.useState<string | null>(null);
  const [didWow, setDidWow] = React.useState(false);

  const reduceMotion = useReducedMotion();
  const glowRef = useRafMouseGlow(!reduceMotion);

  // Auth guard
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!session?.user) {
        const redirectPath = id
          ? `/user/dashboard/warranties/warranty/${id}`
          : "/user/dashboard/warranties";
        router.replace(`/user/login?redirect=${encodeURIComponent(redirectPath)}`);
        return;
      }
      setEmail(session.user.email ?? null);
    })();
  }, [router, id]);

  const warrantyQuery = useQuery<WarrantyRow | null>({
    queryKey: ["warranty-detail", id, email],
    enabled: !!id && !!email,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("warranties")
        .select("*")
        .eq("id", id)
        .eq("customer_email", email)
        .single();

      if (error) throw error;
      return (data ?? null) as WarrantyRow | null;
    },
  });

  const warranty = warrantyQuery.data ?? null;

  // Linked invoice fetch
  const invoiceForMapQuery = useQuery<InvoiceForMap | null>({
    queryKey: ["warranty-linked-invoice-v3", id, email, warranty?.id],
    enabled: !!id && !!email && !!warranty,
    queryFn: async () => {
      if (!warranty) return null;

      const byIdCandidates = [
        warranty.invoice_id,
        warranty.tech_invoice_id,
        warranty.appointment_id,
        warranty.job_id,
      ]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean);

      const byId = byIdCandidates[0] ?? "";
      if (byId) {
        const a = await tryInvoiceLookupById("invoices", byId);
        if (a) return a;

        const b = await tryInvoiceLookupById("tech_invoices", byId);
        if (b) return b;

        const c = await tryInvoiceLookupById("admin_invoices", byId);
        if (c) return c;
      }

      const warrantyNumber = String(warranty.warranty_number ?? "").trim();
      if (warrantyNumber) {
        const a = await tryInvoiceLookupByNumber("invoices", warrantyNumber);
        if (a) return a;

        const b = await tryInvoiceLookupByNumber("tech_invoices", warrantyNumber);
        if (b) return b;

        const c = await tryInvoiceLookupByNumber("admin_invoices", warrantyNumber);
        if (c) return c;
      }

      try {
        const { data, error } = await supabaseClient
          .from("tech_invoices")
          .select("id, invoice_number, status, windshield_repairs_json, services_json")
          .eq("warranty_id", warranty.id)
          .limit(1);

        if (!error && data?.[0]) return data[0] as InvoiceForMap;
      } catch {
        // ignore
      }

      return null;
    },
  });

  const invoiceForMap = invoiceForMapQuery.data ?? null;

  const mapMarkers = React.useMemo(() => {
    if (hasMarkers(invoiceForMap?.windshield_repairs_json))
      return invoiceForMap!.windshield_repairs_json!;
    if (hasMarkers(warranty?.windshield_repairs_json))
      return warranty!.windshield_repairs_json!;
    return null;
  }, [invoiceForMap?.windshield_repairs_json, warranty?.windshield_repairs_json]);

  const mapInvoiceLike = React.useMemo(() => {
    if (!mapMarkers) return null;
    return {
      id: invoiceForMap?.id ?? warranty?.invoice_id ?? warranty?.id ?? "map",
      windshield_repairs_json: mapMarkers,
    };
  }, [mapMarkers, invoiceForMap?.id, warranty?.invoice_id, warranty?.id]);

  // Labels
  const statusLabel = statusPretty(warranty?.status);
  const coverageLabel = coveragePretty(warranty?.coverage_type);

  const serviceDateLabel = safeDateLabel(warranty?.service_date, "—");
  const expirationDateLabel = warranty?.expiration_date
    ? safeDateLabel(warranty?.expiration_date, "—")
    : "Lifetime";

  const vehicleLabel =
    (warranty?.vehicle_year ? `${warranty.vehicle_year} ` : "") +
    (warranty?.vehicle_make ?? "") +
    (warranty?.vehicle_make || warranty?.vehicle_model ? " " : "") +
    (warranty?.vehicle_model ?? "");

  const plateLabel = warranty?.vehicle_plate ?? "";
  const warrantyIdLabel = String(warranty?.warranty_number ?? warranty?.id ?? "").trim();
  const expiryDays = daysUntil(warranty?.expiration_date ?? null);

  const servicePerformed =
    (warranty?.service_performed && String(warranty.service_performed).trim()) ||
    "Windshield chip / crack repair";
  const notes = (warranty?.notes && String(warranty.notes).trim()) || "";

  const normalizedStatus = String(warranty?.status ?? "active").toLowerCase();
  const isActive = normalizedStatus === "active";
  const isExpired = normalizedStatus === "expired";
  const isClaimed = normalizedStatus === "claimed";

  // Trigger one-time WOW reveal when data loads
  React.useEffect(() => {
    if (!reduceMotion && warranty && !didWow) {
      setDidWow(true);
    }
  }, [reduceMotion, warranty, didWow]);

  // Prestige FX helpers
  const heroGlowClass = isActive
    ? "shadow-[0_0_0_1px_rgba(16,185,129,0.20),0_18px_70px_rgba(16,185,129,0.16),0_30px_110px_rgba(2,6,23,0.85)]"
    : isExpired
    ? "shadow-[0_0_0_1px_rgba(244,63,94,0.22),0_18px_70px_rgba(244,63,94,0.16),0_30px_110px_rgba(2,6,23,0.85)]"
    : "shadow-[0_22px_70px_rgba(2,6,23,0.85)]";

  const mapGlowRingClass = isActive
    ? "bg-emerald-500/14"
    : isExpired
    ? "bg-rose-500/14 animate-pulse"
    : "bg-sky-500/10";
  const mapBorderClass = isActive
    ? "border-emerald-400/30"
    : isExpired
    ? "border-rose-400/30"
    : "border-slate-800";
  const mapTopBarGradient = isActive
    ? "from-emerald-500 via-sky-500 to-indigo-500"
    : isExpired
    ? "from-rose-500 via-amber-500 to-slate-500"
    : "from-sky-500 via-indigo-500 to-emerald-400";

  const statusWordClass = isActive
    ? "text-emerald-200 drop-shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : isExpired
    ? "text-rose-200 animate-pulse drop-shadow-[0_0_16px_rgba(244,63,94,0.65)]"
    : "text-slate-50 drop-shadow-[0_0_10px_rgba(148,163,184,0.18)]";

  /* ---------- Loading / Error ---------- */

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <Card className="max-w-md w-full border border-slate-800 bg-slate-950/90 text-slate-50">
          <CardContent className="py-10 text-center space-y-4">
            <h2 className="text-xl font-bold">Invalid warranty link</h2>
            <p className="text-slate-400 text-sm">This warranty link is missing an ID.</p>
            <Button
              onClick={() => router.push("/user/dashboard/warranties")}
              className="mt-2 bg-slate-900 text-slate-50 hover:bg-slate-800 border border-slate-700"
            >
              Back to Warranties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (warrantyQuery.isLoading || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="relative">
          <div className="absolute -inset-10 rounded-full blur-3xl bg-sky-500/20 animate-pulse" />
          <div className="relative">
            <div className="absolute -inset-6 rounded-full blur-2xl bg-emerald-500/10" />
            <div className="relative animate-spin rounded-full h-14 w-14 border-b-2 border-sky-300" />
          </div>
          <p className="mt-5 text-xs text-slate-400 text-center">Loading your warranty…</p>
        </div>
      </div>
    );
  }

  if (warrantyQuery.isError || !warranty) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <Card className="max-w-md w-full border border-slate-800 bg-slate-950/90 text-slate-50">
          <CardContent className="py-10 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-rose-200" />
            </div>
            <h2 className="text-xl font-bold">Warranty not found</h2>
            <p className="text-slate-400 text-sm">
              We couldn&apos;t find this warranty under your account. It may have been moved, updated, or belongs to
              another user.
            </p>
            <Button
              onClick={() => router.push("/user/dashboard/warranties")}
              className="mt-2 bg-slate-900 text-slate-50 hover:bg-slate-800 border border-slate-700"
            >
              Back to Warranties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- Main ---------- */

  const containerVariants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduceMotion ? 0 : 0.55,
        ease: "easeOut",
        staggerChildren: reduceMotion ? 0 : 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: reduceMotion ? 0 : 10,
      scale: reduceMotion ? 1 : 0.99,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: reduceMotion ? 0 : 0.45, ease: "easeOut" },
    },
  };

  return (
    // ✅ Background removed — uses your existing portal/global background
    <div className="relative min-h-screen overflow-hidden">
      {/* One-time WOW overlay (kept, but no global background layers) */}
      <AnimatePresence>
        {!reduceMotion && didWow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 0.22, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className={cx(
                "absolute inset-0",
                isExpired
                  ? "bg-[radial-gradient(circle_at_50%_40%,rgba(244,63,94,0.28),transparent_60%)]"
                  : "bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.22),transparent_60%)]"
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Top bar */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <Button
              variant="outline"
              size="sm"
              className="w-fit flex items-center gap-2 text-xs md:text-sm border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800 hover:text-slate-50"
              onClick={() => router.push("/user/dashboard/warranties")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Warranties
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {/* ✅ Printable receipt route */}
              <Button
                size="sm"
                className="text-xs md:text-sm bg-slate-50 text-slate-950 hover:bg-slate-200"
                onClick={() => router.push(`/user/dashboard/warranties/warranty/${id}/receipt`)}
              >
                <Printer className="w-4 h-4 mr-1" />
                Print Receipt
              </Button>

              {warranty.qr_code_url && (
                <Button asChild size="sm" className="text-xs md:text-sm bg-slate-50 text-slate-950 hover:bg-slate-200">
                  <a href={warranty.qr_code_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-1" />
                    Download QR
                  </a>
                </Button>
              )}

              <Badge
                className={cx(
                  "border text-[0.65rem] md:text-[0.7rem] font-semibold uppercase tracking-wide",
                  getStatusColor(warranty.status)
                )}
              >
                {statusLabel}
              </Badge>

              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-200">
                <Lock className="w-3.5 h-3.5 text-slate-300" />
                VIEW ONLY
              </span>
            </div>
          </motion.div>

          {/* Hero (with interactive glow) */}
          <motion.div variants={itemVariants}>
            <Card
              ref={glowRef as any}
              className={cx(
                "relative overflow-hidden border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50",
                heroGlowClass
              )}
              style={
                !reduceMotion
                  ? ({
                      backgroundImage:
                        "radial-gradient(500px circle at var(--mx, 40%) var(--my, 30%), rgba(255,255,255,0.06), transparent 60%)",
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-85", mapTopBarGradient)} />

              {/* Glass shine + moving shimmer */}
              {!reduceMotion && (
                <div className="pointer-events-none absolute inset-0 opacity-60">
                  <motion.div
                    initial={{ x: "-30%" }}
                    animate={{ x: "130%" }}
                    transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-sm"
                  />
                </div>
              )}

              <CardHeader className="border-b border-slate-800/80 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={cx(
                          "absolute -inset-2 rounded-full blur-md",
                          isExpired ? "bg-rose-400/20 animate-pulse" : "bg-emerald-400/20"
                        )}
                      />
                      <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center shadow-[0_0_28px_rgba(16,185,129,0.35)]">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <div>
                      <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                        Warranty #{warrantyIdLabel}
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/40 px-2 py-1 text-[10px] text-slate-200">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          Glass Guardian
                        </span>
                      </CardTitle>

                      <p className="text-xs md:text-sm text-slate-400 mt-1">
                        Your record of your covered repair — mapped and protected.
                      </p>

                      {/* Premium mini chips */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/45 px-2.5 py-1 text-[10px] text-slate-200">
                          <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                          Elite protection
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/45 px-2.5 py-1 text-[10px] text-slate-200">
                          <Zap className="w-3.5 h-3.5 text-sky-300" />
                          Fast lookup
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/45 px-2.5 py-1 text-[10px] text-slate-200">
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-300" />
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 pb-7 space-y-6">
                {/* KPI tiles (animated) */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <motion.div
                    whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Service date</p>
                        <p className="text-lg font-semibold text-slate-50 mt-1">{serviceDateLabel}</p>
                        <p className="text-xs text-slate-400 mt-1">Original repair completion date.</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-cyan-300" />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Coverage</p>
                        <p className="text-lg font-semibold text-slate-50 mt-1">{coverageLabel}</p>
                        <p className="text-xs text-slate-400 mt-1">Workmanship & materials.</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-emerald-300" />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Expiration</p>
                        <p className="text-lg font-semibold text-slate-50 mt-1">{expirationDateLabel}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {warranty.expiration_date
                            ? expiryDays !== null
                              ? expiryDays >= 0
                                ? `${expiryDays} day${expiryDays === 1 ? "" : "s"} remaining`
                                : "Expired"
                              : "—"
                            : "Most repairs are covered for life of the windshield."}
                        </p>
                      </div>
                      <div
                        className={cx(
                          "h-10 w-10 rounded-xl border flex items-center justify-center",
                          isExpired ? "bg-rose-500/15 border-rose-400/25" : "bg-amber-500/15 border-amber-400/25"
                        )}
                      >
                        {isExpired ? (
                          <AlertTriangle className="w-5 h-5 text-rose-300" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-300" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Main body */}
                <div className="grid lg:grid-cols-12 gap-5">
                  {/* Left: Vehicle + details */}
                  <div className="lg:col-span-5 space-y-4">
                    <motion.div
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-[0.16em]">
                        <Car className="w-4 h-4 text-sky-300" />
                        Vehicle on warranty
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3">
                        <p className="text-sm font-semibold text-slate-50">
                          {vehicleLabel.trim().length > 0 ? vehicleLabel : "Vehicle on file"}
                        </p>

                        {plateLabel ? (
                          <p className="text-xs text-slate-300 mt-1">
                            Plate:{" "}
                            <span className="inline-flex items-center rounded-md border border-slate-600 px-1.5 py-0.5 uppercase tracking-[0.18em] text-[0.7rem]">
                              {plateLabel}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-1">Plate not provided.</p>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Warranty status</p>
                          <p className="text-sm font-semibold mt-1">
                            <span className={cx("inline-block", statusWordClass)}>{statusLabel}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {isClaimed
                              ? "A claim was logged."
                              : isExpired
                              ? "Coverage period ended."
                              : "Coverage is currently active."}
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    {/* Service details */}
                    <motion.div
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-[0.16em]">
                          <ClipboardList className="w-4 h-4 text-cyan-300" />
                          Service details
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 space-y-2">
                        <p className="text-sm font-semibold text-slate-50">{servicePerformed}</p>
                        {notes ? (
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                            {notes}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 leading-relaxed">
                            No extra notes were added for this repair.
                          </p>
                        )}
                      </div>

                      {isActive && (
                        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-3">
                          <p className="text-sm text-emerald-100 font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            You’re covered in this exact spot.
                          </p>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            If the chip expands or reappears where we repaired it, we can re-check and help quickly — just
                            reference Warranty #{warrantyIdLabel}.
                          </p>
                        </div>
                      )}
                    </motion.div>

                    {/* Micro “what to do next” */}
                    <motion.div variants={itemVariants} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs font-semibold text-slate-300 uppercase tracking-[0.16em] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        If anything changes
                      </p>
                      <div className="mt-3 grid gap-2">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex items-start gap-3">
                          <div className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center">
                            <BadgeCheck className="w-5 h-5 text-emerald-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-50">Snap a photo</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              If the chip looks like it’s spreading, capture it right away.
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex items-start gap-3">
                          <div className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-sky-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-50">Mention your warranty</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Use <span className="text-slate-300">#{warrantyIdLabel}</span> so we can pull your exact spot fast.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Right: Map */}
                  <div className="lg:col-span-7 space-y-3">
                    <motion.div variants={itemVariants} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-[0.16em]">
                            <MapPin className="w-4 h-4 text-emerald-300" />
                            Windshield repair map
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Your saved repair mark is shown below.</p>
                        </div>

                        <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/35 px-2.5 py-1 text-[10px] text-slate-200">
                          <Lock className="w-3.5 h-3.5 text-slate-300" />
                          VIEW ONLY
                        </span>
                      </div>

                      <div
                        className={cx(
                          "mt-4 rounded-3xl border bg-gradient-to-b from-slate-950/40 to-slate-950/20 p-3 md:p-4 shadow-[0_18px_60px_rgba(2,6,23,0.75)]",
                          mapBorderClass
                        )}
                      >
                        <div className="relative">
                          <div className={cx("pointer-events-none absolute -inset-6 rounded-[28px] blur-2xl", mapGlowRingClass)} />
                          <div className="pointer-events-none absolute -inset-[1px] rounded-[28px] bg-gradient-to-r from-white/10 via-white/0 to-white/10 opacity-35" />

                          <div className="relative rounded-2xl border border-slate-800 bg-slate-950/35 p-2">
                            {mapInvoiceLike ? (
                              <div className="relative">
                                <motion.div
                                  initial={reduceMotion ? undefined : { scale: 0.995, opacity: 0.9 }}
                                  animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                >
                                  <WindshieldRepairMap invoice={mapInvoiceLike as any} readOnly />
                                </motion.div>

                                {/* Hard lock overlay */}
                                <div
                                  className="absolute inset-0 z-10"
                                  aria-hidden="true"
                                  title="View only"
                                  style={{ background: "transparent" }}
                                />

                                {/* status chip */}
                                <div className="absolute top-3 left-3 z-20">
                                  <span
                                    className={cx(
                                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] text-slate-100 backdrop-blur",
                                      isActive
                                        ? "border-emerald-400/40 bg-emerald-500/12"
                                        : isExpired
                                        ? "border-rose-400/40 bg-rose-500/12"
                                        : "border-slate-700 bg-slate-950/60"
                                    )}
                                  >
                                    {isExpired ? (
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-200" />
                                    ) : (
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                                    )}
                                    {isExpired ? "EXPIRED" : isActive ? "ACTIVE" : statusLabel}
                                  </span>
                                </div>

                                {/* subtle corner watermark */}
                                <div className="absolute bottom-3 right-3 z-20">
                                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-200">
                                    <Star className="w-3.5 h-3.5 text-amber-300" />
                                    Premium map
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="py-10 text-center">
                                <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center">
                                  <MapPin className="w-6 h-6 text-slate-300" />
                                </div>
                                <p className="text-sm font-semibold text-slate-100 mt-3">Repair map not available yet</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                                  {warranty.spot_location
                                    ? `Spot description on file: ${warranty.spot_location}`
                                    : "Spot description on file."}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-[11px] text-slate-400">
                          Warranty ID: <span className="text-slate-300">{String(warranty.id).slice(0, 12)}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">Protected by Glass Guardian workmanship standards.</p>
                      </div>
                    </motion.div>

                    {/* CTA panel with premium hover */}
                    <motion.div
                      variants={itemVariants}
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/70 to-slate-950/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-50">Need help with this repair?</p>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            If the damage changes, take a photo and reach out. Mention Warranty #{warrantyIdLabel} so we can pull up the exact spot fast.
                          </p>
                        </div>
                        <div className="hidden sm:flex h-10 w-10 rounded-xl border border-slate-800 bg-slate-950/40 items-center justify-center">
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/40 px-2.5 py-1 text-[10px] text-slate-200">
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-300" />
                          Fast lookup
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/40 px-2.5 py-1 text-[10px] text-slate-200">
                          <Shield className="w-3.5 h-3.5 text-sky-300" />
                          Warranty-backed
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/40 px-2.5 py-1 text-[10px] text-slate-200">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          Premium service
                        </span>
                      </div>
                    </motion.div>

                    {/* Expired notice (if needed) */}
                    {isExpired && (
                      <motion.div variants={itemVariants} className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4">
                        <p className="text-sm text-rose-100 font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-300" />
                          Coverage expired
                        </p>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          This warranty is no longer active. If you still need help with your windshield, we can offer a new assessment.
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer micro */}
          <motion.div variants={itemVariants} className="pb-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400">
                Saved securely for your account: <span className="text-slate-300">{email ?? "—"}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                This page is view-only to protect the integrity of your warranty map.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}