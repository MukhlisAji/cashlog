/**
 * Meta WhatsApp template for household members (no Sheet URL button).
 *
 * Create in Meta Business Manager:
 * - Name: household_welcome_msg_v1
 * - Language: Indonesian (id)
 * - Category: Utility
 * - Body: paste MEMBER_ONBOARDING_TEMPLATE_BODY
 * - {{1}} and {{2}} = first name of the lead (same value; Meta forbids reusing {{1}})
 * - Buttons: none
 */
export const MEMBER_ONBOARDING_TEMPLATE_NAME = "household_welcome_msg_v1";

export const MEMBER_ONBOARDING_TEMPLATE_BODY = [
  "Halo, Anda telah berhasil terhubung dengan catatan keluarga milik {{1}} di Cashlog.id.",
  "",
  "Silakan balas pesan ini untuk mencatat transaksi (Contoh: Makan siang 50rb).",
  "",
  "Data transaksi Anda akan otomatis tercatat di Google sheet milik {{2}}.",
  "Ketik menu untuk melihat daftar perintah.",
].join("\n");
