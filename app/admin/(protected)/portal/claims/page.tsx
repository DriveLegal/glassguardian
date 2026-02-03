// app/admin/(protected)/portal/claims/page.tsx
"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Edit,
  Download,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Hash,
  Mail,
  Phone,
  User,
  DollarSign,
  ClipboardList,
  FileText,
  X,
  ChevronRight,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ========= Types (loose) ========= */
type AnyObj = Record<string, any>;
type ClaimStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "approved"
  | "denied"
  | "paid";

type Claim = {
  id: string;
  created_at?: string;
  customer_email: string;
  claim_number: string;
  status: ClaimStatus;
  insurance_carrier: string;
  policy_number: string;
  claim_amount?: number;
  approved_amount?: number | null;
  denial_reason?: string | null;
  adjuster_name?: string | null;
  adjuster_phone?: string | null;
  adjuster_email?: string | null;
  notes?: string | null;
  submitted_date?: string | null;
  approval_date?: string | null;
  paid_date?: string | null;
};

function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

type Tone = "slate" | "blue" | "amber" | "emerald" | "rose" | "violet";

function statusTone(status?: string): Tone {
  const s = norm(status);
  if (s === "paid") return "emerald";
  if (s === "approved") return "emerald";
  if (s === "pending_review") return "amber";
  if (s === "submitted") return "blue";
  if (s === "denied") return "rose";
  if (s === "draft") return "slate";
  return "violet";
}

function toneClasses(t: Tone) {
  switch (t) {
    case "emerald":
      return {
        chip: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25",
        left: "#10b981",
        glow: "shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_12px_60px_-30px_rgba(16,185,129,0.55)]",
      };
    case "blue":
      return {
        chip: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25",
        left: "#38bdf8",
        glow: "shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_12px_60px_-30px_rgba(56,189,248,0.55)]",
      };
    case "amber":
      return {
        chip: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25",
        left: "#f59e0b",
        glow: "shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_12px_60px_-30px_rgba(245,158,11,0.55)]",
      };
    case "rose":
      return {
        chip: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25",
        left: "#fb7185",
        glow: "shadow-[0_0_0_1px_rgba(251,113,133,0.22),0_12px_60px_-30px_rgba(251,113,133,0.55)]",
      };
    case "slate":
      return {
        chip: "bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/25",
        left: "#94a3b8",
        glow: "shadow-[0_0_0_1px_rgba(148,163,184,0.18),0_12px_60px_-30px_rgba(148,163,184,0.35)]",
      };
    default:
      return {
        chip: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/25",
        left: "#8b5cf6",
        glow: "shadow-[0_0_0_1px_rgba(139,92,246,0.22),0_12px_60px_-30px_rgba(139,92,246,0.55)]",
      };
  }
}

