// app/admin/(protected)/portal/referral-requests/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Mail,
  User,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  BadgeDollarSign,
  Link2,
  Receipt,
  CalendarDays,
  ScanSearch,
  Copy,
  Check,
  AlertCircle,
  TriangleAlert,
  CircleDashed,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ReqStatus = "new" | "invited" | "ignored";

type ReqRow = {
  id: string;
  full_name: string;
  email: string;
  referral_code: string | null;
  status: ReqStatus;
  created_at: string;
};

type ReferralCodeRow = {
  referral_code: string;
  referrer_email: string;
  created_at: string;
};

type ReferralRow = {
  id: string;
  referral_code: string | null;
  referrer_email: string | null;
  referred_email: string | null;
  status: string | null;
  credit_amount: number | null;
  service_invoice_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  referred_user_id: string | null;
  referrer_user_id: string | null;
  first_paid_invoice_id: string | null;
  credited_at: string | null;
  source: string | null;
  credited: boolean | null;
  credited_invoice_id: string | null;
  credit_cents: number | null;
  discount_cents: number | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  client_id: string | null;
  status: string | null;
  customer_email: string | null;
  customer_name: string | null;
  total_cents: number | null;
  final_paid_cents: number | null;
  paid_at: string | null;
  created_at: string | null;
};

type TrackingState =
  | "broken"
  | "request-only"
  | "code-linked"
  | "converted"
  | "credit-due"
  | "credited";

