"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SettingsSaveButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
};

export function SettingsSaveButton({
  onClick,
  loading = false,
  disabled = false,
  label = "Simpan",
  loadingLabel = "Menyimpan…",
  className,
}: SettingsSaveButtonProps) {
  return (
    <Button
      type="button"
      className={cn("h-10 w-full", className)}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {loading ? loadingLabel : label}
    </Button>
  );
}
