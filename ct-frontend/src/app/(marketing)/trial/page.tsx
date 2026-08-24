"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/constants";
import { withNotice } from "@/lib/notice";
import { subscriptionService } from "@/services/subscription.service";

export default function StartTrialPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activate = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await subscriptionService.startTrial();
    setBusy(false);

    if (result.success) {
      router.replace(withNotice(ROUTES.dashboard, "trial_started"));
      return;
    }

    if (result.code === "UNAUTHORIZED") {
      router.replace(`${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.trial)}`);
      return;
    }

    if (result.code === "TRIAL_ALREADY_USED") {
      router.replace(
        withNotice(ROUTES.subscriptionExpired, "trial_already_used"),
      );
      return;
    }

    started.current = false;
    setError(result.error ?? "Gagal mengaktifkan trial. Coba lagi.");
  }, [router]);

  useEffect(() => {
    if (isLoading || started.current) return;

    if (!isAuthenticated) {
      started.current = true;
      router.replace(`${ROUTES.register}?intent=trial`);
      return;
    }

    started.current = true;
    void activate();
  }, [activate, isAuthenticated, isLoading, router]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
        <p className="text-destructive">{error}</p>
        <Button
          type="button"
          onClick={() => {
            started.current = true;
            void activate();
          }}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      Mengaktifkan trial…
    </div>
  );
}
