import { COURSE_GENERATION_MESSAGE_KEY, COURSE_GENERATION_STREAM_EVENT_TYPE } from "@repo/shared";
import { flattenDeep, isPlainObject } from "lodash-es";

import type { CourseGenerationMessageKey } from "@repo/shared";

type ChatContentPart = {
  text?: unknown;
};

type ThinkingStateChunk = {
  type?: unknown;
  message_key?: unknown;
  course_generated?: unknown;
};

const flattenEntries = (data: unknown): unknown[] =>
  flattenDeep(Array.isArray(data) ? data : [data]) as unknown[];

const courseGenerationMessageKeys = new Set<string>(Object.values(COURSE_GENERATION_MESSAGE_KEY));

const isCourseGenerationMessageKey = (value: unknown): value is CourseGenerationMessageKey =>
  typeof value === "string" && courseGenerationMessageKeys.has(value);

export const getMessageText = (content: unknown): string => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object"
            ? String((part as ChatContentPart).text ?? "")
            : "",
      )
      .join("");
  }

  return "";
};

export const getCurrentMessageKey = (data: unknown): CourseGenerationMessageKey | null => {
  const entries = flattenEntries(data);
  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const entry = entries[idx];
    if (!isPlainObject(entry)) continue;

    const messageKey = (entry as ThinkingStateChunk).message_key;
    if (isCourseGenerationMessageKey(messageKey)) {
      return messageKey;
    }
  }

  return null;
};

export const hasCourseGeneratedFlag = (data: unknown): boolean => {
  const entries = flattenEntries(data);
  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const entry = entries[idx];
    if (!isPlainObject(entry)) continue;
    if ((entry as ThinkingStateChunk).type === COURSE_GENERATION_STREAM_EVENT_TYPE.COURSE_GENERATED)
      return true;
    if ((entry as ThinkingStateChunk).course_generated === true) return true;
  }

  return false;
};
