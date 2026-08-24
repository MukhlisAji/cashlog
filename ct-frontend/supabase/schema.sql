-- =============================================================================
-- cashlog.id — Supabase (PostgreSQL) Single Source of Truth schema
-- =============================================================================
-- FRESH INSTALL ONLY. Jalankan SELURUH isi file ini di Supabase SQL Editor
-- tepat setelah buat project baru.
--
-- Migrasi cleanup dari arsitektur fragmented:
--   • TIDAK ADA LAGI MySQL — Supabase = single source of truth
--   • TIDAK ADA LAGI Baileys / socket session tracking
--     ⇒ drop wa_sessions, wa_auth_keys, whatsapp_sessions
--   • Household add-on (max 5 nomor per akun Pro): whitelist WA
--     ⇒ households + household_members (tanpa Baileys pairing)
--   • profiles.phone_number: UNIQUE text column — mapping langsung Meta
--     WhatsApp Cloud API (wa_id) ke user, tanpa join table session.
--
-- Data transaksi TETAP di Google Sheet user (bukan di Supabase).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Reset bersih (idempotent — dijalankan berulang kali aman untuk project baru)
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.claim_whatsapp_link_code(text, text) cascade;
drop table if exists public.whatsapp_link_codes  cascade;
drop table if exists public.transactions         cascade;
drop table if exists public.budgets              cascade;
drop table if exists public.categories           cascade;
drop table if exists public.user_config          cascade;
drop table if exists public.google_connections   cascade;
drop table if exists public.whatsapp_sessions    cascade;
drop table if exists public.wa_sessions          cascade;
drop table if exists public.wa_auth_keys         cascade;
drop table if exists public.households           cascade;
drop table if exists public.household_members    cascade;
drop table if exists public.profiles             cascade;

-- -----------------------------------------------------------------------------
-- 1. Profiles — extends auth.users
--    + phone_number (UNIQUE) ⇒ Meta Cloud API (wa_id) lookup tanpa join.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text,
  email                 text,
  avatar_url            text,
  phone_number          text,
  subscription_status   text not null default 'free'
    constraint profiles_subscription_status_check
      check (subscription_status in ('trial', 'active', 'expired', 'free')),
  subscription_tier     text
    constraint profiles_subscription_tier_check
      check (subscription_tier in ('pro')),
  subscription_expires_at timestamptz,
  welcome_email_sent_at   timestamptz,
  has_onboarded           boolean not null default false,
  ooc_count               integer not null default 0,
  midtrans_subscription_id text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Incoming Meta webhook map wa_id → user. Index UNIQUE + lookup cepat.
create unique index profiles_phone_number_idx
  on public.profiles (phone_number);
-- Cari user by email (jarang tapi berguna admin tooling).
create index profiles_email_idx on public.profiles (email);

-- -----------------------------------------------------------------------------
-- 2. Google Sheet + OAuth connection
--    Merge MySQL column (refresh_token, access_token, token_expires_at)
--    ke dalam Supabase table. Satu user ⇔ satu Google connection.
-- -----------------------------------------------------------------------------
create table public.google_connections (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null
    references public.profiles(id) on delete cascade,
  spreadsheet_id     text,
  spreadsheet_url    text,
  refresh_token      text not null,
  access_token       text,
  token_expires_at   timestamptz,
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint google_connections_user_id_unique unique (user_id)
);

create index google_connections_user_id_idx
  on public.google_connections (user_id);

