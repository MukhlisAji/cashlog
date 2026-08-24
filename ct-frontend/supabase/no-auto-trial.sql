-- New signups stay on free until they hit /trial (or pay).
-- Apply in Supabase SQL editor if handle_new_user still starts trial.

alter table public.profiles
  alter column subscription_status set default 'free';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'phone_number'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'wa_id'), ''),
      nullif(trim(new.phone), '')
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
    v_phone,
    'free',
    null,
    null,
    false,
    0
  );

  return new;
end;
$$;
