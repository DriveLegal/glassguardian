// app/tech/(protected)/dashboard/users/[id]/page.tsx
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VehicleImageDisplay from "@/components/VehicleImageDisplay";

type AnyObj = Record<string, any>;

type InviteRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  code: string | null;
  created_at: string;
  used_at: string | null;
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

function GGBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-48 -left-40 h-[34rem] w-[34rem] rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="absolute -bottom-56 -right-44 h-[38rem] w-[38rem] rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute top-[35%] left-[55%] h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/60 to-slate-950" />
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
        "bg-gradient-to-br from-white/10 via-white/5 to-transparent",
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

/**
 * VEHICLES (Garage)
 */
async function fetchVehiclesByOwnerEmail(email?: string | null) {
  const clean = normEmail(email);
  if (!clean) return [];

  const { data, error } = await (supabaseClient.from("vehicles") as any)
    .select(
      "id, owner_email, make, model, year, color, vin, license_plate, insurance_carrier, is_default, created_at, updated_at, body_type"
    )
    .eq("owner_email", clean)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AnyObj[];
}

/**
 * INVOICES: match your invoices page exactly, then filter to this user.
 */
async function fetchInvoicesForTech(techEmail: string) {
  const { data, error } = await supabaseClient
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
    .eq("technician_email", techEmail)
    .order("invoice_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as TechInvoiceRow[];
}

function invoiceMatchesUser(inv: TechInvoiceRow, userEmail: string, clientId: string | null) {
  const email = normEmail(userEmail);
  const invEmail = normEmail(inv.customer_email);

  if (clientId && inv.client_id && String(inv.client_id) === String(clientId)) return true;
  if (email && invEmail && invEmail === email) return true;

  const appt = (inv.appointment_snapshot ?? {}) as AnyObj;

  const apptEmail =
    normEmail(appt.customer_email) ||
    normEmail(appt.client_email) ||
    normEmail(appt.email) ||
    normEmail(appt.user_email) ||
    "";

  if (email && apptEmail && apptEmail === email) return true;

  const apptClientId = appt.client_id ?? appt.clientId ?? appt.client?.id ?? null;
  if (clientId && apptClientId && String(apptClientId) === String(clientId)) return true;

  return false;
}

/**
 * WARRANTIES:
 * ✅ NO giant .or()
 * ✅ small simple queries + merge
 * ✅ chunk invoice_id lookups to avoid huge SQL
 *
 * IMPORTANT:
 * If RLS blocks tech from selecting warranties, we return [] and set a debug message.
 */
async function fetchWarrantiesSafe(args: {
  clientId: string | null;
  email: string;
  invoiceIds: string[];
}) {
  const clientId = args.clientId ?? null;
  const email = normEmail(args.email);
  const invoiceIds = (args.invoiceIds ?? []).filter(Boolean);

  const collected: AnyObj[] = [];

  // 1) By client_id
  if (clientId) {
    const { data, error } = await (supabaseClient.from("warranties") as any)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      // If you get stack depth here too, it's almost certainly RLS recursion on warranties table.
      return { warranties: [] as AnyObj[], warrantyError: error as any };
    }
    collected.push(...(data ?? []));
  }

  // 2) By customer_email (case-insensitive)
  if (email) {
    const { data, error } = await (supabaseClient.from("warranties") as any)
      .select("*")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false });

    if (error) {
      return { warranties: [] as AnyObj[], warrantyError: error as any };
    }
    collected.push(...(data ?? []));
  }

  // 3) By invoice_id (chunked)
  if (invoiceIds.length > 0) {
    const parts = chunk(invoiceIds, 25);
    for (const ids of parts) {
      const { data, error } = await (supabaseClient.from("warranties") as any)
        .select("*")
        .in("invoice_id", ids)
        .order("created_at", { ascending: false });

      if (error) {
        // don't kill the whole page; just stop this path
        return { warranties: uniqById(collected), warrantyError: error as any };
      }
      collected.push(...(data ?? []));
    }
  }

  return { warranties: uniqById(collected), warrantyError: null as any };
}

export const dynamic = "force-dynamic";

