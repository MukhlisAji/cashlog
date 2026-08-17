"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isDemoLoggedIn, isDemoMode } from "@/lib/demo";
import { ROUTES } from "@/lib/constants";

const PROTECTED_PREFIXES = ["/ringkasan", "/dashboard", "/settings"];

export function DemoAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isDemoMode()) return;

    const isProtected = PROTECTED_PREFIXES.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    if (isProtected && !isDemoLoggedIn()) {
      router.replace(`${ROUTES.login}?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  return children;
}
