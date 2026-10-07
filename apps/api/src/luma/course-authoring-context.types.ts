/**
 * Internal contracts for Core-owned authoring context assembly.
 *
 * Full context remains the public TypeBox response. Selected detail is deliberately
 * smaller for server-side continuation fulfillment and must not grow into a second
 * public context contract.
 */
import type { AuthoringCourseContext } from "./schema/course-authoring.schema";
import type { LessonTypes } from "@repo/shared";
import type { UUIDType } from "src/common";

export type AuthoringLessonContext = AuthoringCourseContext["chapters"][number]["lessons"][number];
export type AuthoringChapterContext = AuthoringCourseContext["chapters"][number];

/** Localized content lesson text eligible for retrieval by a Mentor in the same course. */
export type AuthoringMentorContextLesson = {
  id: UUIDType;
  chapterId: UUIDType;
  chapterTitle: string | null;
  title: string | null;
  description: string | null;
};

/** Detail-only context returned to a server-side continuation fulfillment. */
export type AuthoringSelectedLessonDetails = Pick<
  AuthoringCourseContext,
  "courseId" | "language"
> & {
  chapters: Array<
    Pick<AuthoringChapterContext, "id" | "title" | "displayOrder"> & {
      lessons: AuthoringLessonContext[];
    }
  >;
};

export type AuthoringContextLessonRow = {
  id: UUIDType;
  chapterId: UUIDType;
  title: string | null;
  description: string | null;
  lessonType: LessonTypes;
  displayOrder: number | null;
  updatedAt: string;
};

export type AuthoringContextChapterRow = {
  id: UUIDType;
  title: string | null;
  displayOrder: number | null;
};

export type AuthoringContextAssessmentRow = {
  lessonId: UUIDType;
  attemptCount: number;
  cooldownHours: number | null;
};

export type AuthoringContextMentorVersionRow = {
  lessonId: UUIDType;
  configurationUpdatedAt: string | null;
  judgeUpdatedAt: string | null;
};
