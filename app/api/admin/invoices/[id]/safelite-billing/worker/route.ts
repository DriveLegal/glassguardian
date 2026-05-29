// app/api/admin/invoices/[id]/safelite-billing/worker/route.ts
import "server-only";

import { NextResponse } from "next/server";

import { assertAdminRequest, getAdminSupabaseClient } from "@/lib/admin/apiAuth";
import { runSafeliteBillingWorker } from "@/lib/safelite/worker";

export const runtime = "nodejs";

function log(message: string) {
  return {
    at: new Date().toISOString(),
    message,
  };
}

const ALLOWED_WORKER_STATUSES = new Set([
  "pending",
  "running",
  "needs_invoice_data",
  "needs_login",
  "ready_for_manual_submit",
  "submitted",
  "failed",
]);

function finalStatusFromResult(result: any) {
  const status = String(result?.status ?? "").trim();

  if (status === "needs_login") return "needs_login";
  if (!result?.ok) return "failed";
  if (ALLOWED_WORKER_STATUSES.has(status)) return status;

  return "ready_for_manual_submit";
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = getAdminSupabaseClient();
  let pickedJob: any = null;
  let existingLogs: any[] = [];

  try {
    const { id: invoiceId } = await context.params;
    const auth = await assertAdminRequest(req, admin);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const inlineWorkerEnabled =
      process.env.SAFELITE_ENABLE_INLINE_WORKER === "true" ||
      process.env.NODE_ENV !== "production";

    if (!inlineWorkerEnabled) {
      return NextResponse.json(
        {
          error:
            "Inline Safelite worker is disabled in production. Run the Safelite worker daemon instead.",
        },
        { status: 409 }
      );
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const dryRun = url.searchParams.get("dryRun") === "1" || body?.dryRun === true;
    const allowFinalSubmit = body?.allowFinalSubmit === false ? false : !dryRun;

    const { data: job, error } = await admin
      .from("safelite_billing_jobs")
      .select("*")
      .eq("invoice_id", invoiceId)
      .in("status", ["pending", "needs_login"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({
        ok: true,
        message: "No pending Safelite billing jobs for this invoice.",
      });
    }

    pickedJob = job;
    existingLogs = Array.isArray(job.logs_json) ? job.logs_json : [];

    await admin
      .from("safelite_billing_jobs")
      .update({
        status: "running",
        logs_json: [...existingLogs, log("Worker picked up job.")],
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    const result = await runSafeliteBillingWorker({
      jobId: job.id,
      payload: job.payload_json,
      headless: false,
      allowFinalSubmit,
      keepBrowserOpenOnReady: dryRun,
    });

    const mergedLogs = [
      ...existingLogs,
      log("Worker picked up job."),
      ...(Array.isArray(result.logs) ? result.logs : []),
    ];

    const finalStatus = finalStatusFromResult(result);

    const { data: updatedJob, error: updateError } = await admin
      .from("safelite_billing_jobs")
      .update({
        status: finalStatus,
        logs_json: mergedLogs,
        screenshots_json: Array.isArray(result.screenshots) ? result.screenshots : [],
        confirmation_number: result.confirmationNumber ?? null,
        error_message: result.error ?? null,
        submitted_at: finalStatus === "submitted" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      const fallbackMessage = `Could not persist Safelite job status "${finalStatus}": ${updateError.message}`;
      const { data: fallbackJob, error: fallbackError } = await admin
        .from("safelite_billing_jobs")
        .update({
          status: "failed",
          logs_json: [...mergedLogs, log(fallbackMessage)],
          screenshots_json: Array.isArray(result.screenshots) ? result.screenshots : [],
          confirmation_number: result.confirmationNumber ?? null,
          error_message: [result.error, fallbackMessage].filter(Boolean).join(" | "),
          submitted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .select("*")
        .maybeSingle();

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }

      return NextResponse.json(
        {
          ok: false,
          error: fallbackMessage,
          job: fallbackJob,
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      job: updatedJob,
      result,
    });
  } catch (e: any) {
    const errorMessage = e?.message || "Safelite worker failed.";

    if (pickedJob?.id) {
      await admin
        .from("safelite_billing_jobs")
        .update({
          status: "failed",
          logs_json: [
            ...existingLogs,
            log("Worker picked up job."),
            log(errorMessage),
          ],
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pickedJob.id);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
