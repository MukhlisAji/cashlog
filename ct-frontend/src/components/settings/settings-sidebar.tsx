"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { id: "langganan", label: "Langganan" },
  { id: "whatsapp", label: "WhatsApp & Sheet" },
  { id: "anggota-keluarga", label: "Anggota Keluarga" },
  { id: "kategori", label: "Kategori" },
  { id: "budget", label: "Budget Bulanan" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export function scrollToSettingsSection(id: SettingsSectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function useSettingsSectionSpy() {
  const [activeId, setActiveId] = useState<SettingsSectionId>("langganan");

  useEffect(() => {
    const elements = SETTINGS_SECTIONS.map(({ id }) =>
      document.getElementById(id),
    ).filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );

        const next = visible[0]?.target.id as SettingsSectionId | undefined;
        if (next) setActiveId(next);
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return activeId;
}

type SettingsSidebarProps = {
  activeId: SettingsSectionId;
};

export function SettingsSidebar({ activeId }: SettingsSidebarProps) {
  return (
    <nav
      aria-label="Navigasi pengaturan"
      className="lg:sticky lg:top-24 lg:w-44 lg:shrink-0"
    >
      <p className="mb-2 hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:block">
        Menu
      </p>
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {SETTINGS_SECTIONS.map(({ id, label }) => {
          const isActive = activeId === id;

          return (
            <li key={id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => scrollToSettingsSection(id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                aria-current={isActive ? "true" : undefined}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
