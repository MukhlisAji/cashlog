"use client";

import { FlaskConical, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Link from "next/link";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/hooks/use-auth";
import { toUserFacingErrorFromUnknown } from "@/lib/api-error";
import {
  shouldShowDemoLogin,
  shouldShowEmailRegister,
  shouldShowGoogleLogin,
} from "@/lib/auth-config";
import { TRIAL_DAYS } from "@/lib/pricing";
import { ROUTES } from "@/lib/constants";

interface RegisterFormProps {
  redirectTo?: string;
}

export function RegisterForm({ redirectTo = "/" }: RegisterFormProps) {
  const { signInAsDemo, signUpWithPassword } = useAuth();
  const router = useRouter();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  const showEmail = shouldShowEmailRegister();
  const showDemo = shouldShowDemoLogin();
  const showGoogle = shouldShowGoogleLogin();

  function handleDemoRegister() {
    setError(null);
    signInAsDemo(redirectTo);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUpWithPassword(name, email, password, redirectTo);

      if (result.needsEmailConfirmation) {
        setCheckEmail(email.trim());
        setIsLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      const message = toUserFacingErrorFromUnknown(
        err,
        "Pendaftaran gagal. Coba lagi.",
      );
      if (message.toLowerCase().includes("already registered")) {
        setError("Email sudah terdaftar. Silakan masuk.");
      } else {
        setError(message);
      }
      setIsLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-5">
          <p className="font-medium">Cek email Anda</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Kami kirim link verifikasi ke{" "}
            <span className="font-medium text-foreground">{checkEmail}</span>.
            Setelah verifikasi, daftarkan nomor WhatsApp untuk mengaktifkan pencatatan.
          </p>
        </div>
        <ButtonLink variant="outline" href="/login" className="w-full">
          Ke halaman masuk
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showDemo && (
        <Button
          size="lg"
          className="w-full"
          onClick={handleDemoRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FlaskConical className="size-4" />
          )}
          Coba Demo (tanpa backend)
        </Button>
      )}

      {showGoogle && (
        <div className="flex flex-col gap-2">
          <GoogleSignInButton
            redirectTo={redirectTo}
            label="Daftar dengan Google"
            className="w-full border-primary/30 bg-primary/5 hover:bg-primary/10"
          />
          <p className="text-center text-xs text-muted-foreground">
            Rekomendasi — masuk & izin Google Sheet sekaligus (1 klik Google)
          </p>
        </div>
      )}

      {showEmail && showGoogle && !showEmailForm && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setShowEmailForm(true)}
        >
          Daftar dengan email
        </Button>
      )}

      {showEmail && (showEmailForm || !showGoogle) && (
        <>
          {showGoogle && (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">atau email</span>
              <Separator className="flex-1" />
            </div>
          )}

          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              Daftar email memerlukan akun Google (Gmail/Workspace) saat setup
              untuk menyimpan transaksi di Google Sheet milik Anda.
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Nama Anda"
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="nama@email.com"
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Konfirmasi password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" size="lg" variant="outline" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              Daftar dengan email
            </Button>
          </form>
        </>
      )}

      {(showGoogle || showEmail) && (
        <p className="text-center text-xs text-muted-foreground">
          Trial Pro {TRIAL_DAYS} hari · tanpa kartu kredit · data di Sheet Anda
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Dengan mendaftar, Anda setuju dengan{" "}
        <Link href={ROUTES.terms} className="underline underline-offset-4 hover:text-foreground">
          Syarat & Ketentuan
        </Link>{" "}
        dan{" "}
        <Link href={ROUTES.privacy} className="underline underline-offset-4 hover:text-foreground">
          Kebijakan Privasi
        </Link>
        . {siteConfig.name} tidak menyimpan isi transaksi di server.
      </p>
    </div>
  );
}
