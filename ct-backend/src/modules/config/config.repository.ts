import { getSupabaseAdmin } from "../../lib/supabase.js";

export const CATEGORY_COLOR_PALETTE = [
  "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444",
  "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
] as const;

export const DEFAULT_CATEGORIES = [
  { name: "Makanan", keywords: "makan,makanan,nasi,bakso,soto,ayam,kopi,susu,camilan,snack,minum,ketoprak,pecel,rendang,jagung,bakar,mie,makan malam", color: "#ef4444", sort_order: 1 },
  { name: "Transportasi", keywords: "grab,gojek,taxi,bensin,solar,ojek,tol,parkir,bus,tiket,kereta,pesawat", color: "#3b82f6", sort_order: 2 },
  { name: "Belanja", keywords: "belanja,shopee,tokopedia,lazada,market,supermarket,mall,barang,baju,sepatu,elektronik", color: "#8b5cf6", sort_order: 3 },
  { name: "Kesehatan", keywords: "sehat,kesehatan,dokter,obat,rs,rumah sakit,olahraga,gym,kickboxing,vitamin,suplemen", color: "#22c55e", sort_order: 4 },
  { name: "Hiburan", keywords: "hiburan,nonton,cinema,bioskop,game,spotify,netflix,liburan,vacation,hotel,tiket,konser", color: "#f59e0b", sort_order: 5 },
  { name: "Tagihan", keywords: "tagihan,pln,listrik,pdam,air,internet,wifi,pulsa,kuota,cicilan,asuransi,bpjs", color: "#f97316", sort_order: 6 },
  { name: "Pendidikan", keywords: "pendidikan,sekolah,kuliah,buku,kursus,bootcamp,sertifikasi,les", color: "#14b8a6", sort_order: 7 },
  { name: "Lainnya", keywords: "", color: "#94a3b8", sort_order: 99 },
] as const;

export interface CategoryRow {
  id: number;
  user_id: string;
  name: string;
  keywords: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GoogleConnectionRow {
  id: string;
  user_id: string;
  spreadsheet_id: string | null;
  spreadsheet_url: string | null;
  refresh_token: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  connected_at: string;
  updated_at: string;
}

/* ================================
   Helpers
   ================================ */

function sb() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error(
      "[config.repository] Supabase admin client is not initialized — call initSupabase(env) in app.ts before HTTP handlers.",
    );
  }
  return client;
}

function coerceToInt(value: unknown): number {
  if (typeof value === "number") return Math.trunc(value);
  if (typeof value === "bigint") return Number(value);
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function todayJakartaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* ================================
   userConfigRepository
   ================================ */

export const userConfigRepository = {
  async ensure(userId: string) {
    const now = new Date();
    const activeMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const { error } = await sb()
      .from("user_config")
      .upsert(
        { user_id: userId, active_month: activeMonth },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  },

  async getDailyTxUsage(userId: string): Promise<{ count: number; date: string }> {
    const today = todayJakartaDate();

    const { data, error } = await sb()
      .from("user_config")
      .select("daily_tx_count, daily_tx_date")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      await userConfigRepository.ensure(userId);
      return { count: 0, date: today };
    }

    const storedDate = data.daily_tx_date
      ? String(data.daily_tx_date).slice(0, 10)
      : null;

    if (storedDate !== today) {
      return { count: 0, date: today };
    }

    return { count: coerceToInt(data.daily_tx_count), date: today };
  },

  async incrementDailyTx(userId: string): Promise<void> {
    const { error } = await sb().rpc("increment_user_config_daily_tx", {
      p_user_id: userId,
    });
    if (error) throw error;
  },

  async getActiveMonth(userId: string): Promise<string> {
    const { data, error } = await sb()
      .from("user_config")
      .select("active_month")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    if (data?.active_month) return data.active_month;

    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  },

  async getLastEveningReminderDate(userId: string): Promise<string | null> {
    const { data, error } = await sb()
      .from("user_config")
      .select("last_evening_reminder_date")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    if (!data?.last_evening_reminder_date) return null;
    return String(data.last_evening_reminder_date).slice(0, 10);
  },

  async setLastEveningReminderDate(userId: string, date: string): Promise<void> {
    await userConfigRepository.ensure(userId);
    const { error } = await sb()
      .from("user_config")
      .update({ last_evening_reminder_date: date })
      .eq("user_id", userId);
    if (error) throw error;
  },

  async getLastAnalyticsReportKey(userId: string): Promise<string | null> {
    const { data, error } = await sb()
      .from("user_config")
      .select("last_analytics_report_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.last_analytics_report_key ?? null;
  },

  async setLastAnalyticsReportKey(userId: string, reportKey: string): Promise<void> {
    await userConfigRepository.ensure(userId);
    const { error } = await sb()
      .from("user_config")
      .update({ last_analytics_report_key: reportKey })
      .eq("user_id", userId);
    if (error) throw error;
  },

  async getLastTrialEndReportKey(userId: string): Promise<string | null> {
    const { data, error } = await sb()
      .from("user_config")
      .select("last_trial_end_report_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.last_trial_end_report_key ?? null;
  },

  async setLastTrialEndReportKey(userId: string, reportKey: string): Promise<void> {
    await userConfigRepository.ensure(userId);
    const { error } = await sb()
      .from("user_config")
      .update({ last_trial_end_report_key: reportKey })
      .eq("user_id", userId);
    if (error) throw error;
  },
};

/* ================================
   categoriesRepository
   ================================ */

export const categoriesRepository = {
  async seedDefaults(userId: string) {
    const rows = DEFAULT_CATEGORIES.map((cat) => ({
      user_id: userId,
      name: cat.name,
      keywords: cat.keywords,
      color: cat.color,
      sort_order: cat.sort_order,
    }));

    const { error } = await sb()
      .from("categories")
      .upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true });
    if (error) throw error;
  },

  async listByUser(userId: string): Promise<CategoryRow[]> {
    const { data, error } = await sb()
      .from("categories")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      id: coerceToInt(row.id),
      sort_order: coerceToInt(row.sort_order),
      keywords: row.keywords ?? "",
    })) as CategoryRow[];
  },

  async update(
    userId: string,
    id: number,
    data: { keywords?: string; color?: string; name?: string },
  ): Promise<CategoryRow | null> {
    const patch: Record<string, unknown> = {};

    if (data.keywords !== undefined) patch.keywords = data.keywords;
    if (data.color !== undefined) patch.color = data.color;
    if (data.name !== undefined) patch.name = data.name.trim();

    if (Object.keys(patch).length === 0) {
      const cats = await categoriesRepository.listByUser(userId);
      return cats.find((c) => c.id === id) ?? null;
    }

    const { error } = await sb()
      .from("categories")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;

    const cats = await categoriesRepository.listByUser(userId);
    return cats.find((c) => c.id === id) ?? null;
  },

  async create(
    userId: string,
    data: { name: string; keywords?: string; color?: string },
  ): Promise<CategoryRow> {
    const existing = await categoriesRepository.listByUser(userId);
    const maxOrder = existing.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const color =
      data.color ??
      CATEGORY_COLOR_PALETTE[existing.length % CATEGORY_COLOR_PALETTE.length]!;

    const { data: inserted, error } = await sb()
      .from("categories")
      .insert({
        user_id: userId,
        name: data.name.trim(),
        keywords: data.keywords ?? "",
        color,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) throw error;

    return {
      ...inserted,
      id: coerceToInt(inserted.id),
      sort_order: coerceToInt(inserted.sort_order),
      keywords: inserted.keywords ?? "",
    } as CategoryRow;
  },

  async delete(userId: string, id: number): Promise<boolean> {
    const existing = await categoriesRepository.listByUser(userId);
    if (existing.length <= 1) return false;

    const cat = existing.find((c) => c.id === id);
    if (!cat) return false;

    const { error: errBudgets } = await sb()
      .from("budgets")
      .delete()
      .eq("user_id", userId)
      .eq("category", cat.name);
    if (errBudgets) throw errBudgets;

    const { error: errCat } = await sb()
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (errCat) throw errCat;

    return true;
  },
};

