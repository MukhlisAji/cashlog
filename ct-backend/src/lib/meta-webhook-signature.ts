import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta sends `X-Hub-Signature-256: sha256=<hex>` over the raw JSON body,
 * HMAC-SHA256 with the app secret.
 */
export function verifyMetaWebhookSignature(
  appSecret: string,
  rawBody: string,
  signatureHeader: string | string[] | undefined,
): boolean {
  const header = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  if (!header) return false;

  const expectedHex = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const expected = Buffer.from(`sha256=${expectedHex}`, "utf8");
  const received = Buffer.from(header, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
