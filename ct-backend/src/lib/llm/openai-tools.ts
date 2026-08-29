import type { CategoryRow } from "../../modules/config/config.repository.js";
import { getNowJakarta } from "../datetime-jakarta.js";

export type TransactionKind = "expense" | "income";

export interface ParsedLayer3Transaction {
  type: TransactionKind;
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
  note: string;
}

export interface ProcessTransactionsToolArgs {
  kind: "process_transactions";
  dynamic_greeting: string;
  transactions: ParsedLayer3Transaction[];
  needs_amount: string[];
}

export interface CasualChatToolArgs {
  kind: "casual_chat";
  reply_text: string;
}

export type Layer3ToolResult = ProcessTransactionsToolArgs | CasualChatToolArgs;

export const PROCESS_TRANSACTIONS_TOOL = {
  type: "function" as const,
  function: {
    name: "process_transactions",
    description:
      "Parses one or multiple financial events (expense and/or income) from the user's message. Always capture every monetary event in the text.",
    parameters: {
      type: "object",
      properties: {
        dynamic_greeting: {
          type: "string",
          description:
            "Short casual Indonesian confirmation, max 8 words. Vary the wording. Examples: 'Oke, udah kecatat.' 'Masuk ya.' 'Siap.' 'Kecatat.' 'Oke, masuk.' Never reuse the same phrase every time.",
        },
        transactions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["expense", "income"],
                description:
                  "expense = uang keluar. income = uang masuk (gaji, transfer, bonus). Both may appear in one message.",
              },
              amount: { type: "number" },
              category: { type: "string" },
              description: {
                type: "string",
                description:
                  "Nama barang/jasa singkat (max 80). Jangan taruh alasan/konteks di sini.",
              },
              note: {
                type: "string",
                description:
                  "Konteks opsional yang bukan nama item: alasan, siapa, tempat. Contoh: 'naqi menangis'. Kosongkan jika tidak ada. Jangan duplikat description.",
              },
              transaction_date: {
                type: "string",
                description: "YYYY-MM-DD",
              },
            },
            required: [
              "type",
              "amount",
              "category",
              "description",
              "transaction_date",
            ],
          },
        },
        needs_amount: {
          type: "array",
          items: { type: "string" },
          description: "Always return an empty array. Never ask the user for missing item prices.",
        },
      },
      required: ["dynamic_greeting", "transactions", "needs_amount"],
    },
  },
};

export const CASUAL_CHAT_TOOL = {
  type: "function" as const,
  function: {
    name: "casual_chat",
    description:
      "Triggered when the user says hello, thanks, or talks about non-financial topics.",
    parameters: {
      type: "object",
      properties: {
        reply_text: {
          type: "string",
          description: "A natural, brief response.",
        },
      },
      required: ["reply_text"],
    },
  },
};

function clipGreeting(raw: unknown, fallback: string): string {
  let greeting = typeof raw === "string" ? raw.trim() : fallback;
  const words = greeting.split(/\s+/).filter(Boolean);
  if (words.length > 8) greeting = words.slice(0, 8).join(" ");
  return greeting || fallback;
}

function parseAmount(value: unknown): number {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(String(value).replace(/[^\d.-]/g, ""))
        : NaN;
  return amount;
}

function parseOneTransaction(
  item: unknown,
  fallbackDate: string,
): ParsedLayer3Transaction | null {
  if (!item || typeof item !== "object") return null;
  const data = item as Record<string, unknown>;
  const amount = parseAmount(data.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5_000_000_000) {
    return null;
  }

  const type: TransactionKind = data.type === "income" ? "income" : "expense";
  const description =
    typeof data.description === "string" && data.description.trim()
      ? data.description.trim().slice(0, 80)
      : type === "income"
        ? "Pemasukan"
        : "Pengeluaran";
  const category =
    typeof data.category === "string" && data.category.trim()
      ? data.category.trim()
      : type === "income"
        ? "Pemasukan"
        : "Lainnya";
  const dateRaw =
    typeof data.transaction_date === "string" ? data.transaction_date.trim() : "";
  const transaction_date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : fallbackDate;
  const note =
    typeof data.note === "string" && data.note.trim()
      ? data.note.trim().slice(0, 200)
      : "";

  return {
    type,
    amount: Math.round(amount),
    category,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    transaction_date,
    note,
  };
}

