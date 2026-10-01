import type {
  COURSE_TRANSLATION_STORAGE_TYPES,
  QUIZ_TRANSLATION_TARGET_TYPES,
} from "../course.constants";
import type { SupportedLanguages } from "@repo/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";

export type CourseAuthorMetadata = {
  authorId: UUIDType;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  description: string | null;
  profilePictureReference: string | null;
};

export type CourseTranslationType = {
  id: string;
  base: string;
  field: AnyPgColumn;
  idColumn: AnyPgColumn;
  storageType?: CourseTranslationStorageType;
  quizTarget?: QuizTranslationTarget;
};

export type CourseTranslationStorageType =
  (typeof COURSE_TRANSLATION_STORAGE_TYPES)[keyof typeof COURSE_TRANSLATION_STORAGE_TYPES];

export type QuizTranslationTarget =
  | {
      type: typeof QUIZ_TRANSLATION_TARGET_TYPES.CHOICE_OPTION;
      questionId: UUIDType;
      displayOrder: number;
      isCorrect: boolean;
    }
  | {
      type: typeof QUIZ_TRANSLATION_TARGET_TYPES.TRUE_FALSE_STATEMENT;
      questionId: UUIDType;
      displayOrder: number;
      correctValue: boolean;
    }
  | {
      type: typeof QUIZ_TRANSLATION_TARGET_TYPES.DRAG_AND_DROP_OPTION;
      questionId: UUIDType;
      displayOrder: number;
      targetBlankId: UUIDType | null;
    }
  | {
      type: typeof QUIZ_TRANSLATION_TARGET_TYPES.BLANK_ANSWER_SET;
      blankId: UUIDType;
    };

export type CourseTranslationContext = {
  courseTitle?: string;
  chapterTitle?: string;
  lessonTitle?: string;
  lessonDescription?: string;
  questionTitle?: string;
  questionDescription?: string;
  questionOptions?: string;
  optionText?: string;
  aiJudgeTaskGoal?: string;
  aiJudgeCriterionTitle?: string;
  aiJudgeExpectedBehavior?: string;
  aiJudgeScore?: string;
};

export type ContextualCourseTranslationType = {
  data: CourseTranslationType;
  metadata: string;
  context: CourseTranslationContext;
};

export type CreateChapterForCourseData = {
  courseId: UUIDType;
  authorId: UUIDType;
  title: string;
  displayOrder: number;
  language: SupportedLanguages;
  isFreemium?: boolean;
};
