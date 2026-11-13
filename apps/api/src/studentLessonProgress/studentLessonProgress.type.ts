import type { CourseStatus, PermissionKey, SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LessonTypes } from "src/lesson/lesson.type";

export const STUDENT_LESSON_PROGRESS_MESSAGE_KEYS = {
  LESSON_COMPLETED: "studentLessonView.scorm.lessonFinished",
  LESSON_PROGRESS_RESET: "studentLessonView.scorm.progressReset",
  LESSON_PROGRESS_UPDATED: "studentLessonView.scorm.progressUpdated",
} as const;

export type StudentLessonProgressMessageKey =
  (typeof STUDENT_LESSON_PROGRESS_MESSAGE_KEYS)[keyof typeof STUDENT_LESSON_PROGRESS_MESSAGE_KEYS];

export type MarkLessonAsIncompleteParams = {
  id: UUIDType;
  studentId: UUIDType;
  userPermissions?: PermissionKey[];
  actor?: CurrentUserType;
  dbInstance?: DatabasePg;
  resetStarted?: boolean;
};

export type MarkLessonProgressResult = {
  messageKey: StudentLessonProgressMessageKey | null;
};

export type EnsureDraftCourseProgressAllowedParams = {
  courseStatus: CourseStatus | null;
  isCourseAuthor: boolean;
  isLearningModeActive: boolean;
  userPermissions: PermissionKey[];
};

export type LessonProgressAccessResult = {
  isAssigned: boolean;
  isFreemium: boolean;
  attempts: number | null;
  lessonIsCompleted: boolean;
  lessonType: LessonTypes;
  chapterId: string;
  courseId: string;
  isCourseAuthor: boolean;
  isLearningModeActive: boolean;
  canTrackProgress: boolean;
  isPublicCoursePreview: boolean;
};

export type FinishQuizProgressParams = {
  chapterId: UUIDType;
  courseId: UUIDType;
  lessonId: UUIDType;
  studentId: UUIDType;
  questionCount: number;
  correctAnswerCount: number;
  score: number;
  attemptNumber: number;
  isQuizPassed: boolean;
  language: SupportedLanguages;
  userPermissions: PermissionKey[];
  // Omitted when acting for the learner (e.g. reviewer grading); the learner is then resolved.
  actor?: CurrentUserType;
  isSupportMode: boolean;
  dbInstance: DatabasePg;
};
