import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";
import { AuthBrandHeader } from "@/components/layout/auth-brand-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Lock } from "lucide-react";
import { isDemoMode } from "@/lib/demo";
import { ROUTES } from "@/lib/constants";
import { TRIAL_DAYS } from "@/lib/pricing";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = {
  title: "Daftar",
};

interface RegisterPageProps {
  searchParams: Promise<{ redirect?: string; intent?: string }>;
}

function getRegisterDescription(wantsTrial: boolean) {
  if (isDemoMode()) {
    return "Mode demo — jelajahi UI tanpa Supabase atau backend";
  }
  if (!isSupabaseConfigured()) {
    return "Supabase belum dikonfigurasi — gunakan Coba Demo";
  }
  if (wantsTrial) {
    return `Mulai trial Pro ${TRIAL_DAYS} hari — data di Google Sheet Anda`;
  }
  return "Buat akun. Trial hanya aktif jika Anda memilih Coba Gratis.";
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const wantsTrial = params.intent === "trial";
  const redirectTo = params.redirect ?? (wantsTrial ? ROUTES.trial : ROUTES.home);

  return (
    <div className="w-full max-w-sm">
      <AuthBrandHeader />

      <Card>
        <CardHeader>
          <CardTitle>Buat akun</CardTitle>
          <CardDescription>{getRegisterDescription(wantsTrial)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RegisterForm redirectTo={redirectTo} />
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Privasi 100%. Kami tidak menyimpan riwayat transaksi — data
              hanya ada di Google Sheet milik Anda.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Sudah punya akun?{" "}
            <Link
              href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Masuk
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privasi
            </Link>
            {" · "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              Syarat
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
