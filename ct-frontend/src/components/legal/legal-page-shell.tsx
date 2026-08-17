import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ButtonLink } from "@/components/ui/button-link";
import { siteConfig } from "@/config/site";
import { ROUTES } from "@/lib/constants";

interface LegalPageShellProps {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}

export function LegalPageShell({
  title,
  updatedAt,
  children,
}: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <ButtonLink variant="ghost" size="sm" href={ROUTES.home}>
            ← {siteConfig.name}
          </ButtonLink>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <ThemeToggle />
            <Link href={ROUTES.privacy} className="hover:text-foreground">
              Privasi
            </Link>
            <Link href={ROUTES.terms} className="hover:text-foreground">
              Syarat
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Terakhir diperbarui: {updatedAt}
        </p>
        <article className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-4 [&_strong]:text-foreground [&_ul]:space-y-2">
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
