"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { SettingsSaveButton } from "@/components/settings/settings-save-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showToast } from "@/components/ui/toaster";
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status";
import { NOTICE_MESSAGES } from "@/lib/notice";
import { sheetsService } from "@/services/sheets.service";
import { whatsappService } from "@/services/whatsapp.service";

const PROGRESS_STEPS = [
  "Menyimpan nomor WhatsApp…",
  "Membuat Google Sheet…",
  "Mengaktifkan pencatatan…",
];

interface LeadWhatsAppPhoneFormProps {
  sheetConnected: boolean;
  sheetHasToken: boolean;
  refreshSheet: () => Promise<unknown>;
  onOnboarded?: () => void;
}

export function LeadWhatsAppPhoneForm({
  sheetConnected,
  sheetHasToken,
  refreshSheet,
  onOnboarded,
}: LeadWhatsAppPhoneFormProps) {
  const { status, isConnected, refresh } = useWhatsAppStatus();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setProgressStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setProgressStep((step) => (step + 1) % PROGRESS_STEPS.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function startGoogleOAuth() {
    if (sheetHasToken) {
      const provision = await sheetsService.provisionSheet();
      if (!provision.success) {
        setError(provision.error ?? "Gagal membuat Google Sheet.");
        showToast(
          NOTICE_MESSAGES.save_failed.kind,
          NOTICE_MESSAGES.save_failed.text,
        );
        setLoading(false);
        return;
      }
      await refreshSheet();
      setLoading(false);
      showToast(NOTICE_MESSAGES.saved.kind, NOTICE_MESSAGES.saved.text);
      onOnboarded?.();
      return;
    }

    const oauth = await sheetsService.getOAuthUrl("/settings");
    if (!oauth.success || !oauth.data?.url) {
      setError(oauth.error ?? "Gagal menghubungkan akun Google.");
      showToast(
        NOTICE_MESSAGES.save_failed.kind,
        NOTICE_MESSAGES.save_failed.text,
      );
      setLoading(false);
      return;
    }
    setProgressStep(2);
    window.location.assign(oauth.data.url);
  }

  async function handleSave() {
    if (!isConnected && !phone.trim()) return;
    setLoading(true);
    setError(null);

    if (isConnected && !showChangeForm && !sheetConnected) {
      await startGoogleOAuth();
      return;
    }

    if (phone.trim()) {
      const result = await whatsappService.registerPhone(phone.trim());
      if (!result.success) {
        setLoading(false);
        setError(result.error ?? "Gagal mendaftarkan nomor.");
        showToast(
          NOTICE_MESSAGES.save_failed.kind,
          NOTICE_MESSAGES.save_failed.text,
        );
        return;
      }
      if (result.data?.requiresGoogleAuth && result.data.oauthUrl) {
        setProgressStep(2);
        window.location.assign(result.data.oauthUrl);
        return;
      }
    }

    if (!sheetConnected) {
      await startGoogleOAuth();
      return;
    }

    setLoading(false);
    await refresh();
    await refreshSheet();
    showToast(NOTICE_MESSAGES.saved.kind, NOTICE_MESSAGES.saved.text);
    onOnboarded?.();
  }

  const needsActivation = !isConnected || !sheetConnected;
  const showPhoneInput = !isConnected || showChangeForm;

  return (
    <div className="flex flex-col gap-3">
      {isConnected && status?.phone ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm">
            Nomor kamu terdaftar:{" "}
            <span className="font-semibold">+{status.phone}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChangeForm((open) => !open)}
          >
            Ganti nomor
            <ChevronDown
              className={`size-4 transition-transform ${showChangeForm ? "rotate-180" : ""}`}
            />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Isi nomor WhatsApp, lalu tekan tombol di bawah. Sheet dibuat otomatis
          tanpa minta izin Google lagi.
        </p>
      )}
      {showPhoneInput && (
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="lead-wa-phone">
            {isConnected ? "Nomor WhatsApp baru" : "Nomor WhatsApp"}
          </Label>
          <Input
            id="lead-wa-phone"
            placeholder="08xxxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />
        </div>
      )}
      {needsActivation || showChangeForm ? (
        <SettingsSaveButton
          loading={loading}
          disabled={showPhoneInput && !phone.trim()}
          onClick={() => void handleSave()}
          label="Simpan & Aktifkan"
          loadingLabel={PROGRESS_STEPS[progressStep]}
        />
      ) : null}
      {loading && (
        <p className="text-xs text-muted-foreground transition-opacity duration-300">
          {PROGRESS_STEPS[progressStep]}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
