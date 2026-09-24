import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyPhishingSignature(
  rawBody: Buffer,
  secret: string,
  timestamp: string,
  signature: string,
  now = Date.now(),
): boolean {
  if (secret.length < 32 || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature))
    return false;
  if (Math.abs(now - Number(timestamp) * 1000) > 300000) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(rawBody)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
