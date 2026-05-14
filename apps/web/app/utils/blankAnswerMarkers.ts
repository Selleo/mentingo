export const BLANK_ANSWER_MARKER_REGEX = /<blank-answer-([^>]+)>/g;

export const createBlankAnswerMarker = (answerId: string) => `<blank-answer-${answerId}>`;

export const getBlankAnswerIds = (content?: string | null) =>
  [...(content ?? "").matchAll(BLANK_ANSWER_MARKER_REGEX)].map((match) => match[1]).filter(Boolean);

export const getBlankCount = (content?: string | null, fallback = 0) => {
  const answerIds = getBlankAnswerIds(content);
  if (answerIds.length > 0) return answerIds.length;

  const legacyMarkersCount = content?.match(/\[word]/g)?.length ?? 0;
  return legacyMarkersCount > 0 ? legacyMarkersCount : fallback;
};

export const splitByBlankAnswerMarkers = (content: string) => {
  const parts: Array<{ text: string; answerId?: string }> = [];

  let lastIndex = 0;

  for (const match of content.matchAll(BLANK_ANSWER_MARKER_REGEX)) {
    const matchIndex = match.index ?? 0;
    parts.push({ text: content.slice(lastIndex, matchIndex), answerId: match[1] });
    lastIndex = matchIndex + match[0].length;
  }

  if (parts.length === 0) {
    return content.split(/\[word]/g).map((text, index, legacyParts) => ({
      text,
      answerId: index < legacyParts.length - 1 ? `${index + 1}` : undefined,
    }));
  }

  parts.push({ text: content.slice(lastIndex) });
  return parts;
};
