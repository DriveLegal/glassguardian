import "server-only";

import { NextResponse } from "next/server";

import { assertAdminRequest, getAdminSupabaseClient } from "@/lib/admin/apiAuth";
import {
  buildSafeliteBillingPayload,
  validateSafeliteBillingPayload,
} from "@/lib/safelite/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  headers.set("Pragma", "no-cache");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

async function fetchVehicleForInvoice(admin: any, invoice: any) {
  if (invoice.vehicle_id) {
    const byId = await admin
      .from("vehicles")
      .select("id, owner_email, make, model, year, color, vin, license_plate, insurance_carrier")
      .eq("id", invoice.vehicle_id)
      .maybeSingle();

    if (!byId.error && byId.data) return byId.data;
  }

  const ownerEmail = String(invoice.customer_email ?? "").trim().toLowerCase();
  if (ownerEmail) {
    const byOwner = await admin
      .from("vehicles")
      .select("id, owner_email, make, model, year, color, vin, license_plate, insurance_carrier")
      .eq("owner_email", ownerEmail)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byOwner.error && byOwner.data) return byOwner.data;
  }

  return null;
}

function getOrigin(req: Request) {
  const envOrigin =
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  if (envOrigin) return envOrigin.replace(/\/+$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "";

  return host ? `${proto}://${host}` : "";
}

function isFreshRunningJob(job: any) {
  if (String(job?.status ?? "") !== "running") return false;

  const updatedAt = new Date(job?.updated_at ?? job?.created_at ?? 0).getTime();
  if (!Number.isFinite(updatedAt)) return false;

  return Date.now() - updatedAt < 15 * 60 * 1000;
}

function buildPreparationLog(existingJob: any, validationOk: boolean) {
  return {
    at: new Date().toISOString(),
    message: existingJob
      ? validationOk
        ? "Safelite billing job reset for retry."
        : "Safelite billing job refreshed but still needs invoice data."
      : validationOk
        ? "Safelite billing job prepared."
        : "Safelite billing job created but needs invoice data.",
  };
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = getAdminSupabaseClient();

    const auth = await assertAdminRequest(req, admin);
    if (!auth.ok) {
      return jsonNoStore({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;

    const { data: job, error } = await admin
      .from("safelite_billing_jobs")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return jsonNoStore({ error: error.message }, { status: 500 });
    }

    return jsonNoStore({ ok: true, job: job ?? null });
  } catch (e: any) {
    return jsonNoStore(
      { error: e?.message || "Failed to load Safelite billing job." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = getAdminSupabaseClient();

    const auth = await assertAdminRequest(req, admin);
    if (!auth.ok) {
      return jsonNoStore({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;

    const { data: invoice, error } = await admin
      .from("tech_invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return jsonNoStore({ error: error.message }, { status: 500 });
    }

    if (!invoice) {
      return jsonNoStore({ error: "Invoice not found." }, { status: 404 });
    }

    const vehicle = await fetchVehicleForInvoice(admin, invoice);

    const payload = buildSafeliteBillingPayload({
      invoice,
      vehicle,
      origin: getOrigin(req),
    });

    const validation = validateSafeliteBillingPayload(payload);

    const createdByEmail =
      (auth as any)?.email ??
      (auth as any)?.user?.email ??
      invoice.technician_email ??
      null;

    const { data: existingJob, error: existingJobError } = await admin
      .from("safelite_billing_jobs")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJobError) {
      return jsonNoStore({ error: existingJobError.message }, { status: 500 });
    }

    if (existingJob?.status === "submitted") {
      return jsonNoStore({
        ok: true,
        job: existingJob,
        status: "already_submitted",
        payload: existingJob.payload_json ?? payload,
        validation: existingJob.validation_json ?? validation,
        automationPlan: [],
      });
    }

    if (isFreshRunningJob(existingJob)) {
      return jsonNoStore({
        ok: true,
        job: existingJob,
        status: "already_running",
        payload: existingJob.payload_json ?? payload,
        validation: existingJob.validation_json ?? validation,
        automationPlan: [],
      });
    }

    const nextStatus = validation.ok ? "pending" : "needs_invoice_data";
    const nextLog = buildPreparationLog(existingJob, validation.ok);

    if (existingJob) {
      const { data: job, error: updateError } = await admin
        .from("safelite_billing_jobs")
        .update({
          status: nextStatus,
          payload_json: payload,
          validation_json: validation,
          logs_json: [nextLog],
          screenshots_json: [],
          confirmation_number: null,
          error_message: validation.ok ? null : "Missing required Safelite billing fields.",
          submitted_at: null,
          created_by_email: createdByEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingJob.id)
        .select("*")
        .single();

      if (updateError) {
        return jsonNoStore({ error: updateError.message }, { status: 500 });
      }

      return jsonNoStore({
        ok: validation.ok,
        job,
        status: validation.ok ? "retry_ready_for_controlled_automation" : "needs_invoice_data",
        payload,
        validation,
        automationPlan: [
          "Click Submit invoice.",
          "Enter shop number.",
          "Enter referral number.",
          "Check shop user acknowledgment.",
          "Continue to Create Invoice.",
          "Fill VIN, invoice number, install date, remove deductible, and customer signature obtained.",
          `Add LABOR Part and set labor to $${payload.laborAmountDollars}.`,
          "Upload the generated PDF as Work Order.",
          "Submit invoice after final validation.",
        ],
      });
    }

    const { data: job, error: jobError } = await admin
      .from("safelite_billing_jobs")
      .insert({
        invoice_id: invoice.id,
        status: validation.ok ? "pending" : "needs_invoice_data",
        payload_json: payload,
        validation_json: validation,
        logs_json: [nextLog],
        screenshots_json: [],
        confirmation_number: null,
        error_message: validation.ok ? null : "Missing required Safelite billing fields.",
        submitted_at: null,
        created_by_email: createdByEmail,
      })
      .select("*")
      .single();

    if (jobError) {
      return jsonNoStore({ error: jobError.message }, { status: 500 });
    }

    return jsonNoStore({
      ok: validation.ok,
      job,
      status: validation.ok ? "ready_for_controlled_automation" : "needs_invoice_data",
      payload,
      validation,
      automationPlan: [
        "Click Submit invoice.",
        "Enter shop number.",
        "Enter referral number.",
        "Check shop user acknowledgment.",
        "Continue to Create Invoice.",
        "Fill VIN, invoice number, install date, remove deductible, and customer signature obtained.",
        `Add LABOR Part and set labor to $${payload.laborAmountDollars}.`,
        "Upload the generated PDF as Work Order.",
        "Submit invoice after final validation.",
      ],
    });
  } catch (e: any) {
    return jsonNoStore(
      { error: e?.message || "Failed to prepare Safelite billing." },
      { status: 500 }
    );
  }
}
