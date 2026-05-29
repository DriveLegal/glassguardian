import "server-only";

import { NextResponse } from "next/server";

import { getAdminSupabaseClient } from "@/lib/admin/apiAuth";

export const runtime = "nodejs";

const ALLOWED_WORKER_STATUSES = new Set([
  "pending",
  "running",
  "needs_invoice_data",
  "needs_login",
  "ready_for_manual_submit",
  "submitted",
  "failed",
]);

function assertWorkerRequest(req: Request) {
  const expected = process.env.SAFELITE_WORKER_TOKEN?.trim();
  const supplied = req.headers.get("x-safelite-worker-token")?.trim();

  if (!expected) {
    return { ok: false as const, status: 500, error: "SAFELITE_WORKER_TOKEN is not configured." };
  }

  if (!supplied || supplied !== expected) {
    return { ok: false as const, status: 401, error: "Invalid Safelite worker token." };
  }

  return { ok: true as const };
}

function finalStatusFromResult(result: any) {
  const status = String(result?.status ?? "").trim();

  if (status === "needs_login") return "needs_login";
  if (!result?.ok) return "failed";
  if (ALLOWED_WORKER_STATUSES.has(status)) return status;

  return "ready_for_manual_submit";
}

function log(message: string) {
  return {
    at: new Date().toISOString(),
    message,
  };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = assertWorkerRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getAdminSupabaseClient();
  const { jobId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const result = body?.result ?? {};

  const { data: job, error: jobError } = await admin
    .from("safelite_billing_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: "Safelite job not found." }, { status: 404 });
  }

  const finalStatus = finalStatusFromResult(result);
  const existingLogs = Array.isArray(job.logs_json) ? job.logs_json : [];
  const resultLogs = Array.isArray(result.logs) ? result.logs : [];
  const screenshots = Array.isArray(body?.screenshots)
    ? body.screenshots
    : Array.isArray(result.screenshots)
      ? result.screenshots
      : [];

  const { data: updatedJob, error: updateError } = await admin
    .from("safelite_billing_jobs")
    .update({
      status: finalStatus,
      logs_json: [
        ...existingLogs,
        ...resultLogs,
        log(`Worker completed job with status ${finalStatus}.`),
      ],
      screenshots_json: screenshots,
      confirmation_number: result.confirmationNumber ?? null,
      error_message: result.error ?? null,
      submitted_at: finalStatus === "submitted" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    job: updatedJob,
  });
}
