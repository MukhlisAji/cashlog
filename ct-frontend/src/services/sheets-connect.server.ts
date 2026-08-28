import { toUserFacingError } from "@/lib/api-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ConnectTokenResponse {
  success: boolean;
  error?: string;
}

/** Persist Supabase Google provider refresh token for deferred sheet setup. */
export async function connectGoogleTokenFromSession(
  accessToken: string,
  providerRefreshToken: string,
  providerAccessToken?: string | null,
): Promise<ConnectTokenResponse> {
  try {
    const response = await fetch(`${API_URL}/api/sheets/connect-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        refresh_token: providerRefreshToken,
        access_token: providerAccessToken ?? undefined,
      }),
      cache: "no-store",
    });

    const body = (await response.json()) as ConnectTokenResponse & {
      message?: string;
      code?: string;
    };
    if (!response.ok || body.success === false) {
      return {
        success: false,
        error: toUserFacingError(
          body,
          response.status,
          "Gagal menautkan Google. Coba lagi.",
        ),
      };
    }
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Tidak terhubung ke server. Periksa internet lalu coba lagi.",
    };
  }
}
