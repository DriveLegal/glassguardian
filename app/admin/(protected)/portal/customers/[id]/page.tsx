// app/admin/(protected)/portal/customers/[id]/page.tsx
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Car,
  Shield,
  AlertTriangle,
  Loader2,
  BadgeCheck,
  Clock,
  Calendar,
  Hash,
  NotebookPen,
  FileText,
  Receipt,
  CheckCircle2,
  BadgeDollarSign,
  Sparkles,
  Info,
  Save,
  RefreshCw,
  Ban,
  Pencil,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import VehicleImageDisplay from "@/components/VehicleImageDisplay";
import { GenerateMagicLinkButton } from "@/components/admin/GenerateMagicLinkButton";

type AnyObj = Record<string, any>;

type AppUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  auth_user_id?: string | null;
  invite_code?: string | null;
  created_by_tech?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  // optional admin-edit fields (safe if absent)
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  notes?: string | null;

  // optional activation flags (safe if absent)
  portal_activated_at?: string | null;
  portal_active?: boolean | null;
  password_set?: boolean | null;
};

type InviteRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  code: string | null;
  created_at: string | null;
  used_at: string | null;
  tech_email?: string | null;
  created_by_tech_email?: string | null;
};

type TechInvoiceRow = {
  id: string;
  invoice_number: string | null;
  technician_email: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  service_address?: string | null;
  appointment_snapshot?: any | null;
  invoice_date: string | null;
  status: string | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  created_at: string | null;
  paid_at?: string | null;
};

type VehicleRow = {
  id: string;
  owner_email?: string | null;
  owner_id?: string | null; // if your schema has it
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  color?: string | null;
  vin?: string | null;
  license_plate?: string | null;
  insurance_carrier?: string | null;
  body_type?: string | null;
  is_default?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeParamId(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return null;
}

function normEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

function formatDT(s?: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s ?? "");
  }
}

function formatD(s?: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return String(s ?? "");
  }
}

function moneyFromCents(cents: any) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return (n / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function normStatus(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function statusPill(status: string) {
  const s = normStatus(status);

  if (["paid", "complete", "completed", "settled"].includes(s)) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }
  if (["draft", "sent", "open", "unpaid", "due", "pending"].includes(s)) {
    return "border-sky-400/30 bg-sky-500/15 text-sky-200";
  }
  if (["cancelled", "canceled", "void", "denied"].includes(s)) {
    return "border-rose-400/30 bg-rose-500/15 text-rose-200";
  }
  return "border-white/15 bg-white/5 text-slate-200";
}

/**
 * Portal “active” detector (ADMIN)
 */
function isPortalActivatedFromUserRow(u: AnyObj) {
  return Boolean(
    u?.auth_user_id ||
      u?.portal_activated_at ||
      u?.portal_active ||
      u?.password_set ||
      u?.has_password ||
      u?.activated_at
  );
}

function isInviteCompleted(inv: AnyObj) {
  return Boolean(
    inv?.used_at || inv?.accepted_at || inv?.completed_at || inv?.activated_at
  );
}

function GGBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      <div className="absolute inset-0 opacity-[0.075] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-48 -left-40 h-[34rem] w-[34rem] rounded-full bg-cyan-500/22 blur-3xl" />
      <div className="absolute -bottom-56 -right-44 h-[38rem] w-[38rem] rounded-full bg-emerald-500/18 blur-3xl" />
      <div className="absolute top-[35%] left-[55%] h-[28rem] w-[28rem] rounded-full bg-indigo-500/14 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/65 to-slate-950" />
    </div>
  );
}

function GradientBorderCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative rounded-2xl p-[1px]",
        "bg-gradient-to-br from-white/12 via-white/6 to-transparent",
        className
      )}
    >
      <div className="rounded-2xl bg-slate-950/55 backdrop-blur-xl border border-white/10">
        {children}
      </div>
    </div>
  );
}

