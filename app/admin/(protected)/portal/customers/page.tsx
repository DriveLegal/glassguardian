// app/admin/(protected)/portal/customers/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Users,
  Search,
  Mail,
  Phone,
  Car,
  Calendar,
  DollarSign,
  CheckCircle2,
  Shield,
  AlertTriangle,
  ArrowRight,
  Clock,
  Ban,
  UserRoundCog,
  ChevronRight,
  Send,
  Loader2,
  ArrowUpDown,
} from "lucide-react";

type AnyObj = Record<string, any>;

/** ---------------- Helpers ---------------- */

function moneyFromInvoice(inv: AnyObj): number {
  if (inv?.total_cents != null) {
    const n = Number(inv.total_cents);
    return Number.isFinite(n) ? n / 100 : 0;
  }
  if (inv?.total_amount != null) {
    const n = Number(inv.total_amount);
    return Number.isFinite(n) ? n : 0;
  }
  if (inv?.total != null) {
    const n = Number(inv.total);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function safeDateMs(v: any) {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * ✅ TRUE portal activation detector (does NOT treat auth_user_id as "active")
 */
function isPortalActivatedFromUserRow(u: AnyObj) {
  return Boolean(
    u?.portal_activated_at ||
      u?.portalActivatedAt ||
      u?.portal_active ||
      u?.portalActive ||
      u?.password_set ||
      u?.passwordSet ||
      u?.has_password ||
      u?.hasPassword ||
      u?.is_portal_active ||
      u?.isPortalActive ||
      u?.activated_at ||
      u?.activatedAt
  );
}

function isInviteCompleted(inv: AnyObj) {
  return Boolean(
    inv?.accepted_at ||
      inv?.acceptedAt ||
      inv?.used_at ||
      inv?.usedAt ||
      inv?.completed_at ||
      inv?.completedAt ||
      inv?.activated_at ||
      inv?.activatedAt ||
      inv?.is_used ||
      inv?.isUsed
  );
}

/** ---- data fetchers (reads only) ---- */

async function fetchCustomers(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function fetchAppointments(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function fetchVehicles(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function fetchInvoices(): Promise<AnyObj[]> {
  const tech = await supabaseClient
    .from("tech_invoices")
    .select("*")
    .order("invoice_date", { ascending: false });

  if (!tech.error) return tech.data ?? [];

  const legacy = await supabaseClient
    .from("invoices")
    .select("*")
    .order("invoice_date", { ascending: false });

  if (legacy.error) throw tech.error;
  return legacy.data ?? [];
}

/**
 * ✅ Warranties (expanded fields so Resend Invite can call email API reliably)
 * We keep id/customer_email/warranty_number, plus:
 * - expiration_date (or expires_at)
 * - service_date
 * - service_performed
 */
async function fetchWarranties(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("warranties")
    .select(
      "id, customer_email, warranty_number, expiration_date, expires_at, service_date, service_performed"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function fetchUserInvites(): Promise<AnyObj[]> {
  const res = await supabaseClient
    .from("user_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (res.error) return [];
  return res.data ?? [];
}

/** ---------------- Email: resend upgraded portal invite ---------------- */

type ResendInviteArgs = {
  email: string;
  fullName: string;
  warrantyNumber: string;
  warrantyExpiration: string;
  dateServicedPerformed: string;
  servicePerformed: string;
};

async function resendOldClientInvite(args: ResendInviteArgs) {
  const res = await fetch("/api/email/old-client-portal-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Email API returned non-OK. ${t ? `Body: ${t}` : ""}`);
  }

  return true;
}

function isoToYmd(value: any): string {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminCustomersPage() {
  const searchParams = useSearchParams();

  // Existing banner (from /new)
  const createdParam = searchParams.get("created");
  const inviteCode = searchParams.get("invite_code") || null;
  const showCreatedBanner = createdParam === "1";

  // Optional: banner for old-client invite redirect
  const oldInviteParam = searchParams.get("old_invite");
  const oldInviteEmail = searchParams.get("email");
  const oldInviteWarranty = searchParams.get("warranty");
  const showOldInviteBanner = oldInviteParam === "1";

  const highlightEmail = React.useMemo(
    () => normalizeEmail(oldInviteEmail),
    [oldInviteEmail]
  );

  const [search, setSearch] = React.useState("");

  // ✅ NEW: independent sort controls per section
  const [activeSortDir, setActiveSortDir] = React.useState<"desc" | "asc">("desc");
  const [pendingSortDir, setPendingSortDir] = React.useState<"desc" | "asc">("desc");

  const {
    data: customers = [],
    isLoading: loadingCustomers,
    error: customersError,
  } = useQuery({
    queryKey: ["admin:customers"],
    queryFn: fetchCustomers,
    staleTime: 15_000,
  });

  const {
    data: appointments = [],
    isLoading: loadingApts,
    error: apptsError,
  } = useQuery({
    queryKey: ["admin:appointments:all"],
    queryFn: fetchAppointments,
    staleTime: 15_000,
  });

  const {
    data: vehicles = [],
    isLoading: loadingVehicles,
    error: vehiclesError,
  } = useQuery({
    queryKey: ["admin:vehicles:all"],
    queryFn: fetchVehicles,
    staleTime: 15_000,
  });

  const {
    data: invoices = [],
    isLoading: loadingInvoices,
    error: invoicesError,
  } = useQuery({
    queryKey: ["admin:invoices:all"],
    queryFn: fetchInvoices,
    staleTime: 15_000,
  });

  const {
    data: warranties = [],
    isLoading: loadingWarranties,
    error: warrantiesError,
  } = useQuery({
    queryKey: ["admin:warranties:all"],
    queryFn: fetchWarranties,
    staleTime: 30_000,
  });

  const {
    data: userInvites = [],
    isLoading: loadingInvites,
    error: invitesError,
  } = useQuery({
    queryKey: ["admin:userInvites"],
    queryFn: fetchUserInvites,
    staleTime: 15_000,
  });

  const totalRevenue = React.useMemo(() => {
    return invoices.reduce(
      (sum: number, inv: AnyObj) => sum + moneyFromInvoice(inv),
      0
    );
  }, [invoices]);

  const filtered = React.useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter((c: AnyObj) => {
      const name = String(c.full_name ?? "").toLowerCase();
      const email = String(c.email ?? "").toLowerCase();
      const phone = String(c.phone ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [customers, search]);

  function getCustomerStats(customerEmail: string) {
    const ce = normalizeEmail(customerEmail);

    const appts = appointments.filter(
      (a: AnyObj) => normalizeEmail(a.customer_email) === ce
    );

    const cars = vehicles.filter(
      (v: AnyObj) => normalizeEmail(v.owner_email) === ce
    );

    const invs = invoices.filter(
      (i: AnyObj) => normalizeEmail(i.customer_email) === ce
    );

    const spent = invs.reduce(
      (sum: number, inv: AnyObj) => sum + moneyFromInvoice(inv),
      0
    );

    return {
      appointmentCount: appts.length,
      vehicleCount: cars.length,
      totalSpent: spent,
    };
  }

  const inviteByEmail = React.useMemo(() => {
    const m = new Map<string, AnyObj>();
    for (const inv of userInvites) {
      const e = normalizeEmail(inv?.email || inv?.customer_email);
      if (!e) continue;

      const prev = m.get(e);
      if (!prev) {
        m.set(e, inv);
        continue;
      }
      const prevTime = safeDateMs(prev?.created_at);
      const nextTime = safeDateMs(inv?.created_at);
      if (nextTime >= prevTime) m.set(e, inv);
    }
    return m;
  }, [userInvites]);

  const loading =
    loadingCustomers ||
    loadingApts ||
    loadingVehicles ||
    loadingInvoices ||
    loadingWarranties ||
    loadingInvites;

  const anyError =
    customersError ||
    apptsError ||
    vehiclesError ||
    invoicesError ||
    warrantiesError ||
    invitesError;

  // Per-email UI feedback for resend
  const [sentByEmail, setSentByEmail] = React.useState<Record<string, string>>(
    {}
  );

  const resendMutation = useMutation({
    mutationFn: resendOldClientInvite,
    onSuccess: (_ok, vars) => {
      const ce = normalizeEmail(vars.email);
      setSentByEmail((prev) => ({
        ...prev,
        [ce]: "Invite resent successfully.",
      }));
    },
    onError: (err: any, vars) => {
      const ce = normalizeEmail(vars.email);
      const msg =
        err instanceof Error
          ? err.message
          : "We couldn’t resend the invite. Double-check the email API route.";
      setSentByEmail((prev) => ({
        ...prev,
        [ce]: msg,
      }));
    },
  });

  /** ✅ Central portal status calc (used for grouping + card rendering consistency) */
  function getPortalStatus(customer: AnyObj) {
    const email = String(customer.email || "");
    const ce = normalizeEmail(email);

    const invite = inviteByEmail.get(ce);
    const inviteTableSignal = Boolean(invite);
    const invitedAt =
      customer?.portal_invited_at ||
      customer?.portalInvitedAt ||
      customer?.invited_at ||
      customer?.invitedAt ||
      customer?.portal_invite_sent_at ||
      customer?.portalInviteSentAt;

    const userRowInviteSignal = Boolean(invitedAt);
    const isInvited = inviteTableSignal || userRowInviteSignal;

    const hasActivationSignal = isPortalActivatedFromUserRow(customer);
    const hasAuthLink = Boolean(customer?.auth_user_id);

    const inviteCompletedFromTable = invite ? isInviteCompleted(invite) : false;
    const inviteCompleted = inviteCompletedFromTable || hasActivationSignal;

    const isPending = isInvited && !hasActivationSignal;
    const isActive = hasActivationSignal || (hasAuthLink && !isInvited);
    const isInactive = !isActive && !isPending;

    return { isActive, isPending, isInactive, inviteCompleted, ce, email };
  }

  /** ✅ Group first, then sort each group independently */
  const grouped = React.useMemo(() => {
    const active: AnyObj[] = [];
    const pending: AnyObj[] = [];
    const other: AnyObj[] = [];

    for (const c of filtered) {
      const s = getPortalStatus(c);
      if (s.isActive) active.push(c);
      else if (s.isPending) pending.push(c);
      else other.push(c);
    }

    active.sort((a, b) => {
      const am = safeDateMs(a?.created_at);
      const bm = safeDateMs(b?.created_at);
      return activeSortDir === "desc" ? bm - am : am - bm;
    });

    pending.sort((a, b) => {
      const am = safeDateMs(a?.created_at);
      const bm = safeDateMs(b?.created_at);
      return pendingSortDir === "desc" ? bm - am : am - bm;
    });

    // keep "other" stable (desc newest first by default)
    other.sort((a, b) => safeDateMs(b?.created_at) - safeDateMs(a?.created_at));

    return { active, pending, other, total: filtered.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, inviteByEmail, activeSortDir, pendingSortDir]);

  function SectionHeader({
    title,
    count,
    badgeClassName,
    subtitle,
    sortDir,
    onToggleSort,
    sortTone = "neutral",
  }: {
    title: string;
    count: number;
    subtitle?: string;
    badgeClassName: string;
    sortDir?: "desc" | "asc";
    onToggleSort?: () => void;
    sortTone?: "cyan" | "amber" | "neutral";
  }) {
    const sortBtnClass =
      sortTone === "cyan"
        ? "bg-cyan-500/10 border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/15"
        : sortTone === "amber"
        ? "bg-amber-500/10 border-amber-400/40 text-amber-100 hover:bg-amber-500/15"
        : "bg-slate-950/40 border-slate-700/60 text-slate-100 hover:bg-slate-900/60";

    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            <Badge className={badgeClassName}>{count}</Badge>
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        {sortDir && onToggleSort ? (
          <Button
            type="button"
            variant="outline"
            onClick={onToggleSort}
            className={[
              "h-9",
              "border",
              sortBtnClass,
              "backdrop-blur-md",
            ].join(" ")}
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortDir === "desc" ? "Newest → Oldest" : "Oldest → Newest"}
          </Button>
        ) : null}
      </div>
    );
  }

  function CustomerCard({ customer }: { customer: AnyObj }) {
    const id = String(customer.id || "");
    const name = (customer.full_name as string) || "No Name";

    const { isActive, isPending, isInactive, ce, email } = getPortalStatus(
      customer
    );

    const stats = getCustomerStats(email);
    const isHighlighted = !!highlightEmail && highlightEmail === ce;

    // Warranty data for resend
    const primaryWarranty = warranties.find(
      (w: AnyObj) => normalizeEmail(w.customer_email) === ce
    );

    const warrantyNumber = String(primaryWarranty?.warranty_number || "").trim();
    const warrantyExpiration =
      isoToYmd(primaryWarranty?.expiration_date) ||
      isoToYmd(primaryWarranty?.expires_at);

    const serviceDate = isoToYmd(primaryWarranty?.service_date);
    const servicePerformed = String(
      primaryWarranty?.service_performed || "Windshield repair"
    ).trim();

    const canResend =
      Boolean(email) &&
      Boolean(name) &&
      Boolean(warrantyNumber) &&
      Boolean(warrantyExpiration) &&
      Boolean(serviceDate);

    const isSendingThis =
      resendMutation.isPending &&
      normalizeEmail((resendMutation.variables as any)?.email) === ce;

    const statusMsg = sentByEmail[ce];

    const borderClass = isActive
      ? "border-cyan-400/70 hover:border-cyan-300/80 hover:shadow-[0_0_70px_rgba(34,211,238,0.45)]"
      : isPending
      ? "border-amber-400/80 hover:border-amber-300/90 hover:shadow-[0_0_70px_rgba(251,191,36,0.32)]"
      : isInactive
      ? "border-amber-500/45 hover:border-amber-400/60 hover:shadow-[0_0_70px_rgba(251,191,36,0.22)]"
      : "border-slate-700/80 hover:border-cyan-400/60 hover:shadow-[0_0_70px_rgba(34,211,238,0.35)]";

    const highlightGlow = isHighlighted
      ? isActive
        ? "shadow-[0_0_95px_rgba(34,211,238,0.22)]"
        : "shadow-[0_0_95px_rgba(251,191,36,0.22)]"
      : "shadow-[0_0_45px_rgba(15,23,42,0.95)]";

    return (
      <Card
        key={id || email}
        id={`customer-${encodeURIComponent(ce)}`}
        className={[
          "border bg-slate-900/70 backdrop-blur-xl transition-all duration-300",
          borderClass,
          highlightGlow,
        ].join(" ")}
      >
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Avatar / identity */}
            <div className="flex items-center gap-4 md:w-1/3">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.8)]">
                  <span className="text-slate-950 font-bold text-xl">
                    {name?.charAt(0)?.toUpperCase() ||
                      email?.charAt(0)?.toUpperCase() ||
                      "C"}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-50">{name}</h3>

                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-[11px] border-cyan-400/60 text-cyan-100 bg-cyan-500/10"
                  >
                    Customer
                  </Badge>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-cyan-100 bg-cyan-500/15 border border-cyan-400/60 px-2 py-0.5 rounded-full shadow-[0_0_16px_rgba(34,211,238,0.55)]">
                      <CheckCircle2 className="w-3 h-3" />
                      Portal Active
                    </span>
                  ) : isPending ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-100 bg-amber-500/15 border border-amber-400/60 px-2 py-0.5 rounded-full shadow-[0_0_16px_rgba(251,191,36,0.45)]">
                      <Clock className="w-3 h-3" />
                      Pending Activation
                    </span>
                  ) : isInactive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-100 bg-amber-500/10 border border-amber-500/35 px-2 py-0.5 rounded-full">
                      <Ban className="w-3 h-3" />
                      Portal Inactive
                    </span>
                  ) : null}

                  {isHighlighted && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-100 bg-slate-500/10 border border-slate-400/30 px-2 py-0.5 rounded-full">
                      <ArrowRight className="w-3 h-3" />
                      Recently invited
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Details + stats */}
            <div className="flex-1 grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-200 break-all">
                  <Mail className="w-4 h-4 text-cyan-300" />
                  <span>{email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Phone className="w-4 h-4 text-cyan-300" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {primaryWarranty?.warranty_number && (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Shield className="w-4 h-4 text-cyan-300" />
                    <span className="text-xs text-slate-300">
                      Warranty:{" "}
                      <span className="font-mono text-slate-100">
                        {primaryWarranty.warranty_number}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-200">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Calendar className="w-4 h-4 text-slate-300" />
                    Appointments
                  </span>
                  <span className="font-semibold">{stats.appointmentCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-200">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Car className="w-4 h-4 text-slate-300" />
                    Vehicles
                  </span>
                  <span className="font-semibold">{stats.vehicleCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-200">
                  <span className="flex items-center gap-1 text-slate-400">
                    <DollarSign className="w-4 h-4 text-slate-300" />
                    Lifetime Value
                  </span>
                  <span className="font-semibold text-emerald-300">
                    ${stats.totalSpent.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-stretch justify-center gap-2 min-w-[260px]">
              <Link href={`/admin/portal/customers/${encodeURIComponent(id)}`}>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-700 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.55)] hover:shadow-[0_0_35px_rgba(34,211,238,0.75)]"
                >
                  <UserRoundCog className="w-4 h-4 mr-2" />
                  Manage Customer
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>

              {/* ✅ Resend upgraded portal invite */}
              {!isActive && (
                <Button
                  size="sm"
                  type="button"
                  disabled={!canResend || isSendingThis}
                  onClick={() => {
                    setSentByEmail((prev) => {
                      const next = { ...prev };
                      delete next[ce];
                      return next;
                    });

                    resendMutation.mutate({
                      email,
                      fullName: name,
                      warrantyNumber,
                      warrantyExpiration,
                      dateServicedPerformed: serviceDate,
                      servicePerformed,
                    });
                  }}
                  className={[
                    "w-full text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)]",
                    canResend
                      ? "bg-emerald-500 hover:bg-emerald-400"
                      : "bg-slate-700/70 hover:bg-slate-700/70 cursor-not-allowed",
                  ].join(" ")}
                >
                  {isSendingThis ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resending invite…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Resend portal invite
                    </span>
                  )}
                </Button>
              )}

              {statusMsg && !isActive && (
                <div className="mt-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/90">
                  {statusMsg}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[radial-gradient(circle_at_top,_#1e293b_0,_#020617_40%,_#000000_100%)] text-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* Header + buttons */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                <Users className="w-6 h-6 text-slate-950" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Customer Galaxy
              </h1>
              <p className="text-sm text-slate-400">
                Search, inspect, and activate Glass Guardian portal access.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Link href="/admin/portal/customers/createoldclientportal">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.55)]">
                <Shield className="w-4 h-4 mr-2" />
                + Create Old Client Portal
              </Button>
            </Link>

            <Link href="/admin/portal/customers/new">
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.7)]">
                + New Customer
              </Button>
            </Link>
          </div>
        </div>

        {/* Banner: from /new */}
        {showCreatedBanner && (
          <div className="mb-6 rounded-md border border-emerald-500/80 bg-emerald-900/60 px-4 py-3 text-sm text-emerald-50 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Customer invite created successfully.</p>
              {inviteCode && inviteCode !== "Created" && (
                <p className="mt-1 text-xs">
                  <span className="text-emerald-100/90">Invite Code:</span>{" "}
                  <span className="font-mono tracking-[0.25em] text-emerald-50">
                    {inviteCode}
                  </span>
                </p>
              )}
              <p className="mt-1 text-xs text-emerald-100/80">
                We&apos;ve emailed them a link to create their account. You can
                now attach this customer to appointments, vehicles, and invoices.
              </p>
            </div>
          </div>
        )}

        {/* Banner: from old-client invite */}
        {showOldInviteBanner && (
          <div className="mb-6 rounded-md border border-cyan-400/70 bg-cyan-900/35 px-4 py-3 text-sm text-cyan-50 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-200" />
            <div className="flex-1">
              <p className="font-medium">Old client portal invite sent successfully.</p>

              {(oldInviteEmail || oldInviteWarranty) && (
                <p className="mt-1 text-xs text-cyan-100/80">
                  {oldInviteEmail ? (
                    <span className="mr-3">
                      <span className="text-cyan-100/90">Email:</span>{" "}
                      <span className="font-mono">{oldInviteEmail}</span>
                    </span>
                  ) : null}
                  {oldInviteWarranty ? (
                    <span>
                      <span className="text-cyan-100/90">Warranty:</span>{" "}
                      <span className="font-mono">{oldInviteWarranty}</span>
                    </span>
                  ) : null}
                </p>
              )}

              <p className="mt-1 text-xs text-cyan-100/80">
                They can now create a password and access their warranty + repair
                history.
              </p>

              {highlightEmail && (
                <div className="mt-3">
                  <a
                    href={`#customer-${encodeURIComponent(highlightEmail)}`}
                    className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-cyan-100"
                  >
                    Jump to customer <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {anyError && !loading && (
          <div className="mb-6 rounded-md border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Something failed while loading data.</p>
              <p className="mt-1 text-xs text-red-200/80">
                Check console for the exact Supabase error (likely table name
                mismatch or RLS).
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <Card className="mb-6 border border-cyan-500/10 bg-slate-900/60 backdrop-blur-xl shadow-[0_0_40px_rgba(15,23,42,0.85)]">
          <CardContent className="p-4 md:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-950/70 border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:border-cyan-400/70 shadow-[0_0_20px_rgba(15,23,42,0.8)]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border border-cyan-500/20 bg-gradient-to-br from-sky-500/20 via-cyan-500/10 to-slate-900/80 backdrop-blur-xl shadow-[0_0_50px_rgba(56,189,248,0.45)]">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.15em] text-cyan-200/90 mb-1">
                Total Customers
              </p>
              <p className="text-3xl font-semibold text-slate-50">
                {customers.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-slate-900/80 backdrop-blur-xl shadow-[0_0_50px_rgba(16,185,129,0.45)]">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.15em] text-emerald-200/90 mb-1">
                Total Revenue
              </p>
              <p className="text-3xl font-semibold text-emerald-100">
                ${totalRevenue.toFixed(0)}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-violet-500/20 bg-gradient-to-br from-violet-500/25 via-indigo-500/10 to-slate-900/80 backdrop-blur-xl shadow-[0_0_50px_rgba(129,140,248,0.45)]">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.15em] text-violet-200/90 mb-1">
                Total Vehicles
              </p>
              <p className="text-3xl font-semibold text-violet-100">
                {vehicles.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-amber-400/25 bg-gradient-to-br from-amber-400/25 via-orange-500/10 to-slate-900/80 backdrop-blur-xl shadow-[0_0_50px_rgba(251,191,36,0.4)]">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.15em] text-amber-100/90 mb-1">
                Total Services
              </p>
              <p className="text-3xl font-semibold text-amber-50">
                {appointments.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-24 text-center text-slate-400">
            <div className="mx-auto h-10 w-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_25px_rgba(34,211,238,0.75)]" />
            Loading customer constellation…
          </div>
        )}

        {/* Grouped Customer Lists */}
        {!loading && (
          <div className="space-y-10">
            {/* ✅ Active first */}
            <div className="space-y-4">
              <SectionHeader
                title="Portal Active"
                subtitle="Customers that have activated / set password."
                count={grouped.active.length}
                badgeClassName="bg-cyan-500/15 text-cyan-100 border border-cyan-400/60"
                sortDir={activeSortDir}
                onToggleSort={() =>
                  setActiveSortDir((d) => (d === "desc" ? "asc" : "desc"))
                }
                sortTone="cyan"
              />
              {grouped.active.length > 0 ? (
                <div className="space-y-4">
                  {grouped.active.map((c) => (
                    <CustomerCard key={String(c.id || c.email)} customer={c} />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 backdrop-blur-xl shadow-[0_0_35px_rgba(15,23,42,0.9)]">
                  <CardContent className="py-10 text-center text-slate-400 text-sm">
                    No active portal customers in this view.
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ✅ Pending second */}
            <div className="space-y-4">
              <SectionHeader
                title="Pending Activation"
                subtitle="Invited, but not activated yet."
                count={grouped.pending.length}
                badgeClassName="bg-amber-500/15 text-amber-100 border border-amber-400/60"
                sortDir={pendingSortDir}
                onToggleSort={() =>
                  setPendingSortDir((d) => (d === "desc" ? "asc" : "desc"))
                }
                sortTone="amber"
              />
              {grouped.pending.length > 0 ? (
                <div className="space-y-4">
                  {grouped.pending.map((c) => (
                    <CustomerCard key={String(c.id || c.email)} customer={c} />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 backdrop-blur-xl shadow-[0_0_35px_rgba(15,23,42,0.9)]">
                  <CardContent className="py-10 text-center text-slate-400 text-sm">
                    No pending activations in this view.
                  </CardContent>
                </Card>
              )}
            </div>

            {/* (Kept) Other / Inactive */}
            <div className="space-y-4">
              <SectionHeader
                title="Other / Inactive"
                subtitle="Not invited yet, or has no activation signals."
                count={grouped.other.length}
                badgeClassName="bg-slate-500/15 text-slate-200 border border-slate-400/30"
              />
              {grouped.other.length > 0 ? (
                <div className="space-y-4">
                  {grouped.other.map((c) => (
                    <CustomerCard key={String(c.id || c.email)} customer={c} />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 backdrop-blur-xl shadow-[0_0_35px_rgba(15,23,42,0.9)]">
                  <CardContent className="py-10 text-center text-slate-400 text-sm">
                    No other customers in this view.
                  </CardContent>
                </Card>
              )}
            </div>

            {grouped.total === 0 && (
              <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 backdrop-blur-xl shadow-[0_0_35px_rgba(15,23,42,0.9)]">
                <CardContent className="py-16 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">
                    No Customers Found
                  </h3>
                  <p className="text-slate-400">Try adjusting your search.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}