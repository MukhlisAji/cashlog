import type { Env } from "../../config/env.js";

export function isMidtransProduction(env: Env): boolean {
  return env.MIDTRANS_IS_PRODUCTION;
}

export function getSnapBaseUrl(env: Env): string {
  return isMidtransProduction(env)
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

export function getCoreApiBaseUrl(env: Env): string {
  return isMidtransProduction(env)
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
}

export function midtransAuthHeader(env: Env): string {
  const key = env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error("MIDTRANS_SERVER_KEY is not configured");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export async function midtransCoreRequest(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", midtransAuthHeader(env));
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${getCoreApiBaseUrl(env)}${path}`, {
    ...init,
    headers,
  });
}

export async function midtransSnapRequest(
  env: Env,
  body: unknown,
): Promise<Response> {
  return fetch(`${getSnapBaseUrl(env)}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: midtransAuthHeader(env),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
