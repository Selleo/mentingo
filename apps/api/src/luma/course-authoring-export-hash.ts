/** Defines the canonical export hash shared by the API and the authoring producer. */
import { createHash } from "node:crypto";

/** Serializes values with sorted object keys for producer-compatible hashing. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  throw new Error("courseAuthoring.errors.invalidExportValue");
}

/** Mirrors producer sorted, compact UTF-8 JSON; defaults must not be added before hashing. */
/** Hashes the immutable export fields used by the apply idempotency contract. */
export function courseAuthoringExportHash(exported: object) {
  const payload = Object.fromEntries(
    Object.entries(exported).filter(([key]) => key !== "exportHash"),
  );
  return createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
}
