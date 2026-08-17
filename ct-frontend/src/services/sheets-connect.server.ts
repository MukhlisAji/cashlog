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

    return (await response.json()) as ConnectTokenResponse;
  } catch {
    return { success: false, error: "Network error" };
  }
}
