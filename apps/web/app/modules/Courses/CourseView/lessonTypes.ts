export const LessonTypes = {
  content: "Content",
  quiz: "Quiz",
  ai_mentor: "AI Mentor",
  embed: "Embed",
} as const;

export const LessonTypesIcons = {
  content: "Content",
  quiz: "Quiz",
  ai_mentor: "AiMentor",
  embed: "Embed",
} as const;

export const CHAPTER_PROGRESS_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
} as const;

export type ProgressStatus =
  (typeof CHAPTER_PROGRESS_STATUSES)[keyof typeof CHAPTER_PROGRESS_STATUSES];
