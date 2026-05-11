export const LESSON_RESOURCE_ID_REGEX = /lesson-resource\/([0-9a-fA-F-]{36})/g;

export const extractLessonResourceIds = (content: string) =>
  Array.from(content.matchAll(LESSON_RESOURCE_ID_REGEX)).map((match) => match[1]);

export const createLessonResourceIdRegex = () => new RegExp(LESSON_RESOURCE_ID_REGEX.source);
