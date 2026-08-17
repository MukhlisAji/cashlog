-- Incremental: household whitelist tables for projects that already ran the
-- lean schema (households dropped). Safe to run once in SQL Editor.

create table if not exists public.households (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  lead_user_id       uuid not null unique
    references public.profiles(id) on delete cascade,
  member_slots_paid  integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.household_members (
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

create unique index if not exists household_members_lead_unique
  on public.household_members (household_id)
  where role = 'lead';

create unique index if not exists household_members_phone_active_idx
  on public.household_members (phone_number)
  where status = 'active' and phone_number is not null;

create index if not exists household_members_household_id_idx
  on public.household_members (household_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create table if not exists public.whatsapp_link_codes (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  code_hash    text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists whatsapp_link_codes_expires_at_idx
  on public.whatsapp_link_codes (expires_at);

alter table public.whatsapp_link_codes enable row level security;

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

  if v_user_id is null then return null; end if;

  if exists (
    select 1 from public.household_members
    where phone_number = p_phone_number and status = 'active' and id <> v_user_id
  ) or exists (
    select 1 from public.profiles
    where phone_number = p_phone_number and id <> v_user_id
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

  update public.whatsapp_link_codes set used_at = now() where user_id = v_user_id;
  return v_user_id;
end;
$$;

revoke all on function public.claim_whatsapp_link_code(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_link_code(text, text)
  to service_role;
