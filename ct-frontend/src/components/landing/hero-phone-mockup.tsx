import type { ReactNode } from "react";

import { Camera, Check, CheckCheck, Sparkles } from "lucide-react";

import { siteConfig } from "@/config/site";

function OutgoingBubble({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto flex max-w-[85%] flex-col gap-0.5 rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
      <span className="text-[13px] leading-snug">{children}</span>
      <span className="ml-auto flex items-center gap-1 text-[10px] opacity-80">
        09:15
        <CheckCheck className="size-3" />
      </span>
    </div>
  );
}

function IncomingBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-border/60 bg-background px-3 py-2 text-[13px] leading-relaxed shadow-sm dark:border-white/5 dark:bg-white/[0.03] dark:shadow-none">
      {children}
    </div>
  );
}

export function HeroPhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[19rem]">
      {/* Ambient glow behind the phone */}
      <div className="animate-float-glow pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-primary/25 via-emerald-400/15 to-transparent blur-3xl" />

      {/* Soft shadow on the "floor" so floating reads as depth */}
      <div className="animate-float-glow pointer-events-none absolute inset-x-10 -bottom-6 h-6 rounded-[50%] bg-slate-900/20 blur-xl dark:bg-black/50" />

      <div className="animate-float-slow relative">
        {/* Phone body — thin bezel */}
        <div className="relative rounded-[2.15rem] border border-slate-700/35 bg-gradient-to-b from-slate-800 to-slate-900 p-1 shadow-2xl shadow-slate-900/35 ring-1 ring-white/10">
          {/* Side buttons */}
          <span className="absolute -left-[2px] top-28 h-10 w-[2px] rounded-l bg-slate-700/80" />
          <span className="absolute -left-[2px] top-[8.25rem] h-7 w-[2px] rounded-l bg-slate-700/80" />
          <span className="absolute -right-[2px] top-32 h-14 w-[2px] rounded-r bg-slate-700/80" />

          {/* Screen */}
          <div className="relative overflow-hidden rounded-[1.85rem] bg-background dark:bg-card/30">
            {/* Notch */}
            <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-900" />

            {/* WhatsApp header */}
            <div className="flex items-center gap-2.5 border-b border-border/60 bg-muted/50 px-4 pb-3 pt-8 backdrop-blur dark:border-white/5 dark:bg-white/[0.02]">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold leading-tight">
                  {siteConfig.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Pesan ke diri sendiri
                </p>
              </div>
            </div>

            {/* Chat */}
            <div className="flex flex-col gap-2.5 bg-muted/20 p-3.5 dark:bg-transparent">
              <OutgoingBubble>Makan siang 25rb</OutgoingBubble>

              <IncomingBubble>
                <span className="flex items-start gap-1.5 font-medium">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  Transaksi berhasil: Makan Siang Rp 25.000
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Kategori Makanan · tersimpan di Google Sheet Anda
                </span>
              </IncomingBubble>

              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm border-2 border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/[0.03]">
                <span className="flex items-center gap-2 text-[11px] font-medium text-amber-800 dark:text-amber-300/80">
                  <Camera className="size-3.5 shrink-0" />
                  Foto struk Indomaret
                </span>
              </div>

              <IncomingBubble>
                <span className="font-medium">
                  Tercatat dari struk — 3 item, Rp 142.500
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Susu UHT · Roti tawar · Detergen
                </span>
              </IncomingBubble>

              {/* Typing indicator keeps the scene feeling alive */}
              <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm border border-border/60 bg-background px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
