import type { Env } from "../../config/env.js";
import {
  checkSubscription,
} from "../../lib/subscription.js";
import type { MessageContext } from "../household/household.types.js";
import {
  categoriesRepository,
  googleConnectionRepository,
} from "../config/config.repository.js";
import { appendTransaction } from "../sheets/sheet-data.service.js";
import { tryHandleWaCommand } from "../whatsapp/wa-command.service.js";
import {
  extractMessageText,
  hasImageMessage,
} from "../whatsapp/whatsapp.message.utils.js";
import {
  formatRecordedAtLabel,
  getNowJakarta,
} from "../../lib/datetime-jakarta.js";
import {
  parseExpense,
  parseExpenseFromReceipt,
  formatReceiptSaveReply,
  type ExpenseParseResult,
  type ReceiptParseResult,
} from "./parse-expense.service.js";

export type MediaDownloader = (
  message: unknown,
) => Promise<{ buffer: Buffer; mimetype: string } | null>;

export async function processWhatsAppMessage(
  env: Env,
  ctx: MessageContext,
  message: unknown,
  downloadMedia?: MediaDownloader,
): Promise<{ ok: boolean; reply?: string }> {
  const sub = await checkSubscription(ctx.leadUserId);
  if (!sub.allowed) {
    return {
      ok: false,
      reply:
        "⚠️ Akun Anda tidak aktif. Buka dashboard cashlog.id untuk info langganan.",
    };
  }

  const text = extractMessageText(message);
  const imageOnly = hasImageMessage(message) && !text;

  if (imageOnly) {
    if (!sub.canUseReceiptOcr) {
      return {
        ok: false,
        reply:
          "📷 Scan struk foto hanya untuk Pro. Upgrade di dashboard cashlog.id, atau ketik manual: \"Beli kopi 20rb\"",
      };
    }

    return processReceiptImage(env, ctx, message, downloadMedia);
  }

  if (!text) return { ok: false };

  const commandReply = await tryHandleWaCommand(env, ctx.leadUserId, text, sub);
  if (commandReply) {
    return { ok: true, reply: commandReply };
  }

  const connection = await googleConnectionRepository.getByUserId(ctx.leadUserId);
  if (!connection?.spreadsheet_id) {
    return {
      ok: false,
      reply:
        "⚠️ Google Sheet belum terhubung. Buka dashboard cashlog.id untuk setup.",
    };
  }

  const categories = await categoriesRepository.listByUser(ctx.leadUserId);
  const parsed = await parseExpense(env, text, categories);

  if (!parsed) {
    return {
      ok: false,
      reply:
        '❓ Format tidak dikenali. Ketik *bantuan* untuk menu, atau coba: "Beli kopi 20rb"',
    };
  }

  return saveExpense(ctx.leadUserId, connection.spreadsheet_id, parsed, env, {
    source: "whatsapp",
    replyPrefix: "✅ Tercatat",
    recorder: ctx.displayName,
  });
}

async function processReceiptImage(
  env: Env,
  ctx: MessageContext,
  message: unknown,
  downloadMedia?: MediaDownloader,
): Promise<{ ok: boolean; reply?: string }> {
  if (!downloadMedia) {
    return { ok: false, reply: "⚠️ Gagal memproses foto struk." };
  }

  const connection = await googleConnectionRepository.getByUserId(ctx.leadUserId);
  if (!connection?.spreadsheet_id) {
    return {
      ok: false,
      reply:
        "⚠️ Google Sheet belum terhubung. Buka dashboard cashlog.id untuk setup.",
    };
  }

  const media = await downloadMedia(message);
  if (!media) {
    return {
      ok: false,
      reply:
        "📷 Foto tidak terbaca. Coba kirim ulang dengan pencahayaan lebih terang.",
    };
  }

  const categories = await categoriesRepository.listByUser(ctx.leadUserId);
  const parsed = await parseExpenseFromReceipt(
    env,
    media.buffer,
    media.mimetype,
    categories,
  );

  if (!parsed) {
    return {
      ok: false,
      reply:
        "📷 Struk tidak terbaca. Coba foto lebih jelas atau ketik manual: \"Beli kopi 20rb\"",
    };
  }

  return saveReceiptExpenses(
    ctx.leadUserId,
    connection.spreadsheet_id,
    parsed,
    env,
    ctx.displayName,
  );
}

async function saveReceiptExpenses(
  userId: string,
  spreadsheetId: string,
  parsed: ReceiptParseResult,
  env: Env,
  recorder: string,
): Promise<{ ok: boolean; reply: string }> {
  const { date, time } = getNowJakarta();
  const noteParts = [parsed.merchant, parsed.note, "scan struk"].filter(Boolean);
  const note = noteParts.join(" · ");

  for (const line of parsed.items) {
    await appendTransaction(env, userId, spreadsheetId, {
      date,
      time,
      item: line.item,
      amount: line.amount,
      category: line.category,
      source: "whatsapp-receipt",
      note,
      recorder,
    });
  }

  const recordedAt = formatRecordedAtLabel(date, time);

  return {
    ok: true,
    reply: `${formatReceiptSaveReply(parsed)}\n📅 ${recordedAt}`,
  };
}

async function saveExpense(
  userId: string,
  spreadsheetId: string,
  parsed: ExpenseParseResult,
  env: Env,
  options: { source: string; replyPrefix: string; recorder: string },
): Promise<{ ok: boolean; reply: string }> {
  const { date, time } = getNowJakarta();

  await appendTransaction(env, userId, spreadsheetId, {
    date,
    time,
    item: parsed.item,
    amount: parsed.amount,
    category: parsed.category,
    source: options.source,
    note: parsed.note ?? "",
    recorder: options.recorder,
  });

  const formatted = new Intl.NumberFormat("id-ID").format(parsed.amount);
  const recordedAt = formatRecordedAtLabel(date, time);

  return {
    ok: true,
    reply: `${options.replyPrefix}: ${parsed.item} — Rp ${formatted} (${parsed.category})\n📅 ${recordedAt}`,
  };
}
