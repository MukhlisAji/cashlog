export const SESSION_EXPIRED =
  "Sesi berakhir. Masuk lagi untuk melanjutkan.";

export type ApiErrorPayload = {
  success?: boolean;
  error?: string;
  message?: string;
  code?: string;
  data?: unknown;
};

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Sesi berakhir. Masuk lagi untuk melanjutkan.",
  SUBSCRIPTION_EXPIRED: "Langganan telah berakhir. Perpanjang untuk melanjutkan.",
  PRO_REQUIRED: "Fitur ini hanya untuk Pro. Upgrade di Pengaturan.",
  GOOGLE_SCOPE_MISSING:
    "Izin Google Drive belum lengkap. Hubungkan ulang Google Sheet.",
};

const EXACT_TECHNICAL = new Set(
  [
    "bad request",
    "forbidden",
    "unauthorized",
    "not found",
    "not authenticated",
    "invalid token",
    "invalid input",
    "invalid signature",
    "request failed",
    "network error",
    "internal server error",
    "checkout gagal",
  ].map((s) => s.toLowerCase()),
);

function byStatus(status: number, fallback: string): string {
  if (status === 401) return CODE_MESSAGES.UNAUTHORIZED;
  if (status === 403) return "Akses ditolak. Periksa langganan atau masuk lagi.";
  if (status === 404) return "Data tidak ditemukan.";
  if (status === 409) return "Data sudah digunakan. Periksa isian lalu coba lagi.";
  if (status === 429) return "Terlalu banyak permintaan. Coba lagi sebentar.";
  if (status === 502 || status === 503) {
    return "Layanan sedang tidak tersedia. Coba lagi sebentar.";
  }
  if (status >= 500) return "Terjadi gangguan di server. Coba lagi sebentar.";
  if (status === 400) return "Data tidak valid. Periksa isian lalu coba lagi.";
  return fallback;
}

function looksTechnical(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return true;
  if (EXACT_TECHNICAL.has(lower)) return true;
  if (lower.startsWith("fst_err")) return true;
  if (lower.includes("content-type")) return true;
  if (lower.includes("body cannot be empty")) return true;
  if (lower.includes("must have required")) return true;
  if (lower.includes("must be ")) return true;
  if (lower.includes("json body")) return true;
  if (lower.includes("schema")) return true;
  if (/^[a-z]+error:/i.test(text.trim())) return true;
  return false;
}

export function toUserFacingError(
  payload: ApiErrorPayload | null | undefined,
  status = 0,
  fallback = "Terjadi kesalahan. Coba lagi.",
): string {
  const code = payload?.code ?? "";
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (code.startsWith("FST_ERR")) return byStatus(status || 400, fallback);

  const raw = (payload?.error ?? payload?.message ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Email atau password salah.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Email sudah terdaftar. Silakan masuk.";
  }
  if (lower.includes("email not confirmed")) {
    return "Email belum dikonfirmasi. Cek kotak masuk kamu.";
  }
  if (raw && !looksTechnical(raw)) return raw;

  return byStatus(status, fallback);
}

export function toUserFacingErrorFromUnknown(
  err: unknown,
  fallback = "Terjadi kesalahan. Coba lagi.",
): string {
  const message = err instanceof Error ? err.message : "";
  return toUserFacingError({ error: message }, 0, fallback);
}

export async function readApiResponse<T>(
  response: Response,
  fallback = "Terjadi kesalahan. Coba lagi.",
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}> {
  let payload: ApiErrorPayload & { data?: T; message?: string } = {};
  try {
    payload = (await response.json()) as ApiErrorPayload & {
      data?: T;
      message?: string;
    };
  } catch {
    payload = {};
  }

  if (response.ok && payload.success !== false) {
    return {
      success: true,
      data: payload.data,
      code: payload.code,
      message: payload.message,
    };
  }

  return {
    success: false,
    data: payload.data as T | undefined,
    code: payload.code,
    error: toUserFacingError(payload, response.status, fallback),
  };
}

export async function fetchApiJson<T>(
  url: string,
  init?: RequestInit,
  fallback = "Terjadi kesalahan. Coba lagi.",
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}> {
  try {
    const response = await fetch(url, init);
    return readApiResponse<T>(response, fallback);
  } catch {
    return {
      success: false,
      error: "Tidak terhubung ke server. Periksa internet lalu coba lagi.",
    };
  }
}
