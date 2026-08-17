export type SubscriptionTier = "pro";

function parseEnvInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export const TRIAL_DAYS = parseEnvInt(process.env.NEXT_PUBLIC_TRIAL_DAYS, 7);

export const TIER_PRICES: Record<SubscriptionTier, number> = {
  pro: parseEnvInt(process.env.NEXT_PUBLIC_PRO_PRICE, 49_000),
};

export const HOUSEHOLD_MEMBER_PRICE = parseEnvInt(
  process.env.NEXT_PUBLIC_HOUSEHOLD_MEMBER_PRICE,
  5_000,
);

export const MAX_HOUSEHOLD_MEMBER_SLOTS = parseEnvInt(
  process.env.NEXT_PUBLIC_MAX_HOUSEHOLD_MEMBER_SLOTS,
  5,
);

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  pro: "Cashlog",
};

export function getTierLabel(tier: SubscriptionTier): string {
  return TIER_LABELS[tier];
}

export const TIER_PRICE_LABELS: Record<SubscriptionTier, string> = {
  pro: "Rp 49.000",
};

export function formatTierPrice(tier: SubscriptionTier): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(TIER_PRICES[tier]);
}

/** Short label for landing cards e.g. "Rp 29rb" */
export function formatTierPriceShort(tier: SubscriptionTier): string {
  const price = TIER_PRICES[tier];
  if (price >= 1000) {
    return `Rp ${Math.round(price / 1000)}rb`;
  }
  return formatTierPrice(tier);
}

export function formatHouseholdMemberPrice(): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(HOUSEHOLD_MEMBER_PRICE);
}
