import type { ResourceMetadata } from "src/file/types/resource-metadata.type";

export function getCanonicalVideoDurationSeconds(
  metadata: ResourceMetadata | null | undefined,
): number | undefined {
  const value = metadata?.durationSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : undefined;
}
