import { getAccessToken } from "@/lib/access-token";
import { fetchApiJson, SESSION_EXPIRED } from "@/lib/api-error";
import {
  demoDelay,
  getDemoBudgets,
  isDemoMode,
  saveDemoBudgets,
} from "@/lib/demo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BudgetItem {
  category: string;
  amount: number;
}

export interface BudgetsData {
  month: string;
  budgets: BudgetItem[];
}

export const budgetsService = {
  async list(month?: string) {
    if (isDemoMode()) {
      await demoDelay();
      return {
        success: true,
        data: getDemoBudgets(month),
      };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: SESSION_EXPIRED };

    const params = month ? `?month=${encodeURIComponent(month)}` : "";
    return fetchApiJson<BudgetsData>(`${API_URL}/api/budgets${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async save(budgets: BudgetItem[], month?: string) {
    if (isDemoMode()) {
      await demoDelay(300);
      const data = saveDemoBudgets(budgets, month);
      return { success: true, data };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: SESSION_EXPIRED };

    return fetchApiJson<BudgetsData>(`${API_URL}/api/budgets`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ month, budgets }),
    });
  },
};
