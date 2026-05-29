create table if not exists public.safelite_billing_jobs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  status text not null default 'pending',
  payload_json jsonb not null default '{}'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  logs_json jsonb not null default '[]'::jsonb,
  screenshots_json jsonb not null default '[]'::jsonb,
  confirmation_number text,
  error_message text,
  submitted_at timestamptz,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists safelite_billing_jobs_invoice_id_idx
  on public.safelite_billing_jobs(invoice_id);

create index if not exists safelite_billing_jobs_status_idx
  on public.safelite_billing_jobs(status);

alter table public.safelite_billing_jobs
  drop constraint if exists safelite_billing_jobs_status_check;

alter table public.safelite_billing_jobs
  add constraint safelite_billing_jobs_status_check
  check (
    status in (
      'pending',
      'running',
      'needs_invoice_data',
      'needs_login',
      'ready_for_manual_submit',
      'submitted',
      'failed'
    )
  );

alter table public.safelite_billing_jobs enable row level security;

drop policy if exists "service role manages safelite billing jobs" on public.safelite_billing_jobs;
create policy "service role manages safelite billing jobs"
  on public.safelite_billing_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'safelite-job-artifacts',
  'safelite-job-artifacts',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
