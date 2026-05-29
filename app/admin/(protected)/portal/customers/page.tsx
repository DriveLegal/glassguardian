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
  Calendar,
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

function normalizeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function normalizePhone(v: any) {
  return String(v || "")
    .trim()
    .replace(/\D/g, "");
}

function safeDateMs(v: any) {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function firstNonEmpty(...values: any[]) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function newestDate(...values: any[]) {
  let best = "";
  let bestMs = 0;

  for (const v of values) {
    const ms = safeDateMs(v);
    if (ms > bestMs) {
      bestMs = ms;
      best = String(v || "");
    }
  }

  return best;
}

function formatPrettyDate(v: any) {
  const ms = safeDateMs(v);
  if (!ms) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

/** ✅ TRUE invoice value */
function invoiceTrueValueCents(inv: AnyObj): number {
  const total = Number(inv?.total_cents ?? 0) || 0;
  const customerPaid = Number(inv?.final_paid_cents ?? 0) || 0;
  const insurancePortion = Number(inv?.insurance_due_cents ?? 0) || 0;
  const combined = customerPaid + insurancePortion;
  return Math.max(0, Math.min(total, combined));
}

function moneyFromInvoice(inv: AnyObj): number {
  if (inv?.total_cents != null) {
    const trueCents = invoiceTrueValueCents(inv);
    if (trueCents > 0) return trueCents / 100;

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

/** ---------------- Data fetchers ---------------- */

async function fetchAppUsers(): Promise<AnyObj[]> {
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

async function fetchWarranties(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("warranties")
    .select("*")
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

/** ---------------- Email ---------------- */

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

/** ---------------- Customer merge builder ---------------- */

type UnifiedCustomer = AnyObj & {
  source_app_user?: AnyObj | null;
  synthetic?: boolean;
  synthetic_key?: string;
};

function buildUnifiedCustomers(args: {
  appUsers: AnyObj[];
  appointments: AnyObj[];
  vehicles: AnyObj[];
  invoices: AnyObj[];
  warranties: AnyObj[];
  userInvites: AnyObj[];
}): UnifiedCustomer[] {
  const { appUsers, appointments, vehicles, invoices, warranties, userInvites } =
    args;

  const byPrimaryKey = new Map<string, UnifiedCustomer>();

  function makeKey(email: string, phone: string) {
    if (email) return `email:${email}`;
    if (phone) return `phone:${phone}`;
    return "";
  }

  function upsertPartial(partial: AnyObj, appUserCandidate?: AnyObj | null) {
    const email = normalizeEmail(
      partial?.email ||
        partial?.customer_email ||
        partial?.owner_email ||
        partial?.user_email
    );

    const phone = normalizePhone(
      partial?.phone || partial?.customer_phone || partial?.owner_phone
    );

    const key = makeKey(email, phone);
    if (!key) return;

    const existing = byPrimaryKey.get(key);

    const baseName =
      firstNonEmpty(
        partial?.full_name,
        partial?.customer_name,
        partial?.name,
        partial?.owner_name,
        partial?.first_name && partial?.last_name
          ? `${partial.first_name} ${partial.last_name}`
          : "",
        existing?.full_name
      ) || "No Name";

    const mergedAppUser =
      appUserCandidate ||
      existing?.source_app_user ||
      (existing?.id && !String(existing.id).startsWith("synthetic:")
        ? existing
        : null);

    const merged: UnifiedCustomer = {
      ...(existing || {}),
      full_name: baseName,
      email: firstNonEmpty(
        email,
        existing?.email,
        partial?.email,
        partial?.customer_email,
        partial?.owner_email,
        partial?.user_email
      ),
      phone: firstNonEmpty(
        phone,
        normalizePhone(existing?.phone),
        partial?.phone,
        partial?.customer_phone,
        partial?.owner_phone
      ),
      created_at: newestDate(
        partial?.created_at,
        partial?.invoice_date,
        partial?.service_date,
        existing?.created_at
      ),
      auth_user_id: firstNonEmpty(
        partial?.auth_user_id,
        existing?.auth_user_id,
        mergedAppUser?.auth_user_id
      ),
      portal_activated_at: firstNonEmpty(
        partial?.portal_activated_at,
        existing?.portal_activated_at,
        mergedAppUser?.portal_activated_at
      ),
      portal_invited_at: firstNonEmpty(
        partial?.portal_invited_at,
        partial?.invited_at,
        existing?.portal_invited_at,
        mergedAppUser?.portal_invited_at
      ),
      source_app_user: mergedAppUser || null,
      synthetic: !mergedAppUser,
      synthetic_key: key,
      id: firstNonEmpty(mergedAppUser?.id, existing?.id, `synthetic:${key}`),
    };

    byPrimaryKey.set(key, merged);
  }

  for (const u of appUsers) {
    upsertPartial(
      {
        ...u,
        email: u?.email,
        phone: u?.phone,
        full_name: u?.full_name,
      },
      u
    );
  }

  for (const a of appointments) {
    upsertPartial({
      email: a?.customer_email,
      phone: a?.customer_phone || a?.phone,
      full_name: a?.customer_name || a?.full_name,
      created_at: a?.created_at,
    });
  }

  for (const v of vehicles) {
    upsertPartial({
      email: v?.owner_email || v?.customer_email || v?.email,
      phone: v?.owner_phone || v?.customer_phone || v?.phone,
      full_name: v?.owner_name || v?.customer_name || v?.full_name,
      created_at: v?.created_at,
    });
  }

  for (const inv of invoices) {
    upsertPartial({
      email: inv?.customer_email,
      phone: inv?.customer_phone || inv?.phone,
      full_name: inv?.customer_name || inv?.full_name,
      created_at: inv?.created_at || inv?.invoice_date,
    });
  }

  for (const w of warranties) {
    upsertPartial({
      email: w?.customer_email,
      full_name: "",
      created_at: w?.created_at || w?.service_date,
    });
  }

  for (const inv of userInvites) {
    upsertPartial({
      email: inv?.email || inv?.customer_email,
      phone: inv?.phone || inv?.customer_phone,
      full_name: inv?.full_name || inv?.customer_name,
      created_at: inv?.created_at,
      invited_at: inv?.created_at,
    });
  }

  return Array.from(byPrimaryKey.values()).sort(
    (a, b) => safeDateMs(b?.created_at) - safeDateMs(a?.created_at)
  );
}

export default function AdminCustomersPage() {
  const searchParams = useSearchParams();

  const createdParam = searchParams.get("created");
  const inviteCode = searchParams.get("invite_code") || null;
  const showCreatedBanner = createdParam === "1";

  const oldInviteParam = searchParams.get("old_invite");
  const oldInviteEmail = searchParams.get("email");
  const oldInviteWarranty = searchParams.get("warranty");
  const showOldInviteBanner = oldInviteParam === "1";

  const highlightEmail = React.useMemo(
    () => normalizeEmail(oldInviteEmail),
    [oldInviteEmail]
  );

  const [search, setSearch] = React.useState("");
  const [activeSortDir, setActiveSortDir] = React.useState<"desc" | "asc">(
    "desc"
  );
  const [pendingSortDir, setPendingSortDir] = React.useState<"desc" | "asc">(
    "desc"
  );

  const { data: appUsers = [], isLoading: loadingAppUsers, error: appUsersError } =
    useQuery({
      queryKey: ["admin:appUsers"],
      queryFn: fetchAppUsers,
      staleTime: 15_000,
    });

  const { data: appointments = [], isLoading: loadingApts, error: apptsError } =
    useQuery({
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

  const customers = React.useMemo(() => {
    return buildUnifiedCustomers({
      appUsers,
      appointments,
      vehicles,
      invoices,
      warranties,
      userInvites,
    });
  }, [appUsers, appointments, vehicles, invoices, warranties, userInvites]);

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

  const inviteByEmail = React.useMemo(() => {
    const m = new Map<string, AnyObj>();

    for (const inv of userInvites) {
      const e = normalizeEmail(inv?.email || inv?.customer_email);
      if (!e) continue;

      const prev = m.get(e);
      if (!prev || safeDateMs(inv?.created_at) >= safeDateMs(prev?.created_at)) {
        m.set(e, inv);
      }
    }

    return m;
  }, [userInvites]);

  const appUserByEmail = React.useMemo(() => {
    const m = new Map<string, AnyObj>();

    for (const u of appUsers) {
      const e = normalizeEmail(u?.email);
      if (!e) continue;

      const prev = m.get(e);
      if (!prev || safeDateMs(u?.created_at) >= safeDateMs(prev?.created_at)) {
        m.set(e, u);
      }
    }

    return m;
  }, [appUsers]);

  const invoicesByCustomerEmail = React.useMemo(() => {
    const m = new Map<string, AnyObj[]>();

    for (const inv of invoices) {
      const e = normalizeEmail(inv?.customer_email || inv?.email);
      if (!e) continue;

      const list = m.get(e) || [];
      list.push(inv);
      m.set(e, list);
    }

    for (const [, list] of m) {
      list.sort(
        (a, b) =>
          safeDateMs(b?.created_at || b?.invoice_date) -
          safeDateMs(a?.created_at || a?.invoice_date)
      );
    }

    return m;
  }, [invoices]);

  function findBestWarrantyForCustomer(customer: AnyObj): AnyObj | null {
    const ce = normalizeEmail(customer?.email);
    const customerInvoiceIds = new Set<string>();

    const relatedInvoices = invoicesByCustomerEmail.get(ce) || [];
    for (const inv of relatedInvoices) {
      const id = firstNonEmpty(inv?.id);
      if (id) customerInvoiceIds.add(String(id));
    }

    const matches = warranties.filter((w: AnyObj) => {
      const warrantyEmail = normalizeEmail(w?.customer_email);
      const warrantyInvoiceId = firstNonEmpty(w?.invoice_id);

      const emailMatch = !!ce && warrantyEmail === ce;
      const invoiceMatch =
        !!warrantyInvoiceId && customerInvoiceIds.has(String(warrantyInvoiceId));

      return emailMatch || invoiceMatch;
    });

    if (!matches.length) return null;

    matches.sort(
      (a, b) =>
        safeDateMs(
          b?.created_at || b?.updated_at || b?.service_date || b?.expires_at
        ) -
        safeDateMs(
          a?.created_at || a?.updated_at || a?.service_date || a?.expires_at
        )
    );

    return matches[0] || null;
  }

  function getLastServiceDate(customer: AnyObj) {
    const ce = normalizeEmail(customer?.email);
    const cp = normalizePhone(customer?.phone);
    const dates: any[] = [];

    for (const a of appointments) {
      const emailMatch =
        ce && normalizeEmail(a?.customer_email || a?.email) === ce;
      const phoneMatch =
        cp && normalizePhone(a?.customer_phone || a?.phone) === cp;

      if (emailMatch || phoneMatch) {
        dates.push(
          a?.service_date,
          a?.scheduled_date,
          a?.completed_at,
          a?.updated_at,
          a?.created_at
        );
      }
    }

    for (const inv of invoices) {
      const emailMatch =
        ce && normalizeEmail(inv?.customer_email || inv?.email) === ce;
      const phoneMatch =
        cp && normalizePhone(inv?.customer_phone || inv?.phone) === cp;

      if (emailMatch || phoneMatch) {
        dates.push(
          inv?.service_date,
          inv?.invoice_date,
          inv?.paid_at,
          inv?.updated_at,
          inv?.created_at
        );
      }
    }

    for (const w of warranties) {
      const emailMatch = ce && normalizeEmail(w?.customer_email) === ce;

      if (emailMatch) {
        dates.push(w?.service_date, w?.updated_at, w?.created_at);
      }
    }

    return newestDate(...dates);
  }

  const loading =
    loadingAppUsers ||
    loadingApts ||
    loadingVehicles ||
    loadingInvoices ||
    loadingWarranties ||
    loadingInvites;

  const anyError =
    appUsersError ||
    apptsError ||
    vehiclesError ||
    invoicesError ||
    warrantiesError ||
    invitesError;

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

  function getPortalStatus(customer: AnyObj) {
    const email = String(customer.email || "");
    const ce = normalizeEmail(email);

    const appUser = customer?.source_app_user || appUserByEmail.get(ce) || null;
    const invite = inviteByEmail.get(ce);

    const inviteTableSignal = Boolean(invite);

    const invitedAt =
      customer?.portal_invited_at ||
      customer?.portalInvitedAt ||
      customer?.invited_at ||
      customer?.invitedAt ||
      customer?.portal_invite_sent_at ||
      customer?.portalInviteSentAt ||
      appUser?.portal_invited_at ||
      appUser?.invited_at;

    const userRowInviteSignal = Boolean(invitedAt);
    const isInvited = inviteTableSignal || userRowInviteSignal;

    const hasActivationSignal =
      isPortalActivatedFromUserRow(customer) ||
      isPortalActivatedFromUserRow(appUser);

    const inviteCompletedFromTable = invite ? isInviteCompleted(invite) : false;

    const isActive = hasActivationSignal || inviteCompletedFromTable;
    const isPending = !isActive && isInvited;
    const isInactive = !isActive && !isPending;

    return {
      isActive,
      isPending,
      isInactive,
      inviteCompleted: inviteCompletedFromTable || hasActivationSignal,
      ce,
      email,
    };
  }

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

    other.sort((a, b) => safeDateMs(b?.created_at) - safeDateMs(a?.created_at));

    return { active, pending, other, total: filtered.length };
  }, [filtered, activeSortDir, pendingSortDir, appUserByEmail, inviteByEmail]);

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
            className={["h-9", "border", sortBtnClass, "backdrop-blur-md"].join(
              " "
            )}
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortDir === "desc" ? "Newest → Oldest" : "Oldest → Newest"}
          </Button>
        ) : null}
      </div>
    );
  }

  function CustomerCard({ customer }: { customer: AnyObj }) {
    const name = (customer.full_name as string) || "No Name";

    const { isActive, isPending, isInactive, ce, email } =
      getPortalStatus(customer);

    const appUser = customer?.source_app_user || appUserByEmail.get(ce) || null;

    const lastLoginDate =
      appUser?.last_sign_in_at ||
      appUser?.last_login_at ||
      appUser?.lastLoginAt ||
      customer?.last_sign_in_at ||
      customer?.last_login_at ||
      customer?.lastLoginAt ||
      "";

    const lastServiceDate = getLastServiceDate(customer);

    const isHighlighted = !!highlightEmail && highlightEmail === ce;
    const primaryWarranty = findBestWarrantyForCustomer(customer);

    const warrantyNumber = String(primaryWarranty?.warranty_number || "").trim();
    const warrantyExpiration =
      isoToYmd(primaryWarranty?.expiration_date) ||
      isoToYmd(primaryWarranty?.expires_at);

    const serviceDate =
      isoToYmd(primaryWarranty?.service_date) || isoToYmd(lastServiceDate);

    const servicePerformed = String(
      primaryWarranty?.service_performed || "Windshield repair"
    ).trim();

    const canResend = Boolean(email);

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

    const detailsHref = email
      ? `/admin/portal/customers/${encodeURIComponent(
          String(customer.id || `synthetic:${ce}`)
        )}?email=${encodeURIComponent(email)}`
      : `/admin/portal/customers/${encodeURIComponent(
          String(customer.id || customer.synthetic_key || "unknown")
        )}`;

    return (
      <Card
        key={String(customer.id || customer.synthetic_key || email)}
        id={`customer-${encodeURIComponent(ce)}`}
        className={[
          "border bg-slate-900/70 backdrop-blur-xl transition-all duration-300",
          borderClass,
          highlightGlow,
        ].join(" ")}
      >
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-6 md:flex-row md:gap-8">
            <div className="flex items-center gap-4 md:w-1/3">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 shadow-[0_0_40px_rgba(34,211,238,0.8)]">
                  <span className="text-xl font-bold text-slate-950">
                    {name?.charAt(0)?.toUpperCase() ||
                      email?.charAt(0)?.toUpperCase() ||
                      "C"}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-50">{name}</h3>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/60 bg-cyan-300/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-50">
                    Customer
                  </span>

                  {customer?.synthetic ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/25 bg-slate-500/10 px-2 py-0.5 text-[11px] text-slate-200">
                      Merged Record
                    </span>
                  ) : null}

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/60 bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.55)]">
                      <CheckCircle2 className="h-3 w-3" />
                      Portal Active
                    </span>
                  ) : isPending ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.45)]">
                      <Clock className="h-3 w-3" />
                      Pending Activation
                    </span>
                  ) : isInactive ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                      <Ban className="h-3 w-3" />
                      Portal Inactive
                    </span>
                  ) : null}

                  {isHighlighted && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[11px] text-slate-100">
                      <ArrowRight className="h-3 w-3" />
                      Recently invited
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid flex-1 gap-4 text-sm md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 break-all text-slate-100">
                  <Mail className="h-4 w-4 text-cyan-300" />
                  <span>{email || "No email found"}</span>
                </div>

                {customer.phone ? (
                  <div className="flex items-center gap-2 text-slate-100">
                    <Phone className="h-4 w-4 text-cyan-300" />
                    <span>{customer.phone}</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4 text-slate-100">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Clock className="h-4 w-4 text-cyan-300" />
                    Last Login
                  </span>
                  <span className="text-right font-semibold">
                    {formatPrettyDate(lastLoginDate)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-slate-100">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Calendar className="h-4 w-4 text-cyan-300" />
                    Last Service
                  </span>
                  <span className="text-right font-semibold">
                    {formatPrettyDate(lastServiceDate)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex min-w-[260px] flex-col items-stretch justify-center gap-2">
              <Link href={detailsHref}>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-700 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.55)] hover:shadow-[0_0_35px_rgba(34,211,238,0.75)]"
                >
                  <UserRoundCog className="mr-2 h-4 w-4" />
                  Manage Customer
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

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
                      : "cursor-not-allowed bg-slate-700/70 hover:bg-slate-700/70",
                  ].join(" ")}
                >
                  {isSendingThis ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resending invite…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Send className="h-4 w-4" />
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b_0,_#020617_40%,_#000000_100%)] p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                <Users className="h-6 w-6 text-slate-950" />
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Link href="/admin/portal/customers/createoldclientportal">
              <Button className="bg-emerald-500 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.55)] hover:bg-emerald-600">
                <Shield className="mr-2 h-4 w-4" />
                + Create Old Client Portal
              </Button>
            </Link>

            <Link href="/admin/portal/customers/new">
              <Button className="bg-cyan-500 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.7)] hover:bg-cyan-600">
                + New Customer
              </Button>
            </Link>
          </div>
        </div>

        {showCreatedBanner && (
          <div className="mb-6 flex items-start gap-2 rounded-md border border-emerald-500/80 bg-emerald-900/60 px-4 py-3 text-sm text-emerald-50">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
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
                We&apos;ve emailed them a link to create their account.
              </p>
            </div>
          </div>
        )}

        {showOldInviteBanner && (
          <div className="mb-6 flex items-start gap-2 rounded-md border border-cyan-400/70 bg-cyan-900/35 px-4 py-3 text-sm text-cyan-50">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-200" />
            <div className="flex-1">
              <p className="font-medium">
                Old client portal invite sent successfully.
              </p>

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
                They can now create a password and access their repair history.
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

        {anyError && !loading && (
          <div className="mb-6 flex items-start gap-2 rounded-md border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Something failed while loading data.</p>
              <p className="mt-1 text-xs text-red-200/80">
                Check console for the exact Supabase error.
              </p>
            </div>
          </div>
        )}

        <Card className="mb-6 border border-cyan-500/10 bg-slate-900/60 shadow-[0_0_40px_rgba(15,23,42,0.85)] backdrop-blur-xl">
          <CardContent className="p-4 md:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-slate-700/80 bg-slate-950/70 pl-10 text-slate-100 shadow-[0_0_20px_rgba(15,23,42,0.8)] placeholder:text-slate-500 focus-visible:border-cyan-400/70 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              />
            </div>
          </CardContent>
        </Card>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card className="border border-cyan-500/20 bg-gradient-to-br from-sky-500/20 via-cyan-500/10 to-slate-900/80 shadow-[0_0_50px_rgba(56,189,248,0.45)] backdrop-blur-xl">
            <CardContent className="p-5">
              <p className="mb-1 text-xs uppercase tracking-[0.15em] text-cyan-200/90">
                Total Customers
              </p>
              <p className="text-3xl font-semibold text-slate-50">
                {customers.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-slate-900/80 shadow-[0_0_50px_rgba(16,185,129,0.45)] backdrop-blur-xl">
            <CardContent className="p-5">
              <p className="mb-1 text-xs uppercase tracking-[0.15em] text-emerald-200/90">
                Total Revenue
              </p>
              <p className="text-3xl font-semibold text-emerald-100">
                ${totalRevenue.toFixed(0)}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-violet-500/20 bg-gradient-to-br from-violet-500/25 via-indigo-500/10 to-slate-900/80 shadow-[0_0_50px_rgba(129,140,248,0.45)] backdrop-blur-xl">
            <CardContent className="p-5">
              <p className="mb-1 text-xs uppercase tracking-[0.15em] text-violet-200/90">
                Total Vehicles
              </p>
              <p className="text-3xl font-semibold text-violet-100">
                {vehicles.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-amber-400/25 bg-gradient-to-br from-amber-400/25 via-orange-500/10 to-slate-900/80 shadow-[0_0_50px_rgba(251,191,36,0.4)] backdrop-blur-xl">
            <CardContent className="p-5">
              <p className="mb-1 text-xs uppercase tracking-[0.15em] text-amber-100/90">
                Total Services
              </p>
              <p className="text-3xl font-semibold text-amber-50">
                {appointments.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {loading && (
          <div className="py-24 text-center text-slate-400">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent shadow-[0_0_25px_rgba(34,211,238,0.75)]" />
            Loading customer constellation…
          </div>
        )}

        {!loading && (
          <div className="space-y-10">
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
                    <CustomerCard
                      key={String(c.id || c.synthetic_key || c.email)}
                      customer={c}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 shadow-[0_0_35px_rgba(15,23,42,0.9)] backdrop-blur-xl">
                  <CardContent className="py-10 text-center text-sm text-slate-400">
                    No active portal customers in this view.
                  </CardContent>
                </Card>
              )}
            </div>

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
                    <CustomerCard
                      key={String(c.id || c.synthetic_key || c.email)}
                      customer={c}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 shadow-[0_0_35px_rgba(15,23,42,0.9)] backdrop-blur-xl">
                  <CardContent className="py-10 text-center text-sm text-slate-400">
                    No pending activations in this view.
                  </CardContent>
                </Card>
              )}
            </div>

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
                    <CustomerCard
                      key={String(c.id || c.synthetic_key || c.email)}
                      customer={c}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 shadow-[0_0_35px_rgba(15,23,42,0.9)] backdrop-blur-xl">
                  <CardContent className="py-10 text-center text-sm text-slate-400">
                    No other customers in this view.
                  </CardContent>
                </Card>
              )}
            </div>

            {grouped.total === 0 && (
              <Card className="border border-dashed border-slate-600/80 bg-slate-900/70 shadow-[0_0_35px_rgba(15,23,42,0.9)] backdrop-blur-xl">
                <CardContent className="py-16 text-center">
                  <Users className="mx-auto mb-4 h-16 w-16 text-slate-600" />
                  <h3 className="mb-2 text-xl font-semibold text-slate-100">
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