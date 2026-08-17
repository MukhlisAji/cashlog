import { isDemoMode } from "@/lib/demo";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface TestUserCredentials {
  email: string;
  password: string;
  name: string;
}

/** Test user untuk local dev — buat via `npm run seed:test-user` di backend */
export function getTestUser(): TestUserCredentials {
  return {
    email: process.env.NEXT_PUBLIC_TEST_USER_EMAIL ?? "test@cashlog.id",
    password: process.env.NEXT_PUBLIC_TEST_USER_PASSWORD ?? "test123456",
    name: process.env.NEXT_PUBLIC_TEST_USER_NAME ?? "Test User",
  };
}

/** @deprecated Use getTestUser() */
export const TEST_USER = {
  get email() {
    return getTestUser().email;
  },
  get password() {
    return getTestUser().password;
  },
  get name() {
    return getTestUser().name;
  },
};

export function isTestLoginEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true" || isDemoMode()
  );
}

/** Tampilkan tombol demo jika mode demo aktif */
export function shouldShowDemoLogin(): boolean {
  return isDemoMode();
}

/** Tampilkan form email/password jika Supabase ada + test login aktif */
export function shouldShowTestLogin(): boolean {
  return isTestLoginEnabled() && isSupabaseConfigured() && !isDemoMode();
}

/** Tampilkan form daftar email/password (signup production) */
export function shouldShowEmailRegister(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

/** Tampilkan login email/password (fallback untuk user daftar manual) */
export function shouldShowEmailLogin(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

/** Tampilkan Google OAuth jika Supabase ada dan bukan pure demo */
export function shouldShowGoogleLogin(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}
