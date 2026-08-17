-- Existing projects only: collapse legacy Basic/Pro tiers into one plan.
update public.profiles
set subscription_tier = 'pro', updated_at = now()
where subscription_tier = 'basic';

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('pro'));
