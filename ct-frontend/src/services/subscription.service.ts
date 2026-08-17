import { createClient } from "@/lib/supabase/client";
import {
  createDemoCategory,
  deleteDemoCategory,
  demoDelay,
  getDemoCategories,
  getMockSubscriptionStatus,
  isDemoMode,
  updateDemoCategory,
  upgradeDemoSubscription,
} from "@/lib/demo";
import type { SubscriptionTier } from "@/lib/pricing";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export interface SubscriptionStatusData {
  allowed: boolean;
  status: "trial" | "active" | "expired";
  tier: SubscriptionTier | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  trialDaysRemaining: number | null;
  canAccessAnalytics: boolean;
  canUseReceiptOcr: boolean;
  canManageCategories: boolean;
  canManageHousehold: boolean;
  isTrial: boolean;
  isPro: boolean;
  /** Dev mode: activated without Midtrans */
  devActivated?: boolean;
  /** Langganan otomatis aktif via Midtrans Subscription */
  autoRenewal?: boolean;
}

export interface CheckoutData {
  checkoutUrl?: string;
  invoiceUrl?: string;
  invoiceId?: string;
  planId?: string;
  amount?: number;
  tier?: SubscriptionTier;
  mode?: "recurring" | "snap" | "invoice";
  devActivated?: boolean;
}

const PENDING_ORDER_KEY = "cashlog_pending_order_id";

export function setPendingPaymentOrderId(orderId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_ORDER_KEY, orderId);
}

export function consumePendingPaymentOrderId(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(PENDING_ORDER_KEY);
  if (value) sessionStorage.removeItem(PENDING_ORDER_KEY);
  return value;
}

export const subscriptionService = {
  async getStatus() {
    if (isDemoMode()) {
      await demoDelay();
      return { success: true, data: getMockSubscriptionStatus() };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.json() as Promise<ApiResponse<SubscriptionStatusData>>;
  },

  async checkout(tier: SubscriptionTier) {
    if (isDemoMode()) {
      await demoDelay(500);
      upgradeDemoSubscription(tier);
      return {
        success: true,
        data: {
          devActivated: true,
          ...getMockSubscriptionStatus(),
        },
      };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/subscription/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tier }),
    });

    const json = (await response.json()) as ApiResponse<
      SubscriptionStatusData & CheckoutData
    >;

    if (json.success && json.data && "devActivated" in json.data) {
      return {
        success: true,
        data: json.data,
        message: json.message,
      };
    }

    if (json.success && (json.data?.checkoutUrl || json.data?.invoiceUrl)) {
      const checkoutUrl = json.data.checkoutUrl ?? json.data.invoiceUrl;
      return {
        success: true,
        data: {
          checkoutUrl,
          invoiceUrl: json.data.invoiceUrl ?? checkoutUrl,
          invoiceId: json.data.invoiceId,
          planId: json.data.planId,
          amount: json.data.amount,
          tier: json.data.tier,
          mode: json.data.mode,
        },
      };
    }

    return {
      success: false,
      error: json.error ?? "Checkout gagal",
      code: json.code,
    };
  },

  async confirmPayment(orderId: string) {
    if (isDemoMode()) {
      return { success: true, data: getMockSubscriptionStatus() };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/subscription/confirm-payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });

    return response.json() as Promise<
      ApiResponse<SubscriptionStatusData & { paymentPending?: boolean }>
    >;
  },

  async cancelRenewal() {
    if (isDemoMode()) {
      return { success: true, message: "Demo — perpanjangan otomatis dibatalkan." };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/subscription/cancel-renewal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.json() as Promise<ApiResponse<void>>;
  },

  /** @deprecated Use checkout('pro') */
  async upgrade() {
    return this.checkout("pro");
  },
};

export interface Category {
  id: number;
  user_id: string;
  name: string;
  keywords: string | null;
  color: string | null;
  sort_order: number;
}

function demoAllowsCustomCategories(): boolean {
  return getMockSubscriptionStatus().canManageCategories;
}

export const categoriesService = {
  async list() {
    if (isDemoMode()) {
      await demoDelay();
      return { success: true, data: getDemoCategories() };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.json() as Promise<ApiResponse<Category[]>>;
  },

  async create(name: string, keywords?: string) {
    if (isDemoMode()) {
      if (!demoAllowsCustomCategories()) {
        return {
          success: false,
          error: "Kategori custom memerlukan langganan aktif.",
          code: "PRO_REQUIRED",
        };
      }
      await demoDelay(300);
      const cats = getDemoCategories();
      if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return { success: false, error: "Kategori sudah ada" };
      }
      const created = createDemoCategory(name, keywords);
      return { success: true, data: created };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, keywords }),
    });

    return response.json() as Promise<ApiResponse<Category>>;
  },

  async update(id: number, data: { keywords?: string; name?: string }) {
    if (isDemoMode()) {
      if (data.name !== undefined && !demoAllowsCustomCategories()) {
        return {
          success: false,
          error: "Kategori custom memerlukan langganan aktif.",
          code: "PRO_REQUIRED",
        };
      }
      await demoDelay(300);
      const updated = updateDemoCategory(id, data);
      if (!updated) return { success: false, error: "Not found" };
      return { success: true, data: updated };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/categories/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return response.json() as Promise<ApiResponse<Category>>;
  },

  async remove(id: number) {
    if (isDemoMode()) {
      if (!demoAllowsCustomCategories()) {
        return {
          success: false,
          error: "Kategori custom memerlukan langganan aktif.",
          code: "PRO_REQUIRED",
        };
      }
      await demoDelay(300);
      const ok = deleteDemoCategory(id);
      if (!ok) {
        return {
          success: false,
          error: "Tidak bisa hapus — minimal 1 kategori harus tersisa",
        };
      }
      return { success: true };
    }

    const token = await getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${API_URL}/api/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.json() as Promise<ApiResponse<void>>;
  },
};