type RichReqRow = ReqRow & {
  referrer_email: string | null;
  code_exists: boolean;
  referral_records: ReferralRow[];
  invoice_rows: InvoiceRow[];
  matched_invoice: InvoiceRow | null;
  converted: boolean;
  credited: boolean;
  credit_due_cents: number;
  credit_paid_cents: number;
  tracking_state: TrackingState;
  tracking_note: string;
};

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function centsToMoney(cents?: number | null) {
  const value = Number(cents ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function shortId(id: string) {
  return id ? `${id.slice(0, 8)}…` : "";
}

function sumNums(values: Array<number | null | undefined>) {
  return values.reduce<number>((sum, n) => sum + (Number.isFinite(Number(n)) ? Number(n) : 0), 0);
}

function TrackingBadge({
  state,
  dueCents,
  paidCents,
}: {
  state: TrackingState;
  dueCents: number;
  paidCents: number;
}) {
  let cls =
    "border-slate-500/40 bg-slate-500/10 text-slate-200";
  let label = "unknown";

  if (state === "broken") {
    cls = "border-rose-400/50 bg-rose-500/15 text-rose-100";
    label = "tracking broken";
  } else if (state === "request-only") {
    cls = "border-slate-500/40 bg-slate-500/10 text-slate-200";
    label = "request only";
  } else if (state === "code-linked") {
    cls = "border-sky-400/50 bg-sky-500/15 text-sky-100";
    label = "code linked";
  } else if (state === "converted") {
    cls = "border-violet-400/50 bg-violet-500/15 text-violet-100";
    label = "converted";
  } else if (state === "credit-due") {
    cls = "border-amber-400/50 bg-amber-500/15 text-amber-100";
    label = `credit due ${centsToMoney(dueCents)}`;
  } else if (state === "credited") {
    cls = "border-emerald-400/50 bg-emerald-500/15 text-emerald-100";
    label = `credited ${centsToMoney(paidCents)}`;
  }

  return (
    <Badge className={cls + " text-[11px] uppercase tracking-[0.16em]"}>
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: ReqRow["status"] }) {
  const cls =
    status === "new"
      ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
      : status === "invited"
      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
      : "border-slate-500/40 bg-slate-500/10 text-slate-200";

  const label =
    status === "new" ? "new" : status === "invited" ? "invited" : "ignored";

  return (
    <Badge className={cls + " text-[11px] uppercase tracking-[0.18em]"}>
      {label}
    </Badge>
  );
}

export default function AdminReferralRequestsPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | ReqRow["status"]>("all");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery<RichReqRow[]>({
    queryKey: ["admin:referral_invite_requests:audit"],
    queryFn: async () => {
      const [{ data: reqData, error: reqError }, { data: codeData, error: codeError }, { data: referralData, error: referralError }, { data: invoiceData, error: invoiceError }] =
        await Promise.all([
          supabaseClient
            .from("referral_invite_requests")
            .select("id, full_name, email, referral_code, status, created_at")
            .order("created_at", { ascending: false }),

          supabaseClient
            .from("referral_codes")
            .select("referral_code, referrer_email, created_at"),

          supabaseClient
            .from("referrals")
            .select(
              [
                "id",
                "referral_code",
                "referrer_email",
                "referred_email",
                "status",
                "credit_amount",
                "service_invoice_id",
                "created_at",
                "updated_at",
                "referred_user_id",
                "referrer_user_id",
                "first_paid_invoice_id",
                "credited_at",
                "source",
                "credited",
                "credited_invoice_id",
                "credit_cents",
                "discount_cents",
              ].join(", ")
            ),

          supabaseClient
            .from("tech_invoices")
            .select(
              [
                "id",
                "invoice_number",
                "client_id",
                "status",
                "customer_email",
                "customer_name",
                "total_cents",
                "final_paid_cents",
                "paid_at",
                "created_at",
              ].join(", ")
            ),
        ]);

      if (reqError) throw reqError;
      if (codeError) throw codeError;
      if (referralError) throw referralError;
      if (invoiceError) throw invoiceError;

      const requests = (reqData ?? []) as ReqRow[];
      const codes = (codeData ?? []) as ReferralCodeRow[];
      const referrals = (referralData ?? []) as unknown as ReferralRow[];
      const invoices = (invoiceData ?? []) as unknown as InvoiceRow[];

      const codeByCode = new Map<string, ReferralCodeRow>();
      for (const codeRow of codes) {
        codeByCode.set(norm(codeRow.referral_code), codeRow);
      }

      const referralsByEmail = new Map<string, ReferralRow[]>();
      const referralsByCode = new Map<string, ReferralRow[]>();

      for (const ref of referrals) {
        const emailKey = norm(ref.referred_email);
        const codeKey = norm(ref.referral_code);

        if (emailKey) {
          const arr = referralsByEmail.get(emailKey) ?? [];
          arr.push(ref);
          referralsByEmail.set(emailKey, arr);
        }

        if (codeKey) {
          const arr = referralsByCode.get(codeKey) ?? [];
          arr.push(ref);
          referralsByCode.set(codeKey, arr);
        }
      }

      const invoicesByEmail = new Map<string, InvoiceRow[]>();
      const invoicesById = new Map<string, InvoiceRow>();

      for (const invoice of invoices) {
        const emailKey = norm(invoice.customer_email);
        if (emailKey) {
          const arr = invoicesByEmail.get(emailKey) ?? [];
          arr.push(invoice);
          invoicesByEmail.set(emailKey, arr);
        }
        invoicesById.set(invoice.id, invoice);
      }

      const richRows: RichReqRow[] = requests.map((req) => {
        const emailKey = norm(req.email);
        const codeKey = norm(req.referral_code);

        const codeRow = codeKey ? codeByCode.get(codeKey) ?? null : null;

        const relatedByEmail = referralsByEmail.get(emailKey) ?? [];
        const relatedByCode = codeKey ? referralsByCode.get(codeKey) ?? [] : [];

        const referralRecordsMap = new Map<string, ReferralRow>();
        [...relatedByEmail, ...relatedByCode].forEach((row) => {
          referralRecordsMap.set(row.id, row);
        });
        const referralRecords = Array.from(referralRecordsMap.values());

        const invoiceRowsMap = new Map<string, InvoiceRow>();
        const emailInvoices = invoicesByEmail.get(emailKey) ?? [];
        emailInvoices.forEach((inv) => invoiceRowsMap.set(inv.id, inv));

        referralRecords.forEach((ref) => {
          const linkedInvoiceIds = uniq(
            [
              ref.service_invoice_id,
              ref.first_paid_invoice_id,
              ref.credited_invoice_id,
            ].filter(Boolean) as string[]
          );

          linkedInvoiceIds.forEach((id) => {
            const inv = invoicesById.get(id);
            if (inv) invoiceRowsMap.set(inv.id, inv);
          });
        });

        const invoiceRows = Array.from(invoiceRowsMap.values()).sort((a, b) => {
          const aTime = new Date(a.paid_at || a.created_at || 0).getTime();
          const bTime = new Date(b.paid_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });

        const matchedInvoice =
          invoiceRows.find((inv) => norm(inv.status) === "paid") ??
          invoiceRows[0] ??
          null;

        const codeExists = !!codeRow;
        const referrer_email =
          codeRow?.referrer_email?.trim() ||
          referralRecords.find((r) => norm(r.referrer_email))?.referrer_email?.trim() ||
          null;

        const converted =
          invoiceRows.length > 0 ||
          referralRecords.length > 0;

        const creditedRows = referralRecords.filter((r) => r.credited === true);
        const credited = creditedRows.length > 0;

        const creditPaidCents = sumNums(
          creditedRows.map((r) =>
            r.credit_cents != null
              ? r.credit_cents
              : r.credit_amount != null
              ? Math.round(Number(r.credit_amount) * 100)
              : 0
          )
        );

        const creditDueRows = referralRecords.filter(
          (r) =>
            r.credited !== true &&
            (
              (r.credit_cents != null && Number(r.credit_cents) > 0) ||
              (r.credit_amount != null && Number(r.credit_amount) > 0)
            )
        );

        const creditDueCents = sumNums(
          creditDueRows.map((r) =>
            r.credit_cents != null
              ? r.credit_cents
              : r.credit_amount != null
              ? Math.round(Number(r.credit_amount) * 100)
              : 0
          )
        );

        let tracking_state: TrackingState = "request-only";
        let tracking_note = "Request exists, but no referral linkage has been captured yet.";

        if (!req.referral_code) {
          tracking_state = "broken";
          tracking_note =
            "This request has no referral code saved, so the system cannot prove who referred this person.";
        } else if (req.referral_code && !codeExists) {
          tracking_state = "broken";
          tracking_note =
            "This request has a referral code value, but that code does not exist in referral_codes.";
        } else if (req.referral_code && codeExists && referralRecords.length === 0) {
          tracking_state = "code-linked";
          tracking_note =
            "The request is tied to a valid referral code and referrer, but no referral conversion row exists yet.";
        } else if (credited) {
          tracking_state = "credited";
          tracking_note =
            "A referral row exists and credit has already been applied.";
        } else if (creditDueCents > 0) {
          tracking_state = "credit-due";
          tracking_note =
            "A referral row exists and the credit amount is present, but it is not marked credited yet.";
        } else if (converted) {
          tracking_state = "converted";
          tracking_note =
            "Conversion activity exists, but no earned credit amount is recorded yet.";
        }

        return {
          ...req,
          email: norm(req.email),
          referral_code: req.referral_code ? String(req.referral_code).trim() : null,
          referrer_email,
          code_exists: codeExists,
          referral_records: referralRecords,
          invoice_rows: invoiceRows,
          matched_invoice: matchedInvoice,
          converted,
          credited,
          credit_due_cents: creditDueCents,
          credit_paid_cents: creditPaidCents,
          tracking_state,
          tracking_note,
        };
      });

      return richRows;
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const filtered = React.useMemo(() => {
    const q = norm(search);

    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;

      const hay = [
        r.full_name,
        r.email,
        r.referral_code ?? "",
        r.referrer_email ?? "",
        r.status,
        r.tracking_state,
        r.id,
        r.matched_invoice?.invoice_number ?? "",
        r.matched_invoice?.customer_name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [rows, search, filter]);

  const counts = React.useMemo(() => {
    const all = rows.length;
    const n = rows.filter((r) => r.status === "new").length;
    const i = rows.filter((r) => r.status === "invited").length;
    const g = rows.filter((r) => r.status === "ignored").length;

    const broken = rows.filter((r) => r.tracking_state === "broken").length;
    const converted = rows.filter((r) => r.converted).length;
    const due = rows.filter((r) => r.tracking_state === "credit-due").length;
    const credited = rows.filter((r) => r.tracking_state === "credited").length;

    const totalDueCents = rows.reduce((sum, r) => sum + r.credit_due_cents, 0);
    const totalPaidCents = rows.reduce((sum, r) => sum + r.credit_paid_cents, 0);

    return {
      all,
      new: n,
      invited: i,
      ignored: g,
      broken,
      converted,
      due,
      credited,
      totalDueCents,
      totalPaidCents,
    };
  }, [rows]);

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ReqRow["status"];
    }) => {
      const { error } = await supabaseClient
        .from("referral_invite_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["admin:referral_invite_requests:audit"],
      });
    },
  });

  function openCreateCustomer(r: RichReqRow) {
    const qs = new URLSearchParams();

    qs.set("email", r.email);
    qs.set("name", r.full_name);
    qs.set("requestId", r.id);

    if (r.referral_code) qs.set("ref", r.referral_code);
    if (r.referrer_email) qs.set("referrerEmail", r.referrer_email);
    if (r.credit_due_cents > 0) qs.set("creditDueCents", String(r.credit_due_cents));
    if (r.credit_paid_cents > 0) qs.set("creditPaidCents", String(r.credit_paid_cents));

    updateStatus.mutate({ id: r.id, status: "invited" });
    router.push(`/admin/portal/customers/new?${qs.toString()}`);
  }

  async function copyTracking(r: RichReqRow) {
    const text = [
      `Request ID: ${r.id}`,
      `Lead: ${r.full_name} <${r.email}>`,
      `Request status: ${r.status}`,
      `Referral code: ${r.referral_code ?? "none"}`,
      `Code exists: ${r.code_exists ? "yes" : "no"}`,
      `Referrer email: ${r.referrer_email ?? "unknown"}`,
      `Tracking state: ${r.tracking_state}`,
      `Tracking note: ${r.tracking_note}`,
      `Converted: ${r.converted ? "yes" : "no"}`,
      `Credited: ${r.credited ? "yes" : "no"}`,
      `Credit due: ${centsToMoney(r.credit_due_cents)}`,
      `Credit paid: ${centsToMoney(r.credit_paid_cents)}`,
      `Referral rows: ${r.referral_records.length}`,
      `Invoice rows: ${r.invoice_rows.length}`,
      `Latest invoice: ${r.matched_invoice?.invoice_number ?? "none"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(r.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {}
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[radial-gradient(circle_at_top,_#1e293b_0,_#020617_40%,_#000000_100%)] text-slate-100">
      <div className="max-w-7xl mx-auto space-y-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/portal/customers"
              className="inline-flex items-center text-sm text-slate-300 hover:text-slate-50 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to customers
            </Link>
          </div>

          <div className="inline-flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/25 blur-xl" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-sky-500 to-blue-700 shadow-[0_0_25px_rgba(16,185,129,0.45)]">
                <Sparkles className="w-6 h-6 text-slate-950" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Referral Requests Audit
              </h1>
              <p className="text-sm text-slate-400">
                Full visibility into request tracking, referral linkage, conversion, and credit state.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          {[
            {
              label: "Total requests",
              value: counts.all,
              sub: `${counts.new} new`,
              icon: ScanSearch,
            },
            {
              label: "Broken tracking",
              value: counts.broken,
              sub: "missing code or bad linkage",
              icon: TriangleAlert,
            },
            {
              label: "Converted",
              value: counts.converted,
              sub: "referral row or invoice found",
              icon: CheckCircle2,
            },
            {
              label: "Credits due",
              value: centsToMoney(counts.totalDueCents),
              sub: `${counts.due} requests`,
              icon: BadgeDollarSign,
            },
            {
              label: "Credits paid",
              value: centsToMoney(counts.totalPaidCents),
              sub: `${counts.credited} requests`,
              icon: Check,
            },
            {
              label: "Invited",
              value: counts.invited,
              sub: `${counts.ignored} ignored`,
              icon: Mail,
            },
          ].map((item) => (
            <Card
              key={item.label}
              className="border border-slate-700/80 bg-slate-950/55 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.72)]"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-50">
                      {item.value}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{item.sub}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80">
                    <item.icon className="h-5 w-5 text-emerald-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead, email, code, referrer, tracking state, invoice…"
              className="pl-9 bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-400/70 focus-visible:ring-2 focus-visible:border-emerald-400/70"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-1.5 py-1 flex-wrap">
            {(
              [
                { key: "all", label: `All (${counts.all})` },
                { key: "new", label: `New (${counts.new})` },
                { key: "invited", label: `Invited (${counts.invited})` },
                { key: "ignored", label: `Ignored (${counts.ignored})` },
              ] as const
            ).map((t) => {
              const active = filter === (t.key as any);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilter(t.key as any)}
                  className={[
                    "px-3 py-1 text-xs rounded-full transition-all",
                    active
                      ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                      : "text-slate-300 hover:bg-slate-800/70",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <Card className="border border-slate-700/80 bg-slate-950/55 backdrop-blur-xl shadow-[0_22px_70px_rgba(15,23,42,0.9)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                Requests with audit detail
              </span>
              <span className="text-xs text-slate-400">{filtered.length} shown</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 md:p-5">
            {isLoading ? (
              <div className="py-14 text-center text-slate-400 text-sm">
                Loading referral requests…
              </div>
            ) : isError ? (
              <div className="py-14 text-center text-rose-300 text-sm">
                Unable to load referral request audit data right now.
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-sm">
                No requests match your search/filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => {
                  const created = r.created_at
                    ? format(new Date(r.created_at), "MMM d, yyyy h:mma")
                    : "";

                  const lastPaid = r.matched_invoice?.paid_at
                    ? format(new Date(r.matched_invoice.paid_at), "MMM d, yyyy h:mma")
                    : null;

                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="rounded-2xl border border-slate-700/80 bg-slate-950/55 px-4 py-4 md:px-5 md:py-5"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/70 border border-slate-700">
                              <User className="h-5 w-5 text-slate-200" />
                            </div>

                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-50">
                                  {r.full_name}
                                </p>
                                <StatusBadge status={r.status} />
                                <TrackingBadge
                                  state={r.tracking_state}
                                  dueCents={r.credit_due_cents}
                                  paidCents={r.credit_paid_cents}
                                />
                                {r.referral_code ? (
                                  <Badge className="border-sky-400/40 bg-sky-500/10 text-sky-200 text-[11px]">
                                    ref:
                                    <span className="ml-1 font-mono tracking-[0.18em]">
                                      {r.referral_code}
                                    </span>
                                  </Badge>
                                ) : (
                                  <Badge className="border-rose-400/40 bg-rose-500/10 text-rose-200 text-[11px]">
                                    missing code
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <span className="break-all">{r.email}</span>
                                </span>

                                <span className="inline-flex items-center gap-1 text-slate-400">
                                  <Clock className="h-3 w-3" />
                                  Requested {created}
                                </span>

                                <span className="inline-flex items-center gap-1 text-slate-500">
                                  <Link2 className="h-3 w-3" />
                                  {shortId(r.id)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => openCreateCustomer(r)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                            >
                              Create Invite
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>

                            <Button
                              variant="outline"
                              onClick={() => copyTracking(r)}
                              className="border-slate-600/70 bg-slate-950/60 text-slate-50 hover:bg-slate-900"
                            >
                              {copiedId === r.id ? (
                                <Check className="w-4 h-4 mr-2 text-emerald-300" />
                              ) : (
                                <Copy className="w-4 h-4 mr-2 text-slate-300" />
                              )}
                              {copiedId === r.id ? "Copied" : "Copy tracking"}
                            </Button>

                            <Button
                              variant="outline"
                              disabled={updateStatus.isPending}
                              onClick={() =>
                                updateStatus.mutate({ id: r.id, status: "invited" })
                              }
                              className="border-emerald-400/40 bg-slate-950/60 text-slate-50 hover:bg-emerald-500/10"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-300" />
                              Mark invited
                            </Button>

                            <Button
                              variant="outline"
                              disabled={updateStatus.isPending}
                              onClick={() =>
                                updateStatus.mutate({ id: r.id, status: "ignored" })
                              }
                              className="border-slate-600/70 bg-slate-950/60 text-slate-50 hover:bg-slate-900"
                            >
                              <XCircle className="w-4 h-4 mr-2 text-slate-300" />
                              Ignore
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              Referrer tracking
                            </div>

                            <div className="mt-2 space-y-1.5 text-sm">
                              <div className="text-slate-50 font-medium">
                                {r.referrer_email ?? "Unknown referrer"}
                              </div>

                              <div className="text-xs text-slate-400">
                                Code exists:{" "}
                                <span className={r.code_exists ? "text-emerald-300" : "text-rose-300"}>
                                  {r.code_exists ? "yes" : "no"}
                                </span>
                              </div>

                              <div className="text-xs text-slate-400">
                                Request code:{" "}
                                <span className="text-slate-200">
                                  {r.referral_code ?? "none"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              Credit tracking
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="text-slate-400 text-xs">Due</div>
                                <div className="text-slate-50 font-semibold">
                                  {centsToMoney(r.credit_due_cents)}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-400 text-xs">Paid</div>
                                <div className="text-slate-50 font-semibold">
                                  {centsToMoney(r.credit_paid_cents)}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-400 text-xs">Referral rows</div>
                                <div className="text-slate-200">
                                  {r.referral_records.length}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-400 text-xs">Credited</div>
                                <div className="text-slate-200">
                                  {r.credited ? "Yes" : "No"}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              Conversion tracking
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="text-slate-400 text-xs">Converted</div>
                                <div className="text-slate-50 font-semibold">
                                  {r.converted ? "Yes" : "No"}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-400 text-xs">Invoices</div>
                                <div className="text-slate-50 font-semibold">
                                  {r.invoice_rows.length}
                                </div>
                              </div>

                              <div className="col-span-2">
                                <div className="text-slate-400 text-xs">Latest invoice</div>
                                <div className="text-slate-200">
                                  {r.matched_invoice?.invoice_number
                                    ? `${r.matched_invoice.invoice_number} • ${centsToMoney(
                                        r.matched_invoice.final_paid_cents ?? r.matched_invoice.total_cents
                                      )}`
                                    : "No invoice found"}
                                </div>
                              </div>

                              <div className="col-span-2">
                                <div className="text-slate-400 text-xs">Paid at</div>
                                <div className="text-slate-200">
                                  {lastPaid ?? "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className={[
                            "flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs leading-5",
                            r.tracking_state === "broken"
                              ? "border border-rose-500/30 bg-rose-500/10 text-rose-100"
                              : "border border-slate-800 bg-slate-950/60 text-slate-300",
                          ].join(" ")}
                        >
                          {r.tracking_state === "broken" ? (
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          ) : r.tracking_state === "credit-due" ? (
                            <BadgeDollarSign className="h-4 w-4 mt-0.5 shrink-0" />
                          ) : r.tracking_state === "credited" ? (
                            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                          ) : (
                            <CircleDashed className="h-4 w-4 mt-0.5 shrink-0" />
                          )}
                          <div>{r.tracking_note}</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400 leading-6">
          This audit page is now grounded only in your real tables:
          <span className="text-slate-200"> referral_invite_requests</span>,
          <span className="text-slate-200"> referral_codes</span>,
          <span className="text-slate-200"> referrals</span>, and
          <span className="text-slate-200"> tech_invoices</span>.
          Right now your database shows that requests can still be created without a saved
          referral code, which is why broken tracking is now surfaced hard instead of hidden.
        </div>
      </div>
    </div>
  );
}