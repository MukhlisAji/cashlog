"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

import { NOTICE_MESSAGES, type NoticeKind } from "@/lib/notice";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: number;
  kind: NoticeKind;
  text: string;
};

let nextId = 1;
const listeners = new Set<(toast: ToastItem) => void>();

export function showToast(kind: NoticeKind, text: string) {
  const toast: ToastItem = { id: nextId++, kind, text };
  listeners.forEach((listener) => listener(toast));
}

function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const push = useCallback((toast: ToastItem) => {
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 5200);
  }, []);

  useEffect(() => {
    listeners.add(push);
    return () => {
      listeners.delete(push);
    };
  }, [push]);

  useEffect(() => {
    const key = searchParams.get("notice");
    if (!key) return;
    const notice = NOTICE_MESSAGES[key];
    if (notice) showToast(notice.kind, notice.text);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[80] flex w-[min(100%-2rem,24rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-3 text-sm shadow-lg",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-50",
          )}
          role="status"
        >
          {toast.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <p>{toast.text}</p>
        </div>
      ))}
    </div>
  );
}

export function Toaster() {
  return (
    <Suspense fallback={null}>
      <ToastViewport />
    </Suspense>
  );
}
