import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionStatus = "trial" | "active" | "expired";
export type SubscriptionTier = "pro";

export interface SubscriptionInfo {
  allowed: boolean;
  status: SubscriptionStatus;
  tier: SubscriptionTier | null;
  expiresAt: string | null;
  canAccessAnalytics: boolean;
  isTrial: boolean;
}

function computeAllowed(
  status: string,
  expiresAt: string | null,
): boolean {
  if (status !== "trial" && status !== "active") return false;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

function hasProEntitlements(
  status: SubscriptionStatus,
  tier: SubscriptionTier | null,
  allowed: boolean,
): boolean {
  if (!allowed) return false;
  if (status === "trial") return true;
  return tier === "pro";
}

export async function checkSubscriptionFromProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionInfo> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "subscription_status, subscription_tier, subscription_expires_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      allowed: false,
      status: "expired",
      tier: null,
      expiresAt: null,
      canAccessAnalytics: false,
      isTrial: false,
    };
  }

  let status = profile.subscription_status as SubscriptionStatus | "free";
  let tier = profile.subscription_tier as SubscriptionTier | null;
  const expiresAt = profile.subscription_expires_at as string | null;

  if (status === "free") {
    status = "expired";
    tier = null;
  }

  const allowed = computeAllowed(status, expiresAt);
  const isTrial = allowed && status === "trial";
  const effectiveTier = allowed
    ? isTrial
      ? "pro"
      : tier
    : null;

  return {
    allowed,
    status: allowed ? status : "expired",
    tier: effectiveTier,
    expiresAt,
    canAccessAnalytics: hasProEntitlements(
      allowed ? status : "expired",
      tier,
      allowed,
    ),
    isTrial,
  };
}