function parseProcessArgs(raw: string): ProcessTransactionsToolArgs | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const fallbackDate = getNowJakarta().date;
    const list = Array.isArray(data.transactions) ? data.transactions : [];
    const transactions = list
      .map((item) => parseOneTransaction(item, fallbackDate))
      .filter((item): item is ParsedLayer3Transaction => item !== null);
    const needs_amount = Array.isArray(data.needs_amount)
      ? data.needs_amount
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 80))
      : [];
    if (transactions.length === 0 && needs_amount.length === 0) return null;
    if (transactions.length === 0) {
      return {
        kind: "process_transactions",
        dynamic_greeting: clipGreeting(data.dynamic_greeting, "Sebentar ya"),
        transactions: [],
        needs_amount,
      };
    }
    return {
      kind: "process_transactions",
      dynamic_greeting: clipGreeting(data.dynamic_greeting, "Oke, masuk."),
      transactions,
      needs_amount,
    };
  } catch {
    return null;
  }
}

function parseCasualArgs(raw: string): CasualChatToolArgs | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const reply =
      typeof data.reply_text === "string" ? data.reply_text.trim().slice(0, 500) : "";
    if (!reply) return null;
    return { kind: "casual_chat", reply_text: reply };
  } catch {
    return null;
  }
}

function buildToolSystemPrompt(
  categories: CategoryRow[],
  options?: { allowCasual?: boolean; oocCount?: number },
): string {
  const names = categories.map((c) => c.name).join(", ");
  const today = getNowJakarta().date;
  const oocCount = options?.oocCount ?? 0;
  const isLastCasual = options?.allowCasual !== false && oocCount >= 2;
  const casualHint = isLastCasual
    ? `Percakapan santai ini yang terakhir. reply_text harus natural: tanggapi isi chat user, lalu alihkan halus ke mencatat pengeluaran/pemasukan. Contoh nada: "Asik juga. Kalo ada yang mau dicatet, ketik aja kayak makan 25rb ya." Jangan sebut batas, kuota, sesi, atau peringatan dalam kurung.`
    : `reply_text boleh ramah singkat. Jangan ceramah panjang.`;
  return `Kamu asisten pencatat keuangan cashlog.id.
Hari ini (Asia/Jakarta): ${today}.
Kategori pengeluaran yang valid: ${names || "Lainnya"}.
Untuk pemasukan gunakan type=income dan category=Pemasukan (atau kategori yang disebut user).
Jika pesan berisi belanjaan/transaksi, WAJIB panggil process_transactions.
amount angka Rupiah (20rb=20000, 35k=35000, 1.5jt=1500000).
transaction_date YYYY-MM-DD; default hari ini.
note: konteks/alasan yang BUKAN nama barang. Contoh: "beli balon tiup, naqi menangis. 15k" → description="Balon tiup" note="Naqi menangis". "Makan siang 50rb" → note="". Jangan isi note dengan daftar belanja.

Aturan bundling (WAJIB):
Jika user menyebut beberapa barang tapi HANYA ada SATU total harga, JANGAN pecah jadi beberapa transaksi.
Gabung jadi SATU object transaction.
description: ringkasan item dipisah koma (contoh: "Pasta gigi, sabun mandi" atau "Kangkung, cabe, bawang").
amount: total yang disebut user.
category: payung yang masuk akal dari daftar kategori (biasanya Belanja).
Contoh: "pasta gigi dan sabun mandi 53k" → satu transaksi description="Pasta gigi, sabun mandi" amount=53000.
Contoh: "beli kangkung, cabe, bawang 50rb" → satu transaksi description="Kangkung, cabe, bawang" amount=50000.
Kalau item tanpa harga tapi ada total di pesan yang sama, anggap itu satu bundle. Jangan tanya harga satuan. needs_amount selalu [].
Hanya pecah ke beberapa transaksi jika user memberi harga terpisah untuk kelompok yang berbeda (contoh: "bakso 45k, grab 20rb"), ATAU jika ada pemasukan dan pengeluaran dalam satu pesan.

3. Multi-type extraction (income & expense dalam satu pesan) — WAJIB:
Satu pesan bisa berisi uang keluar (expense) DAN uang masuk (income) sekaligus. Kamu HARUS mengekstrak SETIAP peristiwa keuangan di teks. Jangan berhenti setelah menemukan satu jenis.
Sinyal income: gaji, transferan, transfer, dapet, dapat, masuk, honor, bonus, refund, dikasih, diterima, jual.
Contoh: "Makan siang 50k, terus dapet transferan bos 5jt"
→ dua object:
  {type:"expense", amount:50000, category:"Makanan", description:"Makan siang"}
  {type:"income", amount:5000000, category:"Pemasukan", description:"Transferan bos"}
Contoh: "Makan 50k, dapet transferan bos 5jt" → expense 50000 + income 5000000.
Scan seluruh pesan sampai semua nominal dan niat (keluar/masuk) tertangkap.

dynamic_greeting: konfirmasi pendek, bahasa Indonesia santai, maksimal 8 kata. Ganti-ganti: "Oke, udah kecatat." / "Masuk ya." / "Siap." / "Kecatat." / "Oke, masuk." Jangan selalu kalimat yang sama. Jangan terdengar seperti sistem.
Jika pesan sapaan, terima kasih, atau topik non-keuangan, panggil casual_chat.
reply_text: bahasa Indonesia santai, 1-2 kalimat, tanpa format sistem.
${casualHint}
Jangan membalas teks bebas.`;
}

