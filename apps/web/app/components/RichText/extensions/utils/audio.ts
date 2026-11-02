import { z } from "zod";

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
