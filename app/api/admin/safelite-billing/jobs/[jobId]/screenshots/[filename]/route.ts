import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { assertAdminRequest, getAdminSupabaseClient } from "@/lib/admin/apiAuth";

export const runtime = "nodejs";

function safeSegment(v: string) {
  return path.basename(String(v || ""));
}

export async function GET(
  req: Request,
  context: { params: Promise<{ jobId: string; filename: string }> }
) {
  const admin = getAdminSupabaseClient();
  const auth = await assertAdminRequest(req, admin);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { jobId, filename } = await context.params;
  const safeJobId = safeSegment(jobId);
  const safeFilename = safeSegment(filename);

  if (!safeJobId || !safeFilename.endsWith(".png")) {
    return NextResponse.json({ error: "Invalid screenshot path." }, { status: 400 });
  }

  const { data: job, error } = await admin
    .from("safelite_billing_jobs")
    .select("id, screenshots_json")
    .eq("id", safeJobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: "Safelite job not found." }, { status: 404 });
  }

  const screenshots = Array.isArray(job.screenshots_json) ? job.screenshots_json : [];
  const matchingShot = screenshots.find((shot: any) => {
    const shotPath = String(shot?.filePath ?? "");
    const storagePath = String(shot?.storage_path ?? "");
    return path.basename(shotPath || storagePath) === safeFilename;
  });

  if (!matchingShot) {
    return NextResponse.json({ error: "Screenshot is not attached to this job." }, { status: 404 });
  }

  const storageBucket = String(matchingShot.storage_bucket ?? "");
  const storagePath = String(matchingShot.storage_path ?? "");
  if (storageBucket && storagePath) {
    const { data, error: downloadError } = await admin.storage
      .from(storageBucket)
      .download(storagePath);

    if (downloadError || !data) {
      return NextResponse.json(
        { error: downloadError?.message || "Screenshot artifact not found." },
        { status: 404 }
      );
    }

    return new Response(data, {
      headers: {
        "content-type": matchingShot.contentType || "image/png",
        "cache-control": "private, max-age=60",
      },
    });
  }

  const filePath = path.join(
    process.cwd(),
    ".safelite-screenshots",
    safeJobId,
    safeFilename
  );

  try {
    const bytes = await fs.readFile(filePath);
    return new Response(bytes, {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Screenshot file not found." }, { status: 404 });
  }
}
