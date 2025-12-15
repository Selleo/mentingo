import type { ActivityLogMetadataBySchema, ActivityLogMetadataSchema } from "../types";

type BuildActivityLogMetadataParams<
  TPrevious extends Record<string, unknown>,
  TUpdated extends Record<string, unknown>,
  TSchema extends ActivityLogMetadataSchema = "update",
> = {
  previous: TPrevious | null | undefined;
  updated: TUpdated | null | undefined;
  context?: Record<string, string> | null;
  schema?: TSchema;
};

/**
 * Builds metadata for an update activity log by comparing previous and updated records.
 *
 * @param params.previous - The previous state of the record.
 * @param params.updated - The updated state of the record.
 * @param params.context - Optional context information to include in the metadata.
 * @param params.schema - Determines whether to build metadata for an update (default) or create.
 * @returns An object containing changed fields, before and after snapshots, and optional context.
 */
export const buildActivityLogMetadata = <
  TPrevious extends Record<string, unknown>,
  TUpdated extends Record<string, unknown>,
  TSchema extends ActivityLogMetadataSchema = "update",
>({
  previous,
  updated,
  context = null,
  schema,
}: BuildActivityLogMetadataParams<
  TPrevious,
  TUpdated,
  TSchema
>): ActivityLogMetadataBySchema<TSchema> => {
  const resolvedSchema = (schema ?? "update") as ActivityLogMetadataSchema;

  const previousRecord = (previous ?? {}) as Record<string, unknown>;
  const updatedRecord = (updated ?? {}) as Record<string, unknown>;

  if (resolvedSchema === "create") {
    const afterSnapshot = buildSnapshotForKeys(
      updatedRecord,
      filterMetadataKeys(Object.keys(updatedRecord)),
    );

    return {
      after: afterSnapshot,
      context,
    } as ActivityLogMetadataBySchema<TSchema>;
  }

  const changedFields: string[] = [];
  const beforeSnapshot: Record<string, string> = {};
  const afterSnapshot: Record<string, string> = {};

  const sharedKeys = Object.keys(previousRecord).filter(
    (key) =>
      Object.prototype.hasOwnProperty.call(previousRecord, key) &&
      Object.prototype.hasOwnProperty.call(updatedRecord, key) &&
      !EXCLUDED_METADATA_KEYS.has(key),
  );

  for (const key of sharedKeys) {
    const previousValue = previousRecord[key];
    const updatedValue = updatedRecord[key];

    if (areValuesEqual(previousValue, updatedValue)) continue;

    changedFields.push(key);

    beforeSnapshot[key] = stringifyMetadataValue(previousValue);
    afterSnapshot[key] = stringifyMetadataValue(updatedValue);
  }

  return {
    changedFields,
    before: beforeSnapshot,
    after: afterSnapshot,
    context,
  } as ActivityLogMetadataBySchema<TSchema>;
};

/**
 * Compares two values for equality, handling special cases for Date objects and records.
 *
 * @param previousValue - The previous value to compare.
 * @param updatedValue - The updated value to compare.
 * @returns A boolean indicating whether the two values are considered equal.
 */
const areValuesEqual = (previousValue: unknown, updatedValue: unknown): boolean => {
  if (previousValue === updatedValue) return true;

  if (previousValue instanceof Date && updatedValue instanceof Date) {
    return previousValue.getTime() === updatedValue.getTime();
  }

  if (isComparableRecord(previousValue) && isComparableRecord(updatedValue)) {
    return JSON.stringify(previousValue) === JSON.stringify(updatedValue);
  }

  if (Array.isArray(previousValue) && Array.isArray(updatedValue)) {
    return JSON.stringify(previousValue) === JSON.stringify(updatedValue);
  }

  return false;
};

/** Converts a metadata value to a string representation.
 *
 * @param value - The value to convert.
 * @returns A string representation of the value.
 */
const stringifyMetadataValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/** Checks if a value is a comparable record (non-null object that is not an array).
 *
 * @param value - The value to check.
 * @returns A boolean indicating whether the value is a comparable record.
 */
const isComparableRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const EXCLUDED_METADATA_KEYS = new Set(["updatedAt", "createdAt"]);

const filterMetadataKeys = (keys: string[]): string[] =>
  keys.filter((key) => !EXCLUDED_METADATA_KEYS.has(key));

const buildSnapshotForKeys = (
  record: Record<string, unknown>,
  keys: string[],
): Record<string, string> => {
  const snapshot: Record<string, string> = {};

  for (const key of keys) snapshot[key] = stringifyMetadataValue(record[key]);

  return snapshot;
};
