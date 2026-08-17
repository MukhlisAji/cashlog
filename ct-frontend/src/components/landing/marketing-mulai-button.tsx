"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { scrollToMarketingSection } from "@/lib/marketing-scroll";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type MarketingMulaiButtonProps = {
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "ghost";
  fullWidth?: boolean;
  children?: React.ReactNode;
};

export function MarketingMulaiButton({
  className,
  size = "sm",
  variant = "default",
  fullWidth = false,
  children = "Mulai",
}: MarketingMulaiButtonProps) {
  const pathname = usePathname();
  const isHome = pathname === ROUTES.home;

  if (isHome) {
    return (
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(fullWidth && "w-full", className)}
        onClick={() => scrollToMarketingSection("harga")}
      >
        {children}
      </Button>
    );
  }

  return (
    <ButtonLink
      size={size}
      variant={variant}
      className={cn(fullWidth && "w-full", className)}
      href={`${ROUTES.home}#harga`}
    >
      {children}
    </ButtonLink>
  );
}