function uniqById(rows: AnyObj[]) {
  const m = new Map<string, AnyObj>();
  for (const r of rows) {
    const k = String(r?.id ?? "");
    if (!k) continue;
    if (!m.has(k)) m.set(k, r);
  }
  return Array.from(m.values());
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function safeDateMs(v: any) {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Safely try to query table by an optional column that might not exist.
 * If the column doesn’t exist (or RLS blocks), return [] without killing the whole page.
 */
async function safeEqQuery(table: string, column: string, value: any) {
  try {
    const res = await (supabaseClient.from(table) as any)
      .select("*")
      .eq(column, value)
      .order("created_at", { ascending: false });

    if (res.error) return [];
    return res.data ?? [];
  } catch {
    return [];
  }
}

/* ----------------------- Data fetchers ----------------------- */

async function fetchAppUserById(id: string) {
  const { data, error } = await supabaseClient
    .from("app_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Customer not found.");
  return data as AppUserRow;
}

async function fetchLatestInviteByEmail(email?: string | null) {
  const clean = normEmail(email);
  if (!clean) return null;

  const { data, error } = await (supabaseClient.from("user_invites") as any)
    .select(
      "id, full_name, email, phone, code, created_at, used_at, tech_email, created_by_tech_email"
    )
    .ilike("email", clean)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null; // soft fail
  return (data ?? null) as InviteRow | null;
}

/**
 * Vehicles
 */
async function fetchVehiclesForCustomer(args: {
  email?: string | null;
  customerId: string;
}) {
  const clean = normEmail(args.email);
  const collected: AnyObj[] = [];

  if (clean) {
    const byEmail = await (supabaseClient.from("vehicles") as any)
      .select("*")
      .ilike("owner_email", clean)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (!byEmail.error) collected.push(...(byEmail.data ?? []));
  }

  collected.push(...(await safeEqQuery("vehicles", "owner_id", args.customerId)));
  collected.push(
    ...((await safeEqQuery("vehicles", "customer_id", args.customerId)) ?? [])
  );
  collected.push(
    ...((await safeEqQuery("vehicles", "app_user_id", args.customerId)) ?? [])
  );

  const out = uniqById(collected) as VehicleRow[];
  out.sort((a: any, b: any) => {
    const ad = a?.is_default ? 0 : 1;
    const bd = b?.is_default ? 0 : 1;
    if (ad !== bd) return ad - bd;
    const at = safeDateMs(a?.created_at);
    const bt = safeDateMs(b?.created_at);
    return at - bt;
  });
  return out;
}

/**
 * Invoices
 */
async function fetchInvoicesForCustomer(args: {
  email?: string | null;
  customerId: string;
}) {
  const clean = normEmail(args.email);
  const collected: AnyObj[] = [];

  if (clean) {
    const byEmail = await supabaseClient
      .from("tech_invoices")
      .select(
        [
          "id",
          "invoice_number",
          "technician_email",
          "client_id",
          "vehicle_id",
          "customer_email",
          "customer_name",
          "service_address",
          "appointment_snapshot",
          "invoice_date",
          "status",
          "subtotal_cents",
          "discount_cents",
          "tax_cents",
          "total_cents",
          "created_at",
          "paid_at",
        ].join(",")
      )
      .ilike("customer_email", clean)
      .order("invoice_date", { ascending: false });

    if (!byEmail.error) collected.push(...(byEmail.data ?? []));
  }

  const byClientId = await supabaseClient
    .from("tech_invoices")
    .select(
      [
        "id",
        "invoice_number",
        "technician_email",
        "client_id",
        "vehicle_id",
        "customer_email",
        "customer_name",
        "service_address",
        "appointment_snapshot",
        "invoice_date",
        "status",
        "subtotal_cents",
        "discount_cents",
        "tax_cents",
        "total_cents",
        "created_at",
        "paid_at",
      ].join(",")
    )
    .eq("client_id", args.customerId)
    .order("invoice_date", { ascending: false });

  if (!byClientId.error) collected.push(...(byClientId.data ?? []));

  // legacy fallback only if needed
  if (collected.length === 0) {
    if (clean) {
      const legacyByEmail = await supabaseClient
        .from("invoices")
        .select("*")
        .ilike("customer_email", clean)
        .order("invoice_date", { ascending: false });

      if (!legacyByEmail.error) collected.push(...(legacyByEmail.data ?? []));
    }
    const legacyByClient = await safeEqQuery("invoices", "client_id", args.customerId);
    collected.push(...(legacyByClient ?? []));
  }

  const out = uniqById(collected) as TechInvoiceRow[];
  out.sort((a: any, b: any) => {
    const at = safeDateMs(a?.invoice_date || a?.created_at);
    const bt = safeDateMs(b?.invoice_date || b?.created_at);
    return bt - at;
  });
  return out;
}

/**
 * Warranties
 */
async function fetchWarrantiesForCustomer(args: {
  email?: string | null;
  customerId: string;
  invoiceIds: string[];
}) {
  const clean = normEmail(args.email);
  const invoiceIds = (args.invoiceIds ?? []).filter(Boolean);

  const collected: AnyObj[] = [];

  if (clean) {
    const byEmail = await (supabaseClient.from("warranties") as any)
      .select("*")
      .ilike("customer_email", clean)
      .order("created_at", { ascending: false });

    if (!byEmail.error) collected.push(...(byEmail.data ?? []));
  }

  collected.push(...(await safeEqQuery("warranties", "customer_id", args.customerId)));
  collected.push(...(await safeEqQuery("warranties", "app_user_id", args.customerId)));
  collected.push(...(await safeEqQuery("warranties", "client_id", args.customerId)));

  if (invoiceIds.length > 0) {
    const parts = chunk(invoiceIds, 25);
    for (const ids of parts) {
      const byInvoice = await (supabaseClient.from("warranties") as any)
        .select("*")
        .in("invoice_id", ids)
        .order("created_at", { ascending: false });

      if (!byInvoice.error) collected.push(...(byInvoice.data ?? []));
    }
  }

  return uniqById(collected);
}

async function updateAppUser(id: string, patch: Partial<AppUserRow>) {
  const { data, error } = await supabaseClient
    .from("app_users")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as AppUserRow;
}

async function updateVehicle(id: string, patch: Partial<VehicleRow>) {
  // IMPORTANT: ask supabase to return updated row. If RLS blocks UPDATE, supabase returns error.
  const { data, error } = await (supabaseClient.from("vehicles") as any)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Vehicle update returned no row (UPDATE may be blocked by RLS).");
  return data as VehicleRow;
}

function formatSupabaseError(e: any) {
  if (!e) return "Unknown error.";
  const msg = String(e?.message ?? e ?? "Unknown error.");
  const code = e?.code ? `code: ${e.code}` : "";
  const details = e?.details ? `details: ${e.details}` : "";
  const hint = e?.hint ? `hint: ${e.hint}` : "";
  return [msg, code, details, hint].filter(Boolean).join(" | ");
}

function toFiniteYearOrNull(v: any): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const dynamic = "force-dynamic";

export default function AdminCustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();

  const customerId = safeParamId((params as AnyObj)?.id);

  const onBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/admin/portal/customers");
  }, [router]);

  // ✅ NEW: deep-link helpers for invoice/warranty details
  const goToWarranty = React.useCallback(
    (warrantyId: string) => {
      if (!warrantyId) return;
      router.push(`/admin/portal/warranties/${warrantyId}`);
    },
    [router]
  );

  // No invoices/[id] page exists — send them to invoices list with a pre-filter.
  // This keeps your UX clean and still gets them to “further details”.
  const goToInvoice = React.useCallback(
    (invoice: AnyObj) => {
      const id = String(invoice?.id ?? "").trim();
      const invoiceNumber = String(invoice?.invoice_number ?? "").trim();

      // Prefer ID if you have it, otherwise try invoice_number
      const q = new URLSearchParams();
      if (id) q.set("invoiceId", id);
      else if (invoiceNumber) q.set("invoiceNumber", invoiceNumber);

      const qs = q.toString();
      router.push(`/admin/portal/invoices${qs ? `?${qs}` : ""}`);
    },
    [router]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin:customer:detail:v3", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) throw new Error("Missing customer id in route.");

      const user = await fetchAppUserById(customerId);
      const email = normEmail(user.email);

      const invite = await fetchLatestInviteByEmail(email);

      const invoices = await fetchInvoicesForCustomer({ email, customerId });
      const invoiceIds = invoices.map((i: any) => String(i.id)).filter(Boolean);

      const [vehicles, warranties] = await Promise.all([
        fetchVehiclesForCustomer({ email, customerId }),
        fetchWarrantiesForCustomer({ email, customerId, invoiceIds }),
      ]);

      return { user, invite, vehicles, invoices, warranties };
    },
    staleTime: 15_000,
  });

  const user = (data?.user as AppUserRow | undefined) ?? undefined;
  const invite = (data?.invite as InviteRow | null | undefined) ?? null;
  const vehicles = (data?.vehicles as VehicleRow[]) ?? [];
  const invoices = (data?.invoices as TechInvoiceRow[]) ?? [];
  const warranties = (data?.warranties as AnyObj[]) ?? [];

  const email = normEmail(user?.email);
  const isPortalActive = user ? isPortalActivatedFromUserRow(user) : false;

  const inviteExists = !!invite?.id;
  const inviteCompleted = invite ? isInviteCompleted(invite) : false;
  const isPending = inviteExists && !isPortalActive && !inviteCompleted;

  const resolvedName =
    user?.full_name ||
    invite?.full_name ||
    (user?.email ? user.email.split("@")[0] : "Customer");

  const openInvoices = invoices.filter((i) =>
    ["draft", "sent", "open", "unpaid", "due", "pending"].includes(normStatus(i.status))
  );
  const paidInvoices = invoices.filter((i) =>
    ["paid", "complete", "completed", "settled"].includes(normStatus(i.status))
  );

  const openTotalCents = openInvoices.reduce(
    (sum, i) => sum + (Number(i.total_cents) || 0),
    0
  );
  const paidTotalCents = paidInvoices.reduce(
    (sum, i) => sum + (Number(i.total_cents) || 0),
    0
  );

  /* ----------------------- Editable user form ----------------------- */

  const [draft, setDraft] = React.useState<Partial<AppUserRow>>({});
  const [notice, setNotice] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setDraft({
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      address_line1: (user as any).address_line1 ?? "",
      address_line2: (user as any).address_line2 ?? "",
      city: (user as any).city ?? "",
      state: (user as any).state ?? "",
      zip: (user as any).zip ?? "",
      notes: (user as any).notes ?? "",
    });
    setNotice(null);
    setSaveErr(null);
  }, [user?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error("Missing customer id.");
      setSaveErr(null);
      setNotice(null);

      const patch: Partial<AppUserRow> = {
        full_name: (draft.full_name ?? "").toString().trim() || null,
        email: (draft.email ?? "").toString().trim().toLowerCase() || null,
        phone: (draft.phone ?? "").toString().trim() || null,
        ...(draft.address_line1 !== undefined
          ? { address_line1: (draft.address_line1 as any) || null }
          : {}),
        ...(draft.address_line2 !== undefined
          ? { address_line2: (draft.address_line2 as any) || null }
          : {}),
        ...(draft.city !== undefined ? { city: (draft.city as any) || null } : {}),
        ...(draft.state !== undefined ? { state: (draft.state as any) || null } : {}),
        ...(draft.zip !== undefined ? { zip: (draft.zip as any) || null } : {}),
        ...(draft.notes !== undefined ? { notes: (draft.notes as any) || null } : {}),
      };

      return await updateAppUser(customerId, patch);
    },
    onSuccess: async () => {
      setNotice("Saved.");
      await queryClient.invalidateQueries({
        queryKey: ["admin:customer:detail:v3", customerId],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin:customers"] });
    },
    onError: (e: any) => setSaveErr(formatSupabaseError(e)),
  });

  /* ----------------------- Editable vehicle form + DEBUG ----------------------- */

  const [vehicleDrafts, setVehicleDrafts] = React.useState<
    Record<string, Partial<VehicleRow>>
  >({});
  const [vehicleNotices, setVehicleNotices] = React.useState<
    Record<string, string | null>
  >({});
  const [vehicleErrors, setVehicleErrors] = React.useState<
    Record<string, string | null>
  >({});
  const [vehicleDebugOpen, setVehicleDebugOpen] = React.useState<
    Record<string, boolean>
  >({});
  const [vehicleDebugLast, setVehicleDebugLast] = React.useState<
    Record<string, AnyObj | null>
  >({});
  const [savingVehicleId, setSavingVehicleId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const seed: Record<string, Partial<VehicleRow>> = {};
    for (const v of vehicles) {
      seed[v.id] = {
        make: v.make ?? "",
        model: v.model ?? "",
        year: v.year ?? "",
        color: v.color ?? "",
        vin: v.vin ?? "",
        license_plate: v.license_plate ?? "",
        insurance_carrier: v.insurance_carrier ?? "",
        body_type: v.body_type ?? "",
        is_default: Boolean(v.is_default),
      };
    }
    setVehicleDrafts(seed);
    setVehicleNotices({});
    setVehicleErrors({});
    setVehicleDebugLast({});
    setSavingVehicleId(null);
  }, [vehicles.map((v) => v.id).join("|")]);

  const updateVehicleMutation = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<VehicleRow> }) => {
      return await updateVehicle(args.id, args.patch);
    },
    onSuccess: async (updatedRow, vars) => {
      // optimistic: immediately update local drafts with returned row (prevents "revert" feel)
      setVehicleDrafts((m) => ({
        ...m,
        [vars.id]: {
          make: updatedRow.make ?? "",
          model: updatedRow.model ?? "",
          year: updatedRow.year ?? "",
          color: updatedRow.color ?? "",
          vin: updatedRow.vin ?? "",
          license_plate: updatedRow.license_plate ?? "",
          insurance_carrier: updatedRow.insurance_carrier ?? "",
          body_type: updatedRow.body_type ?? "",
          is_default: Boolean(updatedRow.is_default),
        },
      }));

      setVehicleNotices((m) => ({ ...m, [vars.id]: "Saved." }));
      setVehicleErrors((m) => ({ ...m, [vars.id]: null }));
      setSavingVehicleId(null);

      await queryClient.invalidateQueries({
        queryKey: ["admin:customer:detail:v3", customerId],
      });
    },
    onError: (e: any, vars) => {
      const msg = formatSupabaseError(e);

      // HARD show it + console (even if you think “no errors”)
      console.error("[Admin Vehicle Update Error]", {
        vehicleId: vars?.id,
        error: e,
        message: msg,
      });

      setVehicleErrors((m) => ({ ...m, [vars.id]: msg }));
      setVehicleNotices((m) => ({ ...m, [vars.id]: null }));
      setSavingVehicleId(null);
    },
  });

  const primaryWarrantyId =
    warranties.find((w) => normEmail(w.customer_email) === email)?.id ??
    warranties[0]?.id ??
    undefined;

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <GGBackground />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className={cx(
              "w-fit border-white/15 bg-white/5 text-white hover:bg-white/10",
              "backdrop-blur"
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="border-white/15 bg-white/5 text-white"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Admin View
            </Badge>

            {user?.invite_code ? (
              <Badge
                variant="outline"
                className="border-white/15 bg-white/5 text-slate-200"
              >
                <Hash className="w-3.5 h-3.5 mr-1.5" />
                {user.invite_code}
              </Badge>
            ) : null}

            {/* Portal status */}
            {isPortalActive ? (
              <Badge className="border-cyan-400/30 bg-cyan-500/15 text-cyan-200">
                <BadgeCheck className="w-3.5 h-3.5 mr-1.5" />
                Portal Active
              </Badge>
            ) : isPending ? (
              <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-200">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Pending Activation
              </Badge>
            ) : (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                <Ban className="w-3.5 h-3.5 mr-1.5" />
                Portal Inactive
              </Badge>
            )}

            <Badge
              variant="outline"
              className="border-white/15 bg-white/5 text-white"
            >
              {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/15 bg-white/5 text-white"
            >
              {warranties.length} warrant{warranties.length === 1 ? "y" : "ies"}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/15 bg-white/5 text-white"
            >
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
            </Badge>

            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              {isFetching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refreshing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </span>
              )}
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <GradientBorderCard>
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl text-white">
                      {resolvedName}
                    </CardTitle>

                    <div className="mt-2 space-y-1 text-sm text-slate-300">
                      {user?.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="break-all">{user.email}</span>
                        </div>
                      ) : null}

                      {user?.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span>{user.phone}</span>
                        </div>
                      ) : null}

                      {(user as any)?.address_line1 || (user as any)?.city ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">
                            {[
                              (user as any)?.address_line1,
                              (user as any)?.address_line2,
                              (user as any)?.city,
                              (user as any)?.state,
                              (user as any)?.zip,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {user?.created_at ? (
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-white/5 text-slate-200"
                        >
                          <Calendar className="w-3.5 h-3.5 mr-1.5" />
                          Created: {formatDT(user.created_at)}
                        </Badge>
                      ) : null}

                      {user?.updated_at ? (
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-white/5 text-slate-200"
                        >
                          <Clock className="w-3.5 h-3.5 mr-1.5" />
                          Updated: {formatDT(user.updated_at)}
                        </Badge>
                      ) : null}

                      {invite?.created_at ? (
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-white/5 text-slate-200"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          Invite: {formatDT(invite.created_at)}
                        </Badge>
                      ) : null}

                      {invite?.used_at ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Joined: {formatDT(invite.used_at)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {user?.email ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          (window.location.href = `mailto:${user.email}`)
                        }
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Email
                      </Button>
                    ) : null}

                    {user?.phone ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          (window.location.href = `tel:${user.phone}`)
                        }
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Call
                      </Button>
                    ) : null}

                    {!isPortalActive && user?.email && primaryWarrantyId ? (
                      <div className="min-w-[240px]">
                        <GenerateMagicLinkButton
                          email={user.email}
                          warrantyId={primaryWarrantyId}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-6">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading customer…</span>
                  </div>
                ) : null}

                {isError ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 mt-0.5" />
                      <div className="w-full">
                        <p className="font-semibold">Couldn’t load customer</p>
                        <p className="text-sm text-red-100/90 mt-1">
                          {(error as Error)?.message || "Failed to load customer."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={() => refetch()}
                            disabled={isFetching}
                          >
                            {isFetching ? "Retrying…" : "Retry"}
                          </Button>
                          <Button
                            variant="outline"
                            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={onBack}
                          >
                            Go back
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!isLoading && !isError && user ? (
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* LEFT column */}
                    <div className="lg:col-span-1 space-y-4">
                      {/* Admin editable profile */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <NotebookPen className="w-4 h-4 text-slate-200" />
                              Customer Profile (Editable)
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-3">
                            {notice ? (
                              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                                {notice}
                              </div>
                            ) : null}
                            {saveErr ? (
                              <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                                {saveErr}
                              </div>
                            ) : null}

                            <div className="space-y-1">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Full name
                              </div>
                              <Input
                                value={(draft.full_name as any) ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    full_name: e.target.value,
                                  }))
                                }
                                className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                placeholder="Customer name"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Email
                              </div>
                              <Input
                                value={(draft.email as any) ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    email: e.target.value,
                                  }))
                                }
                                className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                placeholder="customer@email.com"
                              />
                              <p className="text-xs text-slate-400">
                                If you change email, it affects matching for
                                vehicles/invoices/warranties.
                              </p>
                            </div>

                            <div className="space-y-1">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Phone
                              </div>
                              <Input
                                value={(draft.phone as any) ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    phone: e.target.value,
                                  }))
                                }
                                className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                placeholder="(555) 555-5555"
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-2 pt-2">
                              <Button
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending}
                                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.45)]"
                              >
                                {saveMutation.isPending ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving…
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    Save changes
                                  </span>
                                )}
                              </Button>

                              <Button
                                variant="outline"
                                onClick={() => {
                                  setDraft({
                                    full_name: user.full_name ?? "",
                                    email: user.email ?? "",
                                    phone: user.phone ?? "",
                                    address_line1: (user as any).address_line1 ?? "",
                                    address_line2: (user as any).address_line2 ?? "",
                                    city: (user as any).city ?? "",
                                    state: (user as any).state ?? "",
                                    zip: (user as any).zip ?? "",
                                    notes: (user as any).notes ?? "",
                                  });
                                  setNotice("Reverted.");
                                  setSaveErr(null);
                                }}
                                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                              >
                                Revert
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* Address + notes */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-200" />
                              Address + Notes
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-3">
                            <Input
                              value={(draft.address_line1 as any) ?? ""}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  address_line1: e.target.value,
                                }))
                              }
                              className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                              placeholder="Address line 1"
                            />
                            <Input
                              value={(draft.address_line2 as any) ?? ""}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  address_line2: e.target.value,
                                }))
                              }
                              className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                              placeholder="Address line 2"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <Input
                                value={(draft.city as any) ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, city: e.target.value }))
                                }
                                className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                placeholder="City"
                              />
                              <Input
                                value={(draft.state as any) ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, state: e.target.value }))
                                }
                                className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                placeholder="State"
                              />
                              <Input
                                value={(draft.zip as any) ?? ""}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, zip: e.target.value }))
                                }
                                className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                placeholder="ZIP"
                              />
                            </div>

                            <Textarea
                              value={(draft.notes as any) ?? ""}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, notes: e.target.value }))
                              }
                              className="min-h-[110px] bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                              placeholder="Internal admin notes (visible only to staff)…"
                            />
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* Totals */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <BadgeDollarSign className="w-4 h-4 text-slate-200" />
                              Invoice Totals
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Open
                              </div>
                              <div className="mt-1 text-slate-100 font-semibold tabular-nums">
                                {moneyFromCents(openTotalCents) ?? "$0.00"}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Paid
                              </div>
                              <div className="mt-1 text-slate-100 font-semibold tabular-nums">
                                {moneyFromCents(paidTotalCents) ?? "$0.00"}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* Portal intelligence */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <Info className="w-4 h-4 text-slate-200" />
                              Portal Intelligence
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Signals
                              </div>
                              <div className="mt-2 space-y-1 text-slate-200">
                                <div>
                                  auth_user_id:{" "}
                                  <span className="text-white font-semibold">
                                    {user.auth_user_id ? "yes" : "no"}
                                  </span>
                                </div>
                                <div>
                                  invite exists:{" "}
                                  <span className="text-white font-semibold">
                                    {inviteExists ? "yes" : "no"}
                                  </span>
                                </div>
                                <div>
                                  invite used_at:{" "}
                                  <span className="text-white font-semibold">
                                    {invite?.used_at ? "yes" : "no"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {user.created_by_tech ? (
                              <div className="text-xs text-slate-300">
                                Created by tech:{" "}
                                <span className="text-slate-100">
                                  {user.created_by_tech}
                                </span>
                              </div>
                            ) : invite?.created_by_tech_email ? (
                              <div className="text-xs text-slate-300">
                                Invite created by:{" "}
                                <span className="text-slate-100">
                                  {invite.created_by_tech_email}
                                </span>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>
                    </div>

                    {/* RIGHT column */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* GARAGE (EDITABLE) */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <Car className="w-4 h-4 text-slate-200" />
                              Garage (Editable)
                            </CardTitle>
                            {vehicles.some((v) => v.is_default) ? (
                              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                                Default set
                              </Badge>
                            ) : null}
                          </CardHeader>

                          <CardContent className="space-y-4">
                            {vehicles.length === 0 ? (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                No vehicles found for{" "}
                                <span className="text-white font-semibold">
                                  {user.email}
                                </span>
                                .
                              </div>
                            ) : (
                              <div className="grid md:grid-cols-2 gap-4">
                                {vehicles.map((vehicle, idx) => {
                                  const vd = vehicleDrafts[vehicle.id] ?? {};
                                  const noticeV = vehicleNotices[vehicle.id] ?? null;
                                  const errV = vehicleErrors[vehicle.id] ?? null;
                                  const debugOpen = !!vehicleDebugOpen[vehicle.id];
                                  const last = vehicleDebugLast[vehicle.id] ?? null;

                                  const yearNum = toFiniteYearOrNull(vd.year);

                                  const canPreview =
                                    Boolean(vd.make?.toString().trim()) &&
                                    Boolean(vd.model?.toString().trim());

                                  const savingThis =
                                    savingVehicleId === vehicle.id ||
                                    (updateVehicleMutation.isPending &&
                                      savingVehicleId === vehicle.id);

                                  return (
                                    <div
                                      key={`vehicle-${vehicle?.id || vehicle?.vin || idx}`}
                                      className="rounded-2xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent"
                                    >
                                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl p-4 space-y-3">
                                        {canPreview ? (
                                          <VehicleImageDisplay
                                            make={(vd.make as any) || ""}
                                            model={(vd.model as any) || ""}
                                            year={yearNum ?? undefined}
                                            color={(vd.color as any) || "#FFFFFF"}
                                            className="h-40"
                                          />
                                        ) : (
                                          <div className="h-40 rounded-xl border border-white/10 bg-white/5" />
                                        )}

                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-white font-semibold flex items-center gap-2">
                                            <Pencil className="w-4 h-4 text-slate-300" />
                                            Edit Vehicle
                                          </p>

                                          <div className="flex items-center gap-2">
                                            {vd.is_default ? (
                                              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                                                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                                Default
                                              </Badge>
                                            ) : null}

                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                setVehicleDebugOpen((m) => ({
                                                  ...m,
                                                  [vehicle.id]: !debugOpen,
                                                }))
                                              }
                                              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                                            >
                                              {debugOpen ? (
                                                <ChevronUp className="w-4 h-4" />
                                              ) : (
                                                <ChevronDown className="w-4 h-4" />
                                              )}
                                              <span className="ml-2">Debug</span>
                                            </Button>
                                          </div>
                                        </div>

                                        {noticeV ? (
                                          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                                            {noticeV}
                                          </div>
                                        ) : null}
                                        {errV ? (
                                          <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                                            {errV}
                                          </div>
                                        ) : null}

                                        {debugOpen ? (
                                          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200 space-y-2">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                              Live + last save info
                                            </div>
                                            <div className="space-y-1">
                                              <div>
                                                vehicle.id:{" "}
                                                <span className="font-mono text-slate-100">
                                                  {vehicle.id}
                                                </span>
                                              </div>
                                              <div>
                                                current db updated_at:{" "}
                                                <span className="font-mono text-slate-100">
                                                  {vehicle.updated_at || "—"}
                                                </span>
                                              </div>
                                            </div>
                                            {last ? (
                                              <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-slate-100">
                                                {JSON.stringify(last, null, 2)}
                                              </pre>
                                            ) : (
                                              <div className="text-slate-300">
                                                No save attempt captured yet.
                                              </div>
                                            )}
                                          </div>
                                        ) : null}

                                        <div className="grid grid-cols-2 gap-2">
                                          <Input
                                            value={(vd.year as any) ?? ""}
                                            onChange={(e) =>
                                              setVehicleDrafts((m) => ({
                                                ...m,
                                                [vehicle.id]: {
                                                  ...vd,
                                                  year: e.target.value,
                                                },
                                              }))
                                            }
                                            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                            placeholder="Year"
                                          />
                                          <Input
                                            value={(vd.color as any) ?? ""}
                                            onChange={(e) =>
                                              setVehicleDrafts((m) => ({
                                                ...m,
                                                [vehicle.id]: {
                                                  ...vd,
                                                  color: e.target.value,
                                                },
                                              }))
                                            }
                                            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                            placeholder="Color"
                                          />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                          <Input
                                            value={(vd.make as any) ?? ""}
                                            onChange={(e) =>
                                              setVehicleDrafts((m) => ({
                                                ...m,
                                                [vehicle.id]: {
                                                  ...vd,
                                                  make: e.target.value,
                                                },
                                              }))
                                            }
                                            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                            placeholder="Make"
                                          />
                                          <Input
                                            value={(vd.model as any) ?? ""}
                                            onChange={(e) =>
                                              setVehicleDrafts((m) => ({
                                                ...m,
                                                [vehicle.id]: {
                                                  ...vd,
                                                  model: e.target.value,
                                                },
                                              }))
                                            }
                                            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                            placeholder="Model"
                                          />
                                        </div>

                                        <Input
                                          value={(vd.vin as any) ?? ""}
                                          onChange={(e) =>
                                            setVehicleDrafts((m) => ({
                                              ...m,
                                              [vehicle.id]: {
                                                ...vd,
                                                vin: e.target.value,
                                              },
                                            }))
                                          }
                                          className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                          placeholder="VIN"
                                        />
                                        <Input
                                          value={(vd.license_plate as any) ?? ""}
                                          onChange={(e) =>
                                            setVehicleDrafts((m) => ({
                                              ...m,
                                              [vehicle.id]: {
                                                ...vd,
                                                license_plate: e.target.value,
                                              },
                                            }))
                                          }
                                          className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                          placeholder="License plate"
                                        />
                                        <Input
                                          value={(vd.insurance_carrier as any) ?? ""}
                                          onChange={(e) =>
                                            setVehicleDrafts((m) => ({
                                              ...m,
                                              [vehicle.id]: {
                                                ...vd,
                                                insurance_carrier: e.target.value,
                                              },
                                            }))
                                          }
                                          className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                          placeholder="Insurance carrier"
                                        />
                                        <Input
                                          value={(vd.body_type as any) ?? ""}
                                          onChange={(e) =>
                                            setVehicleDrafts((m) => ({
                                              ...m,
                                              [vehicle.id]: {
                                                ...vd,
                                                body_type: e.target.value,
                                              },
                                            }))
                                          }
                                          className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
                                          placeholder="Body type"
                                        />

                                        <div className="flex items-center justify-between gap-2 pt-1">
                                          <Button
                                            variant="outline"
                                            onClick={() =>
                                              setVehicleDrafts((m) => ({
                                                ...m,
                                                [vehicle.id]: {
                                                  ...vd,
                                                  is_default: !vd.is_default,
                                                },
                                              }))
                                            }
                                            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                                          >
                                            {vd.is_default
                                              ? "Unset Default"
                                              : "Set Default"}
                                          </Button>

                                          <Button
                                            onClick={async () => {
                                              setVehicleNotices((m) => ({
                                                ...m,
                                                [vehicle.id]: null,
                                              }));
                                              setVehicleErrors((m) => ({
                                                ...m,
                                                [vehicle.id]: null,
                                              }));

                                              const patch: Partial<VehicleRow> = {
                                                year: toFiniteYearOrNull(vd.year),
                                                make:
                                                  (vd.make ?? "").toString().trim() ||
                                                  null,
                                                model:
                                                  (vd.model ?? "").toString().trim() ||
                                                  null,
                                                color:
                                                  (vd.color ?? "").toString().trim() ||
                                                  null,
                                                vin:
                                                  (vd.vin ?? "").toString().trim() ||
                                                  null,
                                                license_plate:
                                                  (vd.license_plate ?? "")
                                                    .toString()
                                                    .trim() || null,
                                                insurance_carrier:
                                                  (vd.insurance_carrier ?? "")
                                                    .toString()
                                                    .trim() || null,
                                                body_type:
                                                  (vd.body_type ?? "")
                                                    .toString()
                                                    .trim() || null,
                                                is_default: Boolean(vd.is_default),
                                              };

                                              const debugPayload = {
                                                ts: new Date().toISOString(),
                                                patch_sent: patch,
                                              };
                                              setVehicleDebugLast((m) => ({
                                                ...m,
                                                [vehicle.id]: debugPayload,
                                              }));

                                              console.log(
                                                "[Admin Vehicle Update Attempt]",
                                                { vehicleId: vehicle.id, patch }
                                              );

                                              setSavingVehicleId(vehicle.id);

                                              try {
                                                await updateVehicleMutation.mutateAsync({
                                                  id: vehicle.id,
                                                  patch,
                                                });

                                                setVehicleDebugLast((m) => ({
                                                  ...m,
                                                  [vehicle.id]: {
                                                    ...debugPayload,
                                                    result: "success",
                                                  },
                                                }));
                                              } catch (e: any) {
                                                const msg = formatSupabaseError(e);
                                                setVehicleDebugLast((m) => ({
                                                  ...m,
                                                  [vehicle.id]: {
                                                    ...debugPayload,
                                                    result: "error",
                                                    error: {
                                                      message: e?.message,
                                                      code: e?.code,
                                                      details: e?.details,
                                                      hint: e?.hint,
                                                      formatted: msg,
                                                    },
                                                  },
                                                }));
                                              }
                                            }}
                                            disabled={savingThis}
                                            className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.35)]"
                                          >
                                            {savingThis ? (
                                              <span className="inline-flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Saving…
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-2">
                                                <Save className="w-4 h-4" />
                                                Save
                                              </span>
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* WARRANTIES */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-200" />
                              Warranties
                            </CardTitle>
                            <Badge
                              variant="outline"
                              className="border-white/15 bg-white/5 text-white"
                            >
                              {warranties.length} total
                            </Badge>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            {warranties.length === 0 ? (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                No warranties found for this customer.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {warranties.map((w, idx) => {
                                  const wStatus = normStatus(w?.status);
                                  const exp =
                                    w?.expiration_date ?? w?.expires_at ?? null;
                                  const svc = w?.service_date ?? null;

                                  const isClickable = Boolean(w?.id);
                                  const showCta =
                                    ["draft", "sent", "open", "unpaid", "due", "pending", "active"].includes(
                                      normStatus(w?.status)
                                    ) || Boolean(w?.is_active);

                                  return (
                                    <button
                                      type="button"
                                      key={`warranty-${w?.id || w?.warranty_number || idx}`}
                                      onClick={() => (w?.id ? goToWarranty(String(w.id)) : null)}
                                      disabled={!isClickable}
                                      className={cx(
                                        "relative w-full text-left overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl p-4",
                                        "transition hover:bg-white/[0.07] hover:border-white/20",
                                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-0",
                                        !isClickable && "opacity-70 cursor-not-allowed"
                                      )}
                                    >
                                      <div className="pointer-events-none absolute inset-y-0 -left-10 w-32 bg-gradient-to-r from-emerald-400/15 via-sky-400/5 to-transparent blur-3xl" />

                                      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-slate-50 font-semibold">
                                              Warranty{" "}
                                              {w?.warranty_number ? `#${w.warranty_number}` : ""}
                                            </p>
                                            <Badge className={cx(statusPill(wStatus))}>
                                              {w?.status || "unknown"}
                                            </Badge>
                                            {w?.is_active === false ? (
                                              <Badge className="border-rose-400/30 bg-rose-500/15 text-rose-200">
                                                inactive
                                              </Badge>
                                            ) : null}
                                          </div>

                                          {w?.service_performed ? (
                                            <p className="text-sm text-slate-300">
                                              {w.service_performed}
                                            </p>
                                          ) : null}

                                          <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                                            {svc ? <span>Service: {formatD(svc)}</span> : null}
                                            {exp ? <span>Expires: {formatD(exp)}</span> : null}
                                            {w?.coverage_type ? (
                                              <span>Coverage: {w.coverage_type}</span>
                                            ) : null}
                                            {w?.spot_location ? (
                                              <span>Spot: {w.spot_location}</span>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {w?.invoice_id ? (
                                            <Badge
                                              variant="outline"
                                              className="border-white/15 bg-white/5 text-slate-200"
                                            >
                                              Invoice: {String(w.invoice_id).slice(0, 8)}…
                                            </Badge>
                                          ) : null}

                                          {showCta ? (
                                            <span className="inline-flex items-center gap-2 text-xs text-slate-200 border border-white/15 bg-white/5 px-3 py-1.5 rounded-full">
                                              View details
                                              <ArrowRight className="w-3.5 h-3.5" />
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-2 text-xs text-slate-300 border border-white/10 bg-white/[0.03] px-3 py-1.5 rounded-full">
                                              Open
                                              <ArrowRight className="w-3.5 h-3.5" />
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* INVOICES */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-slate-200" />
                              Invoices
                            </CardTitle>
                            <div className="flex gap-2">
                              <Badge className="border-sky-400/30 bg-sky-500/15 text-sky-200">
                                Open: {openInvoices.length}
                              </Badge>
                              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                                Paid: {paidInvoices.length}
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            {invoices.length === 0 ? (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                No invoices found for this customer.
                                <div className="mt-2 text-xs text-slate-400">
                                  This page checks both{" "}
                                  <span className="text-slate-200">customer_email</span>{" "}
                                  and <span className="text-slate-200">client_id</span>.
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {invoices.map((inv: AnyObj, idx) => {
                                  const invStatus = normStatus(inv?.status);
                                  const invNumber = inv?.invoice_number ?? inv?.id ?? "";
                                  const amount = moneyFromCents(inv?.total_cents) ?? "$0.00";
                                  const invDate = inv?.invoice_date ?? null;

                                  const isOpen = ["draft", "sent", "open", "unpaid", "due", "pending"].includes(
                                    invStatus
                                  );

                                  return (
                                    <button
                                      type="button"
                                      key={`invoice-${inv?.id || invNumber || idx}`}
                                      onClick={() => goToInvoice(inv)}
                                      className={cx(
                                        "relative w-full text-left overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl p-4",
                                        "transition hover:bg-white/[0.07] hover:border-white/20",
                                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-0"
                                      )}
                                    >
                                      <div className="pointer-events-none absolute inset-y-0 -left-10 w-32 bg-gradient-to-r from-sky-400/15 via-indigo-400/5 to-transparent blur-3xl" />

                                      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-slate-50 font-semibold">
                                              Invoice {String(invNumber)}
                                            </p>
                                            <Badge className={cx(statusPill(invStatus))}>
                                              {inv?.status || "unknown"}
                                            </Badge>
                                            {inv?.paid_at ? (
                                              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                                                Paid {formatD(inv.paid_at)}
                                              </Badge>
                                            ) : null}
                                          </div>

                                          <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                                            {invDate ? (
                                              <span>Invoice date: {formatD(invDate)}</span>
                                            ) : null}
                                            {inv?.created_at ? (
                                              <span>Created: {formatDT(inv.created_at)}</span>
                                            ) : null}
                                            {inv?.service_address ? (
                                              <span>Address: {inv.service_address}</span>
                                            ) : null}
                                            {inv?.technician_email ? (
                                              <span>Tech: {inv.technician_email}</span>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <Badge
                                            variant="outline"
                                            className="border-white/15 bg-white/5 text-slate-200"
                                          >
                                            {amount}
                                          </Badge>

                                          {/* ✅ CTA so it's obvious it’s clickable */}
                                          <span
                                            className={cx(
                                              "inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border",
                                              isOpen
                                                ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
                                                : "border-white/15 bg-white/5 text-slate-200"
                                            )}
                                          >
                                            View details
                                            <ArrowRight className="w-3.5 h-3.5" />
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>
      </div>
    </div>
  );
}