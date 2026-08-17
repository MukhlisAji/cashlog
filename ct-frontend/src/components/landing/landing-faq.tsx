"use client";

import { useId, useState } from "react";
import { ChevronDown, HelpCircle, Shield, Sheet, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    icon: Sheet,
    iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    question: "Mengapa pakai Google Sheet?",
    answer:
      "Karena itu adalah cara paling transparan bagi Anda untuk mengolah data. Anda bisa membuat grafik sendiri, menambah kolom, atau membackup data kapan saja tanpa bergantung pada akses kami.",
  },
  {
    icon: Shield,
    iconClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    question: "Apakah ini aman untuk privasi saya?",
    answer:
      "Sangat. Kami tidak memiliki database pusat untuk menyimpan transaksi Anda. Bot kami hanya bertugas sebagai perantara untuk memindahkan data dari chat ke dokumen pribadi Anda.",
  },
  {
    icon: Users,
    iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    question: "Bagaimana jika saya ingin menambah anggota keluarga?",
    answer:
      "Anda bisa menambahkan hingga 5 nomor WhatsApp dalam satu akun keluarga. Semua transaksi dari nomor-nomor tersebut akan masuk ke satu Google Sheet yang sama.",
  },
  {
    icon: Sparkles,
    iconClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    question: "Apa bedanya dengan aplikasi keuangan lain?",
    answer:
      "Kebanyakan aplikasi keuangan memaksa Anda menggunakan sistem mereka (vendor lock-in) dan menyimpan data Anda di server mereka. Di Cashlog, Anda yang memiliki datanya.",
  },
] as const;

interface FaqAccordionItemProps {
  icon: LucideIcon;
  iconClass: string;
  question: string;
  answer: string;
}

function FaqAccordionItem({
  icon: Icon,
  iconClass,
  question,
  answer,
}: FaqAccordionItemProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-sm transition-[box-shadow,border-color,transform] duration-300 hover:border-primary/20",
        open && "border-primary/25 shadow-md shadow-primary/5",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 transition-transform duration-300 dark:ring-white/10",
            iconClass,
            open && "scale-105",
          )}
        >
          <Icon className="size-4" />
        </span>

        <span className="flex-1 text-[15px] font-medium leading-snug sm:text-base">
          {question}
        </span>

        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-300 ease-out",
            open && "rotate-180 text-primary",
          )}
        />
      </button>

      <div
        id={panelId}
        className="faq-accordion-panel"
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
      >
        <div className="faq-accordion-panel-inner">
          <div className="faq-accordion-body border-t border-border/60 px-5 pb-5 pt-4 sm:pl-[4.75rem]">
            <p className="text-sm leading-relaxed text-muted-foreground">{answer}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-marketing border-t bg-muted/20 pb-20 pt-14 sm:pb-24 sm:pt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ScrollReveal className="mb-10 flex items-center justify-center gap-2">
          <HelpCircle className="size-4 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            FAQ
          </p>
        </ScrollReveal>

        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {FAQ_ITEMS.map((item, i) => (
            <ScrollReveal key={item.question} delay={i * 70}>
              <FaqAccordionItem
                icon={item.icon}
                iconClass={item.iconClass}
                question={item.question}
                answer={item.answer}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
