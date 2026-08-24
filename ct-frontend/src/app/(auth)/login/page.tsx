import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
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
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = {
  title: "Masuk",
};

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

function getLoginDescription() {
  if (isDemoMode()) {
    return "Mode demo — jelajahi UI tanpa Supabase atau backend";
  }
  if (!isSupabaseConfigured()) {
    return "Supabase belum dikonfigurasi — gunakan Masuk Demo";
  }
  return "Masuk dengan Google — rekomendasi (termasuk Google Sheet)";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/";
  const hasError = params.error === "auth_callback_failed";

  return (
    <div className="w-full max-w-sm">
      <AuthBrandHeader />

      <Card>
        <CardHeader>
          <CardTitle>Selamat datang</CardTitle>
          <CardDescription>{getLoginDescription()}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoginForm redirectTo={redirectTo} hasError={hasError} />
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
            Belum punya akun?{" "}
            <Link
              href={`/register?redirect=${encodeURIComponent(redirectTo)}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Daftar gratis
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
