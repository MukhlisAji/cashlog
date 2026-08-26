import { getAccessToken } from "@/lib/access-token";
import {
  demoDelay,
  getMockWhatsAppStatus,
  isDemoMode,
  registerDemoWaPhone,
} from "@/lib/demo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

async function apiFetch<T>(
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

  const body = (await response.json()) as ApiResponse<T> & {
    message?: string;
  };

  if (!response.ok && body.success !== true) {
    return {
      success: false,
      error: body.error ?? body.message ?? "Request failed",
      code: body.code,
      data: body.data,
    };
  }

  return body;
}

export type WhatsAppStatus = "idle" | "connected" | "error";

export interface WhatsAppSessionStatus {
  userId?: string;
  memberId?: string;
  phone: string;
  status: WhatsAppStatus;
}

export const whatsappService = {
  async registerPhone(phone: string) {
    if (isDemoMode()) {
      await demoDelay(400);
      registerDemoWaPhone(phone);
      return {
        success: true,
        data: {
          phone,
          status: "connected" as WhatsAppStatus,
          requiresGoogleAuth: false,
        },
      };
    }
    return apiFetch<{
      phone: string;
      status: WhatsAppStatus;
      requiresGoogleAuth: boolean;
      oauthUrl?: string;
      consentPath?: string;
      spreadsheetUrl?: string;
    }>(
      "/api/whatsapp/phone",
      {
        method: "POST",
        body: JSON.stringify({ phone }),
      },
    );
  },

  async createLinkCode() {
    if (isDemoMode()) {
      await demoDelay(300);
      return {
        success: true,
        error: undefined,
        data: {
          code: "DEMO1234",
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          requiresGoogleAuth: false,
          oauthUrl: undefined,
        },
      };
    }
    return apiFetch<{
      code?: string;
      expiresAt?: string;
      requiresGoogleAuth: boolean;
      oauthUrl?: string;
    }>(
      "/api/whatsapp/link-code",
      { method: "POST", body: JSON.stringify({}) },
    );
  },

  async getStatus() {
    if (isDemoMode()) {
      await demoDelay(200);
      return { success: true, data: getMockWhatsAppStatus() };
    }
    return apiFetch<WhatsAppSessionStatus>("/api/whatsapp/status");
  },
};
