"use client";

import { useCallback, useEffect, useState } from "react";

import { sheetsService, type SheetStatus } from "@/services/sheets.service";

export function useSheetStatus() {
  const [status, setStatus] = useState<SheetStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await sheetsService.getStatus();
    if (result.success && result.data) {
      setStatus(result.data);
    }
    setIsLoading(false);
    return result.data ?? null;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isConnected = !!(status?.connected && status.spreadsheetId);
  const hasToken = !!status?.connected;

  return { status, isLoading, isConnected, hasToken, refresh };
}
