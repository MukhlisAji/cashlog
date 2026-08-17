"use client";

import { useCallback, useEffect, useState } from "react";

import {
  dashboardService,
  type DashboardData,
} from "@/services/dashboard.service";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const result = await dashboardService.getDashboard();

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error ?? "Gagal memuat dashboard");
    }
    setIsLoading(false);
    return result.data ?? null;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