/* ================================
   googleConnectionRepository
   ================================ */

export const googleConnectionRepository = {
  async upsert(data: {
    user_id: string;
    refresh_token: string;
    access_token?: string;
    token_expires_at?: Date;
    spreadsheet_id?: string;
    spreadsheet_url?: string;
  }) {
    const { data: existing, error: errSel } = await sb()
      .from("google_connections")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (errSel) throw errSel;

    const merged = {
      user_id: data.user_id,
      refresh_token: data.refresh_token,
      access_token: data.access_token ?? existing?.access_token ?? null,
      token_expires_at:
        data.token_expires_at ?? existing?.token_expires_at ?? null,
      spreadsheet_id: data.spreadsheet_id ?? existing?.spreadsheet_id ?? null,
      spreadsheet_url: data.spreadsheet_url ?? existing?.spreadsheet_url ?? null,
    };

    const { error } = await sb()
      .from("google_connections")
      .upsert(merged, { onConflict: "user_id" });
    if (error) throw error;
  },

  async getByUserId(userId: string): Promise<GoogleConnectionRow | null> {
    const { data, error } = await sb()
      .from("google_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      spreadsheet_id: data.spreadsheet_id,
      spreadsheet_url: data.spreadsheet_url,
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      token_expires_at: data.token_expires_at ?? null,
      connected_at: data.connected_at,
      updated_at: data.updated_at,
    } as GoogleConnectionRow;
  },

  async updateTokens(
    userId: string,
    accessToken: string,
    expiresAt: Date,
  ) {
    const { error } = await sb()
      .from("google_connections")
      .update({ access_token: accessToken, token_expires_at: expiresAt.toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
  },

  async updateSpreadsheet(
    userId: string,
    spreadsheetId: string,
    spreadsheetUrl: string,
  ) {
    const { error } = await sb()
      .from("google_connections")
      .update({ spreadsheet_id: spreadsheetId, spreadsheet_url: spreadsheetUrl })
      .eq("user_id", userId);
    if (error) throw error;
  },
};

/* ================================
   budgetsRepository
   ================================ */

export const budgetsRepository = {
  async listByMonth(userId: string, month: string) {
    const { data, error } = await sb()
      .from("budgets")
      .select("category, amount")
      .eq("user_id", userId)
      .eq("month", month);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      category: row.category,
      amount: coerceToInt(row.amount),
    }));
  },

  async upsert(
    userId: string,
    month: string,
    category: string,
    amount: number,
  ) {
    const { error } = await sb()
      .from("budgets")
      .upsert(
        { user_id: userId, month, category, amount },
        { onConflict: "user_id,month,category" },
      );
    if (error) throw error;
  },

  async upsertMany(
    userId: string,
    month: string,
    items: { category: string; amount: number }[],
  ) {
    for (const item of items) {
      if (item.amount > 0) {
        await budgetsRepository.upsert(userId, month, item.category, item.amount);
      } else {
        const { error } = await sb()
          .from("budgets")
          .delete()
          .eq("user_id", userId)
          .eq("month", month)
          .eq("category", item.category);
        if (error) throw error;
      }
    }
  },
};
