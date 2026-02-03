// app/admin/(protected)/portal/bookingleads/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { format } from "date-fns";

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
} from "lucide-react";

type AnyObj = Record<string, any>;

/* -------------------- Helpers -------------------- */

async function fetchBookingLead(id: string): Promise<AnyObj | null> {
  const { data, error } = await supabaseClient
    .from("booking_leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data ?? null;
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000; // 1000–9999
  return `INV-${y}${m}${d}-${rand}`;
}

/* -------------------- Page -------------------- */

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
  } = useQuery({
    queryKey: ["admin:booking_lead", id],
    queryFn: () => fetchBookingLead(String(id)),
    enabled: !!id,
  });

  // 🔹 Mutation: create an appointment from this lead, then route to it
  //    ➕ ALSO create a stub tech_invoice so WindshieldRepairMap can attach later.
  const createFromLeadMutation = useMutation({
    mutationFn: async (leadArg: AnyObj) => {
      // appointments.customer_email is NOT NULL, but the lead has only name/phone/zip.
      // So we synthesize a placeholder email if none exists.
      const rawEmail: string | null =
        leadArg.customer_email ??
        leadArg.email ??
        leadArg.contact_email ??
        null;

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
        // if you ever start collecting notes/email for leads, this will still pass through:
        notes_customer: leadArg.notes ?? null,
        service_address: leadArg.location ?? leadArg.zip ?? null,
        // ❌ no notes_internal here, because that column doesn't exist in appointments
      };

      const { data, error } = await supabaseClient
        .from("appointments")
        .insert([payload])
        .select("id, customer_email, service_address")
        .single();

      if (error) {
        console.error(
          "Supabase insert error (appointments from lead):",
          error
        );
        throw new Error(error.message || "Failed to create appointment");
      }

      const apptRow = data as {
        id: string;
        customer_email: string | null;
        service_address: string | null;
      };

      // 🔹 Best-effort: create a stub tech_invoice so the windshield component
      //    has an invoice to attach markers to later.
      try {
        const todayIso = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        const invoiceNumber = generateInvoiceNumber();

        await supabaseClient
          .from("tech_invoices")
          .insert([
            {
              appointment_id: apptRow.id,
              customer_email: apptRow.customer_email ?? safeEmail,
              service_address: apptRow.service_address ?? null,
              customer_name: leadArg.full_name ?? null,

              // schema-required fields
              invoice_number: invoiceNumber,
              invoice_date: todayIso,
              status: "draft", // let trigger only act when set to "finalized"/"paid" later

              // numeric fields safe defaults
              subtotal_cents: 0,
              discount_cents: 0,
              tax_cents: 0,
              total_cents: 0,

              // mapping base
              windshield_repairs_json: [], // start empty; techs will fill via WindshieldRepairMap
              services_json: [], // optional: clear list for future line items
            },
          ]);
      } catch (techErr: any) {
        console.error(
          "Supabase insert error (tech_invoices from lead):",
          techErr?.message ?? techErr
        );
        // Don't block the appointment creation / navigation if this fails.
      }

      return { id: apptRow.id };
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["admin:appointments"] });
      router.push(`/admin/portal/appointments/${row.id}`);
    },
    onError: (err) => {
      console.error(
        "createFromLead error",
        err instanceof Error ? err.message : err
      );
      // hook up toast here if you want
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <Card className="max-w-md w-full border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold text-slate-50 mb-2">
              Lead not found
            </h2>
            <p className="text-sm text-slate-300 mb-2">
              This booking lead could not be loaded. It may have been removed.
            </p>
            {leadError && (
              <p className="text-xs text-slate-500 mb-4">
                {(leadError as any)?.message ?? ""}
              </p>
            )}
            <Button
              onClick={() => router.push("/admin/portal/bookingleads")}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Back to Booking Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const createdAt = lead.created_at ? new Date(lead.created_at) : null;
  const createdLabel = createdAt
    ? format(createdAt, "MMM d, yyyy • h:mm a")
    : "Just now";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-4 py-6 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/portal/bookingleads">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to leads
              </Button>
            </Link>

            <Badge className="bg-cyan-500/15 text-cyan-100 border-cyan-400/60 text-[11px] uppercase tracking-[0.2em]">
              Website Lead
            </Badge>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-300">
            <Clock className="h-4 w-4 text-slate-400" />
            Captured {createdLabel}
          </div>
        </div>

        {/* Main Card */}
        <Card className="border border-white/10 bg-slate-950/80 backdrop-blur-2xl shadow-[0_32px_120px_rgba(15,23,42,0.95)] overflow-hidden relative">
          {/* subtle top glow */}
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
            <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sky-50">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/20 border border-cyan-300/60">
                    <Sparkles className="h-4 w-4 text-cyan-100" />
                  </span>
                  <span className="text-lg md:text-xl font-semibold">
                    New booking lead from {lead.full_name}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-200 max-w-xl">
                  This visitor started a booking directly from the public
                  website. Review their details and optionally follow up or
                  create a full appointment.
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 text-right">
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  Lead ID
                </span>
                <span className="text-xs font-mono text-slate-100">
                  {String(lead.id)}
                </span>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="relative z-10 grid gap-6 md:grid-cols-3 p-6 md:p-7">
            {/* Left: contact & context */}
            <div className="md:col-span-2 space-y-5">
              {/* Contact */}
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-slate-50 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-cyan-300" />
                    Contact
                  </h3>
                  <span className="text-[11px] text-slate-300">
                    Captured {createdLabel}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Full name</p>
                    <p className="font-medium text-slate-100">
                      {lead.full_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Phone</p>
                    <p className="font-medium text-slate-100">{lead.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">ZIP</p>
                    <p className="font-medium text-slate-100">{lead.zip}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Source</p>
                    <p className="font-medium text-slate-100">
                      {lead.source ?? "sticky_cta"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Service intent */}
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <h3 className="font-semibold text-slate-50 mb-3">
                  Service intent
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Chip count</p>
                    <p className="font-medium text-slate-100">
                      {lead.chips ?? 0} chip
                      {lead.chips === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Requested slot</p>
                    <p className="font-medium text-slate-100">
                      {lead.slot ?? "No specific time selected"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Priority</p>
                    <p className="font-medium text-emerald-300">
                      High-intent website lead
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: photo + quick actions */}
            <div className="space-y-5">
              {/* Photo preview */}
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-slate-50">
                  <Camera className="h-4 w-4 text-sky-300" />
                  Submitted photo
                </h3>
                {lead.photo_url ? (
                  <a
                    href={lead.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg overflow-hidden border border-slate-700 bg-black/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lead.photo_url}
                      alt="Damage photo"
                      className="w-full h-40 object-cover"
                    />
                    <div className="px-2 py-1 text-[11px] text-slate-200 bg-slate-950/70">
                      Tap to open in new tab
                    </div>
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">
                    No photo was attached with this lead.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
                <h3 className="font-semibold mb-2 text-emerald-100">
                  Next steps
                </h3>
                <p className="text-xs text-emerald-50 mb-3">
                  Use this lead to follow up with the customer and spin it into
                  a full scheduled job from your operations panel.
                </p>
                <div className="flex flex-col gap-2">
                  {/* 🔹 Create appointment & route straight to its detail page */}
                  <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold"
                    disabled={!lead || createFromLeadMutation.isPending}
                    onClick={() => {
                      if (!lead) return;
                      createFromLeadMutation.mutate(lead);
                    }}
                  >
                    {createFromLeadMutation.isPending
                      ? "Creating appointment..."
                      : "Set up appointment"}
                  </Button>

                  <Link href="/admin/portal/bookingleads">
                    <Button
                      variant="outline"
                      className="w-full border-emerald-300/60 text-emerald-100 text-xs hover:bg-emerald-400/10"
                    >
                      Back to Booking Leads
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}