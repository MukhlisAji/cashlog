import { getAccessToken } from "@/lib/access-token";
import { fetchApiJson, SESSION_EXPIRED } from "@/lib/api-error";
import {
  demoDelay,
  getMockDashboardData,
  isDemoMode,
} from "@/lib/demo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DashboardSummary {
  activeMonth: string;
  totalExpense: number;
  transactionCount: number;
  averagePerTransaction: number;
  yearTotal: number;
  topCategory: string;
}

export interface DashboardCategoryTotal {
  category: string;
  amount: number;
}

export interface DashboardTransaction {
  date: string;
  time?: string | null;
  item: string;
  amount: number;
  category: string;
  source: string;
}

export interface DashboardData {
  sheet: {
    connected: boolean;
    spreadsheetId: string | null;
    spreadsheetUrl: string | null;
  };
  whatsapp: {
    connected: boolean;
    phone: string | null;
    status: string;
  };
  summary: DashboardSummary | null;
  recentTransactions: DashboardTransaction[];
  categoryTotals: DashboardCategoryTotal[];
  budgets: { category: string; amount: number }[];
  hasTransactions: boolean;
}

export const dashboardService = {
  async getDashboard(): Promise<ApiResponse<DashboardData>> {
    if (isDemoMode()) {
      await demoDelay();
      return { success: true, data: getMockDashboardData() };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: SESSION_EXPIRED };

    return fetchApiJson<DashboardData>(`${API_URL}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
