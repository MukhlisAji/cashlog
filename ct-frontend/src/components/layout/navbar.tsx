"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLink } from "@/components/layout/brand-link";
import { MarketingMulaiButton } from "@/components/landing/marketing-mulai-button";
import { MarketingNavLinks } from "@/components/landing/marketing-nav-links";
import { MobileNavSheet } from "@/components/layout/mobile-nav-sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { NAV_LINKS, ROUTES } from "@/lib/constants";
import { isMarketingLandingPage } from "@/lib/marketing-scroll";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NavLinks({
  links,
  className,
}: {
  links: readonly { label: string; href: string }[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1 md:flex-row md:items-center md:gap-6", className)}>
      {links.map((link) => {
        const isActive =
          link.href.startsWith("/") && pathname === link.href;

        return (
          <a
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-foreground",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}

function GuestActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ButtonLink variant="ghost" size="sm" href={ROUTES.login}>
        Masuk
      </ButtonLink>
      <MarketingMulaiButton />
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  if (!user) return null;

  async function handleSignOut() {
    await signOut();
    router.push(ROUTES.home);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar size="sm">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              window.location.href = ROUTES.dashboard;
            }}
          >
            <LayoutDashboard />
            Ringkasan
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              window.location.href = ROUTES.settings;
            }}
          >
            <Settings />
            Pengaturan
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void handleSignOut();
            }}
          >
            <LogOut />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AuthActions() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" />;
  }

  if (isAuthenticated) {
    return <UserMenu />;
  }

  return <GuestActions />;
}

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/subscription-expired";
  if (isAuthPage) return null;

  const isDashboard =
    pathname.startsWith("/ringkasan") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings");
  const isMarketingPage = isMarketingLandingPage(pathname);
  const navLinks = isDashboard ? NAV_LINKS.dashboard : NAV_LINKS.marketing;
  const logoHref =
    isAuthenticated && isDashboard ? ROUTES.dashboard : ROUTES.home;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <BrandLink
            href={logoHref}
            scrollToTopOnHome={pathname === ROUTES.home}
          />

          {isMarketingPage ? (
            <MarketingNavLinks className="hidden md:flex" />
          ) : (
            <NavLinks links={navLinks} className="hidden md:flex" />
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <AuthActions />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <MobileNavSheet
            isMarketingPage={isMarketingPage}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Buka menu">
                <Menu className="size-5" />
              </Button>
            }
          />
        </div>
      </div>
    </header>
  );
}
