"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Crown,
  FileDown,
  Flame,
  Lock,
  PiggyBank,
  Receipt,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { CategoryDonutChart } from "@/components/analytics/category-donut-chart";
import { FinancialInsights } from "@/components/analytics/financial-insights";
import { HealthScoreRing } from "@/components/analytics/health-score-ring";
import { MonthlyTrendChart } from "@/components/analytics/monthly-trend-chart";
import { WeekdayChart } from "@/components/analytics/weekday-chart";
import { TopExpensesList } from "@/components/analytics/top-expenses-list";
import { UpgradeProButton } from "@/components/subscription/upgrade-pro-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSubscription } from "@/hooks/use-subscription";
import { useSheetStatus } from "@/hooks/use-sheet-status";
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status";
import { ChatToBotButton } from "@/components/whatsapp/chat-to-bot-button";
import {
  buildCategoryColorMap,
  computeAnalyticsInsights,
  filterBudgetsForActiveCategories,
  filterCategoryTotalsForDisplay,
  getCategoryColor,
} from "@/lib/analytics-utils";
import { demoHasTransactionData, getDemoAllTransactions, isDemoMode } from "@/lib/demo";
import { formatMonthLabel, formatRupiah, formatTransactionDateTime } from "@/lib/format";
import {
  analyticsService,
  type AnalyticsData,
} from "@/services/analytics.service";
import { categoriesService } from "@/services/subscription.service";
import {
  ReportInteractiveCard,
  ReportHoverRow,
  ReportReveal,
} from "@/components/ui/report-motion";
import { cn } from "@/lib/utils";

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent,
  delay = 0,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  accent?: string;
  delay?: number;
}) {
  return (
    <ReportReveal delay={delay} className="h-full">
      <ReportInteractiveCard className="h-full">
        <Card className="group flex h-full flex-col gap-0 overflow-hidden border-border/60 py-0 transition-colors hover:border-primary/30">
          <CardContent className="relative flex flex-1 flex-col px-4 py-3">
            <div className="flex flex-1 items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-xs font-medium text-muted-foreground">{title}</p>
                <p className="mt-1 truncate text-xl font-bold tracking-tight transition-transform duration-300 group-hover:scale-[1.02] group-hover:origin-center sm:text-2xl">
                  {value}
                </p>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-transparent select-none" aria-hidden>
                    —
                  </p>
                )}
                <div className="mt-2 min-h-[26px]">
                  {trend && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        trend.value >= 0
                          ? "bg-destructive/10 text-destructive"
                          : "bg-emerald-500/10 text-emerald-600",
                      )}
                    >
                      {trend.value >= 0 ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {Math.abs(trend.value)}% {trend.label}
                    </div>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                  accent ?? "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </ReportInteractiveCard>
    </ReportReveal>
  );
}

function AnimatedBudgetBar({
  pct,
  over,
  color,
}: {
  pct: number;
  over: boolean;
  color: string;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setWidth(pct);
      return;
    }
    const frame = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div
      className={cn(
        "h-full rounded-full transition-[width] duration-1000 ease-out",
        over && "bg-destructive",
      )}
      style={{
        width: `${width}%`,
        ...(!over ? { backgroundColor: color } : {}),
      }}
    />
  );
}

