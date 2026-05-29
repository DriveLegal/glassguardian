// app/admin/(protected)/portal/bookingleads/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  ArrowLeft,
  Phone,
  Sparkles,
  Camera,
  Clock,
  MessageCircle,
  CalendarCheck,
  CheckCircle2,
  Ban,
  Loader2,
  StickyNote,
  RefreshCw,
  MapPin,
  UserRound,
  CircleDashed,
} from "lucide-react";

type AnyObj = Record<string, any>;

type LeadStatus =
  | "new"
  | "contacted"
  | "booked"
  | "completed"
  | "no_response"
  | "canceled";

type LeadNote = {
  id: string;
  lead_id: string;
  note: string;
  admin_email: string | null;
  admin_name: string | null;
  created_at: string;
};

const STATUS_META: Record<
  LeadStatus,
  {
    label: string;
    description: string;
    className: string;
    dotClassName: string;
    icon: React.ElementType;
  }
> = {
  new: {
    label: "New",
    description: "Fresh website lead that still needs first contact.",
    className: "border-amber-300/40 bg-amber-400/10 text-amber-100",
    dotClassName: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.85)]",
    icon: Sparkles,
  },
  contacted: {
    label: "Contacted",
    description: "You already reached out to this lead.",
    className: "border-sky-300/40 bg-sky-400/10 text-sky-100",
    dotClassName: "bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.85)]",
    icon: MessageCircle,
  },
  booked: {
    label: "Booked",
    description: "This lead converted into an appointment.",
    className: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    dotClassName: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.85)]",
    icon: CalendarCheck,
  },
  completed: {
    label: "Completed",
    description: "Repair/job completed.",
    className: "border-green-300/40 bg-green-400/10 text-green-100",
    dotClassName: "bg-green-300 shadow-[0_0_14px_rgba(134,239,172,0.85)]",
    icon: CheckCircle2,
  },
  no_response: {
    label: "No Response",
    description: "Customer has not answered yet.",
    className: "border-slate-500/60 bg-slate-500/10 text-slate-200",
    dotClassName: "bg-slate-400",
    icon: CircleDashed,
  },
  canceled: {
    label: "Canceled",
    description: "Customer canceled or lead is no longer active.",
    className: "border-rose-300/40 bg-rose-400/10 text-rose-100",
    dotClassName: "bg-rose-300 shadow-[0_0_14px_rgba(253,164,175,0.75)]",
    icon: Ban,
  },
};

function safeString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function pickLeadName(lead: AnyObj | null | undefined) {
  return (
    safeString(lead?.full_name) ||
    safeString(lead?.name) ||
    safeString(lead?.customer_name) ||
    safeString(
      lead?.first_name || lead?.last_name
        ? `${safeString(lead?.first_name)} ${safeString(lead?.last_name)}`.trim()
        : "",
    ) ||
    "Unknown lead"
  );
}

function pickLeadPhone(lead: AnyObj | null | undefined) {
  return (
    safeString(lead?.phone) ||
    safeString(lead?.mobile) ||
    safeString(lead?.phone_number) ||
    safeString(lead?.contact_phone) ||
    ""
  );
}

function pickLeadZip(lead: AnyObj | null | undefined) {
  return safeString(lead?.zip) || safeString(lead?.postal_code) || "";
}

function pickLeadSource(lead: AnyObj | null | undefined) {
  return (
    safeString(lead?.source) ||
    safeString(lead?.utm_source) ||
    safeString(lead?.origin) ||
    safeString(lead?.channel) ||
    "sticky_cta"
  );
}

function pickLeadStatus(lead: AnyObj | null | undefined): LeadStatus {
  const raw = safeString(lead?.status) as LeadStatus;
  return raw && raw in STATUS_META ? raw : "new";
}

function pickLeadEmail(lead: AnyObj | null | undefined) {
  return (
    safeString(lead?.customer_email) ||
    safeString(lead?.email) ||
    safeString(lead?.contact_email) ||
    ""
  );
}

function formatRelative(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return formatDistanceToNow(date, { addSuffix: true });
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return format(date, "MMM d, yyyy • h:mm a");
}

