import { google } from "googleapis";

import type { Env } from "../../config/env.js";
import {
  googleConnectionRepository,
} from "../config/config.repository.js";
import { accessTokenHasDriveFileScope } from "./google-scope.js";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

export function createOAuth2Client(env: Env) {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function getGoogleAuthUrl(env: Env, state: string): string {
  const client = createOAuth2Client(env);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    include_granted_scopes: true,
    state,
  });
}

export async function exchangeGoogleCode(env: Env, code: string) {
  const client = createOAuth2Client(env);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getGoogleAuthClient(env: Env, userId: string) {
  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.refresh_token) {
    throw new Error("Google account not connected");
  }

  const client = createOAuth2Client(env);
  client.setCredentials({
    refresh_token: connection.refresh_token,
    access_token: connection.access_token ?? undefined,
    expiry_date: connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : undefined,
  });

  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await googleConnectionRepository.updateTokens(
        userId,
        tokens.access_token,
        new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      );
    }
  });

  return client;
}

export async function getSheetsClient(env: Env, userId: string) {
  const auth = await getGoogleAuthClient(env, userId);
  return google.sheets({ version: "v4", auth });
}

export async function getDriveClient(env: Env, userId: string) {
  const auth = await getGoogleAuthClient(env, userId);
  return google.drive({ version: "v3", auth });
}

export async function hasDriveFileScope(env: Env, userId: string): Promise<boolean> {
  try {
    const auth = await getGoogleAuthClient(env, userId);
    const token = await auth.getAccessToken();
    const accessToken = token.token;
    if (!accessToken) return false;
    return accessTokenHasDriveFileScope(accessToken);
  } catch {
    return false;
  }
}
