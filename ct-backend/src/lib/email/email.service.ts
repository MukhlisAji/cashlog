import type { Env } from "../../config/env.js";
import { getSubscriptionConfig } from "../subscription.constants.js";
import type { SubscriptionTier } from "../subscription.constants.js";
import { getUserProfile } from "../subscription.js";
import { getSupabaseAdmin } from "../supabase.js";
import {
  buildSubscriptionActivatedEmailHtml,
  buildSubscriptionActivatedEmailText,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  getTierLabel,
} from "./templates.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isEmailConfigured(env: Env): boolean {
  return !!(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(
  env: Env,
  options: SendEmailOptions,
): Promise<boolean> {
  if (!isEmailConfigured(env)) {
    console.info("[email] Skipped (RESEND_API_KEY or EMAIL_FROM not set)");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[email] Resend error:", response.status, err.slice(0, 300));
    return false;
  }

  return true;
}

export async function sendWelcomeEmailIfNeeded(
  env: Env,
  userId: string,
): Promise<{ sent: boolean; skipped?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { sent: false, skipped: "supabase_not_configured" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, welcome_email_sent_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.email) {
    return { sent: false, skipped: "no_email" };
  }

  if (profile.welcome_email_sent_at) {
    return { sent: false, skipped: "already_sent" };
  }

  const { trialDays } = getSubscriptionConfig(env);
  const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
  const name = profile.full_name?.trim() || profile.email.split("@")[0] || "there";

  const sent = await sendEmail(env, {
    to: profile.email,
    subject: `Selamat datang di cashlog.id`,
    html: buildWelcomeEmailHtml({
      name,
      trialDays,
      dashboardUrl: `${frontendUrl}/ringkasan`,
      onboardingUrl: `${frontendUrl}/settings`,
    }),
    text: buildWelcomeEmailText({
      name,
      trialDays,
      dashboardUrl: `${frontendUrl}/ringkasan`,
      onboardingUrl: `${frontendUrl}/settings`,
    }),
  });

  if (sent) {
    await supabase
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", userId);
  }

  return { sent };
}

export async function sendSubscriptionActivatedEmail(
  env: Env,
  userId: string,
  tier: SubscriptionTier,
): Promise<boolean> {
  const profile = await getUserProfile(userId);
  if (!profile?.email) return false;

  const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
  const name =
    profile.full_name?.trim() || profile.email.split("@")[0] || "there";
  const tierLabel = getTierLabel(tier);
  const expiresAt = profile.subscription_expires_at ?? new Date().toISOString();

  return sendEmail(env, {
    to: profile.email,
    subject: `Langganan ${tierLabel} aktif — cashlog.id`,
    html: buildSubscriptionActivatedEmailHtml({
      name,
      tierLabel,
      expiresAt,
      dashboardUrl: `${frontendUrl}/ringkasan`,
    }),
    text: buildSubscriptionActivatedEmailText({
      name,
      tierLabel,
      expiresAt,
      dashboardUrl: `${frontendUrl}/ringkasan`,
    }),
  });
}
