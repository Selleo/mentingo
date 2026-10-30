import type {
  CourseEnrollmentScope,
  CoursesFilterSchema,
  CoursesQuery,
} from "../schemas/courseQuery";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CourseListAccessScope = Pick<
  CoursesQuery,
  "currentUser" | "currentUserId" | "currentUserPermissions"
>;

export type CourseCatalogPageOptions = {
  page: number;
  perPage: number;
  sort: string;
};

export type ManagedCoursesFilters = {
  filters: CoursesFilterSchema;
  includeArchived?: boolean;
  language: SupportedLanguages;
  accessScope: CourseListAccessScope;
};

export type StudentCoursesFilters = {
  studentId: UUIDType;
  filters: CoursesFilterSchema;
  language: SupportedLanguages;
};

export type AvailableCoursesFilters = {
  filters: CoursesFilterSchema;
  language: SupportedLanguages;
  currentUserId?: UUIDType;
  availableCourseIds: UUIDType[];
};

export type TopCoursesFilters = {
  language: SupportedLanguages;
  enrolledSince: string;
  limit: number;
  availableCourseIds: UUIDType[];
};

export type ContentCreatorCoursesFilters = {
  currentUserId: UUIDType;
  authorId: UUIDType;
  scope: CourseEnrollmentScope;
  excludeCourseId?: UUIDType;
  title?: string;
  description?: string;
  language: SupportedLanguages;
  availableCourseIds: UUIDType[];
};
