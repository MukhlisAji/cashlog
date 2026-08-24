import { BRAND_NAME } from "../../config/brand.js";

const SETTINGS_PATH = "/settings#whatsapp";

export const FIRST_CHAT_WELCOME_MESSAGE = [
  `Halo! Selamat datang di ${BRAND_NAME}. 👋`,
  "",
  "Simpan nomor ini di kontak HP dengan nama privat (mis. Uangku / Transaksiku) supaya terasa seperti catatan pribadi.",
  "",
  "⚠️ Nomor kamu belum terhubung ke akun.",
  "",
  `Buka ${BRAND_NAME}${SETTINGS_PATH}, isi nomor WhatsApp, lalu tekan *Simpan & Aktifkan Pencatatan* (izin Google Sheet diminta di situ).`,
  "",
  'Setelah terhubung, baru kirim transaksi — contoh: "Beli kopi 20rb".',
].join("\n");

export const NOT_LINKED_TRANSACTION_REPLY = [
  "⚠️ Nomor WhatsApp ini belum terhubung ke akun Cashlog, jadi transaksi belum bisa dicatat.",
  "",
  `Buka ${BRAND_NAME}${SETTINGS_PATH} → isi nomor → *Simpan & Aktifkan Pencatatan*.`,
].join("\n");

/** User tried to chat before linking (transaction, not a LINK code). */
export function looksLikeTransactionAttempt(body: string | null): boolean {
  const text = body?.trim() ?? "";
  if (!text) return false;
  if (/^(?:LINK|TAUTKAN)\s+[A-Z0-9]{8}$/i.test(text)) return false;
  if (/\d/.test(text)) return true;
  return /beli|bayar|kopi|makan|rb|ribu|rp|juta|transfer|catat/i.test(text);
}

export function replyForUnlinkedUser(body: string | null): string {
  if (looksLikeTransactionAttempt(body)) {
    return NOT_LINKED_TRANSACTION_REPLY;
  }
  return FIRST_CHAT_WELCOME_MESSAGE;
}
