import { Value } from "@sinclair/typebox/value";

import { googleServiceAccountKeySchema } from "../providers/google-workspace-directory.schema";

import type { Static } from "@sinclair/typebox";

export type GoogleServiceAccountKey = Static<typeof googleServiceAccountKeySchema>;

/**
 * Accepts the service account JSON exactly as downloaded from Google Cloud.
 * Returns null for anything that is not a usable key, so callers decide how to report it.
 */
export function parseGoogleServiceAccountKey(
  serializedServiceAccountKey: string,
): GoogleServiceAccountKey | null {
  const serviceAccountKey = parseJsonSafely(serializedServiceAccountKey.trim());

  return Value.Check(googleServiceAccountKeySchema, serviceAccountKey) ? serviceAccountKey : null;
}

function parseJsonSafely(serializedJson: string): unknown {
  try {
    return JSON.parse(serializedJson);
  } catch {
    return null;
  }
}
