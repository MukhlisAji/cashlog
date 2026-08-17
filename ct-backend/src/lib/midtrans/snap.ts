import { createHash } from "node:crypto";

import type { Env } from "../../config/env.js";
import {
  getSubscriptionConfig,
  TIER_LABELS,
  type SubscriptionTier,
} from "../subscription.constants.js";
import { midtransSnapRequest } from "./client.js";
import {
  slotsOrderFields,
  slotsOrderId,
  subscriptionOrderFields,
  subscriptionOrderId,
} from "./orders.js";

export interface MidtransSnapCheckoutResult {
  orderId: string;
  checkoutUrl: string;
  token: string;
  amount: number;
}

function computeRecurringStartTime(): string {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const tz = "+0700";
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())} ${tz}`;
}

function splitName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (fullName ?? "Pelanggan cashlog.id").trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function createSnapTransaction(
  env: Env,
  payload: Record<string, unknown>,
): Promise<MidtransSnapCheckoutResult> {
  const response = await midtransSnapRequest(env, payload);

  if (!response.ok) {
    const body = await response.text();
    console.error("[midtrans] snap create failed:", response.status, body);
    throw new Error("Failed to create Midtrans Snap transaction");
  }

  const data = (await response.json()) as {
    token?: string;
    redirect_url?: string;
  };

  const transactionDetails = payload.transaction_details as {
    order_id: string;
    gross_amount: number;
  };

  if (!data.token || !data.redirect_url) {
    console.error("[midtrans] snap response missing token/url:", data);
    throw new Error("Invalid Midtrans Snap response");
  }

  return {
    orderId: transactionDetails.order_id,
    checkoutUrl: data.redirect_url,
    token: data.token,
    amount: transactionDetails.gross_amount,
  };
}

export async function createSubscriptionSnapCheckout(
  env: Env,
  options: {
    userId: string;
    tier: SubscriptionTier;
    customerEmail?: string | null;
    customerName?: string | null;
    recurring: boolean;
  },
): Promise<MidtransSnapCheckoutResult> {
  const { userId, tier, customerEmail, customerName, recurring } = options;
  const amount = getSubscriptionConfig(env).tierPrices[tier];
  const orderId = subscriptionOrderId(tier);
  const label = TIER_LABELS[tier];
  const { firstName, lastName } = splitName(customerName);

  const payload: Record<string, unknown> = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: tier,
        price: amount,
        quantity: 1,
        name: `cashlog.id ${label}`,
      },
    ],
    customer_details: {
      first_name: firstName,
      last_name: lastName || undefined,
      email: customerEmail ?? undefined,
    },
    credit_card: { secure: true },
    callbacks: {
      finish: `${env.FRONTEND_URL}/payment/return?payment=success&tier=${tier}`,
      error: `${env.FRONTEND_URL}/payment/return?payment=failed&tier=${tier}`,
      pending: `${env.FRONTEND_URL}/payment/return?payment=pending&tier=${tier}`,
    },
    ...subscriptionOrderFields(userId, tier),
  };

  if (recurring) {
    payload.recurring = {
      required: true,
      interval_unit: "month",
      start_time: computeRecurringStartTime(),
    };
    payload.credit_card = { secure: true, save_card: true };
  }

  return createSnapTransaction(env, payload);
}

export async function createSlotsSnapCheckout(
  env: Env,
  options: {
    userId: string;
    slots: number;
    customerEmail?: string | null;
    customerName?: string | null;
  },
): Promise<MidtransSnapCheckoutResult> {
  const { userId, slots, customerEmail, customerName } = options;
  const amount = slots * env.HOUSEHOLD_MEMBER_PRICE;
  const orderId = slotsOrderId();
  const { firstName, lastName } = splitName(customerName);

  return createSnapTransaction(env, {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: "household-slots",
        price: amount,
        quantity: 1,
        name: `Slot anggota keluarga (${slots}×)`,
      },
    ],
    customer_details: {
      first_name: firstName,
      last_name: lastName || undefined,
      email: customerEmail ?? undefined,
    },
    callbacks: {
      finish: `${env.FRONTEND_URL}/payment/return?payment=slots&slots=${slots}`,
      error: `${env.FRONTEND_URL}/payment/return?payment=failed`,
      pending: `${env.FRONTEND_URL}/payment/return?payment=pending`,
    },
    ...slotsOrderFields(userId, slots),
  });
}

export function verifyMidtransSignature(
  env: Env,
  payload: {
    order_id?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
  },
): boolean {
  const serverKey = env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return env.NODE_ENV === "development";

  const { order_id, status_code, gross_amount, signature_key } = payload;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return false;
  }

  const expected = createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest("hex");

  return expected === signature_key;
}

export function isMidtransPaymentSuccess(payload: {
  status_code?: string;
  transaction_status?: string;
  fraud_status?: string;
}): boolean {
  if (payload.status_code !== "200") return false;

  const status = payload.transaction_status;
  if (status !== "capture" && status !== "settlement") return false;

  if (payload.fraud_status && payload.fraud_status !== "accept") {
    return false;
  }

  return true;
}

export function isMidtransConfigured(env: Env): boolean {
  return !!env.MIDTRANS_SERVER_KEY;
}
