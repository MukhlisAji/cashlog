"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Layers, Route } from "lucide-react";

import { SheetClose } from "@/components/ui/sheet";
import { NAV_LINKS, ROUTES } from "@/lib/constants";
import { goToMarketingSection, getActiveMarketingSection } from "@/lib/marketing-scroll";
import { cn } from "@/lib/utils";

const SECTION_IDS = NAV_LINKS.marketing.map((l) => l.href.replace("/#", ""));

const MARKETING_ICONS: Record<string, React.ElementType> = {
  fitur: Layers,
  "cara-kerja": Route,
  harga: CreditCard,
};

const mobileItemClass =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[15px] font-medium transition-colors";

export function MarketingNavLinks({
  className,
  variant = "desktop",
}: {
  className?: string;
  variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const isHome = pathname === ROUTES.home;
  const [active, setActive] = useState(SECTION_IDS[0] ?? "fitur");

  const updateActive = useCallback(() => {
    if (!isHome) return;
    setActive(getActiveMarketingSection(SECTION_IDS));
  }, [isHome]);

  useEffect(() => {
    if (!isHome) return;

    const frame = requestAnimationFrame(updateActive);
    window.addEventListener("scroll", updateActive, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActive);
    };
  }, [isHome, updateActive]);

  function handleSectionClick(id: string) {
    goToMarketingSection(id, pathname);
  }

  if (variant === "mobile") {
    return (
      <nav className={cn("flex flex-col gap-1", className)}>
        {NAV_LINKS.marketing.map((link) => {
          const id = link.href.replace("/#", "");
          const isActive = isHome && active === id;
          const Icon = MARKETING_ICONS[id] ?? Layers;

          if (isHome) {
            return (
              <SheetClose
                key={link.href}
                render={
                  <button
                    type="button"
                    className={cn(
                      mobileItemClass,
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/80 active:bg-muted",
                    )}
                    onClick={() => handleSectionClick(id)}
                  />
                }
              >
                <Icon className="size-5 shrink-0 opacity-80" />
                {link.label}
              </SheetClose>
            );
          }

          return (
            <SheetClose
              key={link.href}
              nativeButton={false}
              render={
                <Link
                  href={link.href}
                  className={cn(
                    mobileItemClass,
                    "text-foreground hover:bg-muted/80 active:bg-muted",
                  )}
                />
              }
            >
              <Icon className="size-5 shrink-0 opacity-80" />
              {link.label}
            </SheetClose>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-1 md:flex-row md:items-center md:gap-1", className)}>
      {NAV_LINKS.marketing.map((link) => {
        const id = link.href.replace("/#", "");
        const isActive = isHome && active === id;

        if (isHome) {
          return (
            <button
              key={link.href}
              type="button"
              onClick={() => handleSectionClick(id)}
              className={cn(
                "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors md:py-1.5",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
              <span
                className={cn(
                  "absolute bottom-0 left-3 right-3 h-0.5 origin-left rounded-full bg-primary transition-all duration-300 ease-out",
                  isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
                )}
              />
            </button>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            className="relative rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:py-1.5"
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
