import { createClient } from "@/lib/supabase/client";
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

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
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
    if (!token) return { success: false, error: "Not authenticated" };

    const params = month ? `?month=${encodeURIComponent(month)}` : "";
    const response = await fetch(`${API_URL}/api/budgets${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.json() as Promise<ApiResponse<BudgetsData>>;
  },

  async save(budgets: BudgetItem[], month?: string) {
    if (isDemoMode()) {
      await demoDelay(300);
      const data = saveDemoBudgets(budgets, month);
      return { success: true, data };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/budgets`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ month, budgets }),
    });

    return response.json() as Promise<ApiResponse<BudgetsData>>;
  },
};
