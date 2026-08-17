export const siteConfig = {
  name: "cashlog.id",
  domain: "cashlog.id",
  description:
    "Platform otomatisasi pencatatan keuangan pribadi via WhatsApp. Privasi 100%, data di tangan Anda.",
  links: {
    whatsapp: "https://wa.me/",
    github: "https://github.com",
  },
  /**
   * Centralized BOT WhatsApp Admin — 1 nomor untuk SEMUA user.
   * Format: E.164 tanpa leading "+" (contoh: 6281234567890).
   *   PROD/UAT  : set via NEXT_PUBLIC_WHATSAPP_ADMIN_PHONE di .env.local / hosting
   *   LOCAL DEV : fallback ke 6281234567890 (ganti ke test number sendiri)
   */
  whatsappAdminPhone: (process.env.NEXT_PUBLIC_WHATSAPP_ADMIN_PHONE ?? "6281234567890").replace(/\D/g, ""),
  /** Fallback wa.me text when opening chat without a custom prefilled message. */
  whatsappAdminFirstMessage: "Beli kopi 20rb",
} as const;

/** Build wa.me click-to-chat link ke admin bot dengan pre-filled pesan. */
export function getWhatsAppAdminUrl(messageOverride?: string): string {
  const phone = siteConfig.whatsappAdminPhone;
  const message =
    messageOverride?.trim() ?? siteConfig.whatsappAdminFirstMessage;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

/** Public app URL — set NEXT_PUBLIC_APP_URL per environment (local/UAT/prod) */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function getSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? `support@${siteConfig.domain}`;
}

export function getHelloEmail(): string {
  return `hello@${siteConfig.domain}`;
}
