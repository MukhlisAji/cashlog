import { createClient } from "@/lib/supabase/client";
import {
  demoDelay,
  getDemoHouseholdSummary,
  inviteDemoHouseholdMember,
  isDemoMode,
  purchaseDemoHouseholdSlots,
  revokeDemoHouseholdMember,
} from "@/lib/demo";
import type { HouseholdSummary } from "@/types/household";

export type {
  HouseholdMember,
  HouseholdMemberStatus,
  HouseholdSummary,
} from "@/types/household";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function authFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: "Not authenticated" };
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  return response.json() as Promise<ApiResponse<T>>;
}

export const householdService = {
  async getSummary() {
    if (isDemoMode()) {
      await demoDelay();
      return { success: true, data: getDemoHouseholdSummary() };
    }
    return authFetch<HouseholdSummary>("/api/household");
  },

  async addMember(displayName: string, phone: string) {
    if (isDemoMode()) {
      await demoDelay(500);
      const summary = getDemoHouseholdSummary();
      if (!summary.canInviteMember) {
        return {
          success: false,
          error: "Beli slot anggota dulu atau slot sudah penuh.",
        };
      }
      return {
        success: true,
        data: inviteDemoHouseholdMember(displayName, phone),
      };
    }

    return authFetch<{
      memberId: string;
      displayName: string;
      phone: string;
    }>("/api/household/members", {
      method: "POST",
      body: JSON.stringify({ displayName, phone }),
    });
  },

  async revokeMember(memberId: string) {
    if (isDemoMode()) {
      await demoDelay(300);
      revokeDemoHouseholdMember(memberId);
      return { success: true };
    }

    return authFetch<void>(`/api/household/members/${memberId}`, {
      method: "DELETE",
    });
  },

  async checkoutSlots(slots: number) {
    if (isDemoMode()) {
      await demoDelay(500);
      purchaseDemoHouseholdSlots(slots);
      return {
        success: true,
        data: {
          slots,
          amount: slots * getDemoHouseholdSummary().memberPrice,
          devActivated: true,
        },
        message: `${slots} slot anggota diaktifkan (demo).`,
      };
    }

    return authFetch<{
      checkoutUrl?: string;
      amount?: number;
      slots?: number;
      devActivated?: boolean;
    }>("/api/household/slots/checkout", {
      method: "POST",
      body: JSON.stringify({ slots }),
    });
  },
};
