export const GOOGLE_SCOPE_MISSING = "GOOGLE_SCOPE_MISSING";

export const CONNECT_SHEETS_PATH = "/auth/connect-sheets";

export function connectSheetsUrl(redirect = "/settings"): string {
  return `${CONNECT_SHEETS_PATH}?redirect=${encodeURIComponent(redirect)}`;
}

export function isGoogleScopeMissing(payload: {
  code?: string;
  error?: string;
  message?: string;
}): boolean {
  if (payload.code === GOOGLE_SCOPE_MISSING) return true;
  const text = `${payload.error ?? ""} ${payload.message ?? ""}`.toLowerCase();
  return text.includes("insufficient") && text.includes("scope");
}
