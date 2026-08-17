"use client";

import { useCallback, useEffect, useState } from "react";

import {
  whatsappService,
  type WhatsAppSessionStatus,
  type WhatsAppStatus,
} from "@/services/whatsapp.service";

export function useWhatsAppStatus() {
  const [status, setStatus] = useState<WhatsAppSessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await whatsappService.getStatus();
    if (result.success && result.data) {
      setStatus(result.data);
    }
    setIsLoading(false);
    return result.data ?? null;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isConnected = status?.status === "connected";

  return {
    status,
    isLoading,
    isConnected,
    whatsappStatus: (status?.status ?? "idle") as WhatsAppStatus,
    refresh,
  };
}
