"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWhatsAppAdminUrl } from "@/config/site";

interface ChatToBotButtonProps {
  /** Prefilled chat message (e.g. first transaction). */
  message?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  className?: string;
  children?: React.ReactNode;
  onError?: (message: string) => void;
}

export function ChatToBotButton({
  message,
  size = "sm",
  variant = "outline",
  className,
  children = "Chat ke Bot",
}: ChatToBotButtonProps) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    window.open(getWhatsAppAdminUrl(message), "_blank", "noopener,noreferrer");
    setLoading(false);
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={loading}
      onClick={handleClick}
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
