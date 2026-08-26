export const GOOGLE_SCOPE_MISSING = "GOOGLE_SCOPE_MISSING";

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const GOOGLE_SCOPE_MISSING_MESSAGE =
  "Izin Google Drive belum aktif. Lanjutkan untuk mengizinkan Cashlog membuat Sheet.";

export class GoogleScopeMissingError extends Error {
  readonly code = GOOGLE_SCOPE_MISSING;

  constructor() {
    super(GOOGLE_SCOPE_MISSING_MESSAGE);
    this.name = "GoogleScopeMissingError";
  }
}

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const e = error as {
    message?: string;
    status?: number;
    code?: number | string;
    response?: { status?: number; data?: { error?: { message?: string } } };
  };
  return [
    e.message,
    e.response?.data?.error?.message,
    typeof e.code === "string" ? e.code : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function googleHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as {
    status?: number;
    code?: number | string;
    response?: { status?: number };
  };
  if (typeof e.status === "number") return e.status;
  if (typeof e.response?.status === "number") return e.response.status;
  if (typeof e.code === "number") return e.code;
  return undefined;
}

export function isGoogleInsufficientScopeError(error: unknown): boolean {
  if (error instanceof GoogleScopeMissingError) return true;
  const status = googleHttpStatus(error);
  const text = errorText(error);
  return (
    status === 403 &&
    text.includes("insufficient") &&
    text.includes("scope")
  );
}

export function scopeListIncludesDriveFile(scope: string | undefined): boolean {
  if (!scope) return false;
  return scope
    .split(/[\s,]+/)
    .filter(Boolean)
    .includes(DRIVE_FILE_SCOPE);
}

export async function accessTokenHasDriveFileScope(
  accessToken: string,
): Promise<boolean> {
  const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  if (!response.ok) return false;
  const body = (await response.json()) as { scope?: string };
  return scopeListIncludesDriveFile(body.scope);
}
