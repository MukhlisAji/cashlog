/** Indonesian WhatsApp mobile — 628 + 8–11 digits (e.g. 628123456789) */
const ID_WA_MOBILE_RE = /^628[1-9]\d{7,10}$/;

export interface ParsedIndonesianPhone {
  /** Baileys format: 628123456789 (no +) */
  phone: string;
  /** Local display without leading 0: 8123456789 */
  local: string;
}

export type PhoneParseResult =
  | { ok: true; data: ParsedIndonesianPhone }
  | { ok: false; error: string };

/**
 * Normalize user input to Baileys/WhatsApp format (628…).
 * Accepts: 0812…, 812…, 62812…, +62 812…
 */
export function normalizePhone(input: string): string {
  const parsed = parseIndonesianPhone(input);
  if (parsed.ok) return parsed.data.phone;

  // Fallback for internal/storage use — still strip to digits + 62 prefix
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("620")) {
    digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62")) {
    digits = `62${digits}`;
  }

  return digits;
}

/** Parse + validate Indonesian mobile for WA pairing. */
export function parseIndonesianPhone(input: string): PhoneParseResult {
  const raw = input.trim();
  if (!raw) {
    return { ok: false, error: "Nomor WhatsApp wajib diisi." };
  }

  if (!/^[\d+\s().-]+$/.test(raw)) {
    return { ok: false, error: "Nomor hanya boleh berisi angka." };
  }

  let digits = raw.replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Nomor hanya boleh berisi angka." };
  }

  if (digits.length > 13) {
    return { ok: false, error: "Nomor maksimal 13 digit." };
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // 6208… → user typed 0 after country code
  if (digits.startsWith("620")) {
    digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62")) {
    digits = `62${digits}`;
  }

  if (!ID_WA_MOBILE_RE.test(digits)) {
    const localLen = digits.startsWith("62") ? digits.length - 2 : digits.length;
    if (localLen < 9 || localLen > 12) {
      return {
        ok: false,
        error: "Panjang nomor tidak valid. Gunakan 9–12 digit (contoh: 081234567890).",
      };
    }
    return {
      ok: false,
      error:
        "Format nomor Indonesia tidak valid. Gunakan nomor HP aktif (contoh: 0812xxxxxxx).",
    };
  }

  return {
    ok: true,
    data: {
      phone: digits,
      local: digits.slice(2),
    },
  };
}

/** Format pairing code for display: ABCD-EFGH */
export function formatPairingCode(code: string): string {
  const clean = code.replace(/\W/g, "").toUpperCase();
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return code.toUpperCase();
}

export function stripPairingCode(code: string): string {
  return code.replace(/\W/g, "").toUpperCase();
}
