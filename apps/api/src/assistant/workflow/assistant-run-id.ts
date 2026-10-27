import { createHash } from "node:crypto";

import type { AssistantRuntimeInput } from "./assistant-workflow.types";

/** Stable ULID identity whose timestamp also anchors the Workflow VM clock. */
export function assistantWorkflowRunId(
  input: Pick<AssistantRuntimeInput, "runId" | "tenantId" | "createdAt">,
): string {
  const createdAt = new Date(input.createdAt).getTime();
  if (!Number.isSafeInteger(createdAt) || createdAt < 0 || createdAt > 281474976710655) {
    throw new Error("Assistant run creation time must be a valid ULID timestamp");
  }
  // Workflow seeds Date.now() from these 48 timestamp bits. Hashing them
  // invents a replay clock and can overflow the SDK's model timeout.
  const bytes = Buffer.alloc(16);
  bytes.writeUIntBE(createdAt, 0, 6);
  createHash("sha256")
    .update(`mentingo-assistant:${input.tenantId}:${input.runId}`)
    .digest()
    .copy(bytes, 6, 0, 10);
  let value = BigInt(`0x${bytes.toString("hex")}`);
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let ulid = "";
  for (let index = 0; index < 26; index += 1) {
    ulid = alphabet[Number(value & BigInt(31))] + ulid;
    value >>= BigInt(5);
  }
  return `wrun_${ulid}`;
}
