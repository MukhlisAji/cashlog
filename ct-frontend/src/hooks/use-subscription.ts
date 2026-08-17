"use client";

import { useCallback, useEffect, useState } from "react";

import {
  subscriptionService,
  type SubscriptionStatusData,
} from "@/services/subscription.service";

export function useSubscription() {
  const [data, setData] = useState<SubscriptionStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await subscriptionService.getStatus();
    if (result.success && result.data) {
      setData(result.data);
    }
    setIsLoading(false);
    return result.data ?? null;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    subscription: data,
    isLoading,
    isAllowed: data?.allowed ?? true,
    isTrial: data?.isTrial ?? false,
    isPro: data?.isPro ?? false,
    canAccessAnalytics: data?.canAccessAnalytics ?? false,
    canUseReceiptOcr: data?.canUseReceiptOcr ?? false,
    canManageCategories: data?.canManageCategories ?? false,
    canManageHousehold: data?.canManageHousehold ?? false,
    daysRemaining: data?.daysRemaining ?? null,
    trialDaysRemaining: data?.trialDaysRemaining ?? null,
    autoRenewal: data?.autoRenewal ?? false,
    refresh,
  };
}
