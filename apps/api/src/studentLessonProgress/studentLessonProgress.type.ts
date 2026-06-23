import type { PermissionKey } from "@repo/shared";
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
};
