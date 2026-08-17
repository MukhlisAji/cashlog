import {
  googleConnectionRepository,
} from "../config/config.repository.js";

export interface GoogleTokenPayload {
  refresh_token: string;
  access_token?: string;
  expiry_date?: number;
}

export async function saveGoogleTokens(
  userId: string,
  tokens: GoogleTokenPayload,
): Promise<void> {
  if (!tokens.refresh_token.trim()) {
    throw new Error("refresh_token is required");
  }

  await googleConnectionRepository.upsert({
    user_id: userId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    token_expires_at: tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : undefined,
  });
}
