"use client";

import { Suspense, useEffect, useState } from "react";
import { ExternalLink, Zap } from "lucide-react";
import { BudgetsEditor } from "@/components/settings/budgets-editor";
import { CategoriesEditor } from "@/components/settings/categories-editor";
import { HouseholdMembersEditor } from "@/components/settings/household-members-editor";
import {
  SettingsSidebar,
  useSettingsSectionSpy,
} from "@/components/settings/settings-sidebar";
import { PaymentResultBanner } from "@/components/subscription/subscription-banners";
import {
  SubscribeButton,
} from "@/components/subscription/subscribe-button";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSheetStatus } from "@/hooks/use-sheet-status";
import { useSubscription } from "@/hooks/use-subscription";
import { LeadWhatsAppPhoneForm } from "@/components/settings/lead-whatsapp-phone-form";
import { formatTierPrice, getTierLabel } from "@/lib/pricing";
import { subscriptionService } from "@/services/subscription.service";

function SubscriptionCard() {
  const {
    isPro,
    isTrial,
    daysRemaining,
    trialDaysRemaining,
    autoRenewal,
    refresh,
  } = useSubscription();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  let badge = "Trial";
  let description =
    `Trial ${getTierLabel("pro")} 7 hari — catat via WA, scan struk, dan analitik lengkap.`;

  if (isPro && !isTrial) {
    badge = getTierLabel("pro");
    description = `${getTierLabel("pro")} aktif${daysRemaining !== null ? ` · ${daysRemaining} hari tersisa` : ""}`;
  } else if (isTrial) {
    description = `Trial ${getTierLabel("pro")}${trialDaysRemaining !== null ? ` · ${trialDaysRemaining} hari tersisa` : ""}`;
  }

  async function handleCancelRenewal() {
    setCancelLoading(true);
    setCancelMessage(null);
    const result = await subscriptionService.cancelRenewal();
    if (result.success) {
      setCancelMessage(result.message ?? "Perpanjangan otomatis dibatalkan.");
      await refresh();
    } else {
      setCancelMessage(result.error ?? "Gagal membatalkan perpanjangan.");
    }
    setCancelLoading(false);
  }

  return (
    <Card className={isPro ? "border-amber-500/25 bg-amber-500/5" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
        <div>
          <CardTitle className="text-lg font-bold">Langganan</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge variant={isPro || isTrial ? "default" : "secondary"}>{badge}</Badge>
      </CardHeader>
      {(!isPro || isTrial) && (
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <SubscribeButton
            tier="pro"
            label={`${getTierLabel("pro")} ${formatTierPrice("pro")}/bln`}
            onSuccess={() => void refresh()}
          />
        </CardContent>
      )}
      {isPro && !isTrial && (
        <CardContent className="flex flex-col gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {autoRenewal
              ? "Langganan diperpanjang otomatis setiap bulan via Midtrans."
              : "Perpanjangan otomatis tidak aktif — langganan berakhir pada tanggal di atas."}
          </p>
          {autoRenewal && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={cancelLoading}
              onClick={() => void handleCancelRenewal()}
            >
              {cancelLoading ? "Memproses..." : "Batalkan perpanjangan otomatis"}
            </Button>
          )}
          {cancelMessage && (
            <p className="text-xs text-muted-foreground">{cancelMessage}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const {
    status: sheetStatus,
    isConnected: sheetConnected,
    hasToken: sheetHasToken,
    refresh: refreshSheet,
  } = useSheetStatus();
  const [catVersion, setCatVersion] = useState(0);
  const activeSection = useSettingsSectionSpy();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") !== "whatsapp") return;

    params.delete("focus");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}#whatsapp`,
    );
    requestAnimationFrame(() => {
      document.getElementById("whatsapp")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola akun dan koneksi Anda
        </p>
      </div>

      <Suspense fallback={null}>
        <PaymentResultBanner />
      </Suspense>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <SettingsSidebar activeId={activeSection} />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <section id="langganan" className="scroll-mt-24">
            <SubscriptionCard />
          </section>

          <section id="whatsapp" className="scroll-mt-24">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between border-b bg-muted/20">
                <div>
                  <CardTitle className="text-lg font-bold">Aktifkan Pencatatan WhatsApp</CardTitle>
                  <CardDescription>
                    Cukup daftarkan nomor. Sistem otomatis meminta izin Google,
                    membuat Sheet, dan menautkan WhatsApp dalam satu proses.
                  </CardDescription>
                </div>
                <Badge variant={sheetConnected ? "default" : "secondary"}>
                  {sheetConnected ? "Sheet siap" : "Belum aktif"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <Zap className="size-3.5 text-amber-500" />
                    Nomor Bot:{" "}
                    <span className="font-mono">+{siteConfig.whatsappAdminPhone}</span>
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Sheet dibuat di Google Drive kamu. Data transaksi tetap
                    milik kamu dan tidak disimpan sebagai database transaksi kami.
                  </p>
                </div>
                <LeadWhatsAppPhoneForm
                  sheetConnected={sheetConnected}
                  sheetHasToken={sheetHasToken}
                  refreshSheet={refreshSheet}
                />
                {sheetStatus?.spreadsheetUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    nativeButton={false}
                    render={
                      <a
                        href={sheetStatus.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ExternalLink className="size-4" />
                    Buka Google Sheet
                  </Button>
                )}
              </CardContent>
            </Card>
          </section>

          <section id="anggota-keluarga" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg font-bold">Anggota Keluarga</CardTitle>
                <CardDescription>
                  {getTierLabel("pro")} only — add-on maks 5 nomor. Nomor yang di-whitelist
                  menulis ke Sheet yang sama.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HouseholdMembersEditor />
              </CardContent>
            </Card>
          </section>

          <section id="kategori" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg font-bold">Kategori</CardTitle>
                <CardDescription>
                  Edit keyword parser WhatsApp. Tambah/hapus kategori custom —
                  Pro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoriesEditor onChange={() => setCatVersion((v) => v + 1)} />
              </CardContent>
            </Card>
          </section>

          <section id="budget" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg font-bold">Budget Bulanan</CardTitle>
                <CardDescription>
                  Atur alokasi anggaran per kategori — tampil di analitik Budget
                  vs Aktual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BudgetsEditor key={catVersion} />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
