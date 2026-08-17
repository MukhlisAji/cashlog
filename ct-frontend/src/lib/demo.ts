import type { DashboardData } from "@/services/dashboard.service";
import type { AnalyticsData } from "@/services/analytics.service";
import type { SheetStatus } from "@/services/sheets.service";
import type {
  SubscriptionStatusData,
} from "@/services/subscription.service";
import type {
  WhatsAppSessionStatus,
  WhatsAppStatus,
} from "@/services/whatsapp.service";
import type { Category } from "@/services/subscription.service";
import type { User } from "@/types";
import type {
  HouseholdMember,
  HouseholdSummary,
} from "@/types/household";
import {
  HOUSEHOLD_MEMBER_PRICE,
  MAX_HOUSEHOLD_MEMBER_SLOTS,
} from "@/lib/pricing";

import { isSupabaseConfigured } from "./supabase/config";

/** Demo aktif jika env DEMO_MODE=true ATAU Supabase belum dikonfigurasi */
export function isDemoMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isSupabaseConfigured()
  );
}

export const DEMO_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Demo User",
  email: "demo@cashlog.id",
  whatsappConnected: false,
};

export const DEMO_SESSION_COOKIE = "cashlog_demo_session";

const SHEET_KEY = "demo_sheet_connected";
const WA_STATUS_KEY = "demo_wa_status";
const WA_PHONE_KEY = "demo_wa_phone";
const WA_STARTED_KEY = "demo_wa_started_at";
const LOGIN_KEY = "demo_logged_in";
const BUDGETS_KEY = "demo_budgets";
const CATEGORIES_KEY = "demo_categories";
const DEMO_PRO_KEY = "demo_pro_manual";
const DEMO_TIER_KEY = "demo_tier";
const DEMO_HOUSEHOLD_SLOTS_KEY = "demo_household_slots";
const DEMO_HOUSEHOLD_MEMBERS_KEY = "demo_household_members";

function ss(): Storage | null {
  if (typeof window === "undefined") return null;
  return sessionStorage;
}

export function isDemoLoggedIn(): boolean {
  return ss()?.getItem(LOGIN_KEY) === "1";
}

export function setDemoLoggedIn(value: boolean) {
  if (value) ss()?.setItem(LOGIN_KEY, "1");
  else ss()?.removeItem(LOGIN_KEY);

  if (typeof document === "undefined") return;

  if (value) {
    document.cookie = `${DEMO_SESSION_COOKIE}=1; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0`;
  }
}

/** Fresh demo login — same starting point as a new user (no sheet/WA pre-connected) */
export function startDemoSession() {
  resetDemoOnboardingState();
  setDemoLoggedIn(true);
}

/** @deprecated Use startDemoSession() — kept for backwards compatibility */
export function initDemoProExperience() {
  startDemoSession();
}

function resetDemoOnboardingState() {
  ss()?.removeItem(SHEET_KEY);
  ss()?.setItem(WA_STATUS_KEY, "idle");
  ss()?.removeItem(WA_PHONE_KEY);
  ss()?.removeItem(WA_STARTED_KEY);
  ss()?.removeItem(DEMO_PRO_KEY);
  ss()?.removeItem(DEMO_TIER_KEY);
  ss()?.removeItem(DEMO_HOUSEHOLD_SLOTS_KEY);
  ss()?.removeItem(DEMO_HOUSEHOLD_MEMBERS_KEY);
  ls()?.removeItem(DEMO_HOUSEHOLD_SLOTS_KEY);
  ls()?.removeItem(DEMO_HOUSEHOLD_MEMBERS_KEY);
}

export function getDemoUser(): User {
  return {
    ...DEMO_USER,
    whatsappConnected: getDemoWaStatus() === "connected",
  };
}

export function getDemoSheetConnected(): boolean {
  return ss()?.getItem(SHEET_KEY) === "1";
}

/** Sheet + WA connected — sama seperti hasTransactions di dashboard demo */
export function demoHasTransactionData(): boolean {
  return getDemoSheetConnected() && getDemoWaStatus() === "connected";
}

export function setDemoSheetConnected(value: boolean) {
  ss()?.setItem(SHEET_KEY, value ? "1" : "0");
}

export function getDemoWaStatus(): WhatsAppStatus {
  const stored = ss()?.getItem(WA_STATUS_KEY) as WhatsAppStatus | null;
  return stored === "connected" ? "connected" : "idle";
}

