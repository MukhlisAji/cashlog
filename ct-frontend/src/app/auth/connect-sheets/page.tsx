"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { withNotice } from "@/lib/notice";
import { authService } from "@/services/auth.service";
import { sheetsService } from "@/services/sheets.service";

function ConnectSheetsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const started = useRef(false);
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const safePath =
      redirect.startsWith("/") && !redirect.startsWith("//")
        ? redirect
        : "/";

    void (async () => {
      const status = await sheetsService.getStatus();
      if (status.success && status.data?.connected) {
        router.replace(withNotice(safePath, "sheet_connected"));
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await authService.signInWithGoogleSheets(safePath, user?.email ?? undefined);
    })();
  }, [redirect, router]);

  return null;
}

export default function ConnectSheetsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectSheetsInner />
    </Suspense>
  );
}
