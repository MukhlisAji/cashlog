import type { User as SupabaseUser } from "@supabase/supabase-js";

import { GOOGLE_SHEETS_SCOPES } from "@/lib/google-scopes";
import { canUseSupabaseAuth, createClient } from "@/lib/supabase/client";
import type { User } from "@/types";

import { triggerWelcomeEmail } from "./notification.service";

export interface SignUpResult {
  user: User;
  needsEmailConfirmation: boolean;
  accessToken: string | null;
}

export function getAuthProvider(
  supabaseUser: SupabaseUser,
): User["authProvider"] {
  if (
    supabaseUser.app_metadata?.provider === "google" ||
    supabaseUser.identities?.some((identity) => identity.provider === "google")
  ) {
    return "google";
  }
  return "email";
}

export function mapSupabaseUser(supabaseUser: SupabaseUser): User {
  const metadata = supabaseUser.user_metadata as Record<string, string>;

  return {
    id: supabaseUser.id,
    name:
      metadata.full_name ??
      metadata.name ??
      supabaseUser.email?.split("@")[0] ??
      "Pengguna",
    email: supabaseUser.email ?? "",
    avatarUrl: metadata.avatar_url ?? metadata.picture,
    whatsappConnected: false,
    authProvider: getAuthProvider(supabaseUser),
  };
}

export const authService = {
  async signInWithGoogle(redirectTo = "/") {
    if (!canUseSupabaseAuth()) {
      throw new Error("Supabase belum dikonfigurasi. Aktifkan demo mode atau isi .env.local");
    }

    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) throw error;
  },

  /** Incremental Sheets grant — Google shows "additional access" (Continue), not the checklist. */
  async signInWithGoogleSheets(redirectTo = "/ringkasan", loginHint?: string) {
    if (!canUseSupabaseAuth()) {
      throw new Error("Supabase belum dikonfigurasi");
    }

    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?phase=sheets&redirect=${encodeURIComponent(redirectTo)}`,
        scopes: GOOGLE_SHEETS_SCOPES,
        queryParams: {
          access_type: "offline",
          include_granted_scopes: "true",
          ...(loginHint ? { login_hint: loginHint } : {}),
        },
      },
    });

    if (error) throw error;
  },

  async signUpWithPassword(
    name: string,
    email: string,
    password: string,
    redirectTo = "/ringkasan",
  ): Promise<SignUpResult> {
    if (!canUseSupabaseAuth()) {
      throw new Error("Supabase belum dikonfigurasi");
    }

    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error("Pendaftaran gagal");

    const user = mapSupabaseUser(data.user);
    const accessToken = data.session?.access_token ?? null;
    const needsEmailConfirmation = !data.session;

    if (accessToken) {
      void triggerWelcomeEmail(accessToken);
    }

    return { user, needsEmailConfirmation, accessToken };
  },

  async signInWithPassword(email: string, password: string) {
    if (!canUseSupabaseAuth()) {
      throw new Error("Supabase belum dikonfigurasi");
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Login gagal");

    return mapSupabaseUser(data.user);
  },

  async signOut() {
    if (!canUseSupabaseAuth()) return;

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    if (!canUseSupabaseAuth()) {
      return { unsubscribe: () => {} };
    }

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? mapSupabaseUser(session.user) : null);
    });

    return subscription;
  },

  async getSessionUser(): Promise<User | null> {
    if (!canUseSupabaseAuth()) return null;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user ? mapSupabaseUser(user) : null;
  },
};
