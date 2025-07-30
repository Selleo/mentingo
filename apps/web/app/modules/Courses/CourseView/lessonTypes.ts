export const LessonTypes = {
  presentation: "Presentation",
  text: "Text",
  video: "Video",
  quiz: "Quiz",
  ai_mentor: "AiMentor",
} as const;

export const LessonTypesIcons = {
  presentation: "Presentation",
  text: "Text",
  video: "Video",
  quiz: "Quiz",
  ai_mentor: "AiMentor",
} as const;

export const CHAPTER_PROGRESS_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
} as const;

export type ProgressStatus =
  (typeof CHAPTER_PROGRESS_STATUSES)[keyof typeof CHAPTER_PROGRESS_STATUSES];
