import type { Env } from "../../config/env.js";
import { formatRecordedAtLabel, getNowJakarta } from "../../lib/datetime-jakarta.js";
import {
  callLayer3Tools,
  callProcessTransactionsFromVision,
  type ParsedLayer3Transaction,
  type ProcessTransactionsToolArgs,
} from "../../lib/llm/openai-tools.js";
import { checkSubscription } from "../../lib/subscription.js";
import { getSupabaseAdmin } from "../../lib/supabase.js";
import {
  categoriesRepository,
  googleConnectionRepository,
} from "../config/config.repository.js";
import type { MessageContext } from "../household/household.types.js";
import { householdRepository } from "../household/household.repository.js";
import {
  appendTransactions,
  type TransactionRow,
} from "../sheets/sheet-data.service.js";
import {
  extractIncomingImageMediaId,
  extractInteractiveCommandId,
  type MetaIncomingMessageEnvelope,
  type MetaService,
} from "./meta-cloud.service.js";
import {
  claimWhatsAppLinkCode,
  parseWhatsAppLinkCode,
} from "./wa-link-code.service.js";
import { tryHandleWaCommand } from "./wa-command.service.js";
import { claimUnregisteredNotice } from "./wa-message-dedup.js";

const FAST_PATH_RE = /\b(bantuan|help|menu|\?|hari ini|ringkasan|terakhir)\b/i;
const HAS_AMOUNT_HINT_RE = /\d/;

const UNREGISTERED_REPLY =
  "Nomor kamu belum terdaftar. Buka https://cashlog.id/settings → isi nomor WhatsApp → Simpan & Aktifkan Pencatatan.";

const FIRST_ONBOARDING_REPLY = [
  "Halo! Selamat datang di Cashlog.id.",
  "Biar lebih personal, simpan nomor ini dengan nama *Catatanku* atau asisten keuanganmu.",
  "Kamu bisa mulai mencatat dengan mengetik natural seperti *Makan siang 50rb*.",
  "Ketik *menu* kapan saja untuk bantuan.",
].join("\n");

const OOC_LOCKED_REPLY =
  "Aku lebih jago bantu catat keuangan. Kirim transaksi kayak *makan 25rb*, atau ketik *menu* ya.";

const MENU_BODY = [
  "Pilih perintah di bawah, atau ketik transaksi natural.",
  'Contoh: "Makan siang 50rb"',
].join("\n");

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount);
}

function resolveCategory(
  raw: string,
  names: string[],
  type: "expense" | "income",
): string {
  if (type === "income") {
    if (raw && names.includes(raw)) return raw;
    const match = names.find((name) => name.toLowerCase() === raw.toLowerCase());
    return match ?? "Pemasukan";
  }
  if (names.includes(raw)) return raw;
  const match = names.find((name) => name.toLowerCase() === raw.toLowerCase());
  return match ?? (names.includes("Lainnya") ? "Lainnya" : names[0] ?? "Lainnya");
}

function commandFromFastPath(text: string, interactiveId: string | null): string | null {
  if (interactiveId?.startsWith("cmd_")) {
    const mapped: Record<string, string> = {
      cmd_menu: "bantuan",
      cmd_hari_ini: "hari ini",
      cmd_ringkasan: "ringkasan",
      cmd_terakhir: "terakhir",
    };
    return mapped[interactiveId] ?? null;
  }

  const cleaned = text.trim().toLowerCase();
  const match = cleaned.match(FAST_PATH_RE);
  if (!match) return null;
  const token = match[1].toLowerCase();
  if (token === "help" || token === "menu" || token === "?") return "bantuan";
  return token;
}

async function getHasOnboarded(userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return true;
  const { data } = await sb
    .from("profiles")
    .select("has_onboarded")
    .eq("id", userId)
    .maybeSingle();
  return data?.has_onboarded === true;
}

