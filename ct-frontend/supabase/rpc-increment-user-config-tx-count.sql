-- =============================================================================
-- RPC: increment_user_config_daily_tx(p_user_id uuid)
-- -----------------------------------------------------------------------------
-- Atomic alternative for:  userConfigRepository.incrementDailyTx()
--   • The JS read-then-write impl has a race under concurrent WA messages.
--   • This Postgres function atomically:
--       1. INSERT ... ON CONFLICT ensures row user_config(user_id)
--       2. IF daily_tx_date != CURRENT_DATE (Asia/Jakarta) → reset count=1, date=TODAY
--       3. ELSE daily_tx_count = daily_tx_count + 1
-- =============================================================================
-- Usage from Node (service_role bypass RLS OK; no explicit GRANT needed because
-- SECURITY DEFINER runs as pg catalog owner).
-- =============================================================================

drop function if exists public.increment_user_config_daily_tx(uuid);

create or replace function public.increment_user_config_daily_tx(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_yyyymmdd text;
begin
  -- Asia/Jakarta = UTC+7, same day regardless of DB timezone.
  v_today_yyyymmdd := to_char(
    timezone('Asia/Jakarta'::text, now()), 'YYYY-MM-DD');

  insert into public.user_config (user_id, daily_tx_count, daily_tx_date)
  values (p_user_id, 1, v_today_yyyymmdd::date)
  on conflict (user_id) do update set
    daily_tx_count = case
      when user_config.daily_tx_date is distinct from v_today_yyyymmdd::date
        then 1
      else user_config.daily_tx_count + 1
    end,
    daily_tx_date = case
      when user_config.daily_tx_date is distinct from v_today_yyyymmdd::date
        then v_today_yyyymmdd::date
      else user_config.daily_tx_date
    end,
    updated_at = now();
end;
$$;

-- =============================================================================
-- Optional: switch userConfigRepository.incrementDailyTx() Node impl becomes:
--
--   await sb().rpc('increment_user_config_daily_tx', { p_user_id: userId });
--
-- (Remove the ensure/getUsage branch logic in JS entirely.)
-- =============================================================================
