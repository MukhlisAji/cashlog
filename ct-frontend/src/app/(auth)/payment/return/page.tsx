"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { withNotice } from "@/lib/notice";
import {
  consumePendingPaymentOrderId,
  subscriptionService,
} from "@/services/subscription.service";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30;

export default function PaymentReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const payment = searchParams.get("payment");
  const tier = searchParams.get("tier");
  const attempts = useRef(0);
  const polling = useRef(false);

  const [message, setMessage] = useState("Memverifikasi pembayaran…");
  const [isWorking, setIsWorking] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!payment) {
      router.replace(ROUTES.subscriptionExpired);
      return;
    }

    if (payment === "failed") {
      setFailed(true);
      setIsWorking(false);
      setMessage("Pembayaran gagal atau dibatalkan.");
      router.replace(withNotice(ROUTES.subscriptionExpired, "payment_failed"));
      return;
    }

    if (polling.current) return;
    polling.current = true;

    async function verifyAndPoll() {
      const orderId = consumePendingPaymentOrderId();

      if (orderId && (payment === "success" || payment === "pending")) {
        await subscriptionService.confirmPayment(orderId);
      }

      while (attempts.current < POLL_MAX_ATTEMPTS) {
        attempts.current += 1;
        const result = await subscriptionService.getStatus();

        if (result.success && result.data?.allowed) {
          router.replace(withNotice(ROUTES.dashboard, "payment_success"));
          return;
        }

        if (payment === "pending") {
          setMessage("Menunggu konfirmasi pembayaran…");
        } else {
          setMessage("Mengaktifkan langganan Anda…");
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      setIsWorking(false);
      setMessage(
        "Pembayaran diterima, tapi aktivasi belum selesai. Coba refresh halaman langganan atau hubungi support jika masalah berlanjut.",
      );
    }

    void verifyAndPoll().catch(() => {
      setIsWorking(false);
      setFailed(true);
      setMessage("Gagal memverifikasi pembayaran. Silakan coba lagi.");
      router.replace(withNotice(ROUTES.subscriptionExpired, "payment_failed"));
    });
  }, [payment, router]);

  const tierLabel = tier === "pro" ? "Cashlog" : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          {failed ? (
            <XCircle className="size-5 text-destructive" />
          ) : isWorking ? (
            <Loader2 className="size-5 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="size-5 text-primary" />
          )}
          {failed
            ? "Pembayaran Gagal"
            : isWorking
              ? "Memproses Pembayaran"
              : "Hampir Selesai"}
        </CardTitle>
        <CardDescription>
          {tierLabel
            ? `Paket ${tierLabel} · ${message}`
            : message}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isWorking && (
          <p className="text-center text-xs text-muted-foreground">
            Jangan tutup halaman ini. Anda akan diarahkan ke dashboard setelah
            langganan aktif.
          </p>
        )}
        {!isWorking && (
          <ButtonLink href={ROUTES.subscriptionExpired} className="w-full">
            Kembali ke halaman langganan
          </ButtonLink>
        )}
      </CardContent>
    </Card>
  );
}
