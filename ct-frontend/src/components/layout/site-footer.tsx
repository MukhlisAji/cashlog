import Link from "next/link";

import { BrandLink } from "@/components/layout/brand-link";
import { getHelloEmail } from "@/config/site";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SiteFooterProps {
  className?: string;
}

export function SiteFooter({ className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t bg-muted/30 py-10 text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLink href={ROUTES.home} />
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href={ROUTES.privacy} className="hover:text-foreground">
              Kebijakan Privasi
            </Link>
            <Link href={ROUTES.terms} className="hover:text-foreground">
              Syarat & Ketentuan
            </Link>
            <a
              href={`mailto:${getHelloEmail()}`}
              className="hover:text-foreground"
            >
              Kontak
            </a>
          </nav>
        </div>
        <p className="text-xs leading-relaxed">
          © {year} cashlog.id — pencatat keuangan keluarga via WhatsApp. Data
          transaksi disimpan di Google Sheet milik Anda, bukan di server kami.
        </p>
      </div>
    </footer>
  );
}
