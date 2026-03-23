import { createHmac } from "node:crypto";

export function hashToken(token: string): string {
  if (!process.env.MASTER_KEY) {
    throw new Error("MASTER_KEY is required for token hashing");
  }

  const secret = Buffer.from(process.env.MASTER_KEY, "base64");

  return createHmac("sha256", secret).update(token, "utf8").digest("hex");
}
