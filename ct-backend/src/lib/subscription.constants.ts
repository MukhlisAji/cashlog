import type { Env } from "../config/env.js";
import { loadEnv } from "../config/env.js";

export type SubscriptionTier = "pro";

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  pro: "Cashlog",
};

export function getSubscriptionConfig(env: Env = loadEnv()) {
  return {
    trialDays: env.TRIAL_DAYS,
    subscriptionPeriodDays: env.SUBSCRIPTION_PERIOD_DAYS,
    tierPrices: { pro: env.PRO_PRICE } satisfies Record<SubscriptionTier, number>,
  };
}

/** @deprecated Use getSubscriptionConfig(env).trialDays */
export function getTrialDays(env?: Env): number {
  return getSubscriptionConfig(env).trialDays;
}

/** @deprecated Use getSubscriptionConfig(env).subscriptionPeriodDays */
export function getSubscriptionPeriodDays(env?: Env): number {
  return getSubscriptionConfig(env).subscriptionPeriodDays;
}

/** @deprecated Use getSubscriptionConfig(env).tierPrices */
export function getTierPrices(env?: Env): Record<SubscriptionTier, number> {
  return getSubscriptionConfig(env).tierPrices;
}