-- -----------------------------------------------------------------------------
-- 3. User-level config (timezone, currency, counters, dedup keys reminder/report)
-- -----------------------------------------------------------------------------
create table public.user_config (
  user_id                      uuid primary key
    references public.profiles(id) on delete cascade,
  timezone                     text        not null default 'Asia/Jakarta',
  currency                     text        not null default 'IDR',
  active_month                 text,           -- YYYY-MM
  daily_tx_count               integer     not null default 0,
  daily_tx_date                date,
  last_evening_reminder_date   date,           -- Last 21:00 WIB WA reminder
  last_analytics_report_key    text,           -- Dedup: weekly:YYYY-MM-DD
  last_trial_end_report_key    text,           -- Dedup: trial hari ke-7
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

-- Restart-safe inbound WA dedup + one-shot cron claims (service role only)
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

-- -----------------------------------------------------------------------------
-- 4. Expense categories + parser LLM keywords (sorted by sort_order)
-- -----------------------------------------------------------------------------
create table public.categories (
  id         bigint generated by default as identity primary key,
  user_id    uuid        not null
    references public.profiles(id) on delete cascade,
  name       text        not null,
  keywords   text,                          -- comma-separated LLM hints
  color      text,                          -- hex color (e.g. #22c55e)
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  -- Satu user tidak boleh punya duplikat nama kategori.
  constraint categories_user_id_name_unique unique (user_id, name)
);

create index categories_user_id_sort_order_idx
  on public.categories (user_id, sort_order);

-- -----------------------------------------------------------------------------
-- 5. Monthly budget allocation per category.
-- -----------------------------------------------------------------------------
create table public.budgets (
  id         bigint generated by default as identity primary key,
  user_id    uuid         not null
    references public.profiles(id) on delete cascade,
  month      text         not null,           -- YYYY-MM
  category   text         not null,
  amount     bigint       not null default 0,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  constraint budgets_user_month_category_unique
    unique (user_id, month, category)
);

create index budgets_user_id_month_idx
  on public.budgets (user_id, month);

-- -----------------------------------------------------------------------------
-- 5a. WhatsApp / app transaction ledger (Sheet remains dashboard source of truth)
-- -----------------------------------------------------------------------------
create table public.transactions (
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

create index transactions_user_id_date_idx
  on public.transactions (user_id, transaction_date desc);

-- -----------------------------------------------------------------------------
-- 5b. Household add-on — whitelist nomor WA yang menulis ke sheet lead.
--     Lead = akun yang daftar. Member = nomor tambahan (max 5, berbayar).
-- -----------------------------------------------------------------------------
create table public.households (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  lead_user_id       uuid not null unique
    references public.profiles(id) on delete cascade,
  member_slots_paid  integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null
    references public.households(id) on delete cascade,
  role          text not null
    constraint household_members_role_check
      check (role in ('lead', 'member')),
  display_name  text not null,
  phone_number  text,
  status        text not null default 'active'
    constraint household_members_status_check
      check (status in ('active', 'revoked')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index household_members_lead_unique
  on public.household_members (household_id)
  where role = 'lead';

create unique index household_members_phone_active_idx
  on public.household_members (phone_number)
  where status = 'active' and phone_number is not null;

create index household_members_household_id_idx
  on public.household_members (household_id);

-- One-time code untuk menautkan nomor dari chat WhatsApp ke akun yang sudah ada.
create table public.whatsapp_link_codes (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  code_hash    text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index whatsapp_link_codes_expires_at_idx
  on public.whatsapp_link_codes (expires_at);

create or replace function public.claim_whatsapp_link_code(
  p_code_hash text,
  p_phone_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.whatsapp_link_codes
  where code_hash = p_code_hash
    and used_at is null
    and expires_at > now()
  for update;

  if v_user_id is null then
    return null;
  end if;

  if exists (
    select 1 from public.household_members
    where phone_number = p_phone_number
      and status = 'active'
      and id <> v_user_id
  ) or exists (
    select 1 from public.profiles
    where phone_number = p_phone_number
      and id <> v_user_id
  ) then
    return null;
  end if;

  update public.profiles
  set phone_number = p_phone_number, updated_at = now()
  where id = v_user_id;

  insert into public.households (id, lead_user_id)
  values (v_user_id, v_user_id)
  on conflict (id) do nothing;

  insert into public.household_members (
    id, household_id, role, display_name, phone_number, status
  )
  select
    v_user_id,
    v_user_id,
    'lead',
    coalesce(nullif(trim(p.full_name), ''), 'Pemilik'),
    p_phone_number,
    'active'
  from public.profiles p
  where p.id = v_user_id
  on conflict (id) do update
  set
    phone_number = excluded.phone_number,
    status = 'active',
    updated_at = now();

  update public.whatsapp_link_codes
  set used_at = now()
  where user_id = v_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.claim_whatsapp_link_code(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_link_code(text, text)
  to service_role;

-- =============================================================================
-- 6. Row Level Security (RLS) — WAJIB untuk SEMUA table user-facing.
--    Policy rule sederhana & konsisten: user hanya boleh sentuh row MILIKNYA.
--      profiles          -> id      = auth.uid()
--      * (lainnya)       -> user_id = auth.uid()
--    Service role Supabase bypass RLS (tidak terpengaruh policy di bawah).
-- =============================================================================
alter table public.profiles           enable row level security;
alter table public.google_connections enable row level security;
alter table public.user_config        enable row level security;
alter table public.categories         enable row level security;
alter table public.budgets            enable row level security;
alter table public.transactions       enable row level security;

-- -----------------------------------------------------------------------------
-- 6.1 profiles (id = auth.uid())
-- -----------------------------------------------------------------------------
create policy "profiles — user read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles — user insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles — user update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles — user delete own"
  on public.profiles for delete
  using (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- Helper: buat policy CRUD kompak untuk semua table dengan kolom user_id.
--   SELECT / INSERT / UPDATE / DELETE → user_id = auth.uid()
-- Dijalankan inline per table supaya jelas / self-documenting, bukan macro.
-- -----------------------------------------------------------------------------

-- 6.2 google_connections
create policy "google_connections — user read own"
  on public.google_connections for select
  using (auth.uid() = user_id);

create policy "google_connections — user insert own"
  on public.google_connections for insert
  with check (auth.uid() = user_id);

create policy "google_connections — user update own"
  on public.google_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "google_connections — user delete own"
  on public.google_connections for delete
  using (auth.uid() = user_id);

-- 6.3 user_config
create policy "user_config — user read own"
  on public.user_config for select
  using (auth.uid() = user_id);

create policy "user_config — user insert own"
  on public.user_config for insert
  with check (auth.uid() = user_id);

create policy "user_config — user update own"
  on public.user_config for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_config — user delete own"
  on public.user_config for delete
  using (auth.uid() = user_id);

-- 6.4 categories
create policy "categories — user read own"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories — user insert own"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories — user update own"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories — user delete own"
  on public.categories for delete
  using (auth.uid() = user_id);

-- 6.5 budgets
create policy "budgets — user read own"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "budgets — user insert own"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "budgets — user update own"
  on public.budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budgets — user delete own"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- 6.5b transactions
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

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.whatsapp_link_codes enable row level security;

create policy "households — lead read own"
  on public.households for select
  using (auth.uid() = lead_user_id);

create policy "households — lead insert own"
  on public.households for insert
  with check (auth.uid() = lead_user_id);

create policy "households — lead update own"
  on public.households for update
  using (auth.uid() = lead_user_id)
  with check (auth.uid() = lead_user_id);

create policy "household_members — lead read own"
  on public.household_members for select
  using (
    household_id in (
      select id from public.households where lead_user_id = auth.uid()
    )
  );

create policy "household_members — lead insert own"
  on public.household_members for insert
  with check (
    household_id in (
      select id from public.households where lead_user_id = auth.uid()
    )
  );

create policy "household_members — lead update own"
  on public.household_members for update
  using (
    household_id in (
      select id from public.households where lead_user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select id from public.households where lead_user_id = auth.uid()
    )
  );

create policy "household_members — lead delete own"
  on public.household_members for delete
  using (
    household_id in (
      select id from public.households where lead_user_id = auth.uid()
    )
  );

-- Kode hanya dikelola backend service-role. Tidak ada policy client.

-- =============================================================================
-- 7. Auto-create profile on first signup as FREE (no trial yet).
--    Trial starts only via POST /api/subscription/start-trial (link /trial).
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone_number text;
begin
  -- Ambil nomor HP (wa_id) kalau user daftar sampaikan via metadata
  -- (client app bisa kirim fields: phone, phone_number, whatsapp, wa_id).
  v_phone_number := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'phone_number'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone'),         ''),
      nullif(trim(new.raw_user_meta_data ->> 'whatsapp'),      ''),
      nullif(trim(new.raw_user_meta_data ->> 'wa_id'),         ''),
      nullif(trim(new.phone),                                  '')
    );

  insert into public.profiles (
    id,
    full_name,
    email,
    avatar_url,
    phone_number,
    subscription_status,
    subscription_tier,
    subscription_expires_at,
    has_onboarded,
    ooc_count
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'user@example.com'), '@', 1)
    ),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    v_phone_number,
    'free',
    null,
    null,
    false,
    0
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
