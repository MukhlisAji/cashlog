import { createClient } from "@/lib/supabase/client";
import {
  demoDelay,
  getDemoAnalyticsData,
  isDemoMode,
} from "@/lib/demo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export interface AnalyticsTransaction {
  date: string;
  time?: string | null;
  month: string;
  item: string;
  amount: number;
  category: string;
}

export interface AnalyticsData {
  activeMonth: string;
  availableMonths: string[];
  transactions: AnalyticsTransaction[];
  categoryTotals: { category: string; amount: number }[];
  dailyTotals: { date: string; amount: number; count: number }[];
  budgets: { category: string; amount: number }[];
  summary: {
    totalExpense: number;
    transactionCount: number;
    averagePerTransaction: number;
    topCategory: string;
  };
}

export const analyticsService = {
  async getAnalytics(month?: string): Promise<ApiResponse<AnalyticsData | null>> {
    if (isDemoMode()) {
      await demoDelay();
      return { success: true, data: getDemoAnalyticsData(month) };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const params = month ? `?month=${encodeURIComponent(month)}` : "";
    const response = await fetch(`${API_URL}/api/dashboard/analytics${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.json() as Promise<ApiResponse<AnalyticsData | null>>;
  },

  async exportPdf(month?: string): Promise<{ ok: boolean; error?: string }> {
    if (isDemoMode()) {
      return { ok: false, error: "Export PDF tidak tersedia di mode demo" };
    }

    const token = await getAccessToken();
    if (!token) return { ok: false, error: "Not authenticated" };

    const params = month ? `?month=${encodeURIComponent(month)}` : "";
    const response = await fetch(
      `${API_URL}/api/dashboard/analytics/export${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      return { ok: false, error: body.error ?? "Export PDF gagal" };
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition");
    const filenameMatch = disposition?.match(/filename="(.+)"/);
    const filename = filenameMatch?.[1] ?? "cashlog-analitik.pdf";

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);

    return { ok: true };
  },
};
