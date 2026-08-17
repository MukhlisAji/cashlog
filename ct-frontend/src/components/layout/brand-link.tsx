"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { siteConfig } from "@/config/site";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface BrandLinkProps {
  /** Where to navigate when not scrolling to top on home */
  href?: string;
  /** On landing page (`/`), scroll to top instead of navigating */
  scrollToTopOnHome?: boolean;
  className?: string;
  iconClassName?: string;
  nameClassName?: string;
  showName?: boolean;
}

export function BrandLink({
  href = ROUTES.home,
  scrollToTopOnHome = false,
  className,
  iconClassName,
  nameClassName,
  showName = true,
}: BrandLinkProps) {
  const pathname = usePathname();
  const isHome = pathname === ROUTES.home;

  const content = (
    <>
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground",
          iconClassName,
        )}
      >
        <MessageCircle className="size-4" />
      </span>
      {showName && (
        <span className={cn("text-base font-semibold tracking-tight", nameClassName)}>
          {siteConfig.name}
        </span>
      )}
    </>
  );

  if (scrollToTopOnHome && isHome) {
    return (
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn("flex items-center gap-2", className)}
        aria-label={`${siteConfig.name} — kembali ke atas`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      {content}
    </Link>
  );
}
