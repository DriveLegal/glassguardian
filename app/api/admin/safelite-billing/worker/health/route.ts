import "server-only";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.SAFELITE_WORKER_TOKEN?.trim();
  const supplied = req.headers.get("x-safelite-worker-token")?.trim();

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "SAFELITE_WORKER_TOKEN is not configured on the app." },
      { status: 500 }
    );
  }

  if (!supplied || supplied !== expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Invalid Safelite worker token. Confirm SAFELITE_WORKER_TOKEN matches the deployed app exactly.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    workerAuth: "ok",
    checkedAt: new Date().toISOString(),
  });
}
