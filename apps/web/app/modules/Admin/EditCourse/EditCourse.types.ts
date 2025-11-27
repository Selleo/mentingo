import type { Question } from "./CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";
import type { AiMentorType } from "@repo/shared";

export type NavigationTab = "Settings" | "Curriculum" | "Pricing" | "Status";

export const LessonResourceType = {
  EMBED: "embed",
} as const;

type AiMentor = {
  id: string;
  lessonId: string;
  aiMentorInstructions: string;
  completionConditions: string;
  type: AiMentorType;
  name: string;
};

export interface LessonResource {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  isExternal: boolean;
  displayOrder: number;
  allowFullscreen: boolean;
  type: (typeof LessonResourceType)[keyof typeof LessonResourceType];
}
export interface Lesson {
  updatedAt: string;
  type: string;
  displayOrder: number;
  id: string;
  title: string;
  description: string;
  thresholdScore?: number;
  attemptsLimit?: number;
  quizCooldownInHours?: number;
  fileS3Key?: string;
  fileS3SignedUrl?: string;
  avatarReferenceUrl?: string;
  fileType?: string;
  chapterId?: string;
  questions?: Question[];
  lessonResources?: LessonResource[];
  isExternal?: boolean;
  aiMentor?: AiMentor;
}

export interface Chapter {
  id: string;
  title: string;
  updatedAt: string;
  // description: string | null;
  // imageUrl: string | null;
  displayOrder: number;
  isFree: boolean;
  lessonCount: number;
  lessons: Lesson[];
}

export const ContentTypes = {
  EMPTY: "EMPTY",
  CHAPTER_FORM: "CHAPTER_FORM",
  SELECT_LESSON_TYPE: "SELECT_LESSON_TYPE",
  TEXT_LESSON_FORM: "TEXT_LESSON_FORM",
  VIDEO_LESSON_FORM: "VIDEO_LESSON_FORM",
  PRESENTATION_FORM: "PRESENTATION_FORM",
  QUIZ_FORM: "QUIZ_FORM",
  AI_MENTOR_FORM: "AI_MENTOR_FORM",
  EMBED_FORM: "EMBED_FORM",
};

export type LessonIcons = "Text" | "Video" | "Presentation" | "Quiz" | "AiMentor" | "Embed";

export const LessonType = {
  VIDEO: "video",
  TEXT: "text",
  PRESENTATION: "presentation",
  QUIZ: "quiz",
  AI_MENTOR: "ai_mentor",
  EMBED: "embed",
} as const;

export type LessonType = (typeof LessonType)[keyof typeof LessonType];

export const DeleteContentType = {
  ...LessonType,
  CHAPTER: "chapter",
  QUESTION: "question",
  COURSE: "course",
  CATEGORY: "category",
} as const;

export type DeleteContentType = (typeof DeleteContentType)[keyof typeof DeleteContentType];