function money(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function prettyStatus(s?: string) {
  const v = String(s ?? "").trim();
  if (!v) return "unknown";
  return v.replace(/_/g, " ");
}

function clampStr(s: any) {
  return String(s ?? "").trim();
}

function toErrMsg(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as any;
  return anyE?.message || anyE?.error_description || "Unknown error";
}

export default function AdminInsuranceClaimsPage() {
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<
    "all" | "submitted" | "pending_review" | "approved" | "denied" | "paid"
  >("all");

  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [updateData, setUpdateData] = useState({
    status: "" as Claim["status"] | "",
    approved_amount: 0,
    denial_reason: "",
    adjuster_name: "",
    adjuster_phone: "",
    adjuster_email: "",
    notes: "",
  });

  /* ========= Data ========= */
  const {
    data: claims = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin:insurance-claims"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("insurance_claims")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Claim[];
    },
    staleTime: 10_000,
    retry: 1,
  });

  const filteredClaims = useMemo(() => {
    const s = search.trim().toLowerCase();
    const byTab =
      filter === "all" ? claims : claims.filter((c) => c.status === filter);

    if (!s) return byTab;

    return byTab.filter((c) => {
      const hay = [
        c.id,
        c.customer_email,
        c.claim_number,
        c.status,
        c.insurance_carrier,
        c.policy_number,
        c.adjuster_name,
        c.adjuster_email,
        c.adjuster_phone,
        c.denial_reason,
        c.notes,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return hay.includes(s);
    });
  }, [claims, filter, search]);

  /* ========= Mutations ========= */
  const updateClaimMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AnyObj }) => {
      const patch: AnyObj = { ...data };

      // Auto-stamp dates on state transitions
      if (data.status === "submitted") patch.submitted_date = new Date().toISOString();
      if (data.status === "approved") patch.approval_date = new Date().toISOString();
      if (data.status === "paid") patch.paid_date = new Date().toISOString();

      const { error } = await supabaseClient
        .from("insurance_claims")
        .update(patch)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin:insurance-claims"] });
      setDialogOpen(false);
    },
  });

  /* ========= Handlers ========= */
  function handleEdit(claim: Claim) {
    setSelectedClaim(claim);
    setUpdateData({
      status: claim.status,
      approved_amount: Number(claim.approved_amount ?? 0),
      denial_reason: claim.denial_reason ?? "",
      adjuster_name: claim.adjuster_name ?? "",
      adjuster_phone: claim.adjuster_phone ?? "",
      adjuster_email: claim.adjuster_email ?? "",
      notes: claim.notes ?? "",
    });
    setDialogOpen(true);
  }

  /* ========= Stats ========= */
  const statTotal = claims.length;
  const statPending = claims.filter((c) =>
    ["submitted", "pending_review"].includes(c.status)
  ).length;
  const statApproved = claims.filter((c) => c.status === "approved").length;
  const statPaid = claims.filter((c) => c.status === "paid").length;
  const statDenied = claims.filter((c) => c.status === "denied").length;

  const statTotalValue = claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
  const statApprovedValue = claims.reduce(
    (sum, c) => sum + (Number(c.approved_amount ?? 0) || 0),
    0
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(900px_520px_at_80%_20%,rgba(16,185,129,0.16),transparent_55%),radial-gradient(900px_520px_at_55%_95%,rgba(139,92,246,0.16),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.35] bg-[linear-gradient(to_bottom,rgba(2,6,23,0.92),rgba(2,6,23,0.96))]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:radial-gradient(rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/12 blur-3xl" />
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Sticky Header (mobile-safe) */}
          <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 md:py-4 backdrop-blur-xl bg-slate-950/55 border-b border-white/10">
            <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                    Insurance Claims
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-slate-200">
                      <Sparkles className="h-3.5 w-3.5 text-violet-200" />
                      Admin
                    </span>
                  </h1>
                  <p className="text-slate-300/80 mt-1 text-sm md:text-base">
                    Process, review, approve, and track claim payouts.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 md:items-end">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => refetch()}
                      aria-label="Refresh"
                      className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                    >
                      <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
                    <span className="text-xs text-slate-200">Compact</span>
                    <Switch checked={compact} onCheckedChange={setCompact} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-[560px]">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search claim #, customer, policy, carrier, adjuster…"
                      className="pl-9 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                    />
                  </div>
                </div>

                {isError ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-rose-200 bg-rose-500/10 ring-1 ring-rose-400/20 px-3 py-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="truncate">
                        Couldn’t load claims: {toErrMsg(error)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      className="border-rose-400/20 bg-white/5 text-slate-100 hover:bg-white/10"
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Stats (mobile-first) */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-6">
            {[
              { label: "Total", value: statTotal, tone: "slate" as Tone, icon: ClipboardList },
              { label: "Pending", value: statPending, tone: "amber" as Tone, icon: Filter },
              { label: "Approved", value: statApproved, tone: "emerald" as Tone, icon: Shield },
              { label: "Denied", value: statDenied, tone: "rose" as Tone, icon: X },
              { label: "Paid", value: statPaid, tone: "emerald" as Tone, icon: DollarSign },
              { label: "Claim Value", value: money(statTotalValue), tone: "violet" as Tone, icon: FileText },
            ].map((s, idx) => {
              const cls = toneClasses(s.tone);
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-black/10 ring-1 ring-white/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-slate-200" />
                          </div>
                          <div className="text-xs text-slate-400 truncate">{s.label}</div>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cls.chip}`}>
                          {s.tone}
                        </span>
                      </div>

                      <div className="mt-2 text-2xl md:text-3xl font-extrabold text-slate-100 break-words">
                        {s.value as any}
                      </div>

                      {s.label === "Approved" ? (
                        <div className="mt-1 text-xs text-slate-400">
                          Approved value:{" "}
                          <span className="text-slate-200 font-semibold">
                            {money(statApprovedValue)}
                          </span>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Filters (mobile scroll tabs) */}
          <Card className="mt-6 border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
            <CardContent className="p-3 md:p-5">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                <TabsList
                  className={[
                    "w-full bg-black/10 ring-1 ring-white/10",
                    "flex items-center justify-start gap-2",
                    "overflow-x-auto whitespace-nowrap",
                    "px-2 py-2 rounded-xl",
                    "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
                  ].join(" ")}
                >
                  <TabsTrigger className="shrink-0" value="all">
                    All ({claims.length})
                  </TabsTrigger>
                  <TabsTrigger className="shrink-0" value="submitted">
                    Submitted
                  </TabsTrigger>
                  <TabsTrigger className="shrink-0" value="pending_review">
                    Pending
                  </TabsTrigger>
                  <TabsTrigger className="shrink-0" value="approved">
                    Approved
                  </TabsTrigger>
                  <TabsTrigger className="shrink-0" value="denied">
                    Denied
                  </TabsTrigger>
                  <TabsTrigger className="shrink-0" value="paid">
                    Paid
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* Claims List */}
          <div className="mt-6 space-y-3">
            {isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 rounded-2xl bg-white/5 ring-1 ring-white/10 animate-pulse"
                  />
                ))}
              </div>
            ) : isError ? (
              <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                <CardContent className="p-8 sm:p-10 text-center">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/20 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-rose-200" />
                  </div>
                  <div className="mt-4 text-lg font-bold text-slate-100">
                    Claims failed to load
                  </div>
                  <div className="mt-1 text-sm text-slate-400 break-words">
                    {toErrMsg(error)}
                  </div>
                  <div className="mt-5 flex items-center justify-center">
                    <Button
                      onClick={() => refetch()}
                      className="bg-sky-600 hover:bg-sky-700 text-white"
                    >
                      Retry
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : filteredClaims.length === 0 ? (
              <Card className="border-none rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-xl">
                <CardContent className="p-8 sm:p-10 text-center">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-black/10 ring-1 ring-white/10 flex items-center justify-center">
                    <ClipboardList className="h-6 w-6 text-slate-200" />
                  </div>
                  <div className="mt-4 text-lg font-bold text-slate-100">
                    No claims match your filters
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Try a different tab or search query.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence initial={false}>
                {filteredClaims.map((claim) => {
                  const tone = statusTone(claim.status);
                  const cls = toneClasses(tone);

                  const createdLabel = claim.created_at
                    ? format(new Date(claim.created_at), "MMM d, yyyy")
                    : "—";

                  return (
                    <motion.div
                      key={claim.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.16 }}
                    >
                      <Card
                        className={[
                          "border-none rounded-2xl overflow-hidden",
                          "bg-white/5 ring-1 ring-white/10 backdrop-blur-xl",
                          "shadow-[0_20px_90px_-60px_rgba(0,0,0,0.8)]",
                          cls.glow,
                        ].join(" ")}
                        style={{ borderLeft: `4px solid ${cls.left}` }}
                      >
                        <CardContent className={compact ? "p-4" : "p-5 sm:p-6"}>
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-4">
                                <div className="h-12 w-12 shrink-0 rounded-2xl bg-black/10 ring-1 ring-white/10 flex items-center justify-center">
                                  <Shield className="h-6 w-6 text-emerald-200" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg md:text-xl font-extrabold text-slate-100">
                                          Claim #{claim.claim_number}
                                        </h3>
                                        <Badge className={`${cls.chip} capitalize`}>
                                          {prettyStatus(claim.status)}
                                        </Badge>
                                        <span className="text-xs text-slate-400">
                                          Created {createdLabel}
                                        </span>
                                      </div>

                                      <div className="mt-1 text-sm text-slate-300 truncate">
                                        {claim.customer_email}
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    className={[
                                      "mt-4 grid gap-3",
                                      compact
                                        ? "grid-cols-1 sm:grid-cols-3"
                                        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
                                    ].join(" ")}
                                  >
                                    <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                                      <div className="text-[11px] text-slate-400">Insurance</div>
                                      <div className="text-sm font-semibold text-slate-100 truncate">
                                        {clampStr(claim.insurance_carrier) || "—"}
                                      </div>
                                    </div>

                                    <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                                      <div className="text-[11px] text-slate-400">Policy #</div>
                                      <div className="text-sm font-semibold text-slate-100 truncate">
                                        {clampStr(claim.policy_number) || "—"}
                                      </div>
                                    </div>

                                    <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                                      <div className="text-[11px] text-slate-400">Claim Amount</div>
                                      <div className="text-sm font-extrabold text-emerald-200">
                                        {money(claim.claim_amount)}
                                      </div>
                                    </div>

                                    {!compact ? (
                                      <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                                        <div className="text-[11px] text-slate-400">Approved Amount</div>
                                        <div className="text-sm font-extrabold text-sky-200">
                                          {money(claim.approved_amount)}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>

                                  {!compact ? (
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                                        <div className="flex items-center gap-2 text-slate-200">
                                          <User className="h-4 w-4 text-slate-300" />
                                          <div className="text-[11px] text-slate-400">Adjuster</div>
                                        </div>
                                        <div className="mt-1 text-sm text-slate-100 font-semibold truncate">
                                          {claim.adjuster_name || "—"}
                                        </div>
                                      </div>

                                      <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                                        <div className="flex items-center gap-2 text-slate-200">
                                          <Phone className="h-4 w-4 text-slate-300" />
                                          <div className="text-[11px] text-slate-400">Phone</div>
                                        </div>
                                        <div className="mt-1 text-sm text-slate-100 font-semibold truncate">
                                          {claim.adjuster_phone || "—"}
                                        </div>
                                      </div>

                                      <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                                        <div className="flex items-center gap-2 text-slate-200">
                                          <Mail className="h-4 w-4 text-slate-300" />
                                          <div className="text-[11px] text-slate-400">Email</div>
                                        </div>
                                        <div className="mt-1 text-sm text-slate-100 font-semibold truncate">
                                          {claim.adjuster_email || "—"}
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* Actions (mobile full-width buttons) */}
                            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-stretch gap-2 lg:justify-end lg:min-w-[220px]">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 w-full"
                                onClick={() => {
                                  // stub: attach your packet generator later
                                }}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Packet
                              </Button>

                              <Button
                                onClick={() => handleEdit(claim)}
                                variant="outline"
                                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 w-full"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Update
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Update Dialog (mobile-safe sizing + scroll) */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="bg-slate-950/85 border-white/10 text-slate-100 backdrop-blur-xl w-[calc(100vw-1.5rem)] sm:w-auto sm:max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                    <Hash className="h-5 w-5 text-slate-200" />
                  </div>
                  Update Claim #{selectedClaim?.claim_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    <div className="text-xs text-slate-400">Customer</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100 break-all">
                      {selectedClaim?.customer_email || "—"}
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                        <div className="text-[11px] text-slate-400">Claim Amount</div>
                        <div className="mt-1 text-sm font-extrabold text-emerald-200">
                          {money(selectedClaim?.claim_amount)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/10 ring-1 ring-white/10 p-3">
                        <div className="text-[11px] text-slate-400">Approved</div>
                        <div className="mt-1 text-sm font-extrabold text-sky-200">
                          {money(selectedClaim?.approved_amount)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    <Label className="text-slate-200">Status</Label>
                    <select
                      value={updateData.status}
                      onChange={(e) =>
                        setUpdateData({
                          ...updateData,
                          status: e.target.value as any,
                        })
                      }
                      className="w-full mt-2 p-3 rounded-xl bg-black/20 text-slate-100 border border-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="approved">Approved</option>
                      <option value="denied">Denied</option>
                      <option value="paid">Paid</option>
                    </select>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-slate-200">Adjuster Name</Label>
                        <Input
                          value={updateData.adjuster_name}
                          onChange={(e) =>
                            setUpdateData({
                              ...updateData,
                              adjuster_name: e.target.value,
                            })
                          }
                          className="mt-2 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-200">Adjuster Phone</Label>
                        <Input
                          value={updateData.adjuster_phone}
                          onChange={(e) =>
                            setUpdateData({
                              ...updateData,
                              adjuster_phone: e.target.value,
                            })
                          }
                          className="mt-2 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-200">Adjuster Email</Label>
                        <Input
                          value={updateData.adjuster_email}
                          onChange={(e) =>
                            setUpdateData({
                              ...updateData,
                              adjuster_email: e.target.value,
                            })
                          }
                          className="mt-2 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  {(updateData.status === "approved" || updateData.status === "paid") && (
                    <div className="mb-4">
                      <Label className="text-slate-200">Approved Amount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={updateData.approved_amount}
                        onChange={(e) =>
                          setUpdateData({
                            ...updateData,
                            approved_amount: parseFloat(e.target.value || "0"),
                          })
                        }
                        className="mt-2 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                      />
                      <div className="mt-1 text-xs text-slate-400">
                        If status is <span className="text-slate-200 font-semibold">Paid</span>,
                        keep this accurate for reporting.
                      </div>
                    </div>
                  )}

                  {updateData.status === "denied" && (
                    <div className="mb-4">
                      <Label className="text-slate-200">Denial Reason</Label>
                      <Textarea
                        rows={3}
                        value={updateData.denial_reason}
                        onChange={(e) =>
                          setUpdateData({
                            ...updateData,
                            denial_reason: e.target.value,
                          })
                        }
                        className="mt-2 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-slate-200">Internal Notes</Label>
                    <Textarea
                      rows={3}
                      value={updateData.notes}
                      onChange={(e) =>
                        setUpdateData({ ...updateData, notes: e.target.value })
                      }
                      className="mt-2 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500/40"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <Button
                    onClick={() => setDialogOpen(false)}
                    variant="outline"
                    className="flex-1 border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={() => {
                      if (!selectedClaim) return;
                      updateClaimMutation.mutate({
                        id: selectedClaim.id,
                        data: updateData,
                      });
                    }}
                    disabled={updateClaimMutation.isPending || !selectedClaim}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    {updateClaimMutation.isPending ? "Updating..." : "Update Claim"}
                  </Button>
                </div>

                {updateClaimMutation.isError ? (
                  <div className="text-sm text-rose-200 bg-rose-500/10 ring-1 ring-rose-400/20 px-3 py-2 rounded-xl">
                    Update failed: {toErrMsg(updateClaimMutation.error)}
                  </div>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}