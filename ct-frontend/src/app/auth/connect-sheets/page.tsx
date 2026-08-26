"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthBrandHeader } from "@/components/layout/auth-brand-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { isGoogleScopeMissing } from "@/lib/google-consent";
import { createClient } from "@/lib/supabase/client";
import { authService } from "@/services/auth.service";
import { sheetsService } from "@/services/sheets.service";

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return ROUTES.settings;
  }
  return value;
}

function ConnectSheetsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams.get("redirect"));
  const shouldProvision = searchParams.get("provision") === "1";
  const scopeMissingHint = searchParams.get("scope") === "missing";

  const [busy, setBusy] = useState(shouldProvision);
  const [error, setError] = useState<string | null>(
    scopeMissingHint
      ? "Izin Google Drive belum aktif. Centang Drive di layar berikutnya, lalu Lanjutkan."
      : null,
  );
  const provisionStarted = useRef(false);

  useEffect(() => {
    if (!shouldProvision || provisionStarted.current) return;
    provisionStarted.current = true;

    void (async () => {
      const status = await sheetsService.getStatus();
      if (status.success && status.data?.spreadsheetId) {
        router.replace(redirect);
        return;
      }

      const provision = await sheetsService.provisionSheet();
      if (provision.success && provision.data) {
        router.replace(redirect);
        return;
      }

      setBusy(false);
      if (
        isGoogleScopeMissing({
          code: provision.code,
          error: provision.error,
        })
      ) {
        setError(
          "Izin Google Drive belum diberikan. Di layar Google, biarkan centang Drive, lalu izinkan.",
        );
        return;
      }
      setError(provision.error ?? "Gagal membuat Google Sheet.");
    })();
  }, [redirect, router, shouldProvision]);

  async function handleContinue() {
    setBusy(true);
    setError(null);

    const status = await sheetsService.getStatus();
    if (status.success && status.data?.spreadsheetId) {
      router.replace(redirect);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace(
        `${ROUTES.login}?redirect=${encodeURIComponent("/auth/connect-sheets?redirect=" + encodeURIComponent(redirect))}`,
      );
      return;
    }

    try {
      await authService.signInWithGoogleSheets(redirect, user.email ?? undefined);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Gagal membuka Google.");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <AuthBrandHeader />
      <Card>
        <CardHeader>
          <CardTitle>Izinkan Google Drive</CardTitle>
          <CardDescription>
            Cashlog membuat spreadsheet di Drive kamu. Nomor WhatsApp sudah bisa
            tersimpan; Sheet baru dibuat setelah izin ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Di layar Google, biarkan centang{" "}
            <span className="font-medium text-foreground">Google Drive</span>.
            Jangan hapus centang itu.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={() => void handleContinue()} disabled={busy}>
            {busy ? "Menyiapkan…" : "Lanjutkan"}
          </Button>
        </CardContent>
        <CardFooter>
          <Link
            href={redirect}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Nanti saja
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ConnectSheetsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectSheetsInner />
    </Suspense>
  );
}
