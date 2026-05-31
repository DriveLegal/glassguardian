import "dotenv/config";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runSafeliteBillingWorker } from "../lib/safelite/worker";

type SafeliteJob = {
  id: string;
  invoice_id: string;
  payload_json: any;
};

type WorkerResult = Awaited<ReturnType<typeof runSafeliteBillingWorker>>;

const apiBaseUrl = (
  process.env.SAFELITE_WORKER_API_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_ORIGIN ||
  "http://localhost:3000"
).replace(/\/+$/, "");

const workerToken = (process.env.SAFELITE_WORKER_TOKEN || "").trim();
const workerId = process.env.SAFELITE_WORKER_ID || `${os.hostname()}-${process.pid}`;
const pollMs = Number(process.env.SAFELITE_WORKER_POLL_MS || 5000);
const headless = process.env.SAFELITE_HEADLESS !== "false";
const allowFinalSubmit = process.env.SAFELITE_ALLOW_FINAL_SUBMIT === "true";
const keepBrowserOpenOnFailure = process.env.SAFELITE_KEEP_BROWSER_OPEN_ON_FAILURE === "true";
const runOnce = process.argv.includes("--once");

function assertConfigured() {
  if (!workerToken) {
    throw new Error("SAFELITE_WORKER_TOKEN is required.");
  }

  if (workerToken.length < 32) {
    throw new Error(
      `SAFELITE_WORKER_TOKEN is too short (${workerToken.length} chars). Use a 64-character random token and set the exact same value in Vercel and on this worker.`
    );
  }
}

function tokenFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function workerHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...extra,
    "x-safelite-worker-token": workerToken,
  };
}

async function postJson<T>(pathname: string, body: any): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${pathname}`, {
    method: "POST",
    headers: workerHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Request failed: ${res.status}`);
  }

  return json as T;
}

async function verifyWorkerAuth() {
  const res = await fetch(`${apiBaseUrl}/api/admin/safelite-billing/worker/health`, {
    method: "POST",
    headers: workerHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ workerId }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `${json.error || `Worker auth check failed: ${res.status}`} Local token length=${workerToken.length}, fingerprint=${tokenFingerprint(workerToken)}. If you changed Vercel env vars, redeploy the app.`
    );
  }
}

async function claimJob() {
  const body = await postJson<{ ok: boolean; job: SafeliteJob | null }>(
    "/api/admin/safelite-billing/worker/claim",
    { workerId }
  );

  return body.job;
}

async function uploadScreenshot(jobId: string, screenshot: any) {
  if (screenshot?.storage_path || screenshot?.storagePath) return screenshot;

  const filePath = String(screenshot?.filePath || "");
  if (!filePath) return screenshot;

  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.set("name", String(screenshot?.name || "screenshot"));
  form.set("at", String(screenshot?.at || new Date().toISOString()));
  form.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    path.basename(filePath)
  );

  const res = await fetch(
    `${apiBaseUrl}/api/admin/safelite-billing/worker/jobs/${encodeURIComponent(jobId)}/artifacts`,
    {
      method: "POST",
      headers: workerHeaders(),
      body: form,
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Screenshot upload failed: ${res.status}`);
  }

  return {
    ...screenshot,
    ...json.artifact,
  };
}

async function sendProgress(
  jobId: string,
  payload: { logs?: any[]; screenshots?: any[]; status?: string }
) {
  return await postJson(`/api/admin/safelite-billing/worker/jobs/${encodeURIComponent(jobId)}/progress`, payload);
}

async function uploadScreenshots(jobId: string, result: WorkerResult) {
  const screenshots = Array.isArray(result.screenshots) ? result.screenshots : [];
  const uploaded = [];

  for (const screenshot of screenshots) {
    uploaded.push(await uploadScreenshot(jobId, screenshot));
  }

  return uploaded;
}

async function completeJob(jobId: string, result: WorkerResult, screenshots: any[]) {
  return await postJson(`/api/admin/safelite-billing/worker/jobs/${encodeURIComponent(jobId)}/complete`, {
    result: {
      ...result,
      screenshots,
    },
    screenshots,
  });
}

async function processOneJob() {
  const job = await claimJob();
  if (!job) return false;

  console.log(`[safelite-worker] claimed job ${job.id} for invoice ${job.invoice_id}`);

  let result: WorkerResult;
  try {
    result = await runSafeliteBillingWorker({
      jobId: job.id,
      payload: job.payload_json,
      headless,
      allowFinalSubmit,
      keepBrowserOpenOnFailure,
      onLog: async (entry) => {
        try {
          await sendProgress(job.id, { logs: [entry], status: "running" });
        } catch (e: any) {
          console.warn(`[safelite-worker] live log update failed: ${e?.message || e}`);
        }
      },
      onScreenshot: async (screenshot) => {
        try {
          const uploaded = await uploadScreenshot(job.id, screenshot);
          await sendProgress(job.id, { screenshots: [uploaded], status: "running" });
          return uploaded;
        } catch (e: any) {
          console.warn(`[safelite-worker] live screenshot update failed: ${e?.message || e}`);
          return screenshot;
        }
      },
    });
  } catch (e: any) {
    result = {
      ok: false,
      status: "failed",
      error: e?.message || "Safelite worker crashed.",
      logs: [
        {
          at: new Date().toISOString(),
          message: e?.message || "Safelite worker crashed.",
        },
      ],
      screenshots: [],
    } as WorkerResult;
  }

  let screenshots = Array.isArray(result.screenshots) ? result.screenshots : [];
  try {
    screenshots = await uploadScreenshots(job.id, result);
  } catch (e: any) {
    result = {
      ...result,
      logs: [
        ...(Array.isArray(result.logs) ? result.logs : []),
        {
          at: new Date().toISOString(),
          message: `Screenshot upload failed: ${e?.message || e}`,
        },
      ],
    };
  }

  await completeJob(job.id, result, screenshots);
  console.log(`[safelite-worker] completed job ${job.id} with status ${result.status}`);

  return true;
}

async function main() {
  assertConfigured();

  console.log(
    `[safelite-worker] starting ${workerId} against ${apiBaseUrl}; final submit ${
      allowFinalSubmit ? "enabled" : "disabled"
    }; headless ${headless ? "enabled" : "disabled"}; failure browser review ${
      keepBrowserOpenOnFailure ? "enabled" : "disabled"
    }; token length ${workerToken.length}; token fingerprint ${tokenFingerprint(workerToken)}`
  );

  await verifyWorkerAuth();
  console.log("[safelite-worker] worker token verified with app.");

  if (runOnce) {
    const processed = await processOneJob();
    if (!processed) console.log("[safelite-worker] no pending jobs.");
    return;
  }

  for (;;) {
    try {
      const processed = await processOneJob();
      if (!processed) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    } catch (e: any) {
      console.error(`[safelite-worker] ${e?.message || e}`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}

main().catch((e) => {
  console.error(`[safelite-worker] fatal: ${e?.message || e}`);
  process.exit(1);
});
