import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema, type UUIDType } from "src/common";

import type { UserRole } from "src/user/schemas/userRoles";

export const courseSortFields = [
  "title",
  "category",
  "creationDate",
  "author",
  "chapterCount",
  "enrolledParticipantsCount",
] as const;

export const CourseSortFields: Record<CourseSortField, CourseSortField> = {
  title: "title",
  category: "category",
  creationDate: "creationDate",
  author: "author",
  chapterCount: "chapterCount",
  enrolledParticipantsCount: "enrolledParticipantsCount",
};

export type CourseSortField = (typeof courseSortFields)[number];

export const sortCourseFieldsOptions = Type.Union([
  Type.Literal("title"),
  Type.Literal("category"),
  Type.Literal("creationDate"),
  Type.Literal("author"),
  Type.Literal("chapterCount"),
  Type.Literal("enrolledParticipantsCount"),
  Type.Literal("-title"),
  Type.Literal("-category"),
  Type.Literal("-creationDate"),
  Type.Literal("-author"),
  Type.Literal("-chapterCount"),
  Type.Literal("-enrolledParticipantsCount"),
]);

export type SortCourseFieldsOptions = Static<typeof sortCourseFieldsOptions>;

export const coursesStatusOptions = Type.Union([
  Type.Literal("draft"),
  Type.Literal("published"),
  Type.Literal("private"),
]);

export type CoursesStatusOptions = Static<typeof coursesStatusOptions>;

export const coursesFilterFiled = Type.Union([
  Type.Literal("title"),
  Type.Literal("category"),
  Type.Literal("creationDateRange"),
  Type.Literal("author"),
]);

export type CoursesFilterFiled = Static<typeof coursesFilterFiled>;

export const coursesFilterSchema = Type.Object({
  title: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  status: Type.Optional(coursesStatusOptions),
  creationDateRange: Type.Optional(
    Type.Tuple([Type.String({ format: "date-time" }), Type.String({ format: "date-time" })]),
  ),
  author: Type.Optional(Type.String()),
});

export type CoursesFilterSchema = Static<typeof coursesFilterSchema>;

export type CoursesQuery = {
  filters?: CoursesFilterSchema;
  page?: number;
  perPage?: number;
  sort?: SortCourseFieldsOptions;
  currentUserId?: UUIDType;
  currentUserRole?: UserRole;
  excludeCourseId?: UUIDType;
};

export const COURSE_ENROLLMENT_SCOPES = {
  ALL: "all",
  ENROLLED: "enrolled",
  AVAILABLE: "available",
} as const;

export type CourseEnrollmentScope =
  (typeof COURSE_ENROLLMENT_SCOPES)[keyof typeof COURSE_ENROLLMENT_SCOPES];

// enrolledStudent query

export const enrolledStudentSortFields = ["enrolledAt"] as const;

export const EnrolledStudentSortFields: Record<string, string> = {
  enrolledAt: "enrolledAt",
};

export type EnrolledStudentSortField = (typeof enrolledStudentSortFields)[number];

export const sortEnrolledStudentsOptions = Type.Union([
  Type.Literal("enrolledAt"),
  Type.Literal("-enrolledAt"),
]);

export type SortEnrolledStudentsOptions = Static<typeof sortEnrolledStudentsOptions>;

export const enrolledStudentFilterSchema = Type.Object({
  keyword: Type.String(),
  sort: sortEnrolledStudentsOptions,
  groupId: Type.Optional(UUIDSchema),
});

export type EnrolledStudentFilterSchema = Static<typeof enrolledStudentFilterSchema>;
