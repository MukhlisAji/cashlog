-- Per-phone streak for daily_reminder_v1 when the 24h session window is closed.
-- Reset to 0 when that number records a transaction.

create table if not exists public.wa_reminder_streaks (
  phone              text primary key,
  template_streak    integer not null default 0,
  last_template_date date,
  updated_at         timestamptz not null default now()
);

alter table public.wa_reminder_streaks enable row level security;
