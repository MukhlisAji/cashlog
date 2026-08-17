"use client";

import { useCallback, useEffect, useState } from "react";

import {
  householdService,
  type HouseholdSummary,
} from "@/services/household.service";

export function useHousehold() {
  const [data, setData] = useState<HouseholdSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await householdService.getSummary();
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
    household: data,
    isLoading,
    refresh,
  };
}
