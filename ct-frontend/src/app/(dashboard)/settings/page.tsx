"use client";

import { Suspense, useEffect, useState } from "react";
import { ExternalLink, Zap } from "lucide-react";
import { BudgetsEditor } from "@/components/settings/budgets-editor";
import { CategoriesEditor } from "@/components/settings/categories-editor";
import { HouseholdMembersEditor } from "@/components/settings/household-members-editor";
import {
  SETTINGS_SECTIONS,
  SettingsSidebar,
  useSettingsSectionSpy,
  type SettingsSectionId,
} from "@/components/settings/settings-sidebar";
import { PaymentResultBanner } from "@/components/subscription/subscription-banners";
import { SubscribeButton } from "@/components/subscription/subscribe-button";
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
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status";
import { LeadWhatsAppPhoneForm } from "@/components/settings/lead-whatsapp-phone-form";
import { showToast } from "@/components/ui/toaster";
import { NOTICE_MESSAGES } from "@/lib/notice";
import { formatLongDate } from "@/lib/format";
import { formatTierPrice, getTierLabel } from "@/lib/pricing";
import { subscriptionService } from "@/services/subscription.service";

function SubscriptionCard() {
  const {
    isPro,
    isTrial,
    daysRemaining,
    trialDaysRemaining,
    expiresAt,
    autoRenewal,
    refresh,
  } = useSubscription();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const expiresLabel = formatLongDate(expiresAt);

  let badge = "Trial";
  let description =
    `Trial ${getTierLabel("pro")} 7 hari — catat via WA, scan struk, dan analitik lengkap.`;

  if (isPro && !isTrial) {
    badge = getTierLabel("pro");
    description = [
      `${getTierLabel("pro")} aktif`,
      daysRemaining !== null ? `${daysRemaining} hari tersisa` : null,
      expiresLabel ? `berakhir ${expiresLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (isTrial) {
    description = [
      `Trial ${getTierLabel("pro")}`,
      trialDaysRemaining !== null ? `${trialDaysRemaining} hari tersisa` : null,
      expiresLabel ? `berakhir ${expiresLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
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
        <CardContent className="flex flex-col gap-2">
          <SubscribeButton
            tier="pro"
            fullWidth
            className="h-10"
            label={`${getTierLabel("pro")} ${formatTierPrice("pro")}/bln`}
            onSuccess={() => void refresh()}
          />
        </CardContent>
      )}
      {isPro && !isTrial && (
        <CardContent className="flex flex-col gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {autoRenewal
              ? expiresLabel
                ? `Perpanjangan otomatis aktif. Tagihan berikutnya sekitar ${expiresLabel}.`
                : "Langganan diperpanjang otomatis setiap bulan via Midtrans."
              : expiresLabel
                ? `Perpanjangan otomatis tidak aktif — akses berakhir ${expiresLabel}.`
                : "Perpanjangan otomatis tidak aktif."}
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
  const { isConnected: waConnected } = useWhatsAppStatus();
  const [catVersion, setCatVersion] = useState(0);
  const [inviteFamily, setInviteFamily] = useState(false);
  const leadOnboarded = (sheetConnected && waConnected) || inviteFamily;

  const sectionIds = SETTINGS_SECTIONS.map((s) => s.id).filter((id) =>
    id === "anggota-keluarga" ? leadOnboarded : true,
  ) as SettingsSectionId[];
  const activeSection = useSettingsSectionSpy(sectionIds);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromSheetOauth = params.get("sheet") === "connected";
    const focusWhatsApp = params.get("focus") === "whatsapp";

    if (fromSheetOauth) {
      params.delete("sheet");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
      setInviteFamily(true);
      showToast(
        NOTICE_MESSAGES.sheet_connected.kind,
        NOTICE_MESSAGES.sheet_connected.text,
      );
      return;
    }

    if (!focusWhatsApp) return;

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

  useEffect(() => {
    if (!inviteFamily || !leadOnboarded) return;
    requestAnimationFrame(() => {
      document
        .getElementById("anggota-keluarga")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [inviteFamily, leadOnboarded]);

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
        <SettingsSidebar activeId={activeSection} sectionIds={sectionIds} />

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
                    Isi nomor WhatsApp, lalu tekan Simpan & Aktifkan.
                    Google Sheet dibuat otomatis jika izin sudah diberikan saat login.
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
                  onOnboarded={() => {
                    setInviteFamily(true);
                    showToast(
                      NOTICE_MESSAGES.linked.kind,
                      NOTICE_MESSAGES.linked.text,
                    );
                  }}
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

          {leadOnboarded ? (
          <section id="anggota-keluarga" className="scroll-mt-24">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg font-bold">Anggota Keluarga</CardTitle>
                <CardDescription>
                  Pencatatan kamu sudah aktif. Tambah nomor istri/anak agar mereka
                  menulis ke Google Sheet yang sama (add-on, maks 5).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HouseholdMembersEditor openAddOnMount={inviteFamily} />
              </CardContent>
            </Card>
          </section>
          ) : null}

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
