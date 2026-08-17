import { createHmac, timingSafeEqual } from "node:crypto";

export interface OAuthStatePayload {
  userId: string;
  ts: number;
  returnTo?: string;
}

export function signOAuthState(
  userId: string,
  secret: string,
  returnTo?: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, ts: Date.now(), returnTo }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(
  state: string,
  secret: string,
  maxAgeMs = 10 * 60 * 1000,
): OAuthStatePayload | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as OAuthStatePayload;

    if (Date.now() - data.ts > maxAgeMs) return null;
    if (!data.userId) return null;
    return data;
  } catch {
    return null;
  }
}

/** Only allow same-site relative paths (no protocol / protocol-relative) */
export function sanitizeOAuthReturnTo(
  returnTo: string | undefined,
  fallbackPath: string,
): string {
  if (
    !returnTo ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//") ||
    returnTo.includes("://")
  ) {
    return fallbackPath;
  }
  return returnTo;
}
