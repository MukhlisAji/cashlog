"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWhatsAppAdminUrl } from "@/config/site";
import { whatsappService } from "@/services/whatsapp.service";

interface ChatToBotButtonProps {
  /** When true, generate LINK code for onboarding. When false, open chat only. */
  withLinkCode?: boolean;
  /** Prefilled message when withLinkCode is false (e.g. first transaction). */
  message?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  className?: string;
  children?: React.ReactNode;
  onError?: (message: string) => void;
}

export function ChatToBotButton({
  withLinkCode = false,
  message,
  size = "sm",
  variant = "outline",
  className,
  children = "Chat ke Bot",
  onError,
}: ChatToBotButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    if (!withLinkCode) {
      window.open(getWhatsAppAdminUrl(message), "_blank", "noopener,noreferrer");
      setLoading(false);
      return;
    }

    const result = await whatsappService.createLinkCode();
    setLoading(false);

    if (!result.success || !result.data) {
      onError?.(result.error ?? "Gagal menyiapkan chat WhatsApp.");
      return;
    }

    if (result.data.requiresGoogleAuth && result.data.oauthUrl) {
      window.location.assign(result.data.oauthUrl);
      return;
    }

    if (!result.data.code) {
      onError?.("Kode verifikasi WhatsApp tidak tersedia.");
      return;
    }

    window.location.assign(getWhatsAppAdminUrl(`LINK ${result.data.code}`));
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={loading}
      onClick={() => void handleClick()}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <MessageCircle className="size-4" />
      )}
      {children}
    </Button>
  );
}
