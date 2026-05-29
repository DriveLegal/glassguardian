# Safelite Billing Worker

The admin app queues Safelite billing jobs. A trusted worker machine runs Playwright, submits the invoice, uploads screenshots, and reports the result back to the app.

## Required Environment

Set these in Vercel and on the worker machine:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://glassguardianchipandcrackrepair.com
SAFELITE_WORKER_TOKEN=use-the-same-64-character-random-token
SAFELITE_ARTIFACT_BUCKET=safelite-job-artifacts
```

Set these on the worker machine or hosted worker service:

```bash
SAFELITE_WORKER_API_URL=https://glassguardianchipandcrackrepair.com
SAFELITE_WORKER_ID=glass-guardian-worker-1
SAFELITE_ALLOW_FINAL_SUBMIT=true
SAFELITE_HEADLESS=true
SAFELITE_WORKER_POLL_MS=5000
```

Generate one real worker token and use the exact same value in Vercel and on the worker:

```bash
openssl rand -hex 32
```

That produces a 64-character token. Do not use `make-a-long-random-secret` in production.

For a visible browser while testing:

```bash
SAFELITE_HEADLESS=false
SAFELITE_ALLOW_FINAL_SUBMIT=false
npm run safelite:worker:once
```

## Database Setup

Run `database/safelite_billing_jobs.sql` in Supabase. It creates:

- `safelite_billing_jobs`
- required status indexes and constraint
- private `safelite-job-artifacts` storage bucket

## Running The Worker

The npm worker scripts explicitly load `.env.local` through `DOTENV_CONFIG_PATH=.env.local`.

Install dependencies on the worker machine:

```bash
npm install
npx playwright install chromium
```

Run one job and exit:

```bash
npm run safelite:worker:once
```

Run continuously:

```bash
npm run safelite:worker
```

If you want to verify env loading without starting automation:

```bash
DOTENV_CONFIG_PATH=.env.local node -r dotenv/config -e "console.log(process.env.SAFELITE_WORKER_TOKEN ? 'SAFELITE_WORKER_TOKEN loaded' : 'missing')"
```

If you want to verify the deployed app has the worker auth route:

```bash
curl -i -X POST https://glassguardianchipandcrackrepair.com/api/admin/safelite-billing/worker/health \
  -H "x-safelite-worker-token: YOUR_TOKEN"
```

`/worker/auth-check` is also supported as an alias. If either route returns `404`, the app code with the worker routes has not been deployed to that URL yet.

## Hosted Worker Deployment

The admin can use the app from a phone or any computer as long as one always-on worker is running somewhere. The worker does not need to run on the admin device.

Deploy `Dockerfile.safelite-worker` to a service that supports long-running Docker workers, such as Render Worker, Railway, Fly.io, DigitalOcean App Platform, or a VPS.

Docker build/run example:

```bash
docker build -f Dockerfile.safelite-worker -t glass-guardian-safelite-worker .
docker run --env-file .env.local glass-guardian-safelite-worker
```

The hosted worker must have `SAFELITE_WORKER_API_URL`, `SAFELITE_WORKER_TOKEN`, `SAFELITE_ALLOW_FINAL_SUBMIT=true`, `SAFELITE_HEADLESS=true`, and the Supabase service role env vars.

If the worker prints `Invalid Safelite worker token`, the local/hosted token does not match the deployed Vercel token or the Vercel app needs a redeploy after env var changes.

## Troubleshooting Pending Jobs

If the invoice page stays on `PENDING` and the latest log only says `Safelite billing job prepared` or `Safelite billing job reset for retry`, the app successfully queued the job but no worker has claimed it yet.

The next expected log is:

```text
Worker <worker-id> claimed job.
```

If that log never appears, start or restart the always-on worker:

```bash
npm run safelite:worker
```

For a one-job production test without final submit:

```bash
SAFELITE_ALLOW_FINAL_SUBMIT=false npm run safelite:worker:once
```

For a real production run with final submit enabled, confirm the invoice data first, then run:

```bash
npm run safelite:worker:once
```

The worker auth route can be healthy even while jobs stay pending. A healthy auth check only proves the token/API URL match; pending means no active worker process is polling `/api/admin/safelite-billing/worker/claim`.

## Admin Flow

1. Admin edits invoice and insurance billing amount if needed.
2. Admin clicks `Save & Safelite Billing` or `Safelite Billing`.
3. The app creates a pending job.
4. The worker claims the job and submits Safelite.
5. The worker uploads the successful submit screenshot.
6. The invoice page shows `Safelite Submission Proof`.

The Vercel app does not run Playwright in production. The old inline worker route is disabled in production unless `SAFELITE_ENABLE_INLINE_WORKER=true` is explicitly set.
