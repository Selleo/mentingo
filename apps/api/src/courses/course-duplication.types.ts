import type { LocalizedText } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CourseSelect } from "src/courses/types/master-course.types";

export type CourseDuplicationSourceCourse = Pick<
  CourseSelect,
  | "id"
  | "title"
  | "description"
  | "baseLanguage"
  | "availableLocales"
  | "authorId"
  | "categoryId"
  | "currency"
  | "courseType"
  | "settings"
>;

export type CreateDraftDuplicateCourseInput = {
  sourceCourse: CourseDuplicationSourceCourse;
  title: LocalizedText;
  authorId: UUIDType;
};
