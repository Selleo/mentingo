export const INLINE_DIFF_SEGMENT_TYPE = {
  UNCHANGED: "unchanged",
  ADDED: "added",
  REMOVED: "removed",
} as const;

export type InlineDiffSegment = {
  type: (typeof INLINE_DIFF_SEGMENT_TYPE)[keyof typeof INLINE_DIFF_SEGMENT_TYPE];
  value: string;
};

const tokenize = (value: string) => value.match(/\s*\S+|\s+$/g) ?? [];

export const createInlineDiff = (before: string, after: string): InlineDiffSegment[] => {
  const beforeTokens = tokenize(before);
  const afterTokens = tokenize(after);
  const lengths = Array.from({ length: beforeTokens.length + 1 }, () =>
    Array<number>(afterTokens.length + 1).fill(0),
  );

  for (let beforeIndex = beforeTokens.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterTokens.length - 1; afterIndex >= 0; afterIndex -= 1) {
      if (beforeTokens[beforeIndex] === afterTokens[afterIndex]) {
        lengths[beforeIndex][afterIndex] = lengths[beforeIndex + 1][afterIndex + 1] + 1;
      } else {
        lengths[beforeIndex][afterIndex] = Math.max(
          lengths[beforeIndex + 1][afterIndex],
          lengths[beforeIndex][afterIndex + 1],
        );
      }
    }
  }

  const segments: InlineDiffSegment[] = [];
  const append = (type: InlineDiffSegment["type"], value: string) => {
    const previous = segments.at(-1);
    if (previous?.type === type) {
      previous.value += value;
      return;
    }
    segments.push({ type, value });
  };

  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < beforeTokens.length && afterIndex < afterTokens.length) {
    if (beforeTokens[beforeIndex] === afterTokens[afterIndex]) {
      append(INLINE_DIFF_SEGMENT_TYPE.UNCHANGED, beforeTokens[beforeIndex]);
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    if (lengths[beforeIndex + 1][afterIndex] >= lengths[beforeIndex][afterIndex + 1]) {
      append(INLINE_DIFF_SEGMENT_TYPE.REMOVED, beforeTokens[beforeIndex]);
      beforeIndex += 1;
      continue;
    }

    append(INLINE_DIFF_SEGMENT_TYPE.ADDED, afterTokens[afterIndex]);
    afterIndex += 1;
  }

  while (beforeIndex < beforeTokens.length) {
    append(INLINE_DIFF_SEGMENT_TYPE.REMOVED, beforeTokens[beforeIndex]);
    beforeIndex += 1;
  }
  while (afterIndex < afterTokens.length) {
    append(INLINE_DIFF_SEGMENT_TYPE.ADDED, afterTokens[afterIndex]);
    afterIndex += 1;
  }

  return segments;
};
