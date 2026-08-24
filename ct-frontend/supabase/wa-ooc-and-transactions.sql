-- Phase 2: OOC counter on profiles (no public.users table in this project).
-- Existing rows stay at 0.

alter table public.profiles
  add column if not exists ooc_count integer not null default 0;

-- Ledger used by WhatsApp Layer 3 bulk inserts. Dashboard still reads Google Sheets.
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null
    references public.profiles(id) on delete cascade,
  type              text not null
    constraint transactions_type_check
      check (type in ('expense', 'income')),
  amount            bigint not null,
  category          text not null,
  description       text not null,
  transaction_date  date not null,
  source            text not null default 'whatsapp',
  recorder          text,
  created_at        timestamptz not null default now()
);

create index if not exists transactions_user_id_date_idx
  on public.transactions (user_id, transaction_date desc);

alter table public.transactions enable row level security;

drop policy if exists "transactions — user read own" on public.transactions;
drop policy if exists "transactions — user insert own" on public.transactions;
drop policy if exists "transactions — user update own" on public.transactions;
drop policy if exists "transactions — user delete own" on public.transactions;

create policy "transactions — user read own"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions — user insert own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions — user update own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions — user delete own"
  on public.transactions for delete
  using (auth.uid() = user_id);
