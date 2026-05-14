import type { Question } from "./CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";
import type {
  AiMentorTTSPreset,
  AiMentorType,
  AiMentorVoiceMode,
  SupportedLanguages,
} from "@repo/shared";

export const EDIT_COURSE_TABS = {
  SETTINGS: "Settings",
  CURRICULUM: "Curriculum",
  PRICING: "Pricing",
  STATUS: "Status",
  ENROLLED: "Enrolled",
  EXPORTS: "Exports",
} as const;

export type EditCourseTab = (typeof EDIT_COURSE_TABS)[keyof typeof EDIT_COURSE_TABS];
export type NavigationTab = EditCourseTab;

type AiMentor = {
  id: string;
  lessonId: string;
  aiMentorInstructions: string;
  completionConditions: string;
  type: AiMentorType;
  name: string;
  voiceMode: AiMentorVoiceMode;
  ttsPreset: AiMentorTTSPreset;
  customTtsReference?: string | null;
};

export interface LessonResource {
  id: string;
  fileUrl: string;
  contentType?: string;
  title?: string;
  description?: string;
  fileName?: string;
  allowFullscreen?: boolean;
}
export interface Lesson {
  updatedAt: string;
  type: LessonType;
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
  scormPackageLanguages?: SupportedLanguages[];
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
  CONTENT_LESSON_FORM: "CONTENT_LESSON_FORM",
  QUIZ_FORM: "QUIZ_FORM",
  AI_MENTOR_FORM: "AI_MENTOR_FORM",
  EMBED_FORM: "EMBED_FORM",
  SCORM_LESSON_FORM: "SCORM_LESSON_FORM",
};

export type LessonIcons = "Content" | "Quiz" | "AiMentor" | "Embed";

export const LessonType = {
  CONTENT: "content",
  QUIZ: "quiz",
  AI_MENTOR: "ai_mentor",
  EMBED: "embed",
  SCORM: "scorm",
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