export function getDemoWaPhone(): string {
  return ss()?.getItem(WA_PHONE_KEY) ?? "";
}

export function registerDemoWaPhone(phone: string) {
  const normalized = phone.startsWith("62") ? phone : `62${phone.replace(/^0/, "")}`;
  ss()?.setItem(WA_PHONE_KEY, normalized);
  ss()?.setItem(WA_STATUS_KEY, "connected");
}

export function resetDemoState() {
  ss()?.removeItem(SHEET_KEY);
  ss()?.removeItem(WA_STATUS_KEY);
  ss()?.removeItem(WA_PHONE_KEY);
  ss()?.removeItem(WA_STARTED_KEY);
  ss()?.removeItem(LOGIN_KEY);
  ss()?.removeItem(BUDGETS_KEY);
  ss()?.removeItem(CATEGORIES_KEY);
  ss()?.removeItem(DEMO_PRO_KEY);
  ss()?.removeItem(DEMO_TIER_KEY);
  ss()?.removeItem(DEMO_HOUSEHOLD_SLOTS_KEY);
  ss()?.removeItem(DEMO_HOUSEHOLD_MEMBERS_KEY);
  ls()?.removeItem(DEMO_HOUSEHOLD_SLOTS_KEY);
  ls()?.removeItem(DEMO_HOUSEHOLD_MEMBERS_KEY);

  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0`;
  }
}

const DEMO_CATEGORY_PALETTE = [
  "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#f43f5e",
  "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

const DEMO_CATEGORIES_DEFAULT: Category[] = [
  { id: 1, user_id: DEMO_USER.id, name: "Makanan", keywords: "kopi,makan,warung", color: "#22c55e", sort_order: 1 },
  { id: 2, user_id: DEMO_USER.id, name: "Transport", keywords: "grab,gojek,bensin", color: "#3b82f6", sort_order: 2 },
  { id: 3, user_id: DEMO_USER.id, name: "Utilitas", keywords: "listrik,pln,internet", color: "#f59e0b", sort_order: 3 },
  { id: 4, user_id: DEMO_USER.id, name: "Belanja", keywords: "alfamart,supermarket", color: "#8b5cf6", sort_order: 4 },
  { id: 5, user_id: DEMO_USER.id, name: "Kesehatan", keywords: "obat,dokter", color: "#f43f5e", sort_order: 5 },
  { id: 6, user_id: DEMO_USER.id, name: "Pendidikan", keywords: "spp,buku", color: "#6366f1", sort_order: 6 },
  { id: 7, user_id: DEMO_USER.id, name: "Hiburan", keywords: "bioskop,game", color: "#ec4899", sort_order: 7 },
  { id: 99, user_id: DEMO_USER.id, name: "Lainnya", keywords: "", color: "#6b7280", sort_order: 99 },
];

/** @deprecated use getDemoCategories() */
export const MOCK_CATEGORIES = DEMO_CATEGORIES_DEFAULT;

export function getDemoCategories(): Category[] {
  const raw = ss()?.getItem(CATEGORIES_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Category[];
    } catch {
      /* fall through */
    }
  }
  return DEMO_CATEGORIES_DEFAULT;
}

function persistDemoCategories(categories: Category[]) {
  ss()?.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function createDemoCategory(
  name: string,
  keywords?: string,
): Category {
  const cats = getDemoCategories();
  const newCat: Category = {
    id: Date.now(),
    user_id: DEMO_USER.id,
    name: name.trim(),
    keywords: keywords ?? "",
    color: DEMO_CATEGORY_PALETTE[cats.length % DEMO_CATEGORY_PALETTE.length]!,
    sort_order: cats.length + 1,
  };
  persistDemoCategories([...cats, newCat]);
  return newCat;
}

export function deleteDemoCategory(id: number): boolean {
  const cats = getDemoCategories();
  if (cats.length <= 1) return false;

  const removed = cats.find((c) => c.id === id);
  if (!removed) return false;

  persistDemoCategories(cats.filter((c) => c.id !== id));

  const { month, budgets } = getDemoBudgets();
  saveDemoBudgets(
    budgets.filter((b) => b.category !== removed.name),
    month,
  );

  return true;
}

export function updateDemoCategory(
  id: number,
  data: { keywords?: string; name?: string },
): Category | null {
  const cats = getDemoCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated = {
    ...cats[idx]!,
    ...(data.keywords !== undefined ? { keywords: data.keywords } : {}),
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
  };
  const next = [...cats];
  next[idx] = updated;
  persistDemoCategories(next);
  return updated;
}

const DEMO_BUDGETS_DEFAULT = [
  { category: "Makanan", amount: 2_500_000 },
  { category: "Transport", amount: 800_000 },
  { category: "Utilitas", amount: 1_200_000 },
  { category: "Belanja", amount: 600_000 },
  { category: "Kesehatan", amount: 400_000 },
  { category: "Pendidikan", amount: 1_500_000 },
  { category: "Hiburan", amount: 300_000 },
];

function currentDemoMonth() {
  return "2026-08";
}

export function getDemoBudgets(month?: string): {
  month: string;
  budgets: { category: string; amount: number }[];
} {
  const activeMonth = month ?? currentDemoMonth();
  const activeNames = new Set(getDemoCategories().map((c) => c.name));

  const raw = ss()?.getItem(BUDGETS_KEY);
  if (raw) {
    try {
      const stored = JSON.parse(raw) as {
        month: string;
        budgets: { category: string; amount: number }[];
      };
      return {
        month: activeMonth,
        budgets: stored.budgets.filter((b) => activeNames.has(b.category)),
      };
    } catch {
      /* fall through */
    }
  }
  return {
    month: activeMonth,
    budgets: DEMO_BUDGETS_DEFAULT.filter((b) => activeNames.has(b.category)),
  };
}

export function saveDemoBudgets(
  budgets: { category: string; amount: number }[],
  month?: string,
): { month: string; budgets: { category: string; amount: number }[] } {
  const activeMonth = month ?? currentDemoMonth();
  const filtered = budgets.filter((b) => b.amount > 0);
  ss()?.setItem(BUDGETS_KEY, JSON.stringify({ month: activeMonth, budgets: filtered }));
  return { month: activeMonth, budgets: filtered };
}

/** Realistic household transactions — 6 bulan data keluarga Jakarta */
const DEMO_ALL_TRANSACTIONS: {
  date: string;
  month: string;
  item: string;
  amount: number;
  category: string;
}[] = [
  // Agustus 2026
  { date: "2026-08-01", month: "2026-08", item: "Belanja bulanan Indomaret", amount: 485_000, category: "Belanja" },
  { date: "2026-08-01", month: "2026-08", item: "SPP anak SD", amount: 850_000, category: "Pendidikan" },
  { date: "2026-08-02", month: "2026-08", item: "Makan siang keluarga", amount: 185_000, category: "Makanan" },
  { date: "2026-08-02", month: "2026-08", item: "Grab weekend mall", amount: 45_000, category: "Transport" },
  { date: "2026-08-03", month: "2026-08", item: "Alfamart kebutuhan dapur", amount: 127_500, category: "Belanja" },
  { date: "2026-08-03", month: "2026-08", item: "Kopi & sarapan", amount: 68_000, category: "Makanan" },
  { date: "2026-08-04", month: "2026-08", item: "Grab ke kantor", amount: 35_000, category: "Transport" },
  { date: "2026-08-04", month: "2026-08", item: "PLN Agustus", amount: 485_000, category: "Utilitas" },
  { date: "2026-08-04", month: "2026-08", item: "Makan malam warteg", amount: 95_000, category: "Makanan" },
  { date: "2026-08-05", month: "2026-08", item: "Kopi susu", amount: 28_000, category: "Makanan" },
  { date: "2026-08-05", month: "2026-08", item: "Gojek anter anak sekolah", amount: 22_000, category: "Transport" },
  { date: "2026-08-05", month: "2026-08", item: "Paket data internet", amount: 150_000, category: "Utilitas" },
  // Juli 2026
  { date: "2026-07-02", month: "2026-07", item: "Belanja bulanan", amount: 520_000, category: "Belanja" },
  { date: "2026-07-03", month: "2026-07", item: "Bensin Pertamax", amount: 350_000, category: "Transport" },
  { date: "2026-07-05", month: "2026-07", item: "PLN Juli", amount: 420_000, category: "Utilitas" },
  { date: "2026-07-07", month: "2026-07", item: "Makan keluarga restoran", amount: 385_000, category: "Makanan" },
  { date: "2026-07-10", month: "2026-07", item: "Biaya puskesmas anak", amount: 125_000, category: "Kesehatan" },
  { date: "2026-07-12", month: "2026-07", item: "Buku & alat tulis", amount: 275_000, category: "Pendidikan" },
  { date: "2026-07-15", month: "2026-07", item: "Bensin", amount: 150_000, category: "Transport" },
  { date: "2026-07-18", month: "2026-07", item: "Nonton bioskop keluarga", amount: 210_000, category: "Hiburan" },
  { date: "2026-07-20", month: "2026-07", item: "Makan malam", amount: 85_000, category: "Makanan" },
  { date: "2026-07-22", month: "2026-07", item: "Grab daily commute", amount: 280_000, category: "Transport" },
  { date: "2026-07-25", month: "2026-07", item: "Groceries weekend", amount: 340_000, category: "Belanja" },
  { date: "2026-07-28", month: "2026-07", item: "Makan harian", amount: 890_000, category: "Makanan" },
  { date: "2026-07-30", month: "2026-07", item: "PDAM & internet", amount: 195_000, category: "Utilitas" },
  // Juni 2026
  { date: "2026-06-01", month: "2026-06", item: "SPP & uang jajan", amount: 920_000, category: "Pendidikan" },
  { date: "2026-06-03", month: "2026-06", item: "Belanja bulanan", amount: 495_000, category: "Belanja" },
  { date: "2026-06-05", month: "2026-06", item: "PLN Juni", amount: 395_000, category: "Utilitas" },
  { date: "2026-06-08", month: "2026-06", item: "Makan & katering", amount: 1_120_000, category: "Makanan" },
  { date: "2026-06-12", month: "2026-06", item: "Transport bulanan", amount: 620_000, category: "Transport" },
  { date: "2026-06-15", month: "2026-06", item: "Checkup keluarga", amount: 350_000, category: "Kesehatan" },
  { date: "2026-06-20", month: "2026-06", item: "Liburan akhir pekan", amount: 450_000, category: "Hiburan" },
  // Mei 2026
  { date: "2026-05-02", month: "2026-05", item: "Belanja & kebutuhan rumah", amount: 580_000, category: "Belanja" },
  { date: "2026-05-04", month: "2026-05", item: "PLN Mei", amount: 410_000, category: "Utilitas" },
  { date: "2026-05-10", month: "2026-05", item: "Makan keluarga", amount: 980_000, category: "Makanan" },
  { date: "2026-05-15", month: "2026-05", item: "Bensin & toll", amount: 540_000, category: "Transport" },
  { date: "2026-05-20", month: "2026-05", item: "Les privat anak", amount: 600_000, category: "Pendidikan" },
  { date: "2026-05-25", month: "2026-05", item: "Obat & vitamin", amount: 185_000, category: "Kesehatan" },
  // April 2026
  { date: "2026-04-01", month: "2026-04", item: "Belanja puasa", amount: 720_000, category: "Belanja" },
  { date: "2026-04-05", month: "2026-04", item: "PLN April", amount: 380_000, category: "Utilitas" },
  { date: "2026-04-10", month: "2026-04", item: "Makan buka & sahur", amount: 1_450_000, category: "Makanan" },
  { date: "2026-04-15", month: "2026-04", item: "Transport", amount: 480_000, category: "Transport" },
  { date: "2026-04-20", month: "2026-04", item: "THR kebutuhan anak", amount: 800_000, category: "Pendidikan" },
  // Maret 2026
  { date: "2026-03-03", month: "2026-03", item: "Belanja bulanan", amount: 510_000, category: "Belanja" },
  { date: "2026-03-05", month: "2026-03", item: "PLN Maret", amount: 365_000, category: "Utilitas" },
  { date: "2026-03-12", month: "2026-03", item: "Makan harian", amount: 870_000, category: "Makanan" },
  { date: "2026-03-18", month: "2026-03", item: "Servis motor", amount: 275_000, category: "Transport" },
  { date: "2026-03-25", month: "2026-03", item: "Waterpark keluarga", amount: 380_000, category: "Hiburan" },
];

function buildAnalyticsForMonth(month: string) {
  const monthRows = DEMO_ALL_TRANSACTIONS.filter((t) => t.month === month);

  const categoryMap = new Map<string, number>();
  for (const t of monthRows) {
    categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + t.amount);
  }
  const categoryTotals = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const t of monthRows) {
    const existing = dailyMap.get(t.date) ?? { amount: 0, count: 0 };
    dailyMap.set(t.date, {
      amount: existing.amount + t.amount,
      count: existing.count + 1,
    });
  }
  const dailyTotals = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalExpense = monthRows.reduce((s, t) => s + t.amount, 0);
  const transactionCount = monthRows.length;

  return {
    activeMonth: month,
    availableMonths: ["2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03"],
    transactions: monthRows.map((t, i) => ({
      ...t,
      time: `${String(8 + (i % 10)).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}:00`,
    })),
    categoryTotals,
    dailyTotals,
    budgets: getDemoBudgets(month).budgets,
    summary: {
      totalExpense,
      transactionCount,
      averagePerTransaction:
        transactionCount > 0 ? Math.round(totalExpense / transactionCount) : 0,
      topCategory: categoryTotals[0]?.category ?? "-",
    },
  };
}

export function getMockDashboardData(): DashboardData {
  const sheetConnected = getDemoSheetConnected();
  const waStatus = getDemoWaStatus();
  const waConnected = waStatus === "connected";
  const hasTransactions = sheetConnected && waConnected;

  const base = {
    sheet: {
      connected: sheetConnected,
      spreadsheetId: sheetConnected ? "demo-spreadsheet-id" : null,
      spreadsheetUrl: sheetConnected
        ? "https://docs.google.com/spreadsheets/d/demo"
        : null,
    },
    whatsapp: {
      connected: waConnected,
      phone: waConnected ? getDemoWaPhone() : null,
      status: waStatus,
    },
    budgets: getDemoBudgets().budgets.slice(0, 2),
    hasTransactions,
  };

  if (!hasTransactions) {
    return {
      ...base,
      summary: null,
      categoryTotals: [],
      recentTransactions: [],
    };
  }

  const august = buildAnalyticsForMonth("2026-08");
  const recentTransactions = august.transactions
    .slice()
    .reverse()
    .slice(0, 8)
    .map(({ date, item, amount, category }, i) => ({
      date,
      time: `${String(7 + (i % 12)).padStart(2, "0")}:${String((i * 11) % 60).padStart(2, "0")}:00`,
      item,
      amount,
      category,
      source: "whatsapp",
    }));

  const yearTotal = DEMO_ALL_TRANSACTIONS.reduce((s, t) => s + t.amount, 0);

  return {
    ...base,
    budgets: getDemoBudgets().budgets,
    categoryTotals: august.categoryTotals,
    summary: {
      activeMonth: "2026-08",
      totalExpense: august.summary.totalExpense,
      transactionCount: august.summary.transactionCount,
      averagePerTransaction: august.summary.averagePerTransaction,
      yearTotal,
      topCategory: august.summary.topCategory,
    },
    recentTransactions,
  };
}

export function getMockAnalyticsData(month?: string): AnalyticsData {
  return buildAnalyticsForMonth(month ?? "2026-08");
}

/** Demo live data — null sampai onboarding sheet + WA selesai */
export function getDemoAnalyticsData(month?: string): AnalyticsData | null {
  if (!demoHasTransactionData()) return null;
  return buildAnalyticsForMonth(month ?? "2026-08");
}

export function getDemoAllTransactions() {
  return DEMO_ALL_TRANSACTIONS;
}

export function getMockSheetStatus(): SheetStatus {
  const connected = getDemoSheetConnected();
  return {
    connected,
    spreadsheetId: connected ? "demo-spreadsheet-id" : null,
    spreadsheetUrl: connected
      ? "https://docs.google.com/spreadsheets/d/demo"
      : null,
  };
}

export function getMockWhatsAppStatus(): WhatsAppSessionStatus {
  const status = getDemoWaStatus();
  const phone = getDemoWaPhone();

  return {
    userId: DEMO_USER.id,
    phone: status === "idle" ? "" : phone,
    status,
  };
}

export function upgradeDemoSubscription(tier: "pro" = "pro") {
  ss()?.setItem(DEMO_PRO_KEY, "1");
  ss()?.setItem(DEMO_TIER_KEY, tier);
}

export function getMockTrialSubscriptionStatus(): SubscriptionStatusData {
  return {
    allowed: true,
    status: "trial",
    tier: "pro",
    expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    daysRemaining: 5,
    trialDaysRemaining: 5,
    canAccessAnalytics: true,
    canUseReceiptOcr: true,
    canManageCategories: true,
    canManageHousehold: true,
    isTrial: true,
    isPro: true,
  };
}

export function getMockSubscriptionStatus(): SubscriptionStatusData {
  if (ss()?.getItem(DEMO_PRO_KEY) === "1") {
    return getMockProSubscriptionStatus();
  }
  return getMockTrialSubscriptionStatus();
}

export function getMockProSubscriptionStatus(): SubscriptionStatusData {
  return {
    allowed: true,
    status: "active",
    tier: "pro",
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    daysRemaining: 30,
    trialDaysRemaining: null,
    canAccessAnalytics: true,
    canUseReceiptOcr: true,
    canManageCategories: true,
    canManageHousehold: true,
    isTrial: false,
    isPro: true,
  };
}

export function demoDelay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ls(): Storage | null {
  if (typeof window === "undefined") return null;
  return localStorage;
}

function migrateDemoHouseholdFromSession() {
  const local = ls();
  const session = ss();
  if (!local || !session) return;

  if (!local.getItem(DEMO_HOUSEHOLD_MEMBERS_KEY) && session.getItem(DEMO_HOUSEHOLD_MEMBERS_KEY)) {
    local.setItem(DEMO_HOUSEHOLD_MEMBERS_KEY, session.getItem(DEMO_HOUSEHOLD_MEMBERS_KEY)!);
    session.removeItem(DEMO_HOUSEHOLD_MEMBERS_KEY);
  }
  if (!local.getItem(DEMO_HOUSEHOLD_SLOTS_KEY) && session.getItem(DEMO_HOUSEHOLD_SLOTS_KEY)) {
    local.setItem(DEMO_HOUSEHOLD_SLOTS_KEY, session.getItem(DEMO_HOUSEHOLD_SLOTS_KEY)!);
    session.removeItem(DEMO_HOUSEHOLD_SLOTS_KEY);
  }
}

interface DemoHouseholdMemberRow extends HouseholdMember {}

function getDemoHouseholdMembersRaw(): DemoHouseholdMemberRow[] {
  migrateDemoHouseholdFromSession();
  const raw = ls()?.getItem(DEMO_HOUSEHOLD_MEMBERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DemoHouseholdMemberRow[];
  } catch {
    return [];
  }
}

function saveDemoHouseholdMembers(members: DemoHouseholdMemberRow[]) {
  ls()?.setItem(DEMO_HOUSEHOLD_MEMBERS_KEY, JSON.stringify(members));
}

export function getDemoHouseholdSummary(): HouseholdSummary {
  const slots = Number(ls()?.getItem(DEMO_HOUSEHOLD_SLOTS_KEY) ?? 0);
  const members = getDemoHouseholdMembersRaw().filter((m) => m.status !== "revoked");
  const sub = getMockSubscriptionStatus();

  return {
    householdId: "demo",
    memberSlotsPaid: slots,
    memberSlotsMax: MAX_HOUSEHOLD_MEMBER_SLOTS,
    activeMemberCount: members.length,
    memberPrice: HOUSEHOLD_MEMBER_PRICE,
    canManageHousehold: sub.canManageHousehold,
    canInviteMember:
      sub.canManageHousehold && slots > 0 && members.length < slots,
    members,
  };
}

export function purchaseDemoHouseholdSlots(slots: number) {
  ls()?.setItem(DEMO_HOUSEHOLD_SLOTS_KEY, String(slots));

  const members = getDemoHouseholdMembersRaw();
  if (members.length > slots) {
    saveDemoHouseholdMembers(members.slice(0, slots));
  }
}

export function inviteDemoHouseholdMember(displayName: string, phone: string) {
  const id = `demo-member-${Date.now()}`;
  const normalized = phone.startsWith("62")
    ? phone
    : `62${phone.replace(/^0/, "")}`;
  const members = getDemoHouseholdMembersRaw();
  members.push({
    id,
    displayName,
    phone: normalized,
    status: "active",
  });
  saveDemoHouseholdMembers(members);

  return {
    memberId: id,
    displayName,
    phone: normalized,
  };
}

export function revokeDemoHouseholdMember(memberId: string) {
  saveDemoHouseholdMembers(
    getDemoHouseholdMembersRaw().filter((m) => m.id !== memberId),
  );
}
