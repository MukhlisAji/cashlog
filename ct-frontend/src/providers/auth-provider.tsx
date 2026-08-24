"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authService, type SignUpResult } from "@/services/auth.service";
import type { User } from "@/types";
import { ROUTES } from "@/lib/constants";
import { getDemoUser, isDemoLoggedIn, isDemoMode, resetDemoState, startDemoSession } from "@/lib/demo";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInAsDemo: (redirectTo?: string) => void;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<User>;
  signUpWithPassword: (
    name: string,
    email: string,
    password: string,
    redirectTo?: string,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode()) {
      if (isDemoLoggedIn()) {
        setUser(getDemoUser());
      } else {
        setUser(null);
      }
      setIsLoading(false);
      return;
    }

    authService.getSessionUser().then((sessionUser) => {
      setUser(sessionUser);
      setIsLoading(false);
    });

    const subscription = authService.onAuthStateChange(setUser);
    return () => subscription.unsubscribe();
  }, []);

  const signInAsDemo = useCallback((redirectTo?: string) => {
    startDemoSession();
    setUser(getDemoUser());
    window.location.href = redirectTo ?? "/";
  }, []);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    if (isDemoMode()) {
      signInAsDemo(redirectTo);
      return;
    }
    await authService.signInWithGoogle(redirectTo);
  }, [signInAsDemo]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const sessionUser = await authService.signInWithPassword(email, password);
    setUser(sessionUser);
    return sessionUser;
  }, []);

  const signUpWithPassword = useCallback(
    async (name: string, email: string, password: string, redirectTo?: string) => {
      const result = await authService.signUpWithPassword(
        name,
        email,
        password,
        redirectTo,
      );
      if (!result.needsEmailConfirmation) {
        setUser(result.user);
      }
      return result;
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (isDemoMode()) {
      resetDemoState();
      setUser(null);
      window.location.assign(ROUTES.home);
      return;
    }
    await authService.signOut();
    setUser(null);
    window.location.assign(ROUTES.home);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      signInAsDemo,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [user, isLoading, signInAsDemo, signInWithGoogle, signInWithPassword, signUpWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