export default function TechUserResolvedDetailPage() {
  const router = useRouter();
  const params = useParams();
  const inviteId = safeParamId((params as AnyObj)?.id);

  const [techEmail, setTechEmail] = React.useState<string | null>(null);

  // match your invoices page auth behavior
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!mounted) return;

      const email = session?.user?.email ?? null;
      setTechEmail(email);

      if (!email) {
        router.replace(
          `/tech/login?redirect=${encodeURIComponent(
            inviteId ? `/tech/dashboard/users/${inviteId}` : "/tech/dashboard/users"
          )}`
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, inviteId]);

  const onBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/tech/dashboard/users");
  }, [router]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tech:user:resolved-detail:v7", inviteId, techEmail],
    enabled: !!inviteId && !!techEmail,
    queryFn: async () => {
      if (!inviteId) throw new Error("Missing user id in route.");
      if (!techEmail) throw new Error("Missing tech session email.");

      // 1) Invite
      const { data: invite, error: invErr } = await (supabaseClient.from("user_invites") as any)
        .select("id, full_name, email, phone, code, created_at, used_at, created_by_tech_email")
        .eq("id", inviteId)
        .maybeSingle();

      if (invErr) throw invErr;
      if (!invite) throw new Error("User invite not found.");

      const inviteRow = invite as InviteRow;
      const userEmail = normEmail(inviteRow.email);

      // 2) Client profile (case-insensitive)
      let client: AnyObj | null = null;
      if (userEmail) {
        const { data: c, error: cErr } = await (supabaseClient.from("clients") as any)
          .select("*")
          .ilike("email", userEmail)
          .maybeSingle();

        if (!cErr && c) client = c as AnyObj;
      }

      // 3) Vehicles
      const vehicles = await fetchVehiclesByOwnerEmail(userEmail);

      // 4) Invoices (tech-scoped) then filter
      const allTechInvoices = await fetchInvoicesForTech(techEmail);
      const userInvoices = allTechInvoices.filter((inv) =>
        invoiceMatchesUser(inv, userEmail, client?.id ? String(client.id) : null)
      );

      // 5) Warranties (safe, no giant OR)
      const invoiceIds = userInvoices.map((i) => String(i.id)).filter(Boolean);
      const { warranties, warrantyError } = await fetchWarrantiesSafe({
        clientId: client?.id ? String(client.id) : null,
        email: userEmail,
        invoiceIds,
      });

      return {
        invite: inviteRow,
        client,
        vehicles,
        invoices: userInvoices,
        warranties,
        email: userEmail,
        techEmail,
        warrantyError,
      };
    },
    staleTime: 15_000,
  });

  const invite = data?.invite as InviteRow | undefined;
  const client = (data?.client as AnyObj | null | undefined) ?? null;

  const vehicles = (data?.vehicles as AnyObj[]) ?? [];
  const warranties = (data?.warranties as AnyObj[]) ?? [];
  const invoices = (data?.invoices as AnyObj[]) ?? [];

  const warrantyError = (data as any)?.warrantyError ?? null;

  const normalizedEmail = data?.email ?? (invite ? normEmail(invite.email) : "");
  const isActiveInvite = !!invite?.used_at;
  const hasClientProfile = !!client?.id;

  const resolvedName =
    client?.full_name ||
    client?.name ||
    invite?.full_name ||
    (invite?.email ? invite.email.split("@")[0] : "User");

  const openInvoices = invoices.filter((i) => {
    const s = normStatus(i.status);
    return ["draft", "sent", "open", "unpaid", "due", "pending"].includes(s);
  });

  const paidInvoices = invoices.filter((i) => {
    const s = normStatus(i.status);
    return ["paid", "complete", "completed", "settled"].includes(s);
  });

  const openTotalCents = openInvoices.reduce((sum, i) => sum + (Number(i.total_cents) || 0), 0);
  const paidTotalCents = paidInvoices.reduce((sum, i) => sum + (Number(i.total_cents) || 0), 0);

  return (
    <div className="min-h-screen relative p-4 md:p-8 overflow-hidden">
      <GGBackground />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className={cx("w-fit border-white/15 bg-white/5 text-white hover:bg-white/10", "backdrop-blur")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              User
            </Badge>

            <Badge
              className={
                isActiveInvite
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                  : "border-amber-400/30 bg-amber-500/15 text-amber-200"
              }
            >
              {isActiveInvite ? (
                <>
                  <BadgeCheck className="w-3.5 h-3.5 mr-1.5" />
                  Invite Completed
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Pending Signup
                </>
              )}
            </Badge>

            <Badge
              className={
                hasClientProfile ? "border-sky-400/30 bg-sky-500/15 text-sky-200" : "border-white/15 bg-white/5 text-slate-200"
              }
            >
              {hasClientProfile ? "Client Profile Linked" : "No Client Profile Yet"}
            </Badge>

            <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
              {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
            </Badge>

            <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
              {warranties.length} warrant{warranties.length === 1 ? "y" : "ies"}
            </Badge>

            <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
            </Badge>
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
                    <CardTitle className="text-2xl md:text-3xl text-white">{resolvedName}</CardTitle>

                    <div className="mt-2 space-y-1 text-sm text-slate-300">
                      {invite?.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="break-all">{invite.email}</span>
                        </div>
                      ) : null}

                      {invite?.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span>{invite.phone}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {invite?.code ? (
                      <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                        <Hash className="w-3.5 h-3.5 mr-1.5" />
                        {invite.code}
                      </Badge>
                    ) : null}

                    {invite?.created_at ? (
                      <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        Invited: {formatDT(invite.created_at)}
                      </Badge>
                    ) : null}

                    {invite?.used_at ? (
                      <Badge variant="outline" className="border-emerald-400/20 bg-emerald-500/10 text-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Joined: {formatDT(invite.used_at)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-6">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading user…</span>
                  </div>
                ) : null}

                {isError ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 mt-0.5" />
                      <div className="w-full">
                        <p className="font-semibold">Couldn’t load user</p>
                        <p className="text-sm text-red-100/90 mt-1">
                          {(error as Error)?.message || "Failed to load user."}
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

                {/* Non-fatal warranties warning */}
                {!isLoading && !isError && warrantyError ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 mt-0.5" />
                      <div className="w-full">
                        <p className="font-semibold">Warranties query blocked / failed</p>
                        <p className="text-sm text-amber-100/90 mt-1">
                          {String(warrantyError?.message || warrantyError?.hint || "Could not read warranties.")}
                        </p>
                        <p className="text-xs text-amber-100/70 mt-2">
                          Vehicles and invoices still load. This usually means RLS on <span className="font-semibold">warranties</span> is blocking tech read,
                          or a policy is recursively querying itself.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!isLoading && !isError && invite ? (
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* LEFT */}
                    <div className="lg:col-span-1 space-y-4">
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <NotebookPen className="w-4 h-4 text-slate-200" />
                              Invite Status
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-3 text-sm">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Signup</div>
                              <div className="mt-1 text-slate-100 font-semibold">
                                {isActiveInvite ? "Completed (account created)" : "Pending (invite sent)"}
                              </div>
                              <div className="mt-2 text-xs text-slate-300">
                                Pending users stay visible here until they complete signup.
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Query keys</div>
                              <div className="mt-1 text-xs text-slate-200">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 mt-0.5 text-slate-400" />
                                  <div className="space-y-1">
                                    <div>
                                      email:{" "}
                                      <span className="text-white font-semibold break-all">
                                        {normalizedEmail || "—"}
                                      </span>
                                    </div>
                                    <div>
                                      client_id:{" "}
                                      <span className="text-white font-semibold">{client?.id || "—"}</span>
                                    </div>
                                    <div>
                                      tech:{" "}
                                      <span className="text-white font-semibold break-all">{techEmail || "—"}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {invite.created_by_tech_email ? (
                              <div className="text-xs text-slate-300">
                                Created by: <span className="text-slate-100">{invite.created_by_tech_email}</span>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </GradientBorderCard>

                      {/* Invoice totals */}
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
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Open</div>
                              <div className="mt-1 text-slate-100 font-semibold tabular-nums">
                                {moneyFromCents(openTotalCents) ?? "$0.00"}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Paid</div>
                              <div className="mt-1 text-slate-100 font-semibold tabular-nums">
                                {moneyFromCents(paidTotalCents) ?? "$0.00"}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </GradientBorderCard>
                    </div>

                    {/* RIGHT */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* GARAGE */}
                      <GradientBorderCard>
                        <Card className="border-0 bg-transparent shadow-none">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-base text-white flex items-center gap-2">
                              <Car className="w-4 h-4 text-slate-200" />
                              Garage
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
                                No vehicles found for <span className="text-white font-semibold">{invite.email}</span>.
                              </div>
                            ) : (
                              <div className="grid md:grid-cols-2 gap-4">
                                {vehicles.map((vehicle, idx) => (
                                  <div
                                    key={`vehicle-${vehicle?.id || vehicle?.vin || idx}`}
                                    className="rounded-2xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent"
                                  >
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl p-4 space-y-3">
                                      {vehicle?.make && vehicle?.model ? (
                                        <VehicleImageDisplay
                                          make={vehicle.make}
                                          model={vehicle.model}
                                          year={vehicle.year}
                                          color={vehicle.color || "#FFFFFF"}
                                          className="h-40"
                                        />
                                      ) : (
                                        <div className="h-40 rounded-xl border border-white/10 bg-white/5" />
                                      )}

                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-semibold text-white">
                                            {vehicle?.year ? `${vehicle.year} ` : ""}
                                            {vehicle?.make || "Make"} {vehicle?.model || "Model"}
                                          </p>
                                          {vehicle?.is_default ? (
                                            <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                                              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                              Default
                                            </Badge>
                                          ) : null}
                                        </div>

                                        <p className="text-xs text-slate-300">VIN: {vehicle?.vin || "N/A"}</p>
                                        <p className="text-xs text-slate-300">
                                          Plate: {vehicle?.license_plate || "N/A"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
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
                            <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
                              {warranties.length} total
                            </Badge>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            {warranties.length === 0 ? (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                No warranties found for this user.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {warranties.map((w, idx) => {
                                  const wStatus = normStatus(w?.status);
                                  const exp = w?.expiration_date ?? w?.expires_at ?? null;
                                  const svc = w?.service_date ?? null;

                                  return (
                                    <div
                                      key={`warranty-${w?.id || w?.warranty_number || idx}`}
                                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl p-4"
                                    >
                                      <div className="pointer-events-none absolute inset-y-0 -left-10 w-32 bg-gradient-to-r from-emerald-400/15 via-sky-400/5 to-transparent blur-3xl" />

                                      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-slate-50 font-semibold">
                                              Warranty {w?.warranty_number ? `#${w.warranty_number}` : ""}
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
                                            <p className="text-sm text-slate-300">{w.service_performed}</p>
                                          ) : null}

                                          <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                                            {svc ? <span>Service: {formatD(svc)}</span> : null}
                                            {exp ? <span>Expires: {formatD(exp)}</span> : null}
                                            {w?.coverage_type ? <span>Coverage: {w.coverage_type}</span> : null}
                                            {w?.spot_location ? <span>Spot: {w.spot_location}</span> : null}
                                          </div>
                                        </div>

                                        {w?.invoice_id ? (
                                          <Badge
                                            variant="outline"
                                            className="border-white/15 bg-white/5 text-slate-200"
                                          >
                                            Invoice: {String(w.invoice_id).slice(0, 8)}…
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>
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
                                No invoices found for this user.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {invoices.map((inv: AnyObj, idx) => {
                                  const invStatus = normStatus(inv?.status);
                                  const invNumber = inv?.invoice_number ?? inv?.id ?? "";
                                  const amount = moneyFromCents(inv?.total_cents) ?? "$0.00";
                                  const invDate = inv?.invoice_date ?? null;

                                  return (
                                    <div
                                      key={`invoice-${inv?.id || invNumber || idx}`}
                                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl p-4"
                                    >
                                      <div className="pointer-events-none absolute inset-y-0 -left-10 w-32 bg-gradient-to-r from-sky-400/15 via-indigo-400/5 to-transparent blur-3xl" />

                                      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-slate-50 font-semibold">Invoice {String(invNumber)}</p>
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
                                            {invDate ? <span>Invoice date: {formatD(invDate)}</span> : null}
                                            {inv?.created_at ? <span>Created: {formatDT(inv.created_at)}</span> : null}
                                            {inv?.service_address ? <span>Address: {inv.service_address}</span> : null}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-200">
                                            {amount}
                                          </Badge>
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