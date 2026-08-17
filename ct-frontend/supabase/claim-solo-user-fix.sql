-- Run in Supabase SQL Editor if claim_whatsapp_link_code predates solo-user fix.
-- Ensures lead row exists on LINK code claim; profiles.phone_number alone is valid.

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
