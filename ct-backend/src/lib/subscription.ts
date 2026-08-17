import {
  getSubscriptionConfig,
  type SubscriptionTier,
} from "./subscription.constants.js";
import { getSupabaseAdmin } from "./supabase.js";

export type SubscriptionStatus = "trial" | "active" | "expired";

export interface UserProfile {
  id: string;
  subscription_status: SubscriptionStatus | "free";
  subscription_tier: SubscriptionTier | null;
  subscription_expires_at: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  midtrans_subscription_id: string | null;
}

export interface SubscriptionCheck {
  allowed: boolean;
  status: SubscriptionStatus;
  tier: SubscriptionTier | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  trialDaysRemaining: number | null;
  canAccessAnalytics: boolean;
  canUseReceiptOcr: boolean;
  canManageCategories: boolean;
  canManageHousehold: boolean;
  isTrial: boolean;
  isPro: boolean;
}

function computeDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function hasProEntitlements(
  status: SubscriptionStatus,
  tier: SubscriptionTier | null,
): boolean {
  if (status === "trial") return true;
  return status === "active" && tier === "pro";
}

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, subscription_status, subscription_tier, subscription_expires_at, full_name, email, phone_number, midtrans_subscription_id",
    )
    .eq("id", userId)
    .maybeSingle();

  return data as UserProfile | null;
}

async function expireIfNeeded(
  userId: string,
  profile: UserProfile,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { subscription_status: status, subscription_expires_at: expiresAt } =
    profile;

  if (!expiresAt) return;
  if (status !== "trial" && status !== "active") return;
  if (new Date(expiresAt).getTime() > Date.now()) return;

  await supabase
    .from("profiles")
    .update({
      subscription_status: "expired",
      subscription_tier: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function checkSubscription(
  userId: string,
): Promise<SubscriptionCheck> {
  let profile = await getUserProfile(userId);

  // Auto-start/reset trial for users who have never had an active subscription:
  //   1) no profile row at all,
  //   2) profile with "free" status and no expiration,
  //   3) profile with "expired" status but no expiration (created incomplete and never had a trial).
  const neverHadActive =
    !profile ||
    (profile.subscription_status === "free" && !profile.subscription_expires_at) ||
    (profile.subscription_status === "expired" && !profile.subscription_expires_at);
  const needsTrial = neverHadActive;
  if (needsTrial) {
    await startTrialForUser(userId);
    profile = (await getUserProfile(userId)) ?? profile;
  }

  if (!profile) {
    return {
      allowed: false,
      status: "expired",
      tier: null,
      expiresAt: null,
      daysRemaining: null,
      trialDaysRemaining: null,
      canAccessAnalytics: false,
      canUseReceiptOcr: false,
      canManageCategories: false,
      canManageHousehold: false,
      isTrial: false,
      isPro: false,
    };
  }

  await expireIfNeeded(userId, profile);
  profile = (await getUserProfile(userId)) ?? profile;

  let status = profile.subscription_status as SubscriptionStatus | "free";
  let tier = profile.subscription_tier;
  const expiresAt = profile.subscription_expires_at;

  if (status === "free") {
    status = "expired";
    tier = null;
  }

  const daysRemaining = computeDaysRemaining(expiresAt);
  const isTrial = status === "trial";
  const trialDaysRemaining = isTrial ? daysRemaining : null;
  const allowed =
    (status === "trial" || status === "active") &&
    !!expiresAt &&
    new Date(expiresAt).getTime() > Date.now();

  // Fallback: jika masih not allowed (profile bermasalah / belum pernah
  // di-set dengan benar), coba start trial sekali lagi. Ini menyelamatkan
  // user yang profile-nya terlanjur "expired" / "free" tanpa data
  // langganan yang jelas — misalnya karena bug trigger Supabase / race.
  if (!allowed) {
    // eslint-disable-next-line no-console
    console.log(
      `[checkSubscription] user=${userId} not allowed (status=${status}, expiresAt=${expiresAt ?? "null"}). Retrying startTrialForUser…`,
    );
    const retry = await startTrialForUser(userId);
    if (retry.ok) {
      profile = await getUserProfile(userId);
      if (profile) {
        status = profile.subscription_status as SubscriptionStatus | "free";
        tier = profile.subscription_tier;
        const newExpiresAt = profile.subscription_expires_at;

        if (status === "free") {
          status = "expired";
          tier = null;
        }

        const newDaysRemaining = computeDaysRemaining(newExpiresAt);
        const newIsTrial = status === "trial";
        const newAllowed =
          (status === "trial" || status === "active") &&
          !!newExpiresAt &&
          new Date(newExpiresAt).getTime() > Date.now();

        const newProEntitlements = newAllowed && hasProEntitlements(status, tier);
        const newIsPro = newAllowed && (newIsTrial || (status === "active" && tier === "pro"));

        return {
          allowed: newAllowed,
          status: newAllowed ? status : "expired",
          tier: newAllowed ? (newIsTrial ? "pro" : tier) : null,
          expiresAt: newAllowed ? newExpiresAt : null,
          daysRemaining: newAllowed ? newDaysRemaining : null,
          trialDaysRemaining: newIsTrial ? newDaysRemaining : null,
          canAccessAnalytics: newProEntitlements,
          canUseReceiptOcr: newProEntitlements,
          canManageCategories: newProEntitlements,
          canManageHousehold: newProEntitlements,
          isTrial: newIsTrial,
          isPro: newIsPro,
        };
      }
    }
  }

  const proEntitlements = allowed && hasProEntitlements(status, tier);
  const isPro = allowed && (isTrial || (status === "active" && tier === "pro"));

  return {
    allowed,
    status: allowed ? status : "expired",
    tier: allowed ? (isTrial ? "pro" : tier) : null,
    expiresAt: allowed ? expiresAt : null,
    daysRemaining: allowed ? daysRemaining : null,
    trialDaysRemaining,
    canAccessAnalytics: proEntitlements,
    canUseReceiptOcr: proEntitlements,
    canManageCategories: proEntitlements,
    canManageHousehold: proEntitlements,
    isTrial,
    isPro,
  };
}

export async function startTrialForUser(
  userId: string,
): Promise<{ ok: boolean; expiresAt: string | null; errorMessage?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, expiresAt: null, errorMessage: "Supabase admin not configured" };

  // Pull user identity from auth.users so we can fill NOT NULL columns
  // (full_name, email) on the profiles row when creating a fresh one.
  // Without this, upsert fails with NOT NULL violation for brand new users.
  let fullName: string | null = null;
  let email: string | null = null;
  try {
    const { data: authUser, error: authErr } =
      await supabase.auth.admin.getUserById(userId);
    if (!authErr && authUser?.user) {
      email = authUser.user.email ?? null;
      const meta = authUser.user.user_metadata as
        | { full_name?: string; name?: string } 
        | undefined;
      fullName =
        meta?.full_name ??
        meta?.name ??
        (email ? email.split("@")[0]! : null);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[startTrialForUser] could not fetch auth user=${userId}:`,
      err instanceof Error ? err.message : err,
    );
  }

  const { trialDays } = getSubscriptionConfig();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + trialDays);
  const now = new Date().toISOString();

  // Use upsert so new users (no profile row) get a row created.
  // The id column must match auth.users.id (primary key on profiles).
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        subscription_status: "trial",
        subscription_tier: "pro",
        subscription_expires_at: expiresAt.toISOString(),
        midtrans_subscription_id: null,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id", ignoreDuplicates: false, defaultToNull: false },
    );

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[startTrialForUser] upsert FAILED user=${userId} cols={full_name:${fullName}, email:${email}}:`,
      error,
    );
    return { ok: false, expiresAt: null, errorMessage: error.message };
  }

  // eslint-disable-next-line no-console
  console.log(
    `[startTrialForUser] SUCCESS user=${userId} expiresAt=${expiresAt.toISOString()}`,
  );
  return { ok: true, expiresAt: expiresAt.toISOString() };
}

export async function activateSubscription(
  userId: string,
  tier: SubscriptionTier,
  days = getSubscriptionConfig().subscriptionPeriodDays,
): Promise<{ ok: boolean; expiresAt: string | null }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, expiresAt: null };

  const profile = await getUserProfile(userId);
  const now = Date.now();

  let base = now;
  if (
    profile?.subscription_status === "active" &&
    profile.subscription_expires_at
  ) {
    const current = new Date(profile.subscription_expires_at).getTime();
    if (current > now) base = current;
  }

  const expiresAt = new Date(base);
  expiresAt.setDate(expiresAt.getDate() + days);

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_status: "active",
      subscription_tier: tier,
      subscription_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) return { ok: false, expiresAt: null };
  return { ok: true, expiresAt: expiresAt.toISOString() };
}

