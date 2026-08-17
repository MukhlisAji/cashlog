"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Smartphone } from "lucide-react";

import { ChatToBotButton } from "@/components/whatsapp/chat-to-bot-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status";
import { sheetsService } from "@/services/sheets.service";
import { whatsappService } from "@/services/whatsapp.service";

interface LeadWhatsAppPhoneFormProps {
  sheetConnected: boolean;
  sheetHasToken: boolean;
  refreshSheet: () => Promise<unknown>;
}

export function LeadWhatsAppPhoneForm({
  sheetConnected,
  sheetHasToken,
  refreshSheet,
}: LeadWhatsAppPhoneFormProps) {
  const { status, isConnected, refresh } = useWhatsAppStatus();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    const result = await whatsappService.registerPhone(phone.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Gagal mendaftarkan nomor.");
      return;
    }
    if (result.data?.requiresGoogleAuth && result.data.oauthUrl) {
      window.location.assign(result.data.oauthUrl);
      return;
    }
    setPhone("");
    setShowChangeForm(false);
    await refresh();
  }

  async function handleSheetRecovery() {
    setSheetLoading(true);
    setError(null);

    if (sheetHasToken) {
      const result = await sheetsService.provisionSheet();
      setSheetLoading(false);
      if (!result.success) {
        setError(result.error ?? "Gagal membuat Google Sheet.");
        return;
      }
      await refreshSheet();
      return;
    }

    const result = await sheetsService.getOAuthUrl("/settings?focus=whatsapp");
    setSheetLoading(false);
    if (!result.success || !result.data?.url) {
      setError(result.error ?? "Gagal menghubungkan akun Google.");
      return;
    }
    window.location.assign(result.data.url);
  }

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
          Daftarkan nomor WhatsApp kamu. Sistem sekaligus akan menghubungkan
          Google dan membuat Sheet jika belum ada.
        </p>
      )}
      {(!isConnected || showChangeForm) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
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
          <Button disabled={loading || !phone.trim()} onClick={() => void handleSave()}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Smartphone className="size-4" />
            )}
            {isConnected ? "Simpan nomor baru" : "Daftarkan"}
          </Button>
        </div>
      )}
      {isConnected && !sheetConnected && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">Google Sheet belum siap</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nomor WhatsApp sudah terdaftar. Selesaikan koneksi Google tanpa
            mendaftarkan ulang nomor.
          </p>
          <Button
            className="mt-3"
            size="sm"
            disabled={sheetLoading}
            onClick={() => void handleSheetRecovery()}
          >
            {sheetLoading && <Loader2 className="size-4 animate-spin" />}
            Hubungkan Google & Buat Sheet
          </Button>
        </div>
      )}
      {!isConnected && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Alternatif: tautkan lewat chat WhatsApp</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Klik tombol di bawah. Pesan verifikasi dengan kode unik sudah
            disiapkan otomatis — tinggal kirim.
          </p>
          <ChatToBotButton
            withLinkCode
            className="mt-3"
            onError={setError}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
