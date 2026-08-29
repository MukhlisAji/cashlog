"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  FileText,
  Flame,
  Loader2,
  Phone,
  RefreshCw,
  Shield,
  Table2,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatLongDate } from "@/lib/format";
import {
  adminService,
  type AdminOverview,
  type AdminUserRow,
} from "@/services/admin.service";

type TabId = "ringkasan" | "kegagalan" | "pengguna";
type Tone = "emerald" | "sky" | "violet" | "amber" | "rose" | "slate";

const TONE: Record<Tone, { wrap: string; icon: string; value: string }> = {
  emerald: {
    wrap: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-card",
    icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    value: "text-emerald-800 dark:text-emerald-200",
  },
  sky: {
    wrap: "border-sky-200/80 bg-gradient-to-br from-sky-50 to-white dark:border-sky-900/50 dark:from-sky-950/40 dark:to-card",
    icon: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    value: "text-sky-800 dark:text-sky-200",
  },
  violet: {
    wrap: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-white dark:border-violet-900/50 dark:from-violet-950/40 dark:to-card",
    icon: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    value: "text-violet-800 dark:text-violet-200",
  },
  amber: {
    wrap: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900/50 dark:from-amber-950/40 dark:to-card",
    icon: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    value: "text-amber-900 dark:text-amber-100",
  },
  rose: {
    wrap: "border-rose-200/80 bg-gradient-to-br from-rose-50 to-white dark:border-rose-900/50 dark:from-rose-950/40 dark:to-card",
    icon: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    value: "text-rose-800 dark:text-rose-200",
  },
  slate: {
    wrap: "border-border bg-card",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

function planLabel(plan: string): string {
  if (plan === "active") return "Aktif";
  if (plan === "trial") return "Trial";
  if (plan === "expired") return "Kadaluarsa";
  return "Gratis";
}

function StatCard({
  tone,
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  tone: Tone;
  icon: ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left shadow-sm transition",
        t.wrap,
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        !onClick && "cursor-default",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", t.value)}>
            {value}
          </p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.icon)}>
          {icon}
        </span>
      </div>
      {hint ? <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </button>
  );
}

function MixBar({
  parts,
}: {
  parts: { label: string; value: number; className: string }[];
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {parts.map((p) => (
          <div
            key={p.label}
            className={p.className}
            style={{ width: `${(p.value / total) * 100}%` }}
            title={`${p.label}: ${p.value}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", p.className)} />
            {p.label} {p.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function failRatio(ok: number, fail: number): number {
  const t = ok + fail;
  if (t <= 0) return 0;
  return Math.round((fail / t) * 100);
}

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("ringkasan");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [expandedFail, setExpandedFail] = useState<number | null>(null);

  const load = useCallback(async (query: string, pageNum: number) => {
    setLoading(true);
    setError(null);
    const [ov, list] = await Promise.all([
      adminService.getOverview(),
      adminService.listUsers(query, pageNum),
    ]);
    setLoading(false);

    if (!ov.success) {
      setError(ov.error ?? "Tidak bisa memuat admin.");
      setOverview(null);
      return;
    }
    if (!list.success || !list.data) {
      setError(list.error ?? "Tidak bisa memuat daftar user.");
      return;
    }

    setOverview(ov.data ?? null);
    setUsers(list.data.users);
    setTotal(list.data.total);
    setPage(list.data.page);
    setPageSize(list.data.pageSize);
  }, []);

  useEffect(() => {
    void load(search, page);
  }, [load, search, page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(q);
  }

  const failsToday = overview
    ? overview.failures.recordToday +
      overview.failures.parseToday +
      overview.failures.onboardToday +
      overview.failures.reminderToday +
      overview.failures.inboundToday +
      overview.failures.sheetSetupToday +
      overview.pdf.generateFailToday +
      overview.pdf.waSendFailToday +
      overview.pdf.exportFailToday
    : 0;

  const filteredFails = useMemo(() => {
    if (!overview) return [];
    if (!kindFilter) return overview.recentFails;
    return overview.recentFails.filter((row) => row.kind === kindFilter);
  }, [overview, kindFilter]);

  const visibleUsers = useMemo(() => {
    if (planFilter === "all") return users;
    return users.filter((u) => u.plan === planFilter);
  }, [users, planFilter]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (error && !overview) {
    return (
      <Card className="border-rose-200 dark:border-rose-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <Shield className="size-5" />
            Admin
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "kegagalan", label: "Kegagalan" },
    { id: "pengguna", label: "Pengguna" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Shield className="size-5" />
            </span>
            Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operasi live · klik kartu untuk lompat ke detail
            {overview?.generatedAt
              ? ` · ${overview.generatedAt.replace("T", " ").slice(11, 16)} UTC`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load(search, page)}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {failsToday > 0 ? (
        <button
          type="button"
          onClick={() => setTab("kegagalan")}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <span className="font-medium">{failsToday} kegagalan hari ini.</span>{" "}
          Buka tab Kegagalan untuk matriks dan pesan error.
        </button>
      ) : null}

      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.id === "kegagalan" && failsToday > 0 ? (
              <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
                {failsToday}
              </span>
            ) : null}
            {item.id === "pengguna" ? (
              <span className="ml-1.5 text-xs text-muted-foreground">{total}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading && !overview ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Memuat...
        </div>
      ) : null}

      {overview && tab === "ringkasan" ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              tone="violet"
              icon={<Users className="size-4" />}
              label="User"
              value={overview.users.total}
              hint={`${overview.users.newToday} baru hari ini · ${overview.users.notOnboarded} belum onboard`}
              onClick={() => setTab("pengguna")}
            />
            <StatCard
              tone="emerald"
              icon={<Wallet className="size-4" />}
              label="Langganan aktif"
              value={overview.users.active}
              hint={`${overview.users.trial} trial · ${overview.users.expired} kadaluarsa · ${overview.billing.expiringIn7Days} habis 7 hari`}
              onClick={() => setTab("pengguna")}
            />
            <StatCard
              tone="sky"
              icon={<Phone className="size-4" />}
              label="WhatsApp"
              value={overview.connections.waPhones}
              hint={`${overview.connections.waLeadPhones} pemilik · ${overview.connections.waMemberPhones} anggota`}
            />
            <StatCard
              tone="amber"
              icon={<Table2 className="size-4" />}
              label="Google Sheet"
              value={overview.connections.googleSheet}
              hint={`${overview.connections.phoneWithoutSheet} WA tanpa sheet · ${overview.connections.sheetWithoutPhone} sheet tanpa WA`}
            />
            <StatCard
              tone="emerald"
              icon={<Activity className="size-4" />}
              label="Catat hari ini"
              value={overview.activity.txToday}
              hint={`${overview.activity.usersWithTxToday} user · ${overview.activity.txLast7Days} tx 7 hari`}
            />
            <StatCard
              tone="sky"
              icon={<FileText className="size-4" />}
              label="PDF WA terkirim"
              value={overview.pdf.waSentToday}
              hint={`${overview.pdf.waSent7d} 7 hari · unduh ${overview.pdf.exportToday}`}
              onClick={() => setTab("kegagalan")}
            />
            <StatCard
              tone={failsToday > 0 ? "rose" : "slate"}
              icon={<AlertTriangle className="size-4" />}
              label="Gagal hari ini"
              value={failsToday}
              hint="Klik untuk matriks & log"
              onClick={() => setTab("kegagalan")}
            />
            <StatCard
              tone="amber"
              icon={<Flame className="size-4" />}
              label="Streak maks"
              value={overview.habit.streakMax}
              hint={`rata-rata ${overview.habit.streakAvg} · ${overview.habit.householdsWithStreak} RT · ${overview.billing.memberSlotsPaid} slot`}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Komposisi langganan</CardTitle>
                <CardDescription>Klik bar untuk filter di tab Pengguna</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <MixBar
                  parts={[
                    { label: "Aktif", value: overview.users.active, className: "bg-emerald-500" },
                    { label: "Trial", value: overview.users.trial, className: "bg-sky-500" },
                    { label: "Kadaluarsa", value: overview.users.expired, className: "bg-amber-500" },
                    { label: "Gratis", value: overview.users.free, className: "bg-slate-400" },
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  {(["active", "trial", "expired", "free"] as const).map((plan) => (
                    <Button
                      key={plan}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPlanFilter(plan);
                        setTab("pengguna");
                      }}
                    >
                      {planLabel(plan)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Funnel koneksi</CardTitle>
                <CardDescription>Onboard vs Sheet vs WA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <FunnelRow
                  label="Onboarded"
                  value={overview.users.onboarded}
                  max={overview.users.total}
                  className="bg-violet-500"
                />
                <FunnelRow
                  label="Punya Sheet"
                  value={overview.connections.googleSheet}
                  max={overview.users.total}
                  className="bg-amber-500"
                />
                <FunnelRow
                  label="Punya WA lead"
                  value={overview.connections.waLeadPhones}
                  max={overview.users.total}
                  className="bg-sky-500"
                />
                <p className="text-xs text-muted-foreground">
                  Marker PDF: {overview.pdf.everWeeklyKey} mingguan ·{" "}
                  {overview.pdf.everMonthlyKey} bulanan · {overview.pdf.everTrialKey} trial-end
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {overview && tab === "kegagalan" ? (
        <div className="flex flex-col gap-4">
          {!overview.failures.tableReady ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Tabel <code>ops_events</code> belum ada. Jalankan{" "}
              <code>ct-frontend/supabase/ops-events.sql</code> di Supabase.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              tone="rose"
              icon={<AlertTriangle className="size-4" />}
              label="Gagal catat"
              value={overview.failures.recordToday}
              hint={`${overview.failures.record7d} dalam 7 hari`}
            />
            <StatCard
              tone="rose"
              icon={<AlertTriangle className="size-4" />}
              label="Gagal parse / struk"
              value={overview.failures.parseToday}
              hint={`${overview.failures.parse7d} dalam 7 hari`}
            />
            <StatCard
              tone="rose"
              icon={<AlertTriangle className="size-4" />}
              label="Gagal boarding"
              value={overview.failures.onboardToday}
              hint={`${overview.failures.onboard7d} dalam 7 hari`}
            />
            <StatCard
              tone="amber"
              icon={<FileText className="size-4" />}
              label="Gagal generate PDF"
              value={overview.pdf.generateFailToday}
              hint={`${overview.pdf.generateFail7d} 7 hari · OK ${overview.pdf.generateOkToday}`}
            />
            <StatCard
              tone="amber"
              icon={<FileText className="size-4" />}
              label="Gagal kirim PDF WA"
              value={overview.pdf.waSendFailToday}
              hint={`${overview.pdf.waSendFail7d} 7 hari`}
            />
            <StatCard
              tone="slate"
              icon={<Activity className="size-4" />}
              label="Reminder / inbound / sheet"
              value={
                overview.failures.reminderToday +
                overview.failures.inboundToday +
                overview.failures.sheetSetupToday
              }
              hint={`reminder ${overview.failures.reminderToday} · inbound ${overview.failures.inboundToday} · sheet ${overview.failures.sheetSetupToday}`}
            />
          </div>

          {overview.matrix.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Matriks event</CardTitle>
                <CardDescription>
                  Klik baris untuk filter log. Merah = rasio gagal tinggi.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Kind</th>
                      <th className="py-2 pr-3 font-medium">Hari ini</th>
                      <th className="py-2 font-medium">7 hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.matrix.map((row) => {
                      const ratio = failRatio(row.ok7d, row.fail7d);
                      const active = kindFilter === row.kind;
                      return (
                        <tr
                          key={row.kind}
                          className={cn(
                            "cursor-pointer border-b last:border-0 hover:bg-muted/50",
                            active && "bg-violet-50 dark:bg-violet-950/30",
                          )}
                          onClick={() =>
                            setKindFilter((k) => (k === row.kind ? null : row.kind))
                          }
                        >
                          <td className="py-2.5 pr-3 font-mono text-xs">{row.kind}</td>
                          <td className="py-2.5 pr-3">
                            <MiniOkFail ok={row.okToday} fail={row.failToday} />
                          </td>
                          <td className="py-2.5">
                            <MiniOkFail ok={row.ok7d} fail={row.fail7d} />
                            {ratio >= 25 ? (
                              <span className="ml-2 text-[10px] font-medium text-rose-600">
                                {ratio}% gagal
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada event ops. Setelah deploy + SQL, matriks terisi otomatis.
            </p>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Log gagal</CardTitle>
                <CardDescription>
                  {kindFilter ? `Filter: ${kindFilter}` : "Semua kind"} · klik baris untuk
                  pesan penuh
                </CardDescription>
              </div>
              {kindFilter ? (
                <Button size="sm" variant="ghost" onClick={() => setKindFilter(null)}>
                  Hapus filter
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {filteredFails.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada kegagalan di rentang ini.</p>
              ) : (
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Waktu</th>
                      <th className="py-2 pr-3 font-medium">Kind</th>
                      <th className="py-2 pr-3 font-medium">User</th>
                      <th className="py-2 font-medium">Pesan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFails.map((row, i) => (
                      <tr
                        key={`${row.createdAt}-${i}`}
                        className="cursor-pointer border-b last:border-0 align-top hover:bg-muted/40"
                        onClick={() => setExpandedFail((n) => (n === i ? null : i))}
                      >
                        <td className="py-2 pr-3 whitespace-nowrap text-xs tabular-nums">
                          {row.createdAt.replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {row.kind}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {row.userId ? row.userId.slice(0, 8) : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-xs",
                            expandedFail === i ? "break-all" : "max-w-md truncate",
                          )}
                        >
                          {row.message ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "pengguna" ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User</CardTitle>
          <CardDescription>
            {total} akun
            {planFilter !== "all" ? ` · filter ${planLabel(planFilter)} di halaman ini` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <Input
              placeholder="Cari email, nama, atau nomor WA"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" size="sm" disabled={loading}>
              Cari
            </Button>
            <div className="flex flex-wrap gap-1">
              {(["all", "active", "trial", "expired", "free"] as const).map((plan) => (
                <Button
                  key={plan}
                  type="button"
                  size="sm"
                  variant={planFilter === plan ? "default" : "outline"}
                  onClick={() => setPlanFilter(plan)}
                >
                  {plan === "all" ? "Semua" : planLabel(plan)}
                </Button>
              ))}
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">WA</th>
                  <th className="px-3 py-2 font-medium">Sheet</th>
                  <th className="px-3 py-2 font-medium">Onboard</th>
                  <th className="px-3 py-2 font-medium">Streak</th>
                  <th className="px-3 py-2 font-medium">Tx hari ini</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">
                        {row.fullName || row.email || row.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        className={cn(
                          row.plan === "active" &&
                            "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                          row.plan === "trial" &&
                            "border-transparent bg-sky-500/15 text-sky-800 dark:text-sky-200",
                          row.plan === "expired" &&
                            "border-transparent bg-amber-500/15 text-amber-900 dark:text-amber-200",
                          row.plan !== "active" &&
                            row.plan !== "trial" &&
                            row.plan !== "expired" &&
                            "border-transparent bg-muted text-muted-foreground",
                        )}
                      >
                        {planLabel(row.plan)}
                      </Badge>
                      {row.expiresAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatLongDate(row.expiresAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.leadPhone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          +{row.leadPhone}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-1.5 rounded-full bg-rose-400" />
                          —
                        </span>
                      )}
                      {row.memberPhones.length > 0 ? (
                        <p className="text-muted-foreground">
                          +{row.memberPhones.length} anggota
                          {row.memberSlotsPaid
                            ? ` · ${row.memberSlotsPaid} slot`
                            : ""}
                        </p>
                      ) : row.memberSlotsPaid ? (
                        <p className="text-muted-foreground">
                          {row.memberSlotsPaid} slot
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium",
                          row.sheetConnected
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-300",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            row.sheetConnected ? "bg-emerald-500" : "bg-rose-400",
                          )}
                        />
                        {row.sheetConnected ? "Terhubung" : "Belum"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.onboarded ? (
                        <span className="text-emerald-700 dark:text-emerald-300">Ya</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">Belum</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {row.habitStreak > 0 ? `🔥 ${row.habitStreak}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {row.txToday > 0 ? (
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">
                          {row.txToday}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <span className="text-muted-foreground">
                {page} / {pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}

function FunnelRow({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", className)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniOkFail({ ok, fail }: { ok: number; fail: number }) {
  const total = ok + fail;
  return (
    <div className="flex min-w-[8rem] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        {total > 0 ? (
          <>
            <div
              className="inline-block h-full bg-emerald-500"
              style={{ width: `${(ok / total) * 100}%` }}
            />
            <div
              className="inline-block h-full bg-rose-500"
              style={{ width: `${(fail / total) * 100}%` }}
            />
          </>
        ) : null}
      </div>
      <span className="shrink-0 tabular-nums text-xs">
        <span className="text-emerald-700 dark:text-emerald-300">{ok}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-rose-600 dark:text-rose-300">{fail}</span>
      </span>
    </div>
  );
}
