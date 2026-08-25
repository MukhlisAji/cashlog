"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface BrandLinkProps {
  href?: string;
  scrollToTopOnHome?: boolean;
  className?: string;
  /** Icon-only (C mark). Default is full wordmark. */
  markOnly?: boolean;
}

function BrandMark({ markOnly }: { markOnly: boolean }) {
  if (markOnly) {
    return (
      <Image
        src="/brand/mark.svg"
        alt={siteConfig.name}
        width={28}
        height={28}
        className="size-7"
        unoptimized
      />
    );
  }

  return (
    <>
      <Image
        src="/brand/wordmark-light.jpeg"
        alt={siteConfig.name}
        width={420}
        height={96}
        className="h-7 w-auto max-w-[9.5rem] object-contain object-left dark:hidden"
        priority
      />
      <Image
        src="/brand/wordmark-dark.jpeg"
        alt=""
        width={420}
        height={96}
        className="hidden h-7 w-auto max-w-[9.5rem] object-contain object-left dark:block"
        priority
      />
    </>
  );
}

export function BrandLink({
  href = ROUTES.home,
  scrollToTopOnHome = false,
  className,
  markOnly = false,
}: BrandLinkProps) {
  const pathname = usePathname();
  const isHome = pathname === ROUTES.home;

  if (scrollToTopOnHome && isHome) {
    return (
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn("flex items-center", className)}
        aria-label={`${siteConfig.name} — kembali ke atas`}
      >
        <BrandMark markOnly={markOnly} />
      </button>
    );
  }

  return (
    <Link href={href} className={cn("flex items-center", className)}>
      <BrandMark markOnly={markOnly} />
    </Link>
  );
}
