export type NoticeKind = "success" | "error";

export const NOTICE_MESSAGES: Record<
  string,
  { kind: NoticeKind; text: string }
> = {
  payment_success: {
    kind: "success",
    text: "Pembayaran berhasil. Langganan Pro sudah aktif.",
  },
  payment_failed: {
    kind: "error",
    text: "Pembayaran gagal atau dibatalkan. Silakan coba lagi.",
  },
  payment_pending: {
    kind: "success",
    text: "Pembayaran sedang diproses. Kami aktifkan langganan setelah konfirmasi.",
  },
  trial_started: {
    kind: "success",
    text: "Trial Pro aktif. Silakan tautkan nomor WhatsApp dan Google Sheet.",
  },
  sheet_connected: {
    kind: "success",
    text: "Google Sheet berhasil ditautkan.",
  },
  whatsapp_connected: {
    kind: "success",
    text: "Nomor WhatsApp berhasil ditautkan.",
  },
  linked: {
    kind: "success",
    text: "Nomor WhatsApp dan Google Sheet berhasil ditautkan.",
  },
  saved: {
    kind: "success",
    text: "Berhasil tersimpan.",
  },
  save_failed: {
    kind: "error",
    text: "Gagal menyimpan. Coba lagi.",
  },
  trial_failed: {
    kind: "error",
    text: "Gagal mengaktifkan trial. Coba lagi.",
  },
  trial_already_used: {
    kind: "error",
    text: "Trial sudah pernah digunakan. Silakan berlangganan.",
  },
};

export function withNotice(path: string, notice: string): string {
  const [pathname, hash = ""] = path.split("#");
  const url = new URL(pathname, "http://local.invalid");
  url.searchParams.set("notice", notice);
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
}
