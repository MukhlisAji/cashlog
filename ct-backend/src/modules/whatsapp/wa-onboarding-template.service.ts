import type { Env } from "../../config/env.js";
import { isMetaWhatsAppConfigured } from "../../config/env.js";
import { getUserProfile } from "../../lib/subscription.js";
import { getSupabaseAdmin } from "../../lib/supabase.js";
import { householdRepository } from "../household/household.repository.js";
import { getSheetStatus } from "../sheets/sheets-setup.service.js";
import { getMetaService } from "./meta-outbound.service.js";
import { MEMBER_ONBOARDING_TEMPLATE_NAME } from "./wa-member-welcome.js";

function firstName(fullName: string | null | undefined): string {
  const token =
    fullName?.trim().split(/\s+/).filter(Boolean)[0]?.replace(/[{}]/g, "") ?? "";
  return token.slice(0, 60) || "Kak";
}

/** Path after https://docs.google.com/ for the template URL button {{1}}. */
export function sheetUrlButtonSuffix(spreadsheetId: string): string {
  return `spreadsheets/d/${spreadsheetId}/edit`;
}

async function claimLeadOnboarding(userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return true;
  const { data } = await sb
    .from("profiles")
    .update({ has_onboarded: true, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("has_onboarded", false)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

async function releaseLeadOnboarding(userId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  await sb
    .from("profiles")
    .update({ has_onboarded: false, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("has_onboarded", true);
}

export async function sendOnboardingTemplate(
  env: Env,
  phone: string,
  displayName: string | null | undefined,
  spreadsheetId: string,
): Promise<boolean> {
  if (!isMetaWhatsAppConfigured(env) || !phone || !spreadsheetId) return false;
  const to = phone.replace(/\D/g, "");
  if (!to) return false;

  try {
    await getMetaService().sendWhatsAppTemplate({
      to,
      templateName: env.META_WA_ONBOARDING_TEMPLATE,
      languageCode: env.META_WA_ONBOARDING_TEMPLATE_LANG,
      bodyParameters: [firstName(displayName)],
      urlButtonSuffix: sheetUrlButtonSuffix(spreadsheetId),
    });
    return true;
  } catch (error) {
    console.error(
      { phone: to, error },
      "[wa-onboarding-template] failed to send onboarding_notif_v1",
    );
    return false;
  }
}

export async function sendMemberOnboardingTemplate(
  env: Env,
  phone: string,
  leadFirstName: string,
): Promise<boolean> {
  if (!isMetaWhatsAppConfigured(env) || !phone) return false;
  const to = phone.replace(/\D/g, "");
  if (!to) return false;

  try {
    await getMetaService().sendWhatsAppTemplate({
      to,
      templateName: env.META_WA_MEMBER_ONBOARDING_TEMPLATE,
      languageCode: env.META_WA_ONBOARDING_TEMPLATE_LANG,
      bodyParameters: [leadFirstName, leadFirstName],
    });
    return true;
  } catch (error) {
    console.error(
      { phone: to, error, template: env.META_WA_MEMBER_ONBOARDING_TEMPLATE },
      `[wa-onboarding-template] failed to send ${MEMBER_ONBOARDING_TEMPLATE_NAME}`,
    );
    return false;
  }
}

export async function sendOnboardingTemplateToLeadIfReady(
  env: Env,
  userId: string,
): Promise<void> {
  const sheet = await getSheetStatus(userId);
  if (!sheet.spreadsheetId) return;

  const phone = await householdRepository.getLeadPhone(userId);
  if (!phone) return;

  const claimed = await claimLeadOnboarding(userId);
  if (!claimed) return;

  const profile = await getUserProfile(userId);
  const sent = await sendOnboardingTemplate(
    env,
    phone,
    profile?.full_name,
    sheet.spreadsheetId,
  );
  if (!sent) await releaseLeadOnboarding(userId);
}

export async function sendOnboardingTemplateToMemberIfReady(
  env: Env,
  leadUserId: string,
  phone: string,
): Promise<void> {
  const profile = await getUserProfile(leadUserId);
  await sendMemberOnboardingTemplate(env, phone, firstName(profile?.full_name));
}
