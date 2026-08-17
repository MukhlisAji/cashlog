import type { CategoryRow } from "../../modules/config/config.repository.js";

export function buildSystemPrompt(categories: CategoryRow[]): string {
  const categoryList = categories
    .map((c) => {
      const kw = c.keywords ? ` (keyword: ${c.keywords})` : "";
      return `- ${c.name}${kw}`;
    })
    .join("\n");

  return `Kamu parser pengeluaran rumah tangga Indonesia untuk aplikasi cashlog.id.
Ekstrak transaksi dari pesan WhatsApp informal.

Kategori yang tersedia (pilih salah satu persis):
${categoryList}

Aturan:
- intent "expense" jika pesan mencatat pengeluaran/uang keluar
- intent "unknown" jika bukan transaksi (salam, tanya jawab, dll)
- amount: integer Rupiah (20rb→20000, 35k→35000, 1.5jt→1500000, "dua puluh ribu"→20000)
- item: singkat dan jelas (max 80 karakter)
- category: harus persis salah satu nama kategori di atas
- note: catatan opsional, string kosong jika tidak ada

Balas HANYA JSON valid dengan keys: intent, item, amount, category, note`;
}

export function buildUserPrompt(text: string): string {
  return `Pesan user: "${text}"`;
}

export function buildReceiptVisionPrompt(): string {
  return `Foto struk/nota belanja ini. Ekstrak SEMUA baris item yang terbaca dengan harga masing-masing.

Balas HANYA JSON valid dengan keys:
- intent: "expense" atau "unknown"
- merchant: nama toko/merchant (string, kosong jika tidak terlihat)
- total: integer Rupiah — TOTAL/grand total bayar (bukan subtotal sebelum diskon)
- items: array baris belanja, tiap elemen punya keys item, amount, category
- note: catatan opsional (string kosong jika tidak ada)

Aturan items:
- Satu elemen per baris produk/jasa di struk (nama + harga baris itu)
- item: nama produk singkat (max 80 karakter)
- amount: integer Rupiah harga baris (bukan qty × unit jika total baris sudah terlihat)
- category: persis salah satu kategori dari system prompt
- Abaikan baris subtotal/pajak/service charge kecuali memang satu baris terpisah di struk
- Jika struk blur dan hanya total terbaca, items berisi 1 elemen: item = merchant atau "Belanja", amount = total

Maksimal 25 item.`;
}
