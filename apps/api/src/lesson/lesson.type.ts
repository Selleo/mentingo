export const LESSON_TYPES = {
  CONTENT: "content",
  QUIZ: "quiz",
  AI_MENTOR: "ai_mentor",
  EMBED: "embed",
  SCORM: "scorm",
} as const;

export type LessonTypes = (typeof LESSON_TYPES)[keyof typeof LESSON_TYPES];

export type EmbedLessonResourceType = {
  id: string;
  reference: string;
  contentType: string;
  metadata: {
    allowFullscreen: boolean;
  };
};
