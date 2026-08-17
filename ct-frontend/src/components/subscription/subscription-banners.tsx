"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

import { SubscribeButton } from "@/components/subscription/subscribe-button";
import { ButtonLink } from "@/components/ui/button-link";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SubscriptionTrialBannerProps {
  trialDaysRemaining: number | null;
  className?: string;
}

export function SubscriptionTrialBanner({
  trialDaysRemaining,
  className,
}: SubscriptionTrialBannerProps) {
  if (trialDaysRemaining === null) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Trial aktif</p>
          <p className="text-xs text-muted-foreground">
            {trialDaysRemaining > 1
              ? `${trialDaysRemaining} hari lagi — nikmati semua fitur gratis.`
              : trialDaysRemaining === 1
                ? "Hari terakhir trial besok — laporan analitik trial dikirim via WA. Berlangganan agar fitur tetap aktif."
                : "Trial berakhir hari ini. Berlangganan untuk melanjutkan."}
          </p>
        </div>
      </div>
      <SubscribeButton tier="pro" label="Berlangganan Rp 49rb" />
    </div>
  );
}

export function PaymentResultBanner({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const payment = searchParams.get("payment");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (payment === "success" || payment === "failed") {
      setVisible(true);
    }
  }, [payment]);

  if (!visible) return null;

  const success = payment === "success";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 text-sm",
        success
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-destructive/30 bg-destructive/10",
        className,
      )}
    >
      <p className="font-semibold">
        {success ? "Pembayaran berhasil!" : "Pembayaran gagal atau dibatalkan"}
      </p>
      <p className="mt-1 text-muted-foreground">
        {success
          ? "Langganan sedang diaktifkan. Setelah metode pembayaran terhubung, status akan diperbarui otomatis."
          : "Silakan coba lagi dari halaman langganan."}
      </p>
      {!success && (
        <ButtonLink href={ROUTES.settings} className="mt-3" variant="outline" size="sm">
          Kembali ke Pengaturan
        </ButtonLink>
      )}
    </div>
  );
}
