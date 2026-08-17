import type { Env } from "../../config/env.js";
import { midtransCoreRequest } from "./client.js";

export interface MidtransTransactionStatus {
  order_id?: string;
  status_code?: string;
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
  custom_field1?: string;
  custom_field2?: string;
  custom_field3?: string;
  saved_token?: string;
  payment_type?: string;
}

export async function getMidtransTransactionStatus(
  env: Env,
  orderId: string,
): Promise<MidtransTransactionStatus | null> {
  const response = await midtransCoreRequest(
    env,
    `/v2/${encodeURIComponent(orderId)}/status`,
  );

  if (!response.ok) {
    const body = await response.text();
    console.error("[midtrans] status check failed:", response.status, body);
    return null;
  }

  return (await response.json()) as MidtransTransactionStatus;
}
