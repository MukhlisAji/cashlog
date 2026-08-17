"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSubscription } from "@/hooks/use-subscription";
import { ROUTES } from "@/lib/constants";
import type { SubscriptionTier } from "@/lib/pricing";
import { formatTierPrice, TIER_PRICES } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { subscriptionService, setPendingPaymentOrderId } from "@/services/subscription.service";

interface SubscribeButtonProps {
  tier: SubscriptionTier;
  className?: string;
  fullWidth?: boolean;
  variant?: "default" | "outline";
  label?: string;
  onSuccess?: () => void;
}

export function SubscribeButton({
  tier,
  className,
  fullWidth,
  variant = "default",
  label,
  onSuccess,
}: SubscribeButtonProps) {
  const router = useRouter();
  const { subscription, refresh, isLoading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const defaultLabel = "Mulai Berlangganan";
  const buttonLabel = label ?? defaultLabel;

  const isCurrentPlan =
    subscription &&
    !subscription.isTrial &&
    subscription.status === "active" &&
    subscription.tier === tier;

  if (subLoading) {
    return (
      <Button disabled className={cn(fullWidth && "w-full", className)} variant={variant}>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  if (isCurrentPlan) {
    return (
      <Button
        disabled
        variant="outline"
        className={cn("gap-2", fullWidth && "w-full", className)}
      >
        <Crown className="size-4 text-amber-600" />
        Langganan Aktif
      </Button>
    );
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    setConfirmOpen(false);

    const result = await subscriptionService.checkout(tier);

    const redirectUrl = result.data?.checkoutUrl ?? result.data?.invoiceUrl;
    if (result.success && redirectUrl) {
      if (result.data?.invoiceId) {
        setPendingPaymentOrderId(result.data.invoiceId);
      }
      window.location.href = redirectUrl;
      return;
    }

    if (
      result.success &&
      result.data &&
      "devActivated" in result.data &&
      result.data.devActivated
    ) {
      await refresh();
      onSuccess?.();
      router.replace(ROUTES.dashboard);
      router.refresh();
      return;
    }

    setError(result.error ?? "Gagal membuat pembayaran");
    setLoading(false);
  }

  const tierLabel = "Cashlog";
  const tierPrice = formatTierPrice(tier);

  return (
    <>
      <div className={cn("flex flex-col gap-2", fullWidth && "w-full")}>
        <Button
          className={cn("gap-2", fullWidth && "w-full", className)}
          variant={variant}
          disabled={loading}
          onClick={() => setConfirmOpen(true)}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : tier === "pro" ? (
            <Crown className="size-4" />
          ) : null}
          {loading ? "Memproses..." : buttonLabel}
        </Button>
        {error && (
          <p className="text-center text-xs text-destructive">{error}</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Berlangganan ${tierLabel}?`}
        description={`Anda akan berlangganan paket ${tierLabel} seharga ${tierPrice}/bulan. ${TIER_PRICES[tier] > 0 ? "Anda akan diarahkan ke halaman pembayaran." : ""}`}
        confirmLabel="Lanjutkan pembayaran"
        loading={loading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCheckout()}
      />
    </>
  );
}

export function SubscribeButtonOrRegister({
  tier,
  className,
  fullWidth,
  variant = "default",
  label,
}: Omit<SubscribeButtonProps, "onSuccess">) {
  return (
    <ButtonLink
      href={ROUTES.register}
      className={cn(fullWidth && "w-full", className)}
      variant={variant}
    >
      {label ?? "Coba Gratis 7 Hari"}
    </ButtonLink>
  );
}

/** @deprecated Use SubscribeButton tier="pro" */
export function UpgradeProButton({
  onUpgraded,
  onSuccess,
  ...props
}: Omit<SubscribeButtonProps, "tier"> & { onUpgraded?: () => void }) {
  return (
    <SubscribeButton
      tier="pro"
      {...props}
      label={props.label ?? "Aktifkan langganan"}
      onSuccess={onSuccess ?? onUpgraded}
    />
  );
}

export function UpgradeProButtonOrLogin(
  props: Omit<SubscribeButtonProps, "tier" | "onSuccess">,
) {
  return (
    <SubscribeButtonOrRegister
      tier="pro"
      {...props}
      label={props.label ?? "Coba Gratis 7 Hari"}
    />
  );
}
