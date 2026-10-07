/** Finds ready operation-bound Mentor briefs without mistaking original-source files for them. */
import type { AuthoringRecord } from "./courseAuthoring.types";

/** Returns operation IDs whose generated brief has already been stored successfully. */
export const targetedMentorOperationIds = (records: readonly AuthoringRecord[]): string[] => {
  const ids = new Set<string>();
  for (const record of records) {
    if (record.kind !== "asset" || record.payload.status !== "ready") continue;
    const manifest = record.payload.manifest;
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) continue;
    if (
      "role" in manifest &&
      manifest.role === "mentor_context" &&
      "operationId" in manifest &&
      typeof manifest.operationId === "string" &&
      (!("sourceVersionId" in manifest) || manifest.sourceVersionId == null)
    )
      ids.add(manifest.operationId);
  }
  return [...ids];
};
