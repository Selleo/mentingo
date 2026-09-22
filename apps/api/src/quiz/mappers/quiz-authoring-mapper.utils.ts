import { BLANK_ANSWER_MARKER_REGEX } from "src/questions/fill-in-the-blanks.utils";

export const filterItemsByQuestionId = <T extends { questionId: string }>(
  items: T[],
  questionId: string,
) => items.filter((item) => item.questionId === questionId);

export const getBlankMarkerIds = (value: string | null | undefined) =>
  [...(value?.matchAll(BLANK_ANSWER_MARKER_REGEX) ?? [])].map((match) => match[1]);

export const replaceBlankMarkerIds = (value: string, blankIdMap: Map<string, string>) =>
  value.replace(BLANK_ANSWER_MARKER_REGEX, (_, blankId: string) => {
    return `<blank-answer-${blankIdMap.get(blankId) ?? blankId}>`;
  });

export const normalizeBlankPromptMarkers = (prompt: string, blankIds: string[]) => {
  const markerIds = [
    ...new Set([...prompt.matchAll(BLANK_ANSWER_MARKER_REGEX)].map(([, markerId]) => markerId)),
  ];
  const knownBlankIds = new Set(blankIds);
  const assignedBlankIds = new Set<string>();
  const markerToBlankId = new Map<string, string>();

  let nextBlankIndex = 0;

  for (const markerId of markerIds) {
    if (knownBlankIds.has(markerId)) {
      markerToBlankId.set(markerId, markerId);
      assignedBlankIds.add(markerId);
      continue;
    }

    while (nextBlankIndex < blankIds.length && assignedBlankIds.has(blankIds[nextBlankIndex])) {
      nextBlankIndex += 1;
    }

    const blankId = blankIds[nextBlankIndex] ?? markerId;
    markerToBlankId.set(markerId, blankId);
    assignedBlankIds.add(blankId);
    nextBlankIndex += 1;
  }

  return prompt.replace(
    /(<\/?blank-answer-)([^>]+)(>)/g,
    (_match, prefix: string, markerId: string, suffix: string) =>
      `${prefix}${markerToBlankId.get(markerId) ?? markerId}${suffix}`,
  );
};
