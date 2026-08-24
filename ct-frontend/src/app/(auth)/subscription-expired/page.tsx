"use client";

import {
  SubscribeButton,
} from "@/components/subscription/subscribe-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupportEmail } from "@/config/site";
import { useAuth } from "@/hooks/use-auth";
import { formatTierPrice } from "@/lib/pricing";

export default function SubscriptionExpiredPage() {
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Langganan Berakhir</CardTitle>
        <CardDescription>
          Trial atau langganan Anda sudah habis. Berlangganan untuk melanjutkan
          mencatat via WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SubscribeButton
          fullWidth
          tier="pro"
          label={`Cashlog — ${formatTierPrice("pro")}/bulan`}
          onSuccess={() => router.replace(ROUTES.dashboard)}
        />
        <Button variant="ghost" className="w-full" onClick={() => void handleSignOut()}>
          Keluar
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Butuh bantuan? Hubungi{" "}
          <a href={`mailto:${getSupportEmail()}`} className="underline">
            {getSupportEmail()}
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
