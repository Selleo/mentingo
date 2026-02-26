import { flattenDeep, isPlainObject } from "lodash-es";

type ChatContentPart = {
  text?: unknown;
};

type ThinkingStateChunk = {
  message_key?: unknown;
  course_generated?: unknown;
};

const flattenEntries = (data: unknown): unknown[] =>
  flattenDeep(Array.isArray(data) ? data : [data]) as unknown[];

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

export const getCurrentMessageKey = (data: unknown): string | null => {
  const entries = flattenEntries(data);
  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const entry = entries[idx];
    if (!isPlainObject(entry)) continue;

    const messageKey = (entry as ThinkingStateChunk).message_key;
    if (typeof messageKey === "string" && messageKey.trim().length > 0) {
      return messageKey.trim();
    }
  }

  return null;
};

export const hasCourseGeneratedFlag = (data: unknown): boolean => {
  const entries = flattenEntries(data);
  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const entry = entries[idx];
    if (!isPlainObject(entry)) continue;
    if ((entry as ThinkingStateChunk).course_generated === true) return true;
  }

  return false;
};