/** @deprecated Use activateSubscription — dev fallback only */
export async function activatePro(
  userId: string,
  days = getSubscriptionConfig().subscriptionPeriodDays,
): Promise<{ ok: boolean; expiresAt: string | null }> {
  return activateSubscription(userId, "pro", days);
}

export async function updateMidtransSubscriptionId(
  userId: string,
  subscriptionId: string | null,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { error } = await supabase
    .from("profiles")
    .update({
      midtrans_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return !error;
}

export async function clearMidtransSubscription(userId: string): Promise<boolean> {
  return updateMidtransSubscriptionId(userId, null);
}

export async function getUserIdByMidtransSubscriptionId(
  subscriptionId: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("midtrans_subscription_id", subscriptionId)
    .maybeSingle();

  return data?.id ?? null;
}

/** Trial users with exactly 1 day remaining (hari ke-7 dari trial 7 hari) */
export async function listTrialUserIdsOnLastDay(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, subscription_expires_at")
    .eq("subscription_status", "trial");

  if (!data) return [];

  return data
    .filter((row) => {
      const expiresAt = row.subscription_expires_at as string | null;
      if (!expiresAt) return false;
      const days = computeDaysRemaining(expiresAt);
      return days === 1;
    })
    .map((row) => row.id as string);
}

/** @deprecated Free tier removed */
export async function canRecordFreeTierTransaction(
  userId: string,
): Promise<{ ok: boolean; remaining: number }> {
  const sub = await checkSubscription(userId);
  return { ok: sub.allowed, remaining: sub.allowed ? -1 : 0 };
}
