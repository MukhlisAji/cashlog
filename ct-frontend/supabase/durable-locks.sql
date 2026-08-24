-- Durable WhatsApp message dedup + scheduler job locks (restart-safe).
-- Run in the Supabase SQL Editor on an existing project.
-- Fresh install: the same tables are included in schema.sql.

create table if not exists public.processed_wa_messages (
  message_id   text primary key,
  processed_at timestamptz not null default now()
);

create table if not exists public.scheduler_job_runs (
  job_key    text primary key,
  claimed_at timestamptz not null default now()
);

alter table public.processed_wa_messages enable row level security;
alter table public.scheduler_job_runs enable row level security;
