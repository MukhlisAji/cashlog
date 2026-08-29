import type { Env } from "../../config/env.js";
import { errorMessage, recordOpsEvent } from "../../lib/ops-events.js";
import { getSupabaseAdmin } from "../../lib/supabase.js";
import { googleConnectionRepository } from "../config/config.repository.js";
import {
  deleteSheetRow,
  listRecentDeletableRows,
  type DeletableSheetRow,
} from "../sheets/sheet-data.service.js";
import { formatRupiah } from "./wa-sheet-queries.js";

const PENDING_TTL_MS = 3 * 60 * 1000;

type PendingDelete = DeletableSheetRow & { expiresAt: number };

const pendingByUser = new Map<string, PendingDelete>();

export function parseHapusCommand(
  text: string,
  interactiveId: string | null,
): { index: number } | null {
  if (interactiveId === "cmd_hapus") return { index: 1 };
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "hapus terakhir" || normalized === "hapus") {
    return { index: 1 };
  }
  const numbered = normalized.match(/^hapus\s+([1-5])$/);
  if (numbered) return { index: Number(numbered[1]) };
  return null;
}

export function parseHapusConfirm(
  text: string,
  interactiveId: string | null,
): "yes" | "no" | null {
  if (interactiveId === "cmd_hapus_ya") return "yes";
  if (interactiveId === "cmd_hapus_batal") return "no";
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "ya" || normalized === "iya" || normalized === "yes") {
    return "yes";
  }
  if (
    normalized === "tidak" ||
    normalized === "ga" ||
    normalized === "gak" ||
    normalized === "nggak" ||
    normalized === "batal" ||
    normalized === "no"
  ) {
    return "no";
  }
  return null;
}

export function hasPendingHapus(userId: string): boolean {
  const pending = pendingByUser.get(userId);
  if (!pending) return false;
  if (Date.now() > pending.expiresAt) {
    pendingByUser.delete(userId);
    return false;
  }
  return true;
}

export function clearPendingHapus(userId: string): void {
  pendingByUser.delete(userId);
}

function formatPreview(row: DeletableSheetRow, index: number): string {
  const sign = row.type === "income" ? "+" : "-";
  return [
    "Hapus transaksi ini?",
    "",
    `${index}. ${row.date} · ${sign} ${row.item} · Rp ${formatRupiah(row.amount)} · ${row.category}`,
    "",
    "Ketik *ya* untuk hapus, *tidak* untuk batal.",
  ].join("\n");
}

export async function beginHapusPreview(
  env: Env,
  userId: string,
  index: number,
): Promise<{ text: string; confirm: boolean }> {
  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.spreadsheet_id) {
    return {
      text: "⚠️ Google Sheet belum terhubung. Setup dulu di dashboard cashlog.id",
      confirm: false,
    };
  }

  const rows = await listRecentDeletableRows(
    env,
    userId,
    connection.spreadsheet_id,
    5,
  );
  if (rows.length === 0) {
    return { text: "Belum ada transaksi untuk dihapus.", confirm: false };
  }

  const row = rows[index - 1];
  if (!row) {
    return {
      text: `Nomor ${index} tidak ada. Ketik *terakhir* lalu *hapus 1* sampai *hapus ${rows.length}*.`,
      confirm: false,
    };
  }

  pendingByUser.set(userId, { ...row, expiresAt: Date.now() + PENDING_TTL_MS });
  return { text: formatPreview(row, index), confirm: true };
}

async function deleteSupabaseMirror(row: DeletableSheetRow, userId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { data } = await sb
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("amount", row.amount)
    .eq("description", row.item)
    .eq("transaction_date", row.date)
    .order("created_at", { ascending: false })
    .limit(1);
  const id = data?.[0]?.id;
  if (!id) return;
  await sb.from("transactions").delete().eq("id", id);
}

export async function confirmPendingHapus(
  env: Env,
  userId: string,
  decision: "yes" | "no",
): Promise<string> {
  const pending = pendingByUser.get(userId);
  if (!pending || Date.now() > pending.expiresAt) {
    pendingByUser.delete(userId);
    return "Tidak ada hapus yang menunggu. Ketik *hapus terakhir* atau *hapus 1*.";
  }

  if (decision === "no") {
    pendingByUser.delete(userId);
    return "Batal. Transaksi tidak dihapus.";
  }

  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.spreadsheet_id) {
    pendingByUser.delete(userId);
    return "⚠️ Google Sheet belum terhubung.";
  }

  try {
    await deleteSheetRow(
      env,
      userId,
      connection.spreadsheet_id,
      pending.year,
      pending.sheetRow,
    );
    try {
      await deleteSupabaseMirror(pending, userId);
    } catch {
      // Sheet is source of truth.
    }
    pendingByUser.delete(userId);
    void recordOpsEvent({
      kind: "record.delete",
      ok: true,
      userId,
      message: pending.item,
    });
    return `Sudah dihapus: ${pending.item} · Rp ${formatRupiah(pending.amount)}.`;
  } catch (error) {
    pendingByUser.delete(userId);
    void recordOpsEvent({
      kind: "record.delete",
      ok: false,
      userId,
      message: errorMessage(error),
    });
    return "Gagal hapus di Google Sheet. Coba lagi, atau hapus barisnya langsung di Sheet.";
  }
}
