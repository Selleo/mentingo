type ChatContentPart = {
  text?: unknown;
};

type ThinkingStateChunk = {
  message_key?: unknown;
  course_generated?: unknown;
};

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
  if (!Array.isArray(data)) return null;

  for (let idx = data.length - 1; idx >= 0; idx -= 1) {
    const entry = data[idx];
    if (!entry || typeof entry !== "object") continue;

    const messageKey = (entry as ThinkingStateChunk).message_key;
    if (typeof messageKey === "string" && messageKey.trim().length > 0) {
      return messageKey.trim();
    }
  }

  return null;
};

export const hasCourseGeneratedFlag = (data: unknown): boolean => {
  if (!Array.isArray(data)) return false;

  for (let idx = data.length - 1; idx >= 0; idx -= 1) {
    const entry = data[idx];

    if (Array.isArray(entry)) {
      if (hasCourseGeneratedFlag(entry)) return true;
      continue;
    }

    if (!entry || typeof entry !== "object") continue;
    if ((entry as ThinkingStateChunk).course_generated === true) return true;
  }

  return false;
};
