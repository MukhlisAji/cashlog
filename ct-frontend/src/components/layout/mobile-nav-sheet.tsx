"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import Image from "next/image";

import { MarketingNavLinks } from "@/components/landing/marketing-nav-links";
import { MarketingMulaiButton } from "@/components/landing/marketing-mulai-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/button-link";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/hooks/use-auth";
import { NAV_LINKS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const mobileItemClass =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[15px] font-medium transition-colors";

function MobileNavLink({
  href,
  active,
  children,
  icon: Icon,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <SheetClose
      nativeButton={false}
      render={
        <a
          href={href}
          onClick={(e) => {
            // Skip Next.js RSC payload wait — go straight to the URL.
            // URL changes instantly; (dashboard)/loading.tsx renders skeleton
            // while browser fetches the new page.
            e.preventDefault();
            window.location.assign(href);
          }}
          className={cn(
            mobileItemClass,
            active
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted/80 active:bg-muted",
          )}
        />
      }
    >
      <Icon className="size-5 shrink-0 opacity-80" />
      {children}
    </SheetClose>
  );
}

const DASHBOARD_ICONS: Record<string, React.ElementType> = {
  "/ringkasan": BarChart3,
};

function MobileDashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_LINKS.dashboard.map((link) => {
        const Icon = DASHBOARD_ICONS[link.href] ?? LayoutDashboard;
        const isActive = pathname === link.href;
        return (
          <MobileNavLink key={link.href} href={link.href} active={isActive} icon={Icon}>
            {link.label}
          </MobileNavLink>
        );
      })}
    </nav>
  );
}

function MobileGuestFooter() {
  return (
    <div className="flex flex-col gap-2">
      <SheetClose
        nativeButton={false}
        render={
          <LinkButton variant="outline" className="w-full" href={ROUTES.login} />
        }
      >
        Masuk
      </SheetClose>
      <SheetClose
        nativeButton={false}
        render={<MarketingMulaiButton fullWidth />}
      />
    </div>
  );
}

function MobileUserFooter({ showDashboardLink }: { showDashboardLink?: boolean }) {
  const { user, signOut } = useAuth();

  if (!user) return null;

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
        <Avatar size="sm">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {showDashboardLink && (
          <MobileNavLink href={ROUTES.dashboard} icon={LayoutDashboard}>
            Ringkasan
          </MobileNavLink>
        )}
        <MobileNavLink href={ROUTES.settings} icon={Settings}>
          Pengaturan
        </MobileNavLink>
      </nav>
      <SheetClose
        render={
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 px-4 py-3.5 text-[15px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void handleSignOut()}
          />
        }
      >
        <LogOut className="size-5 shrink-0" />
        Keluar
      </SheetClose>
    </div>
  );
}

export function MobileNavSheet({
  isMarketingPage,
  trigger,
}: {
  isMarketingPage: boolean;
  trigger: React.ReactElement;
}) {
  const { isAuthenticated } = useAuth();

  return (
    <Sheet>
      <SheetTrigger render={trigger} />
      <SheetContent
        side="right"
        className="flex h-full max-h-[100dvh] w-[min(100vw-1rem,20rem)] flex-col gap-0 overflow-hidden border-l p-0 sm:max-w-xs"
      >
        {/* Header */}
        <div className="flex items-center border-b px-5 py-4 pr-14">
          <Image
            src="/brand/wordmark-light.png"
            alt={siteConfig.name}
            width={420}
            height={96}
            className="h-7 w-auto max-w-[9.5rem] object-contain object-left dark:hidden"
          />
          <Image
            src="/brand/wordmark-dark.png"
            alt=""
            width={420}
            height={96}
            className="hidden h-7 w-auto max-w-[9.5rem] object-contain object-left dark:block"
          />
        </div>

        {/* Nav body */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isMarketingPage ? "Halaman" : "Navigasi"}
          </p>
          {isMarketingPage ? (
            <MarketingNavLinks variant="mobile" />
          ) : (
            <MobileDashboardNav />
          )}
        </div>

        {/* Footer auth */}
        <div className="mt-auto shrink-0 border-t bg-muted/20 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ThemeToggle variant="menu-item" className="mb-4 md:hidden" />
          {isAuthenticated ? (
            <MobileUserFooter showDashboardLink={isMarketingPage} />
          ) : (
            <MobileGuestFooter />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
