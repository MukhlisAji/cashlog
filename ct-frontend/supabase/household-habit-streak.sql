-- Habit streak: consecutive Jakarta calendar days with ≥1 recorded transaction.
-- Run in Supabase SQL Editor on existing projects.

alter table public.households
  add column if not exists habit_streak integer not null default 0,
  add column if not exists habit_last_date date;
