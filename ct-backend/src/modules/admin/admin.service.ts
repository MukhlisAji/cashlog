import { getNowJakarta } from "../../lib/datetime-jakarta.js";
import { getSupabaseAdmin } from "../../lib/supabase.js";

function sb() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

function addDays(yyyyMmDd: string, delta: number): string {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) + delta * 24 * 60 * 60 * 1000;
  const d = new Date(utc);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function countEq(
  table: string,
  column: string,
  value: string | boolean,
): Promise<number> {
  const { count, error } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

async function countAll(table: string): Promise<number> {
  const { count, error } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

type OpsCountFn = (kind: string, ok: boolean, todayOnly: boolean) => number;

async function summarizeOpsEvents(
  client: ReturnType<typeof sb>,
  today: string,
  weekAgoDate: string,
): Promise<{
  tableReady: boolean;
  count: OpsCountFn;
  matrix: {
    kind: string;
    okToday: number;
    failToday: number;
    ok7d: number;
    fail7d: number;
  }[];
  recentFails: {
    createdAt: string;
    kind: string;
    userId: string | null;
    message: string | null;
  }[];
}> {
  const todayStart = `${today}T00:00:00+07:00`;
  const weekStart = `${weekAgoDate}T00:00:00+07:00`;
  const empty = {
    tableReady: false,
    count: (() => 0) as OpsCountFn,
    matrix: [] as {
      kind: string;
      okToday: number;
      failToday: number;
      ok7d: number;
      fail7d: number;
    }[],
    recentFails: [] as {
      createdAt: string;
      kind: string;
      userId: string | null;
      message: string | null;
    }[],
  };

  const { data, error } = await client
    .from("ops_events")
    .select("kind, ok, message, user_id, created_at")
    .gte("created_at", weekStart)
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error) return empty;

  const rows = (data ?? []) as {
    kind: string;
    ok: boolean;
    message: string | null;
    user_id: string | null;
    created_at: string;
  }[];

  const map = new Map<
    string,
    { okToday: number; failToday: number; ok7d: number; fail7d: number }
  >();

  for (const row of rows) {
    const isToday = row.created_at >= todayStart;
    const cur = map.get(row.kind) ?? {
      okToday: 0,
      failToday: 0,
      ok7d: 0,
      fail7d: 0,
    };
    if (row.ok) {
      cur.ok7d += 1;
      if (isToday) cur.okToday += 1;
    } else {
      cur.fail7d += 1;
      if (isToday) cur.failToday += 1;
    }
    map.set(row.kind, cur);
  }

  const count: OpsCountFn = (kind, ok, todayOnly) => {
    const cur = map.get(kind);
    if (!cur) return 0;
    if (ok) return todayOnly ? cur.okToday : cur.ok7d;
    return todayOnly ? cur.failToday : cur.fail7d;
  };

  return {
    tableReady: true,
    count,
    matrix: [...map.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    recentFails: rows
      .filter((row) => row.ok === false)
      .slice(0, 40)
      .map((row) => ({
        createdAt: row.created_at,
        kind: row.kind,
        userId: row.user_id,
        message: row.message,
      })),
  };
}

async function countNotNull(table: string, column: string): Promise<number> {
  const { count, error } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .not(column, "is", null);
  if (error) return 0;
  return count ?? 0;
}

export async function getAdminOverview() {
  const { date } = getNowJakarta();
  const weekAgoDate = addDays(date, -6);
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const client = sb();

  const [
    users,
    trial,
    active,
    expired,
    free,
    onboarded,
    notOnboarded,
    newUsersToday,
    sheetRows,
    leadPhones,
    memberPhones,
    txToday,
    txWeek,
    txTodayRows,
    expiring,
    households,
    weeklyPdfEver,
    monthlyPdfEver,
    trialPdfEver,
    leadsWithPhone,
    sheetsWithId,
  ] = await Promise.all([
    countAll("profiles"),
    countEq("profiles", "subscription_status", "trial"),
    countEq("profiles", "subscription_status", "active"),
    countEq("profiles", "subscription_status", "expired"),
    countEq("profiles", "subscription_status", "free"),
    countEq("profiles", "has_onboarded", true),
    countEq("profiles", "has_onboarded", false),
    client
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${date}T00:00:00+07:00`),
    client
      .from("google_connections")
      .select("*", { count: "exact", head: true })
      .not("spreadsheet_id", "is", null),
    client
      .from("household_members")
      .select("*", { count: "exact", head: true })
      .eq("role", "lead")
      .eq("status", "active")
      .not("phone_number", "is", null),
    client
      .from("household_members")
      .select("*", { count: "exact", head: true })
      .eq("role", "member")
      .eq("status", "active")
      .not("phone_number", "is", null),
    client
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("transaction_date", date),
    client
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .gte("transaction_date", weekAgoDate),
    client
      .from("transactions")
      .select("user_id")
      .eq("transaction_date", date),
    client
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "active")
      .gt("subscription_expires_at", now)
      .lte("subscription_expires_at", soon),
    client
      .from("households")
      .select("habit_streak, member_slots_paid"),
    countNotNull("user_config", "last_analytics_report_key"),
    countNotNull("user_config", "last_monthly_report_key"),
    countNotNull("user_config", "last_trial_end_report_key"),
    client
      .from("household_members")
      .select("household_id")
      .eq("role", "lead")
      .eq("status", "active")
      .not("phone_number", "is", null),
    client
      .from("google_connections")
      .select("user_id")
      .not("spreadsheet_id", "is", null),
  ]);

  const streaks = (households.data ?? []) as {
    habit_streak?: number;
    member_slots_paid?: number;
  }[];
  const streakValues = streaks.map((h) => Number(h.habit_streak ?? 0));
  const streakActive = streakValues.filter((n) => n > 0).length;
  const streakMax = streakValues.reduce((m, n) => Math.max(m, n), 0);
  const streakAvg =
    streakValues.length === 0
      ? 0
      : Math.round(
          (streakValues.reduce((s, n) => s + n, 0) / streakValues.length) * 10,
        ) / 10;
  const slotsPaid = streaks.reduce(
    (s, h) => s + Number(h.member_slots_paid ?? 0),
    0,
  );

  const usersWithTxToday = new Set(
    (txTodayRows.data ?? []).map((row) => String(row.user_id)),
  ).size;

  const sheetIds = new Set(
    (sheetsWithId.data ?? []).map((row) => String(row.user_id)),
  );
  let phoneWithoutSheet = 0;
  let sheetWithoutPhone = 0;
  const phoneIds = new Set(
    (leadsWithPhone.data ?? []).map((row) => String(row.household_id)),
  );
  for (const id of phoneIds) {
    if (!sheetIds.has(id)) phoneWithoutSheet += 1;
  }
  for (const id of sheetIds) {
    if (!phoneIds.has(id)) sheetWithoutPhone += 1;
  }

  const ops = await summarizeOpsEvents(client, date, weekAgoDate);

  return {
    generatedAt: new Date().toISOString(),
    users: {
      total: users,
      trial,
      active,
      expired,
      free,
      onboarded,
      notOnboarded,
      newToday: newUsersToday.count ?? 0,
      payingOrTrial: trial + active,
    },
    connections: {
      googleSheet: sheetRows.count ?? 0,
      waLeadPhones: leadPhones.count ?? 0,
      waMemberPhones: memberPhones.count ?? 0,
      waPhones: (leadPhones.count ?? 0) + (memberPhones.count ?? 0),
      phoneWithoutSheet,
      sheetWithoutPhone,
    },
    activity: {
      txToday: txToday.count ?? 0,
      txLast7Days: txWeek.count ?? 0,
      usersWithTxToday,
    },
    billing: {
      expiringIn7Days: expiring.count ?? 0,
      memberSlotsPaid: slotsPaid,
    },
    habit: {
      householdsWithStreak: streakActive,
      streakMax,
      streakAvg,
    },
    pdf: {
      waSentToday: ops.count("pdf.send", true, true),
      waSent7d: ops.count("pdf.send", true, false),
      waSendFailToday: ops.count("pdf.send", false, true),
      waSendFail7d: ops.count("pdf.send", false, false),
      exportToday: ops.count("pdf.export", true, true),
      export7d: ops.count("pdf.export", true, false),
      exportFailToday: ops.count("pdf.export", false, true),
      exportFail7d: ops.count("pdf.export", false, false),
      generateOkToday: ops.count("pdf.generate", true, true),
      generateFailToday: ops.count("pdf.generate", false, true),
      generateFail7d: ops.count("pdf.generate", false, false),
      everWeeklyKey: weeklyPdfEver,
      everMonthlyKey: monthlyPdfEver,
      everTrialKey: trialPdfEver,
    },
    failures: {
      recordToday: ops.count("record", false, true),
      record7d: ops.count("record", false, false),
      parseToday:
        ops.count("parse", false, true) + ops.count("parse.receipt", false, true),
      parse7d:
        ops.count("parse", false, false) + ops.count("parse.receipt", false, false),
      onboardToday:
        ops.count("onboard.lead", false, true) +
        ops.count("onboard.member", false, true),
      onboard7d:
        ops.count("onboard.lead", false, false) +
        ops.count("onboard.member", false, false),
      reminderToday: ops.count("reminder", false, true),
      reminder7d: ops.count("reminder", false, false),
      inboundToday: ops.count("inbound", false, true),
      inbound7d: ops.count("inbound", false, false),
      sheetSetupToday: ops.count("sheet.setup", false, true),
      sheetSetup7d: ops.count("sheet.setup", false, false),
      tableReady: ops.tableReady,
    },
    matrix: ops.matrix,
    recentFails: ops.recentFails,
  };
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  plan: string;
  expiresAt: string | null;
  createdAt: string;
  onboarded: boolean;
  sheetConnected: boolean;
  leadPhone: string | null;
  memberPhones: string[];
  memberSlotsPaid: number;
  habitStreak: number;
  txToday: number;
};

export async function listAdminUsers(query: {
  q?: string;
  page?: number;
}): Promise<{ users: AdminUserRow[]; page: number; pageSize: number; total: number }> {
  const pageSize = 50;
  const page = Math.max(1, query.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = (query.q?.trim() ?? "").replace(/[%_,]/g, "");
  const { date } = getNowJakarta();
  const client = sb();

  let profileQuery = client
    .from("profiles")
    .select(
      "id, email, full_name, subscription_status, subscription_expires_at, created_at, has_onboarded",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (q) {
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 8) {
      const { data: phones } = await client
        .from("household_members")
        .select("household_id")
        .eq("status", "active")
        .ilike("phone_number", `%${digits}%`);
      const ids = [...new Set((phones ?? []).map((p) => String(p.household_id)))];
      if (ids.length === 0) {
        return { users: [], page, pageSize, total: 0 };
      }
      profileQuery = profileQuery.in("id", ids);
    } else {
      profileQuery = profileQuery.or(
        `email.ilike.%${q}%,full_name.ilike.%${q}%`,
      );
    }
  }

  const { data: profiles, error, count } = await profileQuery.range(from, to);
  if (error) throw error;

  const ids = (profiles ?? []).map((p) => String(p.id));
  if (ids.length === 0) {
    return { users: [], page, pageSize, total: count ?? 0 };
  }

  const [sheets, houses, members, todayTx] = await Promise.all([
    client
      .from("google_connections")
      .select("user_id, spreadsheet_id")
      .in("user_id", ids),
    client
      .from("households")
      .select("id, member_slots_paid, habit_streak")
      .in("id", ids),
    client
      .from("household_members")
      .select("household_id, role, phone_number, status")
      .in("household_id", ids)
      .eq("status", "active"),
    client
      .from("transactions")
      .select("user_id")
      .in("user_id", ids)
      .eq("transaction_date", date),
  ]);

  const sheetSet = new Set(
    (sheets.data ?? [])
      .filter((row) => row.spreadsheet_id)
      .map((row) => String(row.user_id)),
  );
  const houseMap = new Map(
    (houses.data ?? []).map((row) => [
      String(row.id),
      {
        slots: Number(row.member_slots_paid ?? 0),
        streak: Number(row.habit_streak ?? 0),
      },
    ]),
  );
  const txCount = new Map<string, number>();
  for (const row of todayTx.data ?? []) {
    const id = String(row.user_id);
    txCount.set(id, (txCount.get(id) ?? 0) + 1);
  }

  const leadPhone = new Map<string, string | null>();
  const memberPhones = new Map<string, string[]>();
  for (const row of members.data ?? []) {
    const hid = String(row.household_id);
    const phone = (row.phone_number as string | null) ?? null;
    if (row.role === "lead") {
      leadPhone.set(hid, phone);
    } else if (phone) {
      const list = memberPhones.get(hid) ?? [];
      list.push(phone);
      memberPhones.set(hid, list);
    }
  }

  const users: AdminUserRow[] = (profiles ?? []).map((p) => {
    const id = String(p.id);
    const house = houseMap.get(id);
    const status = String(p.subscription_status ?? "free");
    return {
      id,
      email: (p.email as string | null) ?? null,
      fullName: (p.full_name as string | null) ?? null,
      plan: status,
      expiresAt: (p.subscription_expires_at as string | null) ?? null,
      createdAt: String(p.created_at),
      onboarded: p.has_onboarded === true,
      sheetConnected: sheetSet.has(id),
      leadPhone: leadPhone.get(id) ?? null,
      memberPhones: memberPhones.get(id) ?? [],
      memberSlotsPaid: house?.slots ?? 0,
      habitStreak: house?.streak ?? 0,
      txToday: txCount.get(id) ?? 0,
    };
  });

  return { users, page, pageSize, total: count ?? 0 };
}