export function AnalyticsContent() {
  const { canAccessAnalytics, isPro } = useSubscription();
  const { isConnected: sheetConnected, isLoading: sheetLoading } = useSheetStatus();
  const { isConnected: whatsappConnected, isLoading: whatsappLoading } =
    useWhatsAppStatus();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [activeCategoryNames, setActiveCategoryNames] = useState<Set<string>>(
    new Set(),
  );

  const loadCategories = useCallback(async () => {
    const result = await categoriesService.list();
    if (result.success && result.data) {
      setColorMap(buildCategoryColorMap(result.data));
      setActiveCategoryNames(new Set(result.data.map((c) => c.name)));
    }
  }, []);

  const load = useCallback(async (month?: string) => {
    setIsLoading(true);

    const result = await analyticsService.getAnalytics(month);
    if (result.success) {
      setData(result.data ?? null);
      if (result.data?.activeMonth && !month) {
        setSelectedMonth(result.data.activeMonth);
      }
    } else {
      setData(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
    void loadCategories();
  }, [load, loadCategories]);

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
    setSelectedCategory(null);
    void load(month);
  }

  async function handleExportPdf() {
    if (!selectedMonth || locked) return;
    setExportError(null);
    setIsExporting(true);
    const result = await analyticsService.exportPdf(selectedMonth);
    setIsExporting(false);
    if (!result.ok) {
      setExportError(result.error ?? "Export PDF gagal");
    }
  }

  const allMonthTx = useMemo(() => {
    if (isDemoMode()) {
      if (!demoHasTransactionData()) return [];
      return getDemoAllTransactions();
    }
    return data?.transactions ?? [];
  }, [data]);

  const analyticsView = useMemo(() => {
    if (!data) return null;
    if (activeCategoryNames.size === 0) {
      return {
        ...data,
        categoryTotals: data.categoryTotals.filter((row) => row.amount > 0),
      };
    }
    return {
      ...data,
      categoryTotals: filterCategoryTotalsForDisplay(
        data.categoryTotals,
        activeCategoryNames,
      ),
      budgets: filterBudgetsForActiveCategories(data.budgets, activeCategoryNames),
    };
  }, [data, activeCategoryNames]);

  const insights = useMemo(() => {
    if (!analyticsView) return null;
    return computeAnalyticsInsights(analyticsView, allMonthTx);
  }, [analyticsView, allMonthTx]);

  const filteredTransactions = useMemo(() => {
    if (!data) return [];
    if (!selectedCategory) return data.transactions;
    return data.transactions.filter((t) => t.category === selectedCategory);
  }, [data, selectedCategory]);

  const hasArchivedInView = useMemo(
    () =>
      activeCategoryNames.size > 0 &&
      (analyticsView?.categoryTotals.some(
        (c) => !activeCategoryNames.has(c.category),
      ) ??
        false),
    [analyticsView, activeCategoryNames],
  );

  const locked = !canAccessAnalytics;
  const needsOnboarding =
    !data ||
    data.transactions.length === 0 ||
    (isDemoMode() && !demoHasTransactionData());

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (sheetLoading || whatsappLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <Card>
          <CardContent className="py-12">
            <div className="mx-auto h-4 w-64 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsOnboarding || !data || !insights || !analyticsView) {
    const showChatToBot = whatsappConnected;
    const whatsappReadyButSheetMissing = whatsappConnected && !sheetConnected;
    const title = showChatToBot
      ? "Belum ada transaksi"
      : "Mulai catat lewat WhatsApp";
    const description = showChatToBot
      ? "Nomor WhatsApp sudah terdaftar. Kirim transaksi pertama ke bot, misalnya: Beli kopi 20rb."
      : "Daftarkan nomor WhatsApp kamu. Google Sheet akan dibuat otomatis, lalu transaksi pertama bisa langsung dicatat lewat chat.";

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          {showChatToBot ? (
            <ChatToBotButton
              message="Beli kopi 20rb"
              variant="default"
              className="w-fit bg-[#25D366] hover:bg-[#1ebe5a]"
            />
          ) : (
            <Button size="sm" render={<Link href="/settings#whatsapp" />}>
              Daftarkan nomor WhatsApp
            </Button>
          )}
          {whatsappReadyButSheetMissing && (
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/settings#whatsapp" />}
            >
              Hubungkan Google Sheet
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative flex flex-col gap-6">
      {/* Header */}
      <ReportReveal className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Ringkasan Keuangan
            </h1>
            {isPro && <Crown className="size-4 text-amber-600" />}
            {isDemoMode() && (
              <Badge variant="secondary" className="gap-1">
                Demo
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Insight mendalam untuk perencanaan keuangan rumah tangga Anda
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={locked || isExporting || !selectedMonth || isDemoMode()}
            onClick={() => void handleExportPdf()}
          >
            <FileDown className="size-3.5" />
            {isExporting ? "Membuat PDF..." : "Export PDF"}
          </Button>
          {data.availableMonths.map((month) => (
            <Button
              key={month}
              size="sm"
              variant={selectedMonth === month ? "default" : "outline"}
              onClick={() => handleMonthChange(month)}
              disabled={locked}
            >
              <CalendarDays className="size-3.5" />
              {formatMonthLabel(month)}
            </Button>
          ))}
        </div>
      </ReportReveal>

      {exportError && (
        <p className="text-sm text-destructive">{exportError}</p>
      )}

      <div className={cn("flex flex-col gap-4", locked && "select-none blur-[2px]")}>
        {/* Health score hero */}
        <ReportReveal delay={60}>
          <ReportInteractiveCard lift={false}>
            <Card
              className={cn(
                "gap-0 overflow-hidden py-0 shadow-md transition-shadow duration-300 hover:shadow-lg",
                insights.healthScore >= 80
                  ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/12 via-emerald-500/5 to-background"
                  : insights.healthScore >= 60
                    ? "border-amber-500/40 bg-gradient-to-br from-amber-500/12 via-amber-500/5 to-background"
                    : "border-red-500/40 bg-gradient-to-br from-red-500/12 via-red-500/5 to-background",
              )}
            >
              <CardContent className="flex flex-col items-center gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                  <HealthScoreRing
                    score={insights.healthScore}
                    label={insights.healthLabel}
                  />
                  <div className="text-center sm:text-left">
                    <h2 className="text-lg font-semibold">Skor Kesehatan Keuangan</h2>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Berdasarkan budget adherence, tren pengeluaran, dan pola
                      konsumsi keluarga di {formatMonthLabel(data.activeMonth)}.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center sm:gap-6">
                  <div className="group rounded-xl px-3 py-2 transition-colors hover:bg-background/60">
                    <p className="text-xs text-muted-foreground">Budget terpakai</p>
                    <p className="text-2xl font-bold transition-transform duration-300 group-hover:scale-105">
                      {insights.budgetUsedPct}%
                    </p>
                  </div>
                  <div className="group rounded-xl px-3 py-2 transition-colors hover:bg-background/60">
                    <p className="text-xs text-muted-foreground">Proyeksi akhir bulan</p>
                    <p className="text-2xl font-bold transition-transform duration-300 group-hover:scale-105">
                      {formatRupiah(insights.projectedMonthEnd)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ReportInteractiveCard>
        </ReportReveal>

        {/* KPI grid */}
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Pengeluaran"
            value={formatRupiah(data.summary.totalExpense)}
            subtitle={formatMonthLabel(data.activeMonth)}
            icon={Wallet}
            trend={
              insights.momChangePct !== null
                ? { value: insights.momChangePct, label: "vs bulan lalu" }
                : undefined
            }
            accent="bg-violet-500/10 text-violet-600"
            delay={120}
          />
          <KpiCard
            title="Burn Rate Harian"
            value={formatRupiah(insights.dailyBurnRate)}
            subtitle="Rata-rata per hari"
            icon={Flame}
            accent="bg-orange-500/10 text-orange-600"
            delay={180}
          />
          <KpiCard
            title="Rata-rata Transaksi"
            value={formatRupiah(data.summary.averagePerTransaction)}
            subtitle={`${data.summary.transactionCount} transaksi`}
            icon={Receipt}
            accent="bg-blue-500/10 text-blue-600"
            delay={240}
          />
          <KpiCard
            title="Budget Bulanan"
            value={formatRupiah(insights.budgetTotal)}
            subtitle={
              insights.budgetUsedPct <= 100
                ? `Sisa ${formatRupiah(insights.budgetTotal - data.summary.totalExpense)}`
                : `Over ${formatRupiah(data.summary.totalExpense - insights.budgetTotal)}`
            }
            icon={Target}
            accent={
              insights.budgetUsedPct > 100
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600"
            }
            delay={300}
          />
        </div>

        {/* Expert insights */}
        <ReportReveal delay={340}>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              <h2 className="text-base font-semibold">Rekomendasi Pakar Keuangan Keluarga</h2>
            </div>
            <FinancialInsights insights={insights.recommendations} />
          </div>
        </ReportReveal>

        {/* Charts row 1: Donut + Monthly trend */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportReveal delay={400}>
          <ReportInteractiveCard>
          <Card className="gap-0 py-0 transition-colors hover:border-primary/25">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" />
                Komposisi Pengeluaran
              </CardTitle>
              <CardDescription>
                Distribusi per kategori — klik untuk filter
                {hasArchivedInView ? " · kategori arsip = sudah dihapus" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              <CategoryDonutChart
                segments={analyticsView.categoryTotals}
                selectedCategory={selectedCategory}
                onSelect={setSelectedCategory}
                colorMap={colorMap}
              />
            </CardContent>
          </Card>
          </ReportInteractiveCard>
          </ReportReveal>

          <ReportReveal delay={460}>
          <ReportInteractiveCard>
          <Card className="gap-0 py-0 transition-colors hover:border-primary/25">
            <CardHeader className="pt-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" />
                Tren 6 Bulan
              </CardTitle>
              <CardDescription>
                Perkembangan total pengeluaran rumah tangga
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              <MonthlyTrendChart
                data={insights.monthlyTrend}
                activeMonth={data.activeMonth}
              />
            </CardContent>
          </Card>
          </ReportInteractiveCard>
          </ReportReveal>
        </div>

        {/* Weekday + Top expenses — half page each */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportReveal delay={520}>
          <ReportInteractiveCard>
          <Card className="gap-0 py-0 transition-colors hover:border-primary/25">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4 text-primary" />
                Pola Mingguan
              </CardTitle>
              <CardDescription className="text-xs">
                Pengeluaran per hari (Sen–Min)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <WeekdayChart data={insights.weekdayPattern} compact />
            </CardContent>
          </Card>
          </ReportInteractiveCard>
          </ReportReveal>

          <ReportReveal delay={580}>
          <ReportInteractiveCard>
          <Card className="gap-0 py-0 transition-colors hover:border-primary/25">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm">Top Pengeluaran</CardTitle>
              <CardDescription className="text-xs">
                Item terbesar bulan ini
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <TopExpensesList
                items={insights.topItems}
                colorMap={colorMap}
                limit={5}
              />
            </CardContent>
          </Card>
          </ReportInteractiveCard>
          </ReportReveal>
        </div>

        {/* Budget vs actual */}
        {analyticsView.budgets.length > 0 && (
          <ReportReveal delay={640}>
          <ReportInteractiveCard>
          <Card className="gap-0 py-0 transition-colors hover:border-primary/25">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-primary" />
                Budget vs Aktual per Kategori
              </CardTitle>
              <CardDescription>
                Hanya kategori aktif — kategori dihapus tidak ditampilkan di sini
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {analyticsView.budgets.map(({ category, amount: budget }, i) => {
                  const actual =
                    analyticsView.categoryTotals.find((c) => c.category === category)
                      ?.amount ?? 0;
                  const pct = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0;
                  const over = actual > budget;
                  return (
                    <div
                      key={category}
                      className="group rounded-xl border bg-muted/20 p-3 transition-all duration-300 hover:border-primary/25 hover:bg-muted/35 hover:shadow-sm"
                      title={`${category}: ${formatRupiah(actual)} dari budget ${formatRupiah(budget)}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: getCategoryColor(category, colorMap) }}
                          />
                          <span className="text-sm font-medium">{category}</span>
                        </div>
                        <Badge
                          variant={over ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {Math.round(pct)}%
                        </Badge>
                      </div>
                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                        <AnimatedBudgetBar
                          pct={pct}
                          over={over}
                          color={getCategoryColor(category, colorMap)}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>Aktual: {formatRupiah(actual)}</span>
                        <span>Budget: {formatRupiah(budget)}</span>
                      </div>
                      {over && (
                        <p className="mt-1.5 text-xs font-medium text-destructive">
                          Over budget {formatRupiah(actual - budget)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          </ReportInteractiveCard>
          </ReportReveal>
        )}

        {/* Potensi optimasi */}
        <ReportReveal delay={700}>
        <ReportInteractiveCard lift={false}>
          <Card className="gap-0 border-emerald-500/20 bg-emerald-500/5 py-0 transition-shadow duration-300 hover:shadow-md">
            <CardHeader className="pb-2 pt-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PiggyBank className="size-4 text-emerald-600" />
              Potensi Optimasi
            </CardTitle>
            <CardDescription className="text-xs">
              Estimasi penghematan jika budget dipatuhi
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0 pb-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="shrink-0 rounded-xl bg-background px-5 py-3 text-center sm:min-w-[140px]">
              <p className="text-2xl font-bold text-emerald-600">
                {formatRupiah(insights.savingsPotential)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">/ bulan</p>
            </div>
            <ul className="flex-1 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                Review langganan & tagihan tetap (PLN, internet)
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                Rencanakan belanja bulanan 1x (hemat impulse buy)
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                Alokasikan sisa budget ke dana darurat keluarga
              </li>
            </ul>
          </CardContent>
        </Card>
        </ReportInteractiveCard>
        </ReportReveal>

        {/* Transactions */}
        <ReportReveal delay={760}>
        <Card className="gap-0 py-0 transition-colors hover:border-primary/25">
          <CardHeader className="flex flex-row items-center justify-between pt-3 pb-2">
            <div>
              <CardTitle className="text-base">
                Riwayat Transaksi
                {selectedCategory && (
                  <Badge
                    variant="secondary"
                    className="ml-2"
                    style={{ borderColor: getCategoryColor(selectedCategory, colorMap) }}
                  >
                    {selectedCategory}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {filteredTransactions.length} transaksi
                {selectedCategory ? ` · filter aktif` : ""}
              </CardDescription>
            </div>
            {selectedCategory && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedCategory(null)}
              >
                Reset filter
              </Button>
            )}
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-col divide-y">
              {filteredTransactions.map((tx, i) => (
                <ReportHoverRow key={`${tx.date}-${tx.item}-${i}`} delay={40 + i * 30}>
                  <div
                    className="group flex items-center gap-3 rounded-lg py-2.5 first:pt-0 last:pb-0"
                    title={`${tx.category} · ${formatTransactionDateTime(tx.date, tx.time ?? undefined)}`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-125"
                      style={{ backgroundColor: getCategoryColor(tx.category, colorMap) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{tx.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTransactionDateTime(tx.date, tx.time ?? undefined)} · {tx.category}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums transition-colors group-hover:text-primary">
                      {formatRupiah(tx.amount)}
                    </p>
                  </div>
                </ReportHoverRow>
              ))}
            </div>
          </CardContent>
        </Card>
        </ReportReveal>
      </div>

      {locked && (
        <div className="absolute inset-0 flex items-start justify-center pt-24">
          <div className="mx-4 max-w-md rounded-xl border bg-background/95 p-6 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Lock className="size-7 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Langganan tidak aktif</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Unlock skor kesehatan keuangan, tren 6 bulan, rekomendasi
                  pakar, dan insight lengkap untuk keluarga Anda.
                </p>
              </div>
              <UpgradeProButton
                fullWidth
                label="Berlangganan — Rp 49rb/bulan"
                onUpgraded={() => void load(selectedMonth ?? undefined)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
