"use client";

import { useEffect, useState } from "react";
import {
  ChevronUp,
  Loader2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { SettingsSaveButton } from "@/components/settings/settings-save-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHousehold } from "@/hooks/use-household";
import { useSubscription } from "@/hooks/use-subscription";
import {
  formatHouseholdMemberPrice,
  HOUSEHOLD_MEMBER_PRICE,
  MAX_HOUSEHOLD_MEMBER_SLOTS,
} from "@/lib/pricing";
import { NOTICE_MESSAGES } from "@/lib/notice";
import { sanitizePhoneInput } from "@/lib/phone";
import { householdService } from "@/services/household.service";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function HouseholdMembersEditor({
  openAddOnMount = false,
}: {
  openAddOnMount?: boolean;
}) {
  const { isPro, isTrial, canManageHousehold } = useSubscription();
  const { household, isLoading, refresh } = useHousehold();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [addSlotsInput, setAddSlotsInput] = useState("1");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPurchase, setConfirmPurchase] = useState(false);
  const [confirmSlotTarget, setConfirmSlotTarget] = useState<number | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeName, setConfirmRevokeName] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(openAddOnMount);
  const [notifyDraft, setNotifyDraft] = useState({
    notifyMembersReminder: true,
    notifyMembersWeekly: false,
    notifyMembersMonthly: false,
  });
  const [notifySaving, setNotifySaving] = useState(false);

  useEffect(() => {
    if (!household) return;
    setNotifyDraft({
      notifyMembersReminder: household.notifyMembersReminder,
      notifyMembersWeekly: household.notifyMembersWeekly,
      notifyMembersMonthly: household.notifyMembersMonthly,
    });
  }, [
    household?.notifyMembersReminder,
    household?.notifyMembersWeekly,
    household?.notifyMembersMonthly,
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Memuat...
      </div>
    );
  }

  if (!canManageHousehold && !isTrial && !isPro) {
    return (
      <p className="text-sm text-muted-foreground">
        Fitur anggota keluarga hanya tersedia di paket Pro. Upgrade langganan
        untuk menambahkan istri/anak ke sheet yang sama.
      </p>
    );
  }

  const addCount = Number(addSlotsInput);
  const slotsPaid = household?.memberSlotsPaid ?? 0;
  const activeCount = household?.activeMemberCount ?? 0;
  const newTotalSlots = slotsPaid + addCount;
  const maxAdd = MAX_HOUSEHOLD_MEMBER_SLOTS - slotsPaid;
  const canAddSlots =
    Number.isInteger(addCount) &&
    addCount >= 1 &&
    newTotalSlots <= MAX_HOUSEHOLD_MEMBER_SLOTS;
  const monthlyTotal = newTotalSlots * HOUSEHOLD_MEMBER_PRICE;

  async function executePurchaseSlots(targetTotal: number) {
    if (!Number.isInteger(targetTotal) || targetTotal < 0 || targetTotal > MAX_HOUSEHOLD_MEMBER_SLOTS) {
      setError(`Total slot harus 0–${MAX_HOUSEHOLD_MEMBER_SLOTS}.`);
      setConfirmPurchase(false);
      setConfirmSlotTarget(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await householdService.checkoutSlots(targetTotal);
    setLoading(false);
    setConfirmPurchase(false);
    setConfirmSlotTarget(null);

    if (!result.success) {
      setError(result.error ?? "Gagal membeli slot.");
      showToast("error", result.error ?? "Gagal membeli slot.");
      return;
    }

    if (result.data?.checkoutUrl) {
      window.location.href = result.data.checkoutUrl;
      return;
    }

    let okText: string;
    if (targetTotal === 0) {
      okText = "Slot anggota dinonaktifkan.";
    } else if (targetTotal > slotsPaid) {
      okText = `${targetTotal - slotsPaid} slot ditambahkan. Total ${targetTotal} slot aktif.`;
    } else {
      okText = `Slot dikurangi. Total sekarang ${targetTotal} slot.`;
    }
    setMessage(okText);
    showToast("success", okText);
    setAddSlotsInput("1");
    await refresh();
  }

  function openAddSlotsConfirm() {
    if (!canAddSlots) {
      setError(
        maxAdd <= 0
          ? `Sudah maksimal ${MAX_HOUSEHOLD_MEMBER_SLOTS} slot.`
          : `Masukkan 1–${maxAdd} slot tambahan.`,
      );
      return;
    }
    setError(null);
    setConfirmSlotTarget(newTotalSlots);
    setConfirmPurchase(true);
  }

  async function handleAdd() {
    if (!displayName.trim() || !phone.trim()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await householdService.addMember(displayName.trim(), phone.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Gagal menambahkan anggota.");
      showToast("error", result.error ?? "Gagal menambahkan anggota.");
      return;
    }

    setDisplayName("");
    setPhone("");
    const okText = `${result.data?.displayName ?? "Anggota"} terdaftar. Kami kirim pesan selamat datang via WhatsApp.`;
    setMessage(okText);
    showToast("success", okText);
    await refresh();
  }

  async function executeRevoke(memberId: string) {
    setLoading(true);
    setError(null);

    const result = await householdService.revokeMember(memberId);
    setLoading(false);
    setConfirmRevokeId(null);
    setConfirmRevokeName("");

    if (!result.success) {
      setError(result.error ?? "Gagal mencabut anggota.");
      showToast("error", result.error ?? "Gagal mencabut anggota.");
      return;
    }

    const okText = "Anggota dicabut dan 1 slot dinonaktifkan.";
    setMessage(okText);
    showToast("success", okText);
    await refresh();
  }

  const notifyDirty =
    !!household &&
    (notifyDraft.notifyMembersReminder !== household.notifyMembersReminder ||
      notifyDraft.notifyMembersWeekly !== household.notifyMembersWeekly ||
      notifyDraft.notifyMembersMonthly !== household.notifyMembersMonthly);

  async function handleSaveNotify() {
    setNotifySaving(true);
    setError(null);
    const result = await householdService.updateNotifyFlags(notifyDraft);
    setNotifySaving(false);

    if (!result.success) {
      setError(result.error ?? "Gagal menyimpan pengaturan WhatsApp anggota.");
      showToast(
        NOTICE_MESSAGES.save_failed.kind,
        result.error ?? NOTICE_MESSAGES.save_failed.text,
      );
      return;
    }

    await refresh();
    showToast(
      NOTICE_MESSAGES.saved.kind,
      "Pengaturan WhatsApp anggota tersimpan.",
    );
  }

  const hasMembers = (household?.members.length ?? 0) > 0;
  const slotConfirmTarget = confirmSlotTarget ?? 0;
  const isReducingSlots =
    slotConfirmTarget < slotsPaid && slotConfirmTarget > 0;
  const isDeactivatingSlots = slotConfirmTarget === 0;
  const addedSlots = slotConfirmTarget - slotsPaid;

  return (
    <>
      <div className="flex flex-col gap-5">
        {!showAddPanel ? (
          <div className="flex flex-col gap-2">
            {hasMembers && (
              <p className="text-sm text-muted-foreground">
                {activeCount} anggota · {slotsPaid} slot aktif
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setShowAddPanel(true)}
            >
              <UserPlus className="size-4" />
              Tambah anggota keluarga
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <Users className="size-4" />
                  Slot anggota keluarga (add-on)
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={() => setShowAddPanel(false)}
                >
                  <ChevronUp className="size-4" />
                  Tutup
                </Button>
              </div>
              <p className="mt-2 text-muted-foreground">
                {formatHouseholdMemberPrice()}/bulan per anggota (maks{" "}
                {MAX_HOUSEHOLD_MEMBER_SLOTS}). Daftarkan nomor WA mereka — semua
                transaksi masuk ke Sheet yang sama.
              </p>
              <p className="mt-2">
                Slot aktif:{" "}
                <span className="font-medium">{slotsPaid}</span> · Terpakai:{" "}
                <span className="font-medium">{activeCount}</span>
              </p>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="add-slots" className="text-xs">
                    Tambah berapa slot?
                  </Label>
                  <Input
                    id="add-slots"
                    type="number"
                    min={1}
                    max={Math.max(1, maxAdd)}
                    value={addSlotsInput}
                    onChange={(e) => setAddSlotsInput(e.target.value)}
                    className="w-24"
                    disabled={maxAdd <= 0}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading || !canAddSlots}
                  onClick={openAddSlotsConfirm}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    `Tambah ${canAddSlots ? addCount : ""} slot`
                  )}
                </Button>
              </div>
              {canAddSlots && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {slotsPaid} slot sekarang + {addCount} ={" "}
                  <span className="font-medium text-foreground">
                    {newTotalSlots} slot total
                  </span>{" "}
                  ({formatRupiah(monthlyTotal)}/bulan)
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Whitelist nomor anggota</Label>
              <Input
                placeholder="Nama (contoh: Istri)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading || !household?.canInviteMember}
              />
              <Input
                placeholder="08xxxxxxxxxx"
                inputMode="numeric"
                maxLength={13}
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                disabled={loading || !household?.canInviteMember}
              />
              <SettingsSaveButton
                loading={loading}
                disabled={
                  !household?.canInviteMember ||
                  !displayName.trim() ||
                  !phone.trim()
                }
                onClick={() => void handleAdd()}
                label="Daftarkan"
              />
              {!household?.canInviteMember && slotsPaid === 0 && (
                <p className="text-xs text-muted-foreground">
                  Beli slot anggota dulu sebelum menambahkan.
                </p>
              )}
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {household && canManageHousehold ? (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">WhatsApp ke anggota</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kamu sebagai pemilik selalu menerima. Toggle ini hanya untuk
                nomor anggota — tanpa link Google Sheet.
              </p>
            </div>
            {(
              [
                {
                  key: "notifyMembersReminder" as const,
                  label: "Reminder malam (21.00 WIB)",
                  hint: "Default aktif. Pengingat harian ke semua anggota.",
                },
                {
                  key: "notifyMembersWeekly" as const,
                  label: "Insight Senin (PDF)",
                  hint: "Laporan mingguan. Default mati.",
                },
                {
                  key: "notifyMembersMonthly" as const,
                  label: "Laporan bulanan (PDF)",
                  hint: "Dikirim tanggal 1 untuk bulan sebelumnya. Default mati.",
                },
              ] as const
            ).map((row) => (
              <label
                key={row.key}
                className="flex cursor-pointer items-start gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={notifyDraft[row.key]}
                  disabled={notifySaving || loading}
                  onChange={(e) => {
                    setNotifyDraft((current) => ({
                      ...current,
                      [row.key]: e.target.checked,
                    }));
                  }}
                />
                <span>
                  <span className="font-medium">{row.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.hint}
                  </span>
                </span>
              </label>
            ))}
            <SettingsSaveButton
              loading={notifySaving}
              disabled={!notifyDirty}
              onClick={() => void handleSaveNotify()}
              label="Simpan pengaturan WhatsApp"
            />
          </div>
        ) : null}

        {hasMembers && (
          <ul className="divide-y rounded-lg border">
            {household?.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{member.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.phone ? `+${member.phone}` : "Nomor belum diisi"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Terdaftar</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={loading}
                    onClick={() => {
                      setConfirmRevokeId(member.id);
                      setConfirmRevokeName(member.displayName);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmPurchase}
        title={
          isDeactivatingSlots
            ? "Nonaktifkan slot anggota?"
            : isReducingSlots
              ? "Kurangi slot anggota?"
              : "Konfirmasi tambah slot"
        }
        description={
          isDeactivatingSlots
            ? "Slot anggota akan dinonaktifkan."
            : isReducingSlots
              ? `Slot akan diturunkan dari ${slotsPaid} ke ${slotConfirmTarget}.`
              : `Tambah ${addedSlots} slot (${slotsPaid} → ${slotConfirmTarget} total). Tagihan: ${formatRupiah(slotConfirmTarget * HOUSEHOLD_MEMBER_PRICE)}.`
        }
        confirmLabel={isDeactivatingSlots ? "Nonaktifkan" : "Bayar sekarang"}
        loading={loading}
        onCancel={() => {
          setConfirmPurchase(false);
          setConfirmSlotTarget(null);
        }}
        onConfirm={() => {
          if (confirmSlotTarget !== null) {
            void executePurchaseSlots(confirmSlotTarget);
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmRevokeId}
        title="Cabut anggota?"
        description={`${confirmRevokeName} tidak bisa lagi mencatat ke sheet keluarga. 1 slot anggota juga akan dinonaktifkan.`}
        confirmLabel="Ya, cabut"
        loading={loading}
        onCancel={() => {
          setConfirmRevokeId(null);
          setConfirmRevokeName("");
        }}
        onConfirm={() => {
          if (confirmRevokeId) void executeRevoke(confirmRevokeId);
        }}
      />
    </>
  );
}
