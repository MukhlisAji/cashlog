import { getAccessToken } from "@/lib/access-token";
import { fetchApiJson, SESSION_EXPIRED } from "@/lib/api-error";
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

async function authedJson<T>(
  path: string,
  options: RequestInit = {},
) {
  const token = await getAccessToken();
  if (!token) {
    return { success: false as const, error: SESSION_EXPIRED, code: "UNAUTHORIZED" };
  }
  return fetchApiJson<T>(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

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

    return authedJson<SubscriptionStatusData>("/api/subscription/status");
  },

  async startTrial() {
    if (isDemoMode()) {
      await demoDelay(400);
      upgradeDemoSubscription("pro");
      return { success: true, data: getMockSubscriptionStatus() };
    }

    return authedJson<SubscriptionStatusData>("/api/subscription/start-trial", {
      method: "POST",
    });
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

    const json = await authedJson<SubscriptionStatusData & CheckoutData>(
      "/api/subscription/checkout",
      {
        method: "POST",
        body: JSON.stringify({ tier }),
      },
    );

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
      error: json.error ?? "Gagal membuat pembayaran. Coba lagi.",
      code: json.code,
    };
  },

  async confirmPayment(orderId: string) {
    if (isDemoMode()) {
      return { success: true, data: getMockSubscriptionStatus() };
    }

    return authedJson<SubscriptionStatusData & { paymentPending?: boolean }>(
      "/api/subscription/confirm-payment",
      {
        method: "POST",
        body: JSON.stringify({ orderId }),
      },
    );
  },

  async cancelRenewal() {
    if (isDemoMode()) {
      return { success: true, message: "Demo — perpanjangan otomatis dibatalkan." };
    }

    return authedJson<void>("/api/subscription/cancel-renewal", {
      method: "POST",
    });
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

    return authedJson<Category[]>("/api/categories");
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

    return authedJson<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name, keywords }),
    });
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
      if (!updated) return { success: false, error: "Kategori tidak ditemukan." };
      return { success: true, data: updated };
    }

    return authedJson<Category>(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
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

    return authedJson<void>(`/api/categories/${id}`, { method: "DELETE" });
  },
};
