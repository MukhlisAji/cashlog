import { getSupabaseAdmin } from "../../lib/supabase.js";
import { previousJakartaDate } from "../../lib/datetime-jakarta.js";
import { normalizePhone } from "./whatsapp.utils.js";

const MAX_TEMPLATE_STREAK = 3;

function sb() {
  return getSupabaseAdmin();
}

export function reminderTemplateCap(): number {
  return MAX_TEMPLATE_STREAK;
}

export async function getReminderTemplateStreak(
  phone: string,
): Promise<{ streak: number; lastTemplateDate: string | null }> {
  const client = sb();
  if (!client) return { streak: 0, lastTemplateDate: null };

  const key = normalizePhone(phone);
  const { data, error } = await client
    .from("wa_reminder_streaks")
    .select("template_streak, last_template_date")
    .eq("phone", key)
    .maybeSingle();
  if (error || !data) return { streak: 0, lastTemplateDate: null };

  return {
    streak: Number(data.template_streak ?? 0),
    lastTemplateDate: data.last_template_date
      ? String(data.last_template_date).slice(0, 10)
      : null,
  };
}

export async function canSendReminderTemplate(
  phone: string,
  today: string,
): Promise<boolean> {
  const { streak, lastTemplateDate } = await getReminderTemplateStreak(phone);
  if (lastTemplateDate === today) return streak < MAX_TEMPLATE_STREAK;
  const consecutive = lastTemplateDate === previousJakartaDate(today) ? streak : 0;
  return consecutive < MAX_TEMPLATE_STREAK;
}

export async function bumpReminderTemplateStreak(
  phone: string,
  today: string,
): Promise<void> {
  const client = sb();
  if (!client) return;

  const key = normalizePhone(phone);
  const { streak, lastTemplateDate } = await getReminderTemplateStreak(phone);
  if (lastTemplateDate === today) return;

  const next =
    lastTemplateDate === previousJakartaDate(today) ? streak + 1 : 1;

  await client.from("wa_reminder_streaks").upsert(
    {
      phone: key,
      template_streak: next,
      last_template_date: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
}

export async function resetReminderTemplateStreak(phone: string): Promise<void> {
  const client = sb();
  if (!client || !phone) return;

  const key = normalizePhone(phone);
  await client.from("wa_reminder_streaks").upsert(
    {
      phone: key,
      template_streak: 0,
      last_template_date: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
}
