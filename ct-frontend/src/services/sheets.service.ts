import { getAccessToken } from "@/lib/access-token";
import { fetchApiJson, SESSION_EXPIRED } from "@/lib/api-error";
import {
  demoDelay,
  getMockSheetStatus,
  isDemoMode,
  setDemoSheetConnected,
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

export interface SheetStatus {
  connected: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
}

export const sheetsService = {
  async getOAuthUrl(returnTo?: string) {
    if (isDemoMode()) {
      await demoDelay(600);
      setDemoSheetConnected(true);
      const path = returnTo ?? "/ringkasan";
      const sep = path.includes("?") ? "&" : "?";
      return {
        success: true,
        data: { url: `${path}${sep}sheet=connected` },
      };
    }
    const params = returnTo
      ? `?returnTo=${encodeURIComponent(returnTo)}`
      : "";
    return apiFetch<{ url: string }>(`/api/sheets/oauth/url${params}`);
  },

  async getStatus() {
    if (isDemoMode()) {
      await demoDelay();
      return { success: true, data: getMockSheetStatus() };
    }
    return apiFetch<SheetStatus>("/api/sheets/status");
  },

  async provisionSheet() {
    if (isDemoMode()) {
      await demoDelay(800);
      setDemoSheetConnected(true);
      return {
        success: true,
        data: getMockSheetStatus(),
      };
    }
    return apiFetch<SheetStatus>("/api/sheets/setup", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
