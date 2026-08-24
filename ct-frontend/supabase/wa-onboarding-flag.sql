-- First-chat onboarding flag. Existing users stay true so they are not
-- re-welcomed; new signups default false via handle_new_user / column default.

alter table public.profiles
  add column if not exists has_onboarded boolean not null default true;

alter table public.profiles
  alter column has_onboarded set default false;
