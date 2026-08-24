"use client";

import {
  SubscribeButton,
  SubscribeButtonOrRegister,
} from "@/components/subscription/subscribe-button";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { ButtonLink } from "@/components/ui/button-link";
import { ROUTES } from "@/lib/constants";
import { TRIAL_DAYS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface PricingActionProps {
  tier: "pro";
  label?: string;
}

export function PricingAction({ tier, label }: PricingActionProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { isAllowed, isLoading: subLoading } = useSubscription();

  if (isLoading || subLoading) {
    return (
      <ButtonLink className="mt-8 w-full" href={ROUTES.register} variant="outline">
        Memuat...
      </ButtonLink>
    );
  }

  if (isAuthenticated && !isAllowed) {
    return (
      <ButtonLink className="mt-8 w-full" href={ROUTES.trial}>
        {label ?? `Mulai trial ${TRIAL_DAYS} hari`}
      </ButtonLink>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="mt-8">
        <SubscribeButton
          fullWidth
          tier={tier}
          label={label ?? "Mulai Berlangganan"}
        />
      </div>
    );
  }

  const registerLabel = label ?? `Coba Gratis ${TRIAL_DAYS} Hari`;

  return (
    <SubscribeButtonOrRegister
      tier={tier}
      className={cn(
        "mt-8 w-full gap-2",
        "shadow-md shadow-primary/15",
      )}
      variant="default"
      label={registerLabel}
    />
  );
}

/** @deprecated Use PricingAction tier="pro" */
export function ProPricingAction() {
  return <PricingAction tier="pro" />;
}