export async function callLayer3Tools(
  apiKey: string,
  model: string,
  userText: string,
  categories: CategoryRow[],
  options?: { allowCasual?: boolean; oocCount?: number },
): Promise<Layer3ToolResult | null> {
  const allowCasual = options?.allowCasual !== false;
  const tools = allowCasual
    ? [PROCESS_TRANSACTIONS_TOOL, CASUAL_CHAT_TOOL]
    : [PROCESS_TRANSACTIONS_TOOL];
  const lastCasual = allowCasual && (options?.oocCount ?? 0) >= 2;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: lastCasual ? 0.6 : 0,
      tool_choice: "required",
      tools,
      messages: [
        { role: "system", content: buildToolSystemPrompt(categories, options) },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI tools error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: {
      message?: {
        tool_calls?: Array<{
          function?: { name?: string; arguments?: string };
        }>;
      };
    }[];
  };

  const calls = json.choices?.[0]?.message?.tool_calls ?? [];
  const processCall = calls.find((item) => item.function?.name === "process_transactions");
  if (processCall?.function?.arguments) {
    return parseProcessArgs(processCall.function.arguments);
  }

  const casualCall = calls.find((item) => item.function?.name === "casual_chat");
  if (allowCasual && casualCall?.function?.arguments) {
    return parseCasualArgs(casualCall.function.arguments);
  }

  return null;
}

const VISION_OCR_SYSTEM_PROMPT = `You are an expert OCR and financial data extractor. Look at this receipt, extract all purchased items, calculate their individual amounts, map them to standard categories (e.g., Food & Beverage, Groceries), and call the process_transactions tool.`;

export async function callProcessTransactionsFromVision(
  apiKey: string,
  categories: CategoryRow[],
  imageBase64: string,
  mimeType: string,
  caption?: string,
): Promise<ProcessTransactionsToolArgs | null> {
  const names = categories.map((c) => c.name).join(", ");
  const today = getNowJakarta().date;
  const mime = mimeType.startsWith("image/") ? mimeType : "image/jpeg";
  const userText = [
    VISION_OCR_SYSTEM_PROMPT,
    `Hari ini (Asia/Jakarta): ${today}.`,
    `Kategori yang valid: ${names || "Lainnya, Makanan, Belanja"}.`,
    "Pecah baris struk hanya jika masing-masing punya harga sendiri. Kalau struk punya satu total, catat satu transaksi dengan description ringkasan item.",
    "amount dalam Rupiah (angka). type=expense kecuali jelas pemasukan.",
    "note: nama toko atau caption user yang bukan nama item; kosongkan jika tidak ada.",
    caption?.trim() ? `Caption user: ${caption.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      tool_choice: {
        type: "function",
        function: { name: "process_transactions" },
      },
      tools: [PROCESS_TRANSACTIONS_TOOL],
      messages: [
        { role: "system", content: userText },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all line items from this receipt and call process_transactions.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI vision error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: {
      message?: {
        tool_calls?: Array<{
          function?: { name?: string; arguments?: string };
        }>;
      };
    }[];
  };

  const processCall = json.choices?.[0]?.message?.tool_calls?.find(
    (item) => item.function?.name === "process_transactions",
  );
  if (!processCall?.function?.arguments) return null;
  return parseProcessArgs(processCall.function.arguments);
}
