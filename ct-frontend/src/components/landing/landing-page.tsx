"use client";

import { useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  Lock,
  MessageCircle,
  Sparkles,
  Zap,
} from "lucide-react";

import { HeroPhoneMockup } from "@/components/landing/hero-phone-mockup";
import { LandingFaq } from "@/components/landing/landing-faq";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { TypingHeadline } from "@/components/landing/typing-headline";
import { SiteFooter } from "@/components/layout/site-footer";
import { PricingAction } from "@/components/subscription/pro-pricing-action";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import {
  isMarketingSectionId,
  scrollToMarketingSection,
  scrollToMarketingSectionWhenReady,
} from "@/lib/marketing-scroll";
import {
  formatTierPriceShort,
  formatHouseholdMemberPrice,
  getTierLabel,
  TRIAL_DAYS,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

const ADVANCED_FEATURES = [
  "Catat via WhatsApp unlimited",
  "Google Sheet milik Anda — 100% privasi",
  "Dashboard ringkasan harian",
  "AI parsing bahasa natural Indonesia",
  "AI scan struk multi-item dari foto",
  "Analitik & skor kesehatan keuangan",
  "Budget bulanan + rekomendasi AI",
  "Laporan lengkap otomatis via WhatsApp",
  "Kategori custom",
  `Add-on keluarga +${formatHouseholdMemberPrice()}/anggota (maks 5)`,
];

const FEATURES = [
  {
    icon: Camera,
    title: "Scan Struk",
    badge: "Termasuk",
    description:
      "Foto nota via WhatsApp — AI baca total & kategori otomatis.",
    accent: "from-amber-500/15 to-orange-500/5 border-amber-500/20",
    iconColor: "text-amber-600 bg-amber-500/15",
  },
  {
    icon: MessageCircle,
    title: "Catat via Chat",
    description:
      'Ketik "Beli kopi 20rb" — langsung masuk Google Sheet milik Anda.',
    accent: "from-primary/15 to-emerald-500/5 border-primary/20",
    iconColor: "text-primary bg-primary/15",
  },
  {
    icon: BarChart3,
    title: "Analitik Keluarga",
    badge: "Termasuk",
    description:
      "Skor kesehatan keuangan, tren bulanan, dan rekomendasi praktis.",
    accent: "from-violet-500/15 to-indigo-500/5 border-violet-500/20",
    iconColor: "text-violet-600 bg-violet-500/15",
  },
  {
    icon: Lock,
    title: "Privasi Penuh",
    description:
      "Data transaksi hanya di Sheet Anda. Kami tidak simpan riwayat keuangan.",
    accent: "from-slate-500/10 to-background border-border/60",
    iconColor: "text-muted-foreground bg-muted",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Hubungkan",
    description: "Daftar, hubungkan Google Sheet, daftarkan nomor WA, lalu chat ke bot pusat.",
  },
  {
    step: "02",
    title: "Catat",
    description: "Kirim pesan atau foto struk — langsung tercatat di Google Sheet.",
  },
  {
    step: "03",
    title: "Pantau",
    description:
      "Lihat ringkasan di dashboard — atau terima laporan lengkap langsung di WhatsApp tanpa perlu buka dashboard.",
  },
];

export function LandingPage() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (isMarketingSectionId(hash)) {
      requestAnimationFrame(() => scrollToMarketingSectionWhenReady(hash));
    }
  }, []);

  return (
    <div className="flex flex-col overflow-x-hidden">
      {/* Hero */}
      <section className="relative border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,oklch(0.72_0.14_155/0.25),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.5_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0_0/0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-2 lg:items-center lg:gap-16">
          <ScrollReveal direction="left">
            <div className="flex flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                Keuangan rumah tangga via WhatsApp
              </span>

              <TypingHeadline />

              <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                {siteConfig.name} otomatis mencatat transaksi dari WhatsApp ke Google Sheet
                Anda — privasi 100%, data tetap milik Anda.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  size="lg"
                  className="gap-2 shadow-lg shadow-primary/20"
                  onClick={() => scrollToMarketingSection("harga")}
                >
                  Mulai
                  <ArrowRight className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-primary" />
                  Trial {getTierLabel("pro")} {TRIAL_DAYS} hari
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-primary" />
                  100% privasi
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-primary" />
                  Setup &lt; 5 menit
                </span>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={120}>
            <HeroPhoneMockup />
          </ScrollReveal>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="scroll-mt-marketing border-b bg-muted/20 pb-20 pt-14 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">Fitur</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Semua yang dibutuhkan keluarga modern
            </h2>
            <p className="mt-3 text-muted-foreground">
              Dari pencatatan harian hingga insight keuangan — dalam satu alur WhatsApp.
            </p>
          </ScrollReveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 80}>
                <div
                  className={cn(
                    "group h-full rounded-2xl border bg-gradient-to-b p-5 transition-shadow hover:shadow-lg",
                    feature.accent,
                  )}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl",
                        feature.iconColor,
                      )}
                    >
                      <feature.icon className="size-5" />
                    </span>
                    {feature.badge && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="scroll-mt-marketing pb-20 pt-14 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">Cara Kerja</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Tiga langkah, langsung jalan
            </h2>
          </ScrollReveal>

          <div className="relative grid gap-8 md:grid-cols-3 md:gap-6">
            <div className="pointer-events-none absolute top-8 hidden h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent md:inset-x-[16%] md:block" />
            {STEPS.map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 100} className="relative">
                <div className="flex flex-col items-center text-center">
                  <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="harga" className="scroll-mt-marketing border-t bg-muted/20 pb-20 pt-14 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">Harga</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Mulai perjalanan keuangan Anda dengan akses penuh
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Coba semua fitur selama {TRIAL_DAYS} hari. Setelah itu hanya satu
              paket lengkap, tanpa bingung memilih tier.
            </p>
          </ScrollReveal>

          <div className="mx-auto max-w-xl">
            <ScrollReveal delay={100}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-primary/35 bg-gradient-to-b from-primary/[0.07] via-card to-card p-7 shadow-2xl shadow-primary/15 transition-[translate,box-shadow] duration-300 ease-out will-change-transform hover:border-primary/55 hover:shadow-primary/35 motion-safe:hover:-translate-y-2 lg:scale-[1.02]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-primary" />
                <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/20 opacity-70 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 size-32 rounded-full bg-emerald-400/10 blur-2xl" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15">
                      <Sparkles className="size-4 text-primary" />
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-primary">
                        {getTierLabel("pro")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Semua fitur dalam satu paket
                      </p>
                    </div>
                  </div>
                  {/* <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    Most Value
                  </span> */}
                </div>

                <div className="relative mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {formatTierPriceShort("pro")}
                  </span>
                  <span className="text-muted-foreground">/bulan</span>
                </div>
                <p className="relative mt-1 text-sm font-medium text-primary">
                  Gratis {TRIAL_DAYS} hari · semua fitur AI & analitik
                </p>

                <ul className="relative mt-8 flex-1 space-y-3.5">
                  {ADVANCED_FEATURES.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                        <Check className="size-3 text-primary" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <PricingAction
                  tier="pro"
                  label={`Coba Gratis ${TRIAL_DAYS} Hari`}
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <LandingFaq />

      {/* Footer CTA */}
      <section className="border-t pb-16 pt-12">
        <ScrollReveal className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Siap mulai catat keuangan keluarga?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Trial {getTierLabel("pro")} {TRIAL_DAYS} hari gratis saat daftar — coba semua fitur
            lalu lanjut dengan satu paket lengkap.
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              size="lg"
              onClick={() => scrollToMarketingSection("harga")}
            >
              Mulai
            </Button>
          </div>
        </ScrollReveal>
      </section>

      <SiteFooter />
    </div>
  );
}
