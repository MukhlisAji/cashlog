/** Client-side validation — mirrors backend parseIndonesianPhone rules. */

const ID_WA_MOBILE_RE = /^628[1-9]\d{7,10}$/;

export type PhoneValidationResult =
  | { ok: true; normalized: string; local: string }
  | { ok: false; error: string };

function normalizeDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("620")) digits = `62${digits.slice(3)}`;
  else if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (!digits.startsWith("62")) digits = `62${digits}`;

  return digits;
}

export function validateIndonesianWaPhone(input: string): PhoneValidationResult {
  const raw = input.trim();
  if (!raw) {
    return { ok: false, error: "Nomor WhatsApp wajib diisi." };
  }

  if (!/^[\d+\s().-]+$/.test(raw)) {
    return { ok: false, error: "Nomor hanya boleh berisi angka." };
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Nomor hanya boleh berisi angka." };
  }

  if (digits.length > 13) {
    return { ok: false, error: "Nomor maksimal 13 digit." };
  }

  const normalized = normalizeDigits(raw);

  if (!ID_WA_MOBILE_RE.test(normalized)) {
    const withoutCountry = normalized.slice(2);
    if (withoutCountry.length < 9 || withoutCountry.length > 12) {
      return {
        ok: false,
        error: "Panjang nomor tidak valid. Gunakan 9–12 digit (contoh: 081234567890).",
      };
    }
    return {
      ok: false,
      error: "Format nomor tidak valid. Contoh: 0812xxxxxxx atau 812xxxxxxx.",
    };
  }

  return { ok: true, normalized, local: normalized.slice(2) };
}

/** Strip to digits for input field (max 13). */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 13);
}
