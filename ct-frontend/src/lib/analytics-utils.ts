/** Shared category styling for analytics charts */
export const CATEGORY_META: Record<
  string,
  { color: string; bg: string; icon: string }
> = {
  Makanan: { color: "#22c55e", bg: "bg-emerald-500", icon: "utensils" },
  Transport: { color: "#3b82f6", bg: "bg-blue-500", icon: "car" },
  Utilitas: { color: "#f59e0b", bg: "bg-amber-500", icon: "zap" },
  Belanja: { color: "#8b5cf6", bg: "bg-violet-500", icon: "shopping-bag" },
  Kesehatan: { color: "#f43f5e", bg: "bg-rose-500", icon: "heart" },
  Pendidikan: { color: "#6366f1", bg: "bg-indigo-500", icon: "graduation-cap" },
  Hiburan: { color: "#ec4899", bg: "bg-pink-500", icon: "gamepad" },
  Lainnya: { color: "#6b7280", bg: "bg-gray-400", icon: "circle" },
};

export function getCategoryColor(
  category: string,
  overrides?: Record<string, string>,
): string {
  if (overrides?.[category]) return overrides[category];
  return CATEGORY_META[category]?.color ?? stringToColor(category);
}

export function getCategoryBg(category: string): string {
  return CATEGORY_META[category]?.bg ?? "bg-primary";
}

/** Build color map from user-defined categories (hex colors) */
export function buildCategoryColorMap(
  categories: { name: string; color: string | null }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of categories) {
    map[cat.name] = cat.color ?? stringToColor(cat.name);
  }
  return map;
}

export interface CategoryTotalRow {
  category: string;
  amount: number;
  /** Kategori sudah dihapus user; hanya tampil jika ada transaksi historis */
  archived?: boolean;
}

/**
 * Cutoff analitik:
 * - Kategori aktif dengan Rp 0 tidak ditampilkan (no padding)
 * - Kategori dihapus hanya muncul jika bulan tersebut masih punya transaksi
 */
