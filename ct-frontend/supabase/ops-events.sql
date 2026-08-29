-- Ops events for admin failure / delivery metrics.
-- Run in Supabase SQL Editor.

create table if not exists public.ops_events (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  ok          boolean not null default true,
  user_id     uuid,
  message     text,
  created_at  timestamptz not null default now()
);

create index if not exists ops_events_created_at_idx
  on public.ops_events (created_at desc);

create index if not exists ops_events_kind_ok_created_idx
  on public.ops_events (kind, ok, created_at desc);
