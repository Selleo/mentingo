import { isValidVideoDuration } from "src/file/video-metadata.utils";
import { normalizeJsonb } from "src/utils/jsonb";

export const mergeResourceMetadataPreservingDuration = (
  sourceMetadata: unknown,
  targetMetadata: unknown,
): Record<string, unknown> => {
  const source = normalizeJsonb<Record<string, unknown>>(sourceMetadata, {});
  if (isValidVideoDuration(source.durationSeconds)) return source;

  const target = normalizeJsonb<Record<string, unknown>>(targetMetadata, {});
  const targetDuration = target.durationSeconds;
  if (!isValidVideoDuration(targetDuration)) return source;

  return { ...source, durationSeconds: targetDuration };
};