async function markOnboarded(userId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  await sb
    .from("profiles")
    .update({ has_onboarded: true, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

async function getOocCount(userId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { data } = await sb
    .from("profiles")
    .select("ooc_count")
    .eq("id", userId)
    .maybeSingle();
  const n = Number(data?.ooc_count ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function setOocCount(userId: string, count: number): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  await sb
    .from("profiles")
    .update({ ooc_count: count, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

async function incrementOocCount(userId: string): Promise<number> {
  const next = Math.min((await getOocCount(userId)) + 1, 3);
  await setOocCount(userId, next);
  return next;
}

async function insertSupabaseTransactions(
  userId: string,
  recorder: string,
  items: Array<{
    type: "expense" | "income";
    amount: number;
    category: string;
    description: string;
    transaction_date: string;
  }>,
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || items.length === 0) return;
  const { error } = await sb.from("transactions").insert(
    items.map((item) => ({
      user_id: userId,
      type: item.type,
      amount: item.amount,
      category: item.category,
      description: item.description,
      transaction_date: item.transaction_date,
      source: "whatsapp",
      recorder,
    })),
  );
  if (error) {
    throw error;
  }
}

function formatBulkReply(
  greeting: string,
  items: Array<{
    type: "expense" | "income";
    amount: number;
    category: string;
    description: string;
    transaction_date: string;
  }>,
  time: string,
): string {
  const lines = items.map((item) => {
    const sign = item.type === "income" ? "+" : "-";
    return `${sign} *${item.description}*  Rp ${formatRupiah(item.amount)}  (${item.category})`;
  });
  const firstDate = items[0]?.transaction_date;
  return [
    greeting,
    items.length ? "" : "",
    ...lines,
    firstDate && items.length ? `📅 ${formatRecordedAtLabel(firstDate, time)}` : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();
}

async function sendMenu(meta: MetaService, waId: string): Promise<void> {
  try {
    await meta.sendInteractiveList(waId, MENU_BODY, "Lihat menu", [
      { id: "cmd_hari_ini", title: "Hari ini", description: "Total catatan hari ini" },
      { id: "cmd_ringkasan", title: "Ringkasan", description: "Total bulan ini" },
      { id: "cmd_terakhir", title: "Terakhir", description: "5 transaksi terbaru" },
    ]);
  } catch {
    await meta.sendWhatsAppMessage(
      waId,
      [
        "📋 *Menu cashlog.id*",
        'Ketik: "Makan siang 50rb"',
        "• *hari ini* — total hari ini",
        "• *ringkasan* — total bulan ini",
        "• *terakhir* — 5 transaksi terbaru",
      ].join("\n"),
    );
  }
}

async function sendCommandWithButtons(
  meta: MetaService,
  waId: string,
  body: string,
): Promise<void> {
  try {
    await meta.sendInteractiveButtons(waId, body, [
      { id: "cmd_hari_ini", title: "Hari ini" },
      { id: "cmd_ringkasan", title: "Ringkasan" },
      { id: "cmd_menu", title: "Menu" },
    ]);
  } catch {
    await meta.sendWhatsAppMessage(waId, body);
  }
}

/**
 * 3-layer WhatsApp router. HTTP 200 to Meta is already sent by the webhook
 * controller; returning here only stops further processing (no OpenAI).
 */
export async function routeIncomingWhatsAppMessage(
  env: Env,
  meta: MetaService,
  msg: MetaIncomingMessageEnvelope,
): Promise<void> {
  const typing = await meta.beginTyping(msg.messageId);
  try {
    await routeIncomingWhatsAppMessageInner(env, meta, msg);
  } finally {
    typing.stop();
  }
}

async function routeIncomingWhatsAppMessageInner(
  env: Env,
  meta: MetaService,
  msg: MetaIncomingMessageEnvelope,
): Promise<void> {
  const linkCode = parseWhatsAppLinkCode(msg.body);
  if (linkCode) {
    try {
      const userId = await claimWhatsAppLinkCode(linkCode, msg.waId);
      await meta.sendWhatsAppMessage(
        msg.waId,
        userId
          ? "✅ Nomor WhatsApp berhasil ditautkan. Sekarang kirim transaksi, misalnya: Makan siang 50rb"
          : "❌ Kode tidak valid, sudah dipakai, kedaluwarsa, atau nomor ini terdaftar di akun lain. Buat kode baru di Pengaturan.",
      );
    } catch {
      await meta.sendWhatsAppMessage(
        msg.waId,
        "⚠️ Gagal menautkan nomor. Coba buat kode baru di Pengaturan.",
      );
    }
    return;
  }

  const ctx = await householdRepository.getActiveByPhone(msg.waId);
  if (!ctx) {
    if (!(await claimUnregisteredNotice(msg.waId))) {
      return;
    }
    await meta.sendWhatsAppMessage(msg.waId, UNREGISTERED_REPLY);
    return;
  }

  const sub = await checkSubscription(ctx.leadUserId);
  if (!sub.allowed) {
    await meta.sendWhatsAppMessage(
      msg.waId,
      "Masa aktif langganan sudah habis. Perpanjang di cashlog.id/settings untuk lanjut mencatat.",
    );
    return;
  }

  const onboarded = await getHasOnboarded(ctx.leadUserId);
  if (!onboarded) {
    await meta.sendWhatsAppMessage(msg.waId, FIRST_ONBOARDING_REPLY);
    await markOnboarded(ctx.leadUserId);
    return;
  }

  if (msg.type === "image") {
    await runReceiptVision(env, meta, ctx, msg);
    return;
  }

  const interactiveId = extractInteractiveCommandId(msg.raw);
  const text = msg.body?.trim() ?? "";
  const fastCommand = commandFromFastPath(text, interactiveId);

  if (fastCommand) {
    if (fastCommand === "bantuan") {
      await sendMenu(meta, msg.waId);
      return;
    }
    const reply = await tryHandleWaCommand(env, ctx.leadUserId, fastCommand, sub);
    if (reply) {
      await sendCommandWithButtons(meta, msg.waId, reply);
    }
    return;
  }

  if (!text) return;

  await runAiBrain(env, meta, ctx, msg.waId, text);
}

async function runAiBrain(
  env: Env,
  meta: MetaService,
  ctx: MessageContext,
  waId: string,
  text: string,
): Promise<void> {
  const oocCount = await getOocCount(ctx.leadUserId);
  const looksFinancial = HAS_AMOUNT_HINT_RE.test(text);

  if (oocCount >= 3 && !looksFinancial) {
    await meta.sendWhatsAppMessage(waId, OOC_LOCKED_REPLY);
    return;
  }

  if (!env.OPENAI_API_KEY) {
    await meta.sendWhatsAppMessage(
      waId,
      "⚠️ Parser AI belum dikonfigurasi. Coba lagi nanti.",
    );
    return;
  }

  const connection = await googleConnectionRepository.getByUserId(ctx.leadUserId);
  if (!connection?.spreadsheet_id) {
    await meta.sendWhatsAppMessage(
      waId,
      "⚠️ Google Sheet belum terhubung. Buka dashboard cashlog.id untuk setup.",
    );
    return;
  }

  const categories = await categoriesRepository.listByUser(ctx.leadUserId);
  const allowCasual = oocCount < 3;

  let parsed;
  try {
    parsed = await callLayer3Tools(
      env.OPENAI_API_KEY,
      env.OPENAI_MODEL,
      text,
      categories,
      { allowCasual, oocCount },
    );
  } catch {
    await meta.sendWhatsAppMessage(
      waId,
      '❓ Belum bisa membaca transaksi itu. Coba: "Makan siang 50rb"',
    );
    return;
  }

  if (!parsed) {
    if (!allowCasual) {
      await meta.sendWhatsAppMessage(waId, OOC_LOCKED_REPLY);
      return;
    }
    await meta.sendWhatsAppMessage(
      waId,
      '❓ Format tidak dikenali. Ketik *menu* atau coba: "Makan siang 50rb"',
    );
    return;
  }

  if (parsed.kind === "casual_chat") {
    await incrementOocCount(ctx.leadUserId);
    await meta.sendWhatsAppMessage(waId, parsed.reply_text);
    return;
  }

  const reply = await persistProcessedTransactions(
    env,
    ctx,
    connection.spreadsheet_id,
    categories.map((c) => c.name),
    parsed,
  );
  await meta.sendWhatsAppMessage(waId, reply);
}

async function runReceiptVision(
  env: Env,
  meta: MetaService,
  ctx: MessageContext,
  msg: MetaIncomingMessageEnvelope,
): Promise<void> {
  const mediaId = extractIncomingImageMediaId(msg.raw);
  if (!mediaId) {
    await meta.sendWhatsAppMessage(
      msg.waId,
      "⚠️ Foto struk tidak bisa dibaca. Kirim ulang gambarnya.",
    );
    return;
  }

  if (!env.OPENAI_API_KEY) {
    await meta.sendWhatsAppMessage(
      msg.waId,
      "⚠️ Parser struk belum dikonfigurasi. Coba lagi nanti.",
    );
    return;
  }

  const connection = await googleConnectionRepository.getByUserId(ctx.leadUserId);
  if (!connection?.spreadsheet_id) {
    await meta.sendWhatsAppMessage(
      msg.waId,
      "⚠️ Google Sheet belum terhubung. Buka dashboard cashlog.id untuk setup.",
    );
    return;
  }

  const media = await meta.downloadMedia(mediaId);
  if (!media?.buffer?.length) {
    await meta.sendWhatsAppMessage(
      msg.waId,
      "⚠️ Gagal mengunduh foto dari WhatsApp. Kirim ulang struknya.",
    );
    return;
  }

  const categories = await categoriesRepository.listByUser(ctx.leadUserId);
  const imageBase64 = media.buffer.toString("base64");

  let parsed: ProcessTransactionsToolArgs | null;
  try {
    parsed = await callProcessTransactionsFromVision(
      env.OPENAI_API_KEY,
      categories,
      imageBase64,
      media.mimetype,
      msg.body ?? undefined,
    );
  } catch {
    await meta.sendWhatsAppMessage(
      msg.waId,
      "❓ Struk belum terbaca. Pastikan fotonya jelas, atau ketik transaksinya.",
    );
    return;
  }

  if (!parsed) {
    await meta.sendWhatsAppMessage(
      msg.waId,
      "❓ Tidak ada item yang bisa diekstrak dari struk. Coba foto lebih dekat.",
    );
    return;
  }

  const reply = await persistProcessedTransactions(
    env,
    ctx,
    connection.spreadsheet_id,
    categories.map((c) => c.name),
    parsed,
  );
  await meta.sendWhatsAppMessage(msg.waId, reply);
}

async function persistProcessedTransactions(
  env: Env,
  ctx: MessageContext,
  spreadsheetId: string,
  categoryNames: string[],
  parsed: ProcessTransactionsToolArgs,
): Promise<string> {
  const { time } = getNowJakarta();
  const normalized: ParsedLayer3Transaction[] = parsed.transactions.map((item) => ({
    ...item,
    category: resolveCategory(item.category, categoryNames, item.type),
  }));

  if (normalized.length === 0) {
    return formatBulkReply(parsed.dynamic_greeting || "Siap", [], time);
  }

  const sheetRows: TransactionRow[] = normalized.map((item) => ({
    date: item.transaction_date,
    time,
    item: item.description,
    amount: item.amount,
    category: item.category,
    source: "whatsapp",
    note: [item.type === "income" ? "income" : "", item.note]
      .filter(Boolean)
      .join(" · "),
    recorder: ctx.displayName,
  }));

  try {
    await insertSupabaseTransactions(ctx.leadUserId, ctx.displayName, normalized);
  } catch {
    // Table may not exist until SQL is applied; Sheet remains a backup write.
  }

  await appendTransactions(env, ctx.leadUserId, spreadsheetId, sheetRows);
  await setOocCount(ctx.leadUserId, 0);
  return formatBulkReply(parsed.dynamic_greeting, normalized, time);
}