async function fetchBookingLead(id: string): Promise<AnyObj | null> {
  const { data, error } = await supabaseClient
    .from("booking_leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data ?? null;
}

async function fetchLeadNotes(leadId: string): Promise<LeadNote[]> {
  const { data, error } = await supabaseClient
    .from("booking_lead_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LeadNote[];
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;

  return `INV-${y}${m}${d}-${rand}`;
}

export default function AdminBookingLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const id = params?.id;

  const {
    data: lead,
    isLoading,
    isError,
    error: leadError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin:booking_lead", id],
    queryFn: () => fetchBookingLead(String(id)),
    enabled: !!id,
  });

  const {
    data: leadNotes = [],
    isLoading: isLoadingNotes,
    isFetching: isFetchingNotes,
  } = useQuery({
    queryKey: ["admin:booking_lead_notes", id],
    queryFn: () => fetchLeadNotes(String(id)),
    enabled: !!id,
  });

  const [notesDraft, setNotesDraft] = React.useState("");

  const updateLeadMutation = useMutation({
    mutationFn: async (patch: Partial<AnyObj>) => {
      if (!id) throw new Error("Missing lead id");

      const { data, error, count } = await supabaseClient
        .from("booking_leads")
        .update(patch, { count: "exact" })
        .eq("id", id)
        .select("id,status,last_contacted_at");

      console.log("booking_leads update result:", {
        data,
        error,
        count,
        patch,
        id,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error(
          "Update matched 0 rows. Check RLS policy, lead id, or admin access.",
        );
      }

      return data[0];
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin:booking_lead", id] });
      await qc.invalidateQueries({
        queryKey: ["admin:booking_leads"],
        exact: false,
      });
      await qc.invalidateQueries({
        queryKey: ["admin:booking_leads_stats"],
        exact: false,
      });
      await refetch();
    },
    onError: (error) => {
      console.error("Failed to update booking lead:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not update booking lead.",
      );
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      if (!id) throw new Error("Missing lead id");

      const trimmed = noteText.trim();
      if (!trimmed) throw new Error("Note cannot be empty.");

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      const adminEmail = user?.email ?? null;
      const adminName =
        user?.user_metadata?.full_name ??
        user?.user_metadata?.name ??
        adminEmail ??
        "Admin";

      const { data, error } = await supabaseClient
        .from("booking_lead_notes")
        .insert([
          {
            lead_id: id,
            note: trimmed,
            admin_email: adminEmail,
            admin_name: adminName,
          },
        ])
        .select("*")
        .single();

      if (error) throw error;

      return data as LeadNote;
    },
    onSuccess: async () => {
      setNotesDraft("");
      await qc.invalidateQueries({
        queryKey: ["admin:booking_lead_notes", id],
      });
    },
    onError: (error) => {
      console.error("Failed to save note:", error);
      alert(error instanceof Error ? error.message : "Could not save note.");
    },
  });

  const createFromLeadMutation = useMutation({
    mutationFn: async (leadArg: AnyObj) => {
      const rawEmail: string | null =
        leadArg.customer_email ?? leadArg.email ?? leadArg.contact_email ?? null;

      const leadKey = leadArg.id ?? `tmp-${Date.now()}`;
      const safeEmail =
        rawEmail ?? `lead-${String(leadKey)}@placeholder.glassguardian.local`;

      const payload: AnyObj = {
        status: "requested",
        service_type: (
          leadArg.service_type ??
          leadArg.lead_type ??
          "chip_repair"
        ).toString(),
        customer_email: safeEmail,
        notes_customer: null,
        service_address: leadArg.location ?? leadArg.zip ?? null,
      };

      const { data, error } = await supabaseClient
        .from("appointments")
        .insert([payload])
        .select("id, customer_email, service_address")
        .single();

      if (error) {
        console.error("Supabase insert error (appointments from lead):", error);
        throw new Error(error.message || "Failed to create appointment");
      }

      const apptRow = data as {
        id: string;
        customer_email: string | null;
        service_address: string | null;
      };

      try {
        const todayIso = new Date().toISOString().slice(0, 10);
        const invoiceNumber = generateInvoiceNumber();

        await supabaseClient.from("tech_invoices").insert([
          {
            appointment_id: apptRow.id,
            customer_email: apptRow.customer_email ?? safeEmail,
            service_address: apptRow.service_address ?? null,
            customer_name: leadArg.full_name ?? leadArg.name ?? null,

            invoice_number: invoiceNumber,
            invoice_date: todayIso,
            status: "draft",

            subtotal_cents: 0,
            discount_cents: 0,
            tax_cents: 0,
            total_cents: 0,

            windshield_repairs_json: [],
            services_json: [],
          },
        ]);
      } catch (techErr: any) {
        console.error(
          "Supabase insert error (tech_invoices from lead):",
          techErr?.message ?? techErr,
        );
      }

      const { error: leadUpdateError } = await supabaseClient
        .from("booking_leads")
        .update({
          status: "booked",
          last_contacted_at:
            leadArg.last_contacted_at ?? new Date().toISOString(),
        })
        .eq("id", leadArg.id);

      if (leadUpdateError) {
        console.error("Failed to auto-mark lead as booked:", leadUpdateError);
      }

      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        await supabaseClient.from("booking_lead_notes").insert([
          {
            lead_id: leadArg.id,
            note: `Converted to appointment ${apptRow.id}.`,
            admin_email: user?.email ?? null,
            admin_name:
              user?.user_metadata?.full_name ??
              user?.user_metadata?.name ??
              user?.email ??
              "Admin",
          },
        ]);
      } catch (noteErr: any) {
        console.error(
          "Failed to create conversion note:",
          noteErr?.message ?? noteErr,
        );
      }

      return { id: apptRow.id };
    },
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["admin:appointments"] });
      await qc.invalidateQueries({ queryKey: ["admin:booking_lead", id] });
      await qc.invalidateQueries({
        queryKey: ["admin:booking_lead_notes", id],
      });
      await qc.invalidateQueries({
        queryKey: ["admin:booking_leads"],
        exact: false,
      });
      await qc.invalidateQueries({
        queryKey: ["admin:booking_leads_stats"],
        exact: false,
      });

      router.push(`/admin/portal/appointments/${row.id}`);
    },
    onError: (err) => {
      console.error(
        "createFromLead error",
        err instanceof Error ? err.message : err,
      );
      alert(
        err instanceof Error
          ? err.message
          : "Could not create appointment from this lead.",
      );
    },
  });

  function updateStatus(status: LeadStatus) {
    const patch: AnyObj = { status };

    if (status === "contacted" || status === "booked") {
      patch.last_contacted_at = new Date().toISOString();
    }

    updateLeadMutation.mutate(patch);
  }

  function saveNotes() {
    createNoteMutation.mutate(notesDraft);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold text-slate-50">
              Lead not found
            </h2>
            <p className="mb-2 text-sm text-slate-300">
              This booking lead could not be loaded. It may have been removed.
            </p>
            {leadError && (
              <p className="mb-4 text-xs text-slate-500">
                {(leadError as any)?.message ?? ""}
              </p>
            )}
            <Button
              onClick={() => router.push("/admin/portal/bookingleads")}
              className="bg-sky-600 text-white hover:bg-sky-700"
            >
              Back to Booking Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = pickLeadName(lead);
  const phone = pickLeadPhone(lead);
  const zip = pickLeadZip(lead);
  const email = pickLeadEmail(lead);
  const source = pickLeadSource(lead);
  const status = pickLeadStatus(lead);
  const statusMeta = STATUS_META[status];
  const StatusIcon = statusMeta.icon;

  const createdLabel = formatDateLabel(lead.created_at);
  const lastContactedLabel = formatRelative(lead.last_contacted_at);

  const isSaving = updateLeadMutation.isPending;
  const isSavingNote = createNoteMutation.isPending;
  const isCreatingAppointment = createFromLeadMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/portal/bookingleads">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to leads
              </Button>
            </Link>

            <Badge className="border-cyan-400/60 bg-cyan-500/15 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
              Website Lead
            </Badge>

            <StatusBadge status={status} />
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-300/60 hover:bg-slate-900"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",
                  isFetching ? "animate-spin text-cyan-200" : "text-slate-400",
                ].join(" ")}
              />
              Refresh
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Clock className="h-4 w-4 text-slate-400" />
              Captured {createdLabel}
            </div>
          </div>
        </div>

        <Card className="relative overflow-hidden border border-white/10 bg-slate-950/80 shadow-[0_32px_120px_rgba(15,23,42,0.95)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-80 mix-blend-screen">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(700px 420px at 0% 0%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(700px 420px at 100% 100%, rgba(59,130,246,0.3), transparent 55%)",
              }}
            />
          </div>

          <CardHeader className="relative z-10 pb-4">
            <CardTitle className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sky-50">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-400/20">
                    <Sparkles className="h-4 w-4 text-cyan-100" />
                  </span>
                  <span className="text-lg font-semibold md:text-xl">
                    Booking lead from {name}
                  </span>
                </div>

                <p className="mt-2 max-w-xl text-xs text-slate-200">
                  Review lead details, track outreach, save timestamped notes,
                  and convert this website lead into a full appointment when
                  ready.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    <Clock className="mr-1 h-3 w-3" />
                    {createdLabel}
                  </Badge>

                  {lastContactedLabel && (
                    <Badge className="border-sky-300/30 bg-sky-400/10 text-sky-100">
                      <MessageCircle className="mr-1 h-3 w-3" />
                      Contacted {lastContactedLabel}
                    </Badge>
                  )}

                  <Badge className="border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                    <StickyNote className="mr-1 h-3 w-3" />
                    {leadNotes.length} note{leadNotes.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col items-start gap-1 text-left md:items-end md:text-right">
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  Lead ID
                </span>
                <span className="max-w-[280px] truncate font-mono text-xs text-slate-100">
                  {String(lead.id)}
                </span>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="relative z-10 grid gap-6 p-6 md:grid-cols-3 md:p-7">
            <div className="space-y-5 md:col-span-2">
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-50">
                    <Phone className="h-4 w-4 text-cyan-300" />
                    Contact
                  </h3>
                  <span className="text-[11px] text-slate-300">
                    Captured {createdLabel}
                  </span>
                </div>

                <div className="grid gap-4 text-sm md:grid-cols-2">
                  <DetailField label="Full name" value={name} />
                  <DetailField label="Phone" value={phone || "Not provided"} />
                  <DetailField label="Email" value={email || "Not provided"} />
                  <DetailField label="ZIP" value={zip || "Not provided"} />
                  <DetailField label="Source" value={source} />
                  <DetailField
                    label="Status"
                    value={statusMeta.label}
                    valueClassName="text-cyan-100"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {phone && (
                    <a href={`tel:${phone}`}>
                      <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                        <Phone className="mr-2 h-4 w-4" />
                        Call lead
                      </Button>
                    </a>
                  )}

                  <Button
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => updateStatus("contacted")}
                    className="border-sky-300/50 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageCircle className="mr-2 h-4 w-4" />
                    )}
                    Mark contacted
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-50">
                  <MapPin className="h-4 w-4 text-emerald-300" />
                  Service intent
                </h3>

                <div className="grid gap-4 text-sm md:grid-cols-3">
                  <DetailField
                    label="Chip count"
                    value={`${lead.chips ?? 0} chip${
                      lead.chips === 1 ? "" : "s"
                    }`}
                  />
                  <DetailField
                    label="Requested slot"
                    value={lead.slot ?? "No specific time selected"}
                  />
                  <DetailField
                    label="Priority"
                    value="High-intent website lead"
                    valueClassName="text-emerald-300"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-50">
                    <StickyNote className="h-4 w-4 text-cyan-300" />
                    Lead notes
                  </h3>

                  <Button
                    size="sm"
                    disabled={isSavingNote || !notesDraft.trim()}
                    onClick={saveNotes}
                    className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingNote ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Add note
                  </Button>
                </div>

                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Example: Called customer, left voicemail. Damage looks repairable from photo. Follow up tomorrow."
                  className="min-h-[110px] w-full resize-none rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-400/10"
                />

                <div className="mt-4 space-y-3">
                  {isLoadingNotes || isFetchingNotes ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading notes…
                    </div>
                  ) : leadNotes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-3 py-3 text-xs text-slate-400">
                      No notes yet.
                    </div>
                  ) : (
                    leadNotes.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <Badge className="border-cyan-300/30 bg-cyan-400/10 text-cyan-100">
                            Admin
                          </Badge>

                          <span className="text-[11px] text-slate-400">
                            {formatDateLabel(item.created_at)}
                          </span>
                        </div>

                        <p className="whitespace-pre-wrap text-sm text-slate-100">
                          {item.note}
                        </p>

                        <div className="mt-2 text-[11px] text-slate-500">
                          By {item.admin_name || item.admin_email || "Admin"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <h3 className="mb-3 font-semibold text-slate-50">
                  Lead lifecycle
                </h3>

                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatusAction
                    label="New"
                    icon={Sparkles}
                    active={status === "new"}
                    disabled={isSaving}
                    onClick={() => updateStatus("new")}
                  />
                  <StatusAction
                    label="Contacted"
                    icon={MessageCircle}
                    active={status === "contacted"}
                    disabled={isSaving}
                    onClick={() => updateStatus("contacted")}
                  />
                  <StatusAction
                    label="Booked"
                    icon={CalendarCheck}
                    active={status === "booked"}
                    disabled={isSaving}
                    onClick={() => updateStatus("booked")}
                  />
                  <StatusAction
                    label="Completed"
                    icon={CheckCircle2}
                    active={status === "completed"}
                    disabled={isSaving}
                    onClick={() => updateStatus("completed")}
                  />
                  <StatusAction
                    label="No Response"
                    icon={CircleDashed}
                    active={status === "no_response"}
                    disabled={isSaving}
                    onClick={() => updateStatus("no_response")}
                  />
                  <StatusAction
                    label="Canceled"
                    icon={Ban}
                    active={status === "canceled"}
                    disabled={isSaving}
                    onClick={() => updateStatus("canceled")}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-xs text-slate-400">
                    Manual status
                  </label>

                  <select
                    value={status}
                    disabled={isSaving}
                    onChange={(event) =>
                      updateStatus(event.target.value as LeadStatus)
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition hover:border-cyan-300/60 focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {Object.entries(STATUS_META).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>

                  {isSaving && (
                    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-50">
                  <Camera className="h-4 w-4 text-sky-300" />
                  Submitted photo
                </h3>

                {lead.photo_url ? (
                  <a
                    href={lead.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-slate-700 bg-black/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lead.photo_url}
                      alt="Damage photo"
                      className="h-40 w-full object-cover"
                    />
                    <div className="bg-slate-950/70 px-2 py-1 text-[11px] text-slate-200">
                      Tap to open in new tab
                    </div>
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">
                    No photo was attached with this lead.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-5">
                <h3 className="mb-2 flex items-center gap-2 font-semibold text-cyan-100">
                  <StatusIcon className="h-4 w-4" />
                  Current status
                </h3>

                <StatusBadge status={status} />

                <p className="mt-3 text-xs text-cyan-50/90">
                  {statusMeta.description}
                </p>

                {lastContactedLabel ? (
                  <p className="mt-2 text-[11px] text-slate-300">
                    Last contacted {lastContactedLabel}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-300">
                    No outreach timestamp saved yet.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
                <h3 className="mb-2 font-semibold text-emerald-100">
                  Next steps
                </h3>

                <p className="mb-3 text-xs text-emerald-50">
                  Creating an appointment automatically marks this lead as{" "}
                  <span className="font-semibold">Booked</span>.
                </p>

                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full bg-emerald-500 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                    disabled={!lead || isCreatingAppointment}
                    onClick={() => createFromLeadMutation.mutate(lead)}
                  >
                    {isCreatingAppointment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating appointment...
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="mr-2 h-4 w-4" />
                        Set up appointment
                      </>
                    )}
                  </Button>

                  <Link href="/admin/portal/bookingleads">
                    <Button
                      variant="outline"
                      className="w-full border-emerald-300/60 text-xs text-emerald-100 hover:bg-emerald-400/10"
                    >
                      Back to Booking Leads
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-50">
                  <UserRound className="h-4 w-4 text-slate-300" />
                  Raw lead info
                </h3>

                <div className="space-y-2 text-xs">
                  <RawField label="Lead ID" value={safeString(lead.id)} />
                  <RawField label="Created" value={createdLabel} />
                  <RawField label="Source" value={source} />
                  <RawField
                    label="Photo URL"
                    value={safeString(lead.photo_url)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  valueClassName = "text-slate-100",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={["font-medium", valueClassName].join(" ")}>{value}</p>
    </div>
  );
}

function RawField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-all font-mono text-[11px] text-slate-300">
        {value || "—"}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        meta.className,
      ].join(" ")}
    >
      <span
        className={["h-1.5 w-1.5 rounded-full", meta.dotClassName].join(" ")}
      />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function StatusAction({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100 shadow-[0_0_18px_rgba(56,189,248,0.22)]"
          : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-cyan-300/60 hover:bg-cyan-500/10 hover:text-cyan-100",
      ].join(" ")}
    >
      {disabled ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}