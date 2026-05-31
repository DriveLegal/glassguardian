import "server-only";

import { NextResponse } from "next/server";

import { getAdminSupabaseClient } from "@/lib/admin/apiAuth";

export const runtime = "nodejs";

const ALLOWED_PROGRESS_STATUSES = new Set(["running"]);

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

function uniqueBy(items: any[], keyFor: (item: any) => string) {
  const seen = new Set<string>();
  const unique: any[] = [];

  for (const item of items) {
    const key = keyFor(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function logKey(item: any) {
  return `${String(item?.at ?? "")}|${String(item?.message ?? "")}`;
}

function screenshotKey(item: any) {
  return String(item?.storage_path ?? item?.filePath ?? `${item?.at ?? ""}|${item?.name ?? ""}`);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = assertWorkerRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { jobId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const admin = getAdminSupabaseClient();

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

  const existingLogs = Array.isArray(job.logs_json) ? job.logs_json : [];
  const existingScreenshots = Array.isArray(job.screenshots_json) ? job.screenshots_json : [];
  const nextLogs = Array.isArray(body?.logs) ? body.logs : [];
  const nextScreenshots = Array.isArray(body?.screenshots) ? body.screenshots : [];
  const requestedStatus = String(body?.status ?? "").trim();
  const nextStatus = ALLOWED_PROGRESS_STATUSES.has(requestedStatus)
    ? requestedStatus
    : job.status;

  const { data: updatedJob, error: updateError } = await admin
    .from("safelite_billing_jobs")
    .update({
      status: nextStatus,
      logs_json: uniqueBy([...existingLogs, ...nextLogs], logKey),
      screenshots_json: uniqueBy([...existingScreenshots, ...nextScreenshots], screenshotKey),
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
