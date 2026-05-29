import "server-only";

import { NextResponse } from "next/server";

import { getAdminSupabaseClient } from "@/lib/admin/apiAuth";

export const runtime = "nodejs";

function log(message: string) {
  return {
    at: new Date().toISOString(),
    message,
  };
}

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

export async function POST(req: Request) {
  const auth = assertWorkerRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getAdminSupabaseClient();
  const body = await req.json().catch(() => ({}));
  const workerId = String(body?.workerId || "safelite-worker").slice(0, 120);

  const { data: candidates, error } = await admin
    .from("safelite_billing_jobs")
    .select("*")
    .in("status", ["pending", "needs_login"])
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const candidate of candidates ?? []) {
    const existingLogs = Array.isArray(candidate.logs_json) ? candidate.logs_json : [];
    const { data: claimed, error: claimError } = await admin
      .from("safelite_billing_jobs")
      .update({
        status: "running",
        logs_json: [...existingLogs, log(`Worker ${workerId} claimed job.`)],
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id)
      .in("status", ["pending", "needs_login"])
      .select("*")
      .maybeSingle();

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    if (claimed) {
      return NextResponse.json({ ok: true, job: claimed });
    }
  }

  return NextResponse.json({ ok: true, job: null });
}
