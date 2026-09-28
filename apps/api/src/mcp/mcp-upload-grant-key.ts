import { createHash } from "node:crypto";

import type { RedisClient } from "src/redis";

export function mcpUploadGrantKey(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex");
  return `mcp:upload:${digest}`;
}

export async function revokeMcpUploadGrant(redis: RedisClient, token: string): Promise<void> {
  await redis.del(mcpUploadGrantKey(token));
}
