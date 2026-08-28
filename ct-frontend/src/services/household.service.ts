import { getAccessToken } from "@/lib/access-token";
import { fetchApiJson, SESSION_EXPIRED } from "@/lib/api-error";
import {
  demoDelay,
  getDemoHouseholdSummary,
  inviteDemoHouseholdMember,
  isDemoMode,
  purchaseDemoHouseholdSlots,
  revokeDemoHouseholdMember,
  updateDemoMemberNotifyFlags,
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

async function authFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: SESSION_EXPIRED };
  }

  const hasBody = options.body !== undefined && options.body !== null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (hasBody && !("Content-Type" in headers) && !("content-type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  return fetchApiJson<T>(`${API_URL}${path}`, { ...options, headers });
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

  async updateNotifyFlags(flags: {
    notifyMembersReminder?: boolean;
    notifyMembersWeekly?: boolean;
    notifyMembersMonthly?: boolean;
  }) {
    if (isDemoMode()) {
      await demoDelay(200);
      const summary = updateDemoMemberNotifyFlags(flags);
      return {
        success: true,
        data: {
          notifyMembersReminder: summary.notifyMembersReminder,
          notifyMembersWeekly: summary.notifyMembersWeekly,
          notifyMembersMonthly: summary.notifyMembersMonthly,
        },
      };
    }

    return authFetch<{
      notifyMembersReminder: boolean;
      notifyMembersWeekly: boolean;
      notifyMembersMonthly: boolean;
    }>("/api/household/notify", {
      method: "PATCH",
      body: JSON.stringify(flags),
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
