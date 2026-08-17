import { randomBytes } from "node:crypto";

import type { SubscriptionTier } from "../subscription.constants.js";

export type MidtransPaymentKind = "subscription" | "slots";

export interface MidtransOrderContext {
  userId: string;
  kind: MidtransPaymentKind;
  tier?: SubscriptionTier;
  slots?: number;
}

/** Midtrans order_id max 50 chars — keep short, use custom_field for metadata. */
export function buildMidtransOrderId(prefix: string): string {
  const suffix = randomBytes(4).toString("hex");
  return `${prefix}-${Date.now().toString(36)}-${suffix}`.slice(0, 50);
}

export function subscriptionOrderId(tier: SubscriptionTier): string {
  return buildMidtransOrderId(`cl-${tier}`);
}

export function slotsOrderId(): string {
  return buildMidtransOrderId("cl-slots");
}

export function subscriptionOrderFields(
  userId: string,
  tier: SubscriptionTier,
): Record<string, string> {
  return {
    custom_field1: userId,
    custom_field2: tier,
    custom_field3: "subscription",
  };
}

export function slotsOrderFields(userId: string, slots: number): Record<string, string> {
  return {
    custom_field1: userId,
    custom_field2: String(slots),
    custom_field3: "slots",
  };
}

export function parseMidtransOrderContext(payload: {
  order_id?: string;
  custom_field1?: string;
  custom_field2?: string;
  custom_field3?: string;
}): MidtransOrderContext | null {
  const userId = payload.custom_field1?.trim();
  const kind = payload.custom_field3?.trim() as MidtransPaymentKind | undefined;
  const field2 = payload.custom_field2?.trim();

  if (!userId || (kind !== "subscription" && kind !== "slots")) {
    return null;
  }

  if (kind === "slots") {
    const slots = Number(field2);
    if (!Number.isInteger(slots) || slots < 0 || slots > 5) return null;
    return { userId, kind, slots };
  }

  // Accept legacy in-flight Basic orders, but activate the unified plan.
  if (field2 !== "basic" && field2 !== "pro") return null;
  return { userId, kind, tier: "pro" };
}
