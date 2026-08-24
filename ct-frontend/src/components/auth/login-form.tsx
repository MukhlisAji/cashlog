"use client";

import { FlaskConical, Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import {
  shouldShowDemoLogin,
  shouldShowEmailLogin,
  shouldShowGoogleLogin,
  shouldShowTestLogin,
  getTestUser,
} from "@/lib/auth-config";

interface LoginFormProps {
  redirectTo?: string;
  hasError?: boolean;
}

export function LoginForm({ redirectTo = "/", hasError }: LoginFormProps) {
  const { signInAsDemo, signInWithGoogle, signInWithPassword } = useAuth();
  const router = useRouter();

  const testUser = getTestUser();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState<string>(testUser.email);
  const [password, setPassword] = useState<string>(testUser.password);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    hasError ? "Gagal masuk. Silakan coba lagi." : null,
  );

  const showTest = shouldShowTestLogin();
  const showDemo = shouldShowDemoLogin();
  const showGoogle = shouldShowGoogleLogin();
  const showEmail = shouldShowEmailLogin();

  function handleDemoLogin() {
    setError(null);
    signInAsDemo("/ringkasan");
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("Invalid login")
            ? "Email atau password salah."
            : err.message
          : "Login gagal",
      );
      setIsLoading(false);
    }
  }

  async function handleTestLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("Invalid login")
            ? "Email/password salah. Jalankan: npm run seed:test-user"
            : err.message
          : "Login gagal",
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {(error || hasError) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error ?? "Gagal masuk. Silakan coba lagi."}
        </div>
      )}

      {showDemo && (
        <Button
          size="lg"
          className="w-full"
          onClick={handleDemoLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FlaskConical className="size-4" />
          )}
          Masuk Demo (tanpa backend)
        </Button>
      )}

      {showGoogle && !showTest && (
        <div className="flex flex-col gap-2">
          <GoogleSignInButton
            redirectTo={redirectTo}
            label="Masuk dengan Google"
            className="w-full border-primary/30 bg-primary/5 hover:bg-primary/10"
          />
          <p className="text-center text-xs text-muted-foreground">
            Rekomendasi — termasuk izin Google Sheet (1 klik)
          </p>
        </div>
      )}

      {showTest && (
        <form onSubmit={handleTestLogin} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email test</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            Masuk Test User
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {testUser.email} / {testUser.password}
          </p>
        </form>
      )}

      {showTest && showGoogle && (
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">atau</span>
          <Separator className="flex-1" />
        </div>
      )}

      {showGoogle && showTest && (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isLoading}
          onClick={() => void signInWithGoogle(redirectTo)}
        >
          Masuk dengan Google
        </Button>
      )}

      {showEmail && !showTest && !showEmailForm && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setShowEmailForm(true)}
        >
          Masuk dengan email
        </Button>
      )}

      {showEmail && !showTest && showEmailForm && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">atau email</span>
            <Separator className="flex-1" />
          </div>
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" size="lg" variant="outline" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              Masuk dengan email
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