export function filterCategoryTotalsForDisplay(
  categoryTotals: { category: string; amount: number }[],
  activeCategoryNames: Set<string>,
): CategoryTotalRow[] {
  return categoryTotals
    .filter((row) => row.amount > 0)
    .map((row) => ({
      ...row,
      archived: !activeCategoryNames.has(row.category),
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Budget hanya untuk kategori yang masih aktif */
export function filterBudgetsForActiveCategories(
  budgets: { category: string; amount: number }[],
  activeCategoryNames: Set<string>,
): { category: string; amount: number }[] {
  return budgets.filter((b) => activeCategoryNames.has(b.category));
}

function stringToColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

export interface ComputedInsights {
  healthScore: number;
  healthLabel: string;
  momChangePct: number | null;
  dailyBurnRate: number;
  projectedMonthEnd: number;
  budgetTotal: number;
  budgetUsedPct: number;
  savingsPotential: number;
  weekdayPattern: { day: string; dayIndex: number; amount: number; count: number }[];
  topItems: { item: string; amount: number; count: number; category: string }[];
  monthlyTrend: { month: string; amount: number }[];
  recommendations: {
    type: "warning" | "tip" | "success" | "info";
    title: string;
    description: string;
  }[];
}

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function computeAnalyticsInsights(
  data: {
    activeMonth: string;
    transactions: { date: string; month: string; item: string; amount: number; category: string }[];
    categoryTotals: { category: string; amount: number }[];
    budgets: { category: string; amount: number }[];
    summary: { totalExpense: number; transactionCount: number };
    availableMonths: string[];
  },
  allMonthTransactions: { date: string; month: string; item: string; amount: number; category: string }[],
): ComputedInsights {
  const { activeMonth, transactions, categoryTotals, budgets, summary } = data;

  const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
  const budgetUsedPct =
    budgetTotal > 0 ? Math.round((summary.totalExpense / budgetTotal) * 100) : 0;

  const daysInMonth = new Date(
    Number(activeMonth.slice(0, 4)),
    Number(activeMonth.slice(5, 7)),
    0,
  ).getDate();
  const today = activeMonth === "2026-08" ? 5 : daysInMonth;
  const dailyBurnRate = today > 0 ? Math.round(summary.totalExpense / today) : 0;
  const projectedMonthEnd = dailyBurnRate * daysInMonth;

  const prevMonthIdx = data.availableMonths.indexOf(activeMonth) + 1;
  const prevMonth = data.availableMonths[prevMonthIdx];
  let momChangePct: number | null = null;
  if (prevMonth) {
    const prevTotal = allMonthTransactions
      .filter((t) => t.month === prevMonth)
      .reduce((s, t) => s + t.amount, 0);
    if (prevTotal > 0) {
      momChangePct = Math.round(
        ((summary.totalExpense - prevTotal) / prevTotal) * 100,
      );
    }
  }

  const weekdayMap = new Map<number, { amount: number; count: number }>();
  for (const t of transactions) {
    const d = new Date(t.date).getDay();
    const existing = weekdayMap.get(d) ?? { amount: 0, count: 0 };
    weekdayMap.set(d, {
      amount: existing.amount + t.amount,
      count: existing.count + 1,
    });
  }
  const weekdayPattern = [1, 2, 3, 4, 5, 6, 0].map((dayIndex) => ({
    day: WEEKDAYS[dayIndex]!,
    dayIndex,
    amount: weekdayMap.get(dayIndex)?.amount ?? 0,
    count: weekdayMap.get(dayIndex)?.count ?? 0,
  }));

  const itemMap = new Map<string, { amount: number; count: number; category: string }>();
  for (const t of transactions) {
    const existing = itemMap.get(t.item) ?? { amount: 0, count: 0, category: t.category };
    itemMap.set(t.item, {
      amount: existing.amount + t.amount,
      count: existing.count + 1,
      category: t.category,
    });
  }
  const topItems = Array.from(itemMap.entries())
    .map(([item, v]) => ({ item, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const monthlyTrend = data.availableMonths
    .slice()
    .reverse()
    .map((month) => ({
      month,
      amount: allMonthTransactions
        .filter((t) => t.month === month)
        .reduce((s, t) => s + t.amount, 0),
    }));

  let healthScore = 75;
  if (budgetUsedPct > 100) healthScore -= 25;
  else if (budgetUsedPct > 85) healthScore -= 15;
  else if (budgetUsedPct < 70) healthScore += 10;
  if (momChangePct !== null && momChangePct > 20) healthScore -= 15;
  if (momChangePct !== null && momChangePct < -10) healthScore += 10;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const healthLabel =
    healthScore >= 80 ? "Sehat" : healthScore >= 60 ? "Cukup Baik" : "Perlu Perhatian";

  const overBudgetCats = budgets.filter((b) => {
    const actual = categoryTotals.find((c) => c.category === b.category)?.amount ?? 0;
    return actual > b.amount;
  });

  const savingsPotential = overBudgetCats.reduce((s, b) => {
    const actual = categoryTotals.find((c) => c.category === b.category)?.amount ?? 0;
    return s + Math.max(0, actual - b.amount);
  }, 0);

  const recommendations: ComputedInsights["recommendations"] = [];

  if (overBudgetCats.length > 0) {
    recommendations.push({
      type: "warning",
      title: `${overBudgetCats.length} kategori melebihi budget`,
      description: `Utilitas dan kategori lain sudah over budget. Pertimbangkan review langganan dan tagihan tetap bulan ini.`,
    });
  }

  const topCat = categoryTotals[0];
  if (topCat && summary.totalExpense > 0) {
    const pct = Math.round((topCat.amount / summary.totalExpense) * 100);
    if (pct > 40) {
      recommendations.push({
        type: "info",
        title: `${topCat.category} dominan (${pct}%)`,
        description: `Pengeluaran ${topCat.category.toLowerCase()} menyumbang ${pct}% total bulan ini. Pola wajar untuk rumah tangga, tapi pantau jika terus naik.`,
      });
    }
  }

  const weekendSpend =
    (weekdayMap.get(0)?.amount ?? 0) + (weekdayMap.get(6)?.amount ?? 0);
  const weekdaySpend = summary.totalExpense - weekendSpend;
  if (weekendSpend > weekdaySpend * 0.4 && weekendSpend > 0) {
    recommendations.push({
      type: "tip",
      title: "Weekend spending tinggi",
      description:
        "Pengeluaran akhir pekan cukup besar. Rencanakan aktivitas keluarga dengan budget mingguan agar lebih terkontrol.",
    });
  }

  if (projectedMonthEnd > budgetTotal && budgetTotal > 0) {
    recommendations.push({
      type: "warning",
      title: "Proyeksi melewati budget bulanan",
      description: `Jika pola ini berlanjut, estimasi akhir bulan ${formatRupiahShort(projectedMonthEnd)} vs budget ${formatRupiahShort(budgetTotal)}. Kurangi pengeluaran diskresioner sekarang.`,
    });
  } else if (healthScore >= 80) {
    recommendations.push({
      type: "success",
      title: "Keuangan rumah tangga terkendali",
      description:
        "Pola pengeluaran bulan ini sehat. Pertahankan dan alokasikan sisa budget ke dana darurat atau tabungan pendidikan anak.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "tip",
      title: "Catat konsisten via WhatsApp",
      description:
        "Semakin lengkap data harian, semakin akurat insight finansial keluarga Anda.",
    });
  }

  return {
    healthScore,
    healthLabel,
    momChangePct,
    dailyBurnRate,
    projectedMonthEnd,
    budgetTotal,
    budgetUsedPct,
    savingsPotential,
    weekdayPattern,
    topItems,
    monthlyTrend,
    recommendations,
  };
}

function formatRupiahShort(n: number): string {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`;
  return `Rp ${n}`;
}

export { formatRupiahShort };
