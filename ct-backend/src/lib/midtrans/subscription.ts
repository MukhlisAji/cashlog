import type { Env } from "../../config/env.js";
import {
  getSubscriptionConfig,
  type SubscriptionTier,
} from "../subscription.constants.js";
import { midtransCoreRequest } from "./client.js";

export interface MidtransSubscriptionResult {
  id: string;
  status: string;
  amount: string;
}

function computeSubscriptionStartTime(): string {
  const start = new Date();
  start.setMonth(start.getMonth() + 1);
  start.setHours(9, 0, 0, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())} +0700`;
}

export async function createMidtransSubscription(
  env: Env,
  options: {
    userId: string;
    tier: SubscriptionTier;
    token: string;
    paymentType: "credit_card" | "gopay";
    customerEmail?: string | null;
    customerName?: string | null;
  },
): Promise<MidtransSubscriptionResult> {
  const amount = getSubscriptionConfig(env).tierPrices[options.tier];
  const name = `cashlog-${options.tier}-${options.userId.slice(0, 8)}`;

  const payload = {
    name: name.slice(0, 40),
    amount: String(amount),
    currency: "IDR",
    payment_type: options.paymentType,
    token: options.token,
    schedule: {
      interval: 1,
      interval_unit: "month",
      start_time: computeSubscriptionStartTime(),
    },
    metadata: {
      user_id: options.userId,
      tier: options.tier,
    },
    customer_details: options.customerEmail
      ? {
          email: options.customerEmail,
          first_name: options.customerName ?? "Pelanggan",
        }
      : undefined,
  };

  const response = await midtransCoreRequest(env, "/v1/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[midtrans] create subscription failed:", response.status, body);
    throw new Error("Failed to create Midtrans subscription");
  }

  const data = (await response.json()) as MidtransSubscriptionResult;
  return data;
}

export async function disableMidtransSubscription(
  env: Env,
  subscriptionId: string,
): Promise<boolean> {
  const response = await midtransCoreRequest(
    env,
    `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/disable`,
    { method: "POST" },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(
      "[midtrans] disable subscription failed:",
      response.status,
      body,
    );
    return false;
  }

  return true;
}

export function parseRecurringWebhookMetadata(metadata: unknown): {
  userId: string;
  tier: SubscriptionTier;
} | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const userId = record.user_id;
  const tier = record.tier;
  if (typeof userId !== "string") return null;
  // Legacy recurring metadata may still say "basic"; map it to one plan.
  if (tier !== "basic" && tier !== "pro") return null;
  return { userId, tier: "pro" };
}

export function isRecurringChargeSuccess(payload: {
  event_name?: string;
  transaction?: {
    status_code?: string;
    transaction_status?: string;
  };
}): boolean {
  if (payload.event_name !== "subscription.charge") return false;
  const tx = payload.transaction;
  if (!tx) return false;
  if (tx.status_code !== "200") return false;
  return tx.transaction_status === "capture" || tx.transaction_status === "settlement";
}
