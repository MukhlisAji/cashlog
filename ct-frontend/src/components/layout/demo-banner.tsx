"use client";

import Link from "next/link";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isDemoMode, resetDemoState } from "@/lib/demo";
import { ROUTES } from "@/lib/constants";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  if (!isDemoMode() || dismissed) return null;

  function handleReset() {
    resetDemoState();
    router.push(ROUTES.login);
    router.refresh();
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <FlaskConical className="size-4 shrink-0 text-amber-600" />
          <span>
            <strong>Demo mode</strong> — alur sama seperti user nyata, data mockup
            lokal.{" "}
            <Link href={ROUTES.login} className="underline">
              Mulai dari login
            </Link>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDismissed(true)}
            aria-label="Tutup"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
