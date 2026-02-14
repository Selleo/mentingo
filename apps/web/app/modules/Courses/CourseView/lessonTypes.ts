export const LessonTypesIcons = {
  content: "Content",
  quiz: "Quiz",
  ai_mentor: "AiMentor",
  embed: "Embed",
} as const;

const lessonTypeTranslationSuffix = {
  content: "content",
  quiz: "quiz",
  ai_mentor: "ai_mentor",
  embed: "embed",
} as const;

type LessonTypeTranslationKey = keyof typeof lessonTypeTranslationSuffix;

export const getLessonTypeTranslationKey = (type: LessonTypeTranslationKey) => {
  const key = lessonTypeTranslationSuffix[type];
  return `common.lessonTypes.${key}`;
};

export const CHAPTER_PROGRESS_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
} as const;

export type ProgressStatus =
  (typeof CHAPTER_PROGRESS_STATUSES)[keyof typeof CHAPTER_PROGRESS_STATUSES];
