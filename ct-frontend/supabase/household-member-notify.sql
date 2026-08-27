-- Household member WhatsApp notify flags + monthly report dedup.
-- Run in Supabase SQL Editor on existing projects.

alter table public.households
  add column if not exists notify_members_reminder boolean not null default true,
  add column if not exists notify_members_weekly boolean not null default false,
  add column if not exists notify_members_monthly boolean not null default false;

alter table public.user_config
  add column if not exists last_monthly_report_key text;
