import type { SubscriptionTier } from "../subscription.constants.js";

const BRAND = "cashlog.id";

export function buildWelcomeEmailHtml(options: {
  name: string;
  trialDays: number;
  dashboardUrl: string;
  onboardingUrl: string;
}): string {
  const { name, trialDays, dashboardUrl, onboardingUrl } = options;

  return `
<!DOCTYPE html>
<html lang="id">
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; margin-bottom: 8px;">Selamat datang di ${BRAND} 🎉</h1>
  <p>Halo ${escapeHtml(name)},</p>
  <p>Akun Anda sudah dibuat. Mulai trial atau berlangganan dari halaman utama, lalu catat pengeluaran dari WhatsApp ke Google Sheet milik Anda.</p>
  <p style="margin: 24px 0;">
    <a href="${onboardingUrl}" style="display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Buka pengaturan</a>
  </p>
  <p style="font-size: 14px; color: #555;">Langkah singkat:</p>
  <ol style="font-size: 14px; color: #555; padding-left: 20px;">
    <li>Hubungkan Google Sheet</li>
    <li>Pairing WhatsApp ke nomor Anda</li>
    <li>Kirim pesan: <em>Beli kopi 20rb</em></li>
  </ol>
  <p style="font-size: 13px; color: #888; margin-top: 32px;">
    Dashboard: <a href="${dashboardUrl}">${dashboardUrl}</a><br/>
    Privasi 100% — kami tidak menyimpan riwayat transaksi Anda.
  </p>
</body>
</html>`.trim();
}

export function buildWelcomeEmailText(options: {
  name: string;
  trialDays: number;
  dashboardUrl: string;
  onboardingUrl: string;
}): string {
  const { name, trialDays, dashboardUrl, onboardingUrl } = options;
  return [
    `Selamat datang di ${BRAND}!`,
    "",
    `Halo ${name},`,
    "",
    `Akun Anda sudah dibuat. Mulai trial atau berlangganan dari halaman utama.`,
    "",
    `Pengaturan: ${onboardingUrl}`,
    `Dashboard: ${dashboardUrl}`,
    "",
    "Langkah: hubungkan Sheet → pairing WA → kirim \"Beli kopi 20rb\"",
  ].join("\n");
}

export function buildSubscriptionActivatedEmailHtml(options: {
  name: string;
  tierLabel: string;
  expiresAt: string;
  dashboardUrl: string;
}): string {
  const { name, tierLabel, expiresAt, dashboardUrl } = options;
  const expiryLabel = formatDateId(expiresAt);

  return `
<!DOCTYPE html>
<html lang="id">
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px;">Pembayaran berhasil ✅</h1>
  <p>Halo ${escapeHtml(name)},</p>
  <p>Langganan <strong>${escapeHtml(tierLabel)}</strong> Anda sudah aktif hingga <strong>${escapeHtml(expiryLabel)}</strong>.</p>
  <p style="margin: 24px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Buka dashboard</a>
  </p>
  <p style="font-size: 13px; color: #888;">Terima kasih sudah menggunakan ${BRAND}.</p>
</body>
</html>`.trim();
}

export function buildSubscriptionActivatedEmailText(options: {
  name: string;
  tierLabel: string;
  expiresAt: string;
  dashboardUrl: string;
}): string {
  const expiryLabel = formatDateId(options.expiresAt);
  return [
    `Pembayaran berhasil — ${BRAND}`,
    "",
    `Halo ${options.name},`,
    "",
    `Langganan ${options.tierLabel} aktif hingga ${expiryLabel}.`,
    `Dashboard: ${options.dashboardUrl}`,
  ].join("\n");
}

export function getTierLabel(tier: SubscriptionTier): string {
  return tier === "pro" ? "Cashlog" : "Cashlog";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateId(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
