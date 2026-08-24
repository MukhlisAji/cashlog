export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/ringkasan",
  analytics: "/ringkasan",
  settings: "/settings",
  trial: "/trial",
  subscriptionExpired: "/subscription-expired",
  paymentReturn: "/payment/return",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const NAV_LINKS = {
  marketing: [
    { label: "Fitur", href: "/#fitur" },
    { label: "Cara Kerja", href: "/#cara-kerja" },
    { label: "Harga", href: "/#harga" },
  ],
  dashboard: [
    { label: "Ringkasan", href: "/ringkasan" },
  ],
} as const;
