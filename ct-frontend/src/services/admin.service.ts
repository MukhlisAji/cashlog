import { fetchApiJson } from "@/lib/api-error";
import { getAccessToken } from "@/lib/access-token";
import { SESSION_EXPIRED } from "@/lib/api-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type AdminOverview = {
  generatedAt: string;
  users: {
    total: number;
    trial: number;
    active: number;
    expired: number;
    free: number;
    onboarded: number;
    notOnboarded: number;
    newToday: number;
    payingOrTrial: number;
  };
  connections: {
    googleSheet: number;
    waLeadPhones: number;
    waMemberPhones: number;
    waPhones: number;
    phoneWithoutSheet: number;
    sheetWithoutPhone: number;
  };
  activity: {
    txToday: number;
    txLast7Days: number;
    usersWithTxToday: number;
  };
  billing: {
    expiringIn7Days: number;
    memberSlotsPaid: number;
  };
  habit: {
    householdsWithStreak: number;
    streakMax: number;
    streakAvg: number;
  };
  pdf: {
    waSentToday: number;
    waSent7d: number;
    waSendFailToday: number;
    waSendFail7d: number;
    exportToday: number;
    export7d: number;
    exportFailToday: number;
    exportFail7d: number;
    generateOkToday: number;
    generateFailToday: number;
    generateFail7d: number;
    everWeeklyKey: number;
    everMonthlyKey: number;
    everTrialKey: number;
  };
  failures: {
    recordToday: number;
    record7d: number;
    parseToday: number;
    parse7d: number;
    onboardToday: number;
    onboard7d: number;
    reminderToday: number;
    reminder7d: number;
    inboundToday: number;
    inbound7d: number;
    sheetSetupToday: number;
    sheetSetup7d: number;
    tableReady: boolean;
  };
  matrix: {
    kind: string;
    okToday: number;
    failToday: number;
    ok7d: number;
    fail7d: number;
  }[];
  recentFails: {
    createdAt: string;
    kind: string;
    userId: string | null;
    message: string | null;
  }[];
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  plan: string;
  expiresAt: string | null;
  createdAt: string;
  onboarded: boolean;
  sheetConnected: boolean;
  leadPhone: string | null;
  memberPhones: string[];
  memberSlotsPaid: number;
  habitStreak: number;
  txToday: number;
};

async function adminGet<T>(path: string) {
  const token = await getAccessToken();
  if (!token) {
    return { success: false as const, error: SESSION_EXPIRED };
  }
  return fetchApiJson<T>(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export const adminService = {
  getOverview() {
    return adminGet<AdminOverview>("/api/admin/overview");
  },
  listUsers(q: string, page: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return adminGet<{
      users: AdminUserRow[];
      page: number;
      pageSize: number;
      total: number;
    }>(`/api/admin/users${qs ? `?${qs}` : ""}`);
  },
};
