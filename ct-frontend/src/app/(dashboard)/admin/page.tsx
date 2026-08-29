"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";

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
import { formatLongDate } from "@/lib/format";
import {
  adminService,
  type AdminOverview,
  type AdminUserRow,
} from "@/services/admin.service";

function planLabel(plan: string): string {
  if (plan === "active") return "Aktif";
  if (plan === "trial") return "Trial";
  if (plan === "expired") return "Kadaluarsa";
  return "Belum berlangganan";
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {hint}
        </CardContent>
      ) : null}
    </Card>
  );
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

  if (error && !overview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Admin
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Shield className="size-6" />
          Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Akun, PDF, onboarding, dan matriks kegagalan (hari ini / 7 hari).
        </p>
      </div>

      {loading && !overview ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Memuat...
        </div>
      ) : null}

      {overview ? (
        <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="User"
            value={overview.users.total}
            hint={`${overview.users.payingOrTrial} trial/aktif · ${overview.users.onboarded} onboard`}
          />
          <Metric
            label="User baru hari ini"
            value={overview.users.newToday}
            hint={`${overview.users.notOnboarded} belum onboard`}
          />
          <Metric
            label="Langganan aktif"
            value={overview.users.active}
            hint={`${overview.users.trial} trial · ${overview.users.expired} kadaluarsa`}
          />
          <Metric
            label="Nomor WhatsApp"
            value={overview.connections.waPhones}
            hint={`${overview.connections.waLeadPhones} pemilik · ${overview.connections.waMemberPhones} anggota`}
          />
          <Metric
            label="Google Sheet"
            value={overview.connections.googleSheet}
            hint={`${overview.connections.phoneWithoutSheet} WA tanpa sheet · ${overview.connections.sheetWithoutPhone} sheet tanpa WA`}
          />
          <Metric
            label="Catat hari ini"
            value={overview.activity.txToday}
            hint={`${overview.activity.usersWithTxToday} user · ${overview.activity.txLast7Days} tx 7 hari`}
          />
          <Metric
            label="PDF WA terkirim"
            value={overview.pdf.waSentToday}
            hint={`${overview.pdf.waSent7d} 7 hari · gagal ${overview.pdf.waSendFailToday} hari ini / ${overview.pdf.waSendFail7d} 7h`}
          />
          <Metric
            label="PDF unduh user"
            value={overview.pdf.exportToday}
            hint={`${overview.pdf.export7d} 7 hari · gagal ${overview.pdf.exportFailToday} / ${overview.pdf.exportFail7d}`}
          />
          <Metric
            label="Gagal generate PDF"
            value={overview.pdf.generateFailToday}
            hint={`${overview.pdf.generateFail7d} 7 hari · OK generate hari ini ${overview.pdf.generateOkToday}`}
          />
          <Metric
            label="Gagal catat"
            value={overview.failures.recordToday}
            hint={`${overview.failures.record7d} 7 hari`}
          />
          <Metric
            label="Gagal parse / struk"
            value={overview.failures.parseToday}
            hint={`${overview.failures.parse7d} 7 hari`}
          />
          <Metric
            label="Gagal boarding"
            value={overview.failures.onboardToday}
            hint={`${overview.failures.onboard7d} 7 hari`}
          />
          <Metric
            label="Gagal reminder"
            value={overview.failures.reminderToday}
            hint={`inbound ${overview.failures.inboundToday} · sheet ${overview.failures.sheetSetupToday}`}
          />
          <Metric
            label="Habis 7 hari"
            value={overview.billing.expiringIn7Days}
            hint="Status aktif, expires ≤ 7 hari"
          />
          <Metric
            label="Slot anggota"
            value={overview.billing.memberSlotsPaid}
            hint="Total slot yang sudah dibayar"
          />
          <Metric
            label="Streak maks"
            value={overview.habit.streakMax}
            hint={`rata-rata ${overview.habit.streakAvg} · ${overview.habit.householdsWithStreak} rumah tangga`}
          />
          <Metric
            label="Pernah kirim PDF (marker)"
            value={overview.pdf.everWeeklyKey}
            hint={`mingguan · ${overview.pdf.everMonthlyKey} bulanan · ${overview.pdf.everTrialKey} trial-end`}
          />
        </div>

        {!overview.failures.tableReady ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Tabel <code>ops_events</code> belum ada. Jalankan{" "}
            <code>ct-frontend/supabase/ops-events.sql</code> di Supabase agar
            matriks kegagalan terisi.
          </p>
        ) : null}

        {overview.matrix.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Matriks event</CardTitle>
              <CardDescription>
                Semua jenis ops (sukses / gagal) hari ini dan 7 hari.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Kind</th>
                    <th className="py-2 pr-3 font-medium">OK hari ini</th>
                    <th className="py-2 pr-3 font-medium">Gagal hari ini</th>
                    <th className="py-2 pr-3 font-medium">OK 7 hari</th>
                    <th className="py-2 font-medium">Gagal 7 hari</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.matrix.map((row) => (
                    <tr key={row.kind} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{row.kind}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.okToday}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.failToday}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.ok7d}</td>
                      <td className="py-2 tabular-nums">{row.fail7d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}

        {overview.recentFails.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gagal terbaru</CardTitle>
              <CardDescription>Pesan error (maks 40, 7 hari).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
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
                  {overview.recentFails.map((row, i) => (
                    <tr key={`${row.createdAt}-${i}`} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-xs tabular-nums">
                        {row.createdAt.replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{row.kind}</td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {row.userId ? row.userId.slice(0, 8) : "—"}
                      </td>
                      <td className="py-2 text-xs break-all">{row.message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User</CardTitle>
          <CardDescription>{total} akun</CardDescription>
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
          </form>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">WA</th>
                  <th className="px-3 py-2 font-medium">Sheet</th>
                  <th className="px-3 py-2 font-medium">Streak</th>
                  <th className="px-3 py-2 font-medium">Tx hari ini</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {row.fullName || row.email || row.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          row.plan === "active" || row.plan === "trial"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {planLabel(row.plan)}
                      </Badge>
                      {row.expiresAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatLongDate(row.expiresAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.leadPhone ? `+${row.leadPhone}` : "—"}
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
                    <td className="px-3 py-2">
                      {row.sheetConnected ? "Ya" : "Tidak"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.habitStreak > 0 ? `🔥 ${row.habitStreak}` : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.txToday}</td>
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
    </div>
  );
}
