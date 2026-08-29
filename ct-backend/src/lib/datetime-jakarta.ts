const JAKARTA_TZ = "Asia/Jakarta";
// Excel epoch: 1899-12-30 (historical Lotus 1-2-3 bug, preserved by Excel / Google Sheets)
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Excel/Google Sheets serial date → JS Date (UTC).
 * Serial 1 → 1899-12-31; fractional part is time-of-day UTC.
 */
export function excelSerialToUtcDate(serial: number): Date {
  const wholeDays = Math.floor(serial);
  const dayFraction = serial - wholeDays;
  const wholeDaysMs = wholeDays * MS_PER_DAY;
  // Round time to nearest ms to avoid floating point drift around 0.99998 → 23:59:59.998
  const timeMs = Math.round(dayFraction * MS_PER_DAY);
  return new Date(EXCEL_EPOCH_UTC + wholeDaysMs + timeMs);
}

/** Format UTC-based JS Date to Asia/Jakarta YYYY-MM-DD. */
function formatJakartaIsoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Format UTC-based JS Date to Asia/Jakarta HH:mm:ss in 24h. */
function formatJakartaIsoTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const second = parts.find((p) => p.type === "second")?.value ?? "00";
  return `${hour}:${minute}:${second}`;
}

/**
 * Normalize a raw date cell value coming from Google Sheets.
 * Accepts Excel serial numbers, ISO-ish strings, or plain strings.
 * Returns object with date (YYYY-MM-DD), month (YYYY-MM — derived from date
 * alone — since the sheet no longer stores a separate month column), and
 * optionally time.
 */
export function normalizeSheetCellDateTime(
  rawDate: unknown,
  rawTime?: unknown,
): { date: string; month: string; time: string | null } {
  // Numeric serial date from UNFORMATTED_VALUE — the most common case.
  if (typeof rawDate === "number" && Number.isFinite(rawDate)) {
    // Excel serial time alone (0 < x < 1 without date) — treat as today Jakarta date.
    const isTimeOnly = rawDate > 0 && rawDate < 1;
    const base = isTimeOnly ? 0 : Math.trunc(rawDate);
    const frac = isTimeOnly ? rawDate : rawDate - Math.trunc(rawDate);

    let dateObj: Date;
    if (base === 0) {
      // No date serial — derive date from today Jakarta, apply time fraction
      const todayIso = getNowJakarta().date;
      dateObj = excelSerialToUtcDate(0);
      const [y, m, d] = todayIso.split("-").map(Number);
      dateObj = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
      dateObj = new Date(dateObj.getTime() + Math.round(frac * MS_PER_DAY));
    } else {
      dateObj = excelSerialToUtcDate(rawDate);
    }

    const date = formatJakartaIsoDate(dateObj);
    // Separate time from rawTime if explicitly provided (column G),
    // otherwise fall back to the fractional part of serial date.
    let time: string | null = null;
    if (typeof rawTime === "number" && Number.isFinite(rawTime)) {
      time = formatJakartaIsoTime(excelSerialToUtcDate(rawTime));
    } else if (typeof rawTime === "string" && rawTime.trim()) {
      time = rawTime.trim();
    } else if (frac > 0) {
      time = formatJakartaIsoTime(dateObj);
    }
    return { date, month: date.slice(0, 7), time };
  }

  // String path (already ISO, or raw text)
  const strDate = String(rawDate ?? "").trim();
  const strTime =
    typeof rawTime === "string"
      ? rawTime.trim() || null
      : typeof rawTime === "number" && Number.isFinite(rawTime)
        ? formatJakartaIsoTime(excelSerialToUtcDate(rawTime))
        : null;

  if (/^\d{4}-\d{2}-\d{2}/.test(strDate)) {
    return {
      date: strDate.slice(0, 10),
      month: strDate.slice(0, 7),
      time: strTime,
    };
  }

  return { date: strDate, month: strDate.slice(0, 7), time: strTime };
}

/**
 * @deprecated Since sheet no longer stores a standalone "month" column.
 * Left here so older callers that explicitly name a `month` derived value (e.g.,
 * when reading legacy sheets) — extract the first 7 chars of the ISO date instead.
 */
export function normalizeSheetCellMonth(_rawMonth: unknown): string {
  const raw = _rawMonth;
  if (typeof raw === "string") {
    const trim = raw.trim();
    if (/^\d{4}-\d{2}/.test(trim)) return trim.slice(0, 7);
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return formatJakartaIsoDate(excelSerialToUtcDate(raw)).slice(0, 7);
  }
  return String(raw ?? "").slice(0, 7);
}

export interface JakartaDateTime {
  date: string;
  month: string;
  time: string;
}

export function getNowJakarta(): JakartaDateTime {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = timeParts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  const second = timeParts.find((p) => p.type === "second")?.value ?? "00";

  return {
    date,
    month: date.slice(0, 7),
    time: `${hour}:${minute}:${second}`,
  };
}

/** @deprecated Use getNowJakarta() */
export function getTodayJakarta(): { date: string; month: string } {
  const { date, month } = getNowJakarta();
  return { date, month };
}

export function formatRecordedAtLabel(date: string, time: string): string {
  const datePart = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+07:00`));

  const timeShort = time.slice(0, 5);
  return `${datePart} · ${timeShort} WIB`;
}

/** Previous calendar day for a YYYY-MM-DD date string. */
export function previousJakartaDate(yyyyMmDd: string): string {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000;
  const d = new Date(utc);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function formatTransactionLineMeta(
  date: string,
  time?: string | null,
): string {
  const datePart = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+07:00`));

  if (time) {
    return `${datePart} · ${time.slice(0, 5)} WIB`;
  }

  return datePart;
}

