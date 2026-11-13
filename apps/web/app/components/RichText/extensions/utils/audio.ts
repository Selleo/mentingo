import { parseVideoCoverageRanges, type VideoCoverageRange } from "@repo/shared";
import { z } from "zod";

import { parseFiniteNumberOrNull } from "~/lib/number";
import { baseUrl } from "~/utils/baseUrl";

const ROOT_RELATIVE_OR_HTTP_URL_PATTERN = /^(\/|https?:\/\/)/i;
const LESSON_RESOURCE_PATH_PATTERN = /^\/api\/lesson\/lesson-resource\/[0-9a-f-]{36}$/i;

const resolveAgainstApiOrigin = (src: string) => {
  try {
    const apiOrigin = new URL(baseUrl).origin;
    return { url: new URL(src, apiOrigin), apiOrigin };
  } catch {
    return null;
  }
};

const isPlainLessonResourceUrl = (src: string) => {
  const resolved = resolveAgainstApiOrigin(src);
  if (!resolved) return false;

  const { url, apiOrigin } = resolved;

  return (
    url.origin === apiOrigin &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    LESSON_RESOURCE_PATH_PATTERN.test(url.pathname)
  );
};

/** Persisted audio may only point at a lesson resource on the API origin, never blob/data/foreign URLs. */
const audioSrcSchema = z
  .string()
  .regex(ROOT_RELATIVE_OR_HTTP_URL_PATTERN)
  .refine(isPlainLessonResourceUrl);

export const safeAudioSrc = (src: unknown) => {
  const result = audioSrcSchema.safeParse(src);

  return result.success ? result.data : null;
};

export type AudioCoverageAttrs = {
  resourceEntityId: string | null;
  audioCoveragePercent: number | null;
  audioIsListened: boolean;
  audioListenedRanges: VideoCoverageRange[];
  audioDurationSeconds: number | null;
  audioBucketSizeSeconds: number | null;
};

const getNumericAttribute = (value: unknown) =>
  typeof value === "number" || typeof value === "string" ? value : null;

export const normalizeAudioCoverageAttributes = (
  attrs: Record<string, unknown>,
): AudioCoverageAttrs => ({
  resourceEntityId: typeof attrs.resourceEntityId === "string" ? attrs.resourceEntityId : null,
  audioCoveragePercent: parseFiniteNumberOrNull(getNumericAttribute(attrs.audioCoveragePercent)),
  audioIsListened: attrs.audioIsListened === true || attrs.audioIsListened === "true",
  audioListenedRanges:
    Array.isArray(attrs.audioListenedRanges) || typeof attrs.audioListenedRanges === "string"
      ? parseVideoCoverageRanges(attrs.audioListenedRanges)
      : [],
  audioDurationSeconds: parseFiniteNumberOrNull(getNumericAttribute(attrs.audioDurationSeconds)),
  audioBucketSizeSeconds: parseFiniteNumberOrNull(
    getNumericAttribute(attrs.audioBucketSizeSeconds),
  ),
});

export const getAudioCoverageAttrsFromElement = (element: HTMLElement) =>
  normalizeAudioCoverageAttributes({
    resourceEntityId: element.getAttribute("data-resource-entity-id"),
    audioCoveragePercent: element.getAttribute("data-audio-coverage-percent"),
    audioIsListened: element.getAttribute("data-audio-is-listened"),
    audioListenedRanges: element.getAttribute("data-audio-listened-ranges"),
    audioDurationSeconds: element.getAttribute("data-audio-duration-seconds"),
    audioBucketSizeSeconds: element.getAttribute("data-audio-bucket-size-seconds"),
  });

export const getAudioCoverageDataAttributes = (attrs: AudioCoverageAttrs) => ({
  ...(attrs.resourceEntityId ? { "data-resource-entity-id": attrs.resourceEntityId } : {}),
  ...(attrs.audioCoveragePercent !== null
    ? { "data-audio-coverage-percent": attrs.audioCoveragePercent }
    : {}),
  ...(attrs.audioIsListened ? { "data-audio-is-listened": "true" } : {}),
  ...(attrs.audioListenedRanges.length > 0
    ? { "data-audio-listened-ranges": JSON.stringify(attrs.audioListenedRanges) }
    : {}),
  ...(attrs.audioDurationSeconds !== null
    ? { "data-audio-duration-seconds": attrs.audioDurationSeconds }
    : {}),
  ...(attrs.audioBucketSizeSeconds !== null
    ? { "data-audio-bucket-size-seconds": attrs.audioBucketSizeSeconds }
    : {}),
});
