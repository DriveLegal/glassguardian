import "server-only";

import path from "node:path";
import { NextResponse } from "next/server";

import { getAdminSupabaseClient } from "@/lib/admin/apiAuth";

export const runtime = "nodejs";

const DEFAULT_BUCKET = "safelite-job-artifacts";

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

function safeSegment(v: string) {
  return path
    .basename(String(v || "artifact"))
    .replace(/[^a-z0-9_.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "artifact";
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
  const safeJobId = safeSegment(jobId);
  const admin = getAdminSupabaseClient();

  const { data: job, error: jobError } = await admin
    .from("safelite_billing_jobs")
    .select("id")
    .eq("id", safeJobId)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: "Safelite job not found." }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing artifact file." }, { status: 400 });
  }

  const name = String(form.get("name") || "screenshot");
  const at = String(form.get("at") || new Date().toISOString());
  const fileName = safeSegment(file.name || `${name}.png`);
  const bucket = process.env.SAFELITE_ARTIFACT_BUCKET || DEFAULT_BUCKET;
  const storagePath = `${safeJobId}/${Date.now()}-${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/png";

  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    artifact: {
      at,
      name,
      fileName,
      contentType,
      size: bytes.byteLength,
      storage_bucket: bucket,
      storage_path: storagePath,
    },
  });
}
