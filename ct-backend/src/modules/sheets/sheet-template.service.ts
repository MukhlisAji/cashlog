import type { sheets_v4 } from "googleapis";

import {
  TRANSACTION_HEADERS,
} from "./sheets.constants.js";

function getCurrentYear(): string {
  return String(new Date().getFullYear());
}

/** Build Summary tab formulas referencing the year tab dynamically */
function buildSummaryValues(year: string): sheets_v4.Schema$ValueRange[] {
  const yearRef = `'${year}'`;

  return [
    {
      // B1: text month "2026-08". Using TEXT(EOMONTH...) keeps it as a string
      // so SUMIFS below can compare against TEXT(tanggal,"yyyy-mm") without
      // Excel serial number coercion issues.
      range: "Summary!A1:B10",
      values: [
        ["BULAN AKTIF", `=TEXT(EOMONTH(TODAY(),-1)+1,"yyyy-mm")`],
        ["", ""],
        [
          "Total Bulan Ini",
          `=SUMIFS(${yearRef}!C:C,ARRAYFORMULA(TEXT(${yearRef}!A:A,"yyyy-mm")),Summary!B1)`,
        ],
        [
          "Jumlah Transaksi",
          `=COUNTIFS(ARRAYFORMULA(TEXT(${yearRef}!A:A,"yyyy-mm")),Summary!B1)`,
        ],
        [
          "Rata-rata per Transaksi",
          `=IF(B4=0,0,ROUND(B3/B4))`,
        ],
        ["Total Tahun " + year, `=SUM(${yearRef}!C:C)`],
        ["", ""],
        [
          "Kategori Terbesar (bulan)",
          `=IFERROR(INDEX(${yearRef}!D:D,MATCH(MAXIFS(${yearRef}!C:C,ARRAYFORMULA(TEXT(${yearRef}!A:A,"yyyy-mm")),Summary!B1),IF(ARRAYFORMULA(TEXT(${yearRef}!A:A,"yyyy-mm"))=Summary!B1,${yearRef}!C:C),0)),"-")`,
        ],
        ["", ""],
        ["Catatan", "Jangan edit baris formula. Transaksi ada di tab " + year],
      ],
    },
  ];
}

/** Shape a Drive-created blank spreadsheet into Summary + year tabs. */
export async function ensureAppSpreadsheetTabs(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  year = getCurrentYear(),
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets ?? [];
  const hasSummary = existing.some((s) => s.properties?.title === "Summary");
  const hasYear = existing.some((s) => s.properties?.title === year);
  const firstSheetId = existing[0]?.properties?.sheetId;

  const requests: sheets_v4.Schema$Request[] = [];

  if (!hasSummary && firstSheetId != null) {
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: firstSheetId,
          title: "Summary",
          index: 0,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: "title,index,gridProperties.frozenRowCount",
      },
    });
  }

  if (!hasYear) {
    requests.push({
      addSheet: {
        properties: {
          title: year,
          index: 1,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  if (requests.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

export async function populateSheetTemplate(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  year = getCurrentYear(),
) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${year}!A1:H1`,
          values: [TRANSACTION_HEADERS as unknown as string[]],
        },
        ...buildSummaryValues(year),
      ],
    },
  });
}

export async function ensureYearTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  year: string,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === year,
  );

  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: year },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${year}!A1:H1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [TRANSACTION_HEADERS as unknown as string[]],
    },
  });

  // Extend Summary total year row if needed — user can add manually; MVP keeps primary year
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
