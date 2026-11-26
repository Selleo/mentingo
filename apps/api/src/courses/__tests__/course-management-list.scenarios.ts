import { COURSE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { COURSE_ENROLLMENT_SCOPES } from "src/courses/schemas/courseQuery";

import type { CourseStatus } from "@repo/shared";

export const MANAGEMENT_VIEWERS = {
  ADMIN: "admin",
  CONTENT_CREATOR: "content creator",
  CONTENT_CREATOR_WITH_ADMIN_ROLE: "content creator who is also an admin",
  STUDENT: "student",
  STUDENT_GROUP_MANAGER: "student who also manages a group",
} as const;

export type ManagementViewer = (typeof MANAGEMENT_VIEWERS)[keyof typeof MANAGEMENT_VIEWERS];

export const VISIBILITY_COURSES = {
  VIEWER_AUTHORED: "viewer authored",
  PUBLISHED: "published",
  ENROLLED_PRIVATE: "private with viewer enrolled",
  PRIVATE: "private",
  DRAFT: "draft",
  MANAGED_GROUP_DRAFT: "draft assigned to a group",
  ARCHIVED: "archived",
} as const;

export type VisibilityCourse = (typeof VISIBILITY_COURSES)[keyof typeof VISIBILITY_COURSES];

export const OTHER_AUTHOR_VISIBILITY_COURSE_FIXTURES: Record<
  Exclude<VisibilityCourse, typeof VISIBILITY_COURSES.VIEWER_AUTHORED>,
  { status: CourseStatus; isArchived: boolean }
> = {
  [VISIBILITY_COURSES.PUBLISHED]: { status: COURSE_STATUSES.PUBLISHED, isArchived: false },
  [VISIBILITY_COURSES.ENROLLED_PRIVATE]: { status: COURSE_STATUSES.PRIVATE, isArchived: false },
  [VISIBILITY_COURSES.PRIVATE]: { status: COURSE_STATUSES.PRIVATE, isArchived: false },
  [VISIBILITY_COURSES.DRAFT]: { status: COURSE_STATUSES.DRAFT, isArchived: false },
  [VISIBILITY_COURSES.MANAGED_GROUP_DRAFT]: { status: COURSE_STATUSES.DRAFT, isArchived: false },
  [VISIBILITY_COURSES.ARCHIVED]: { status: COURSE_STATUSES.PUBLISHED, isArchived: true },
};

const ALL_VISIBILITY_COURSES = Object.values(VISIBILITY_COURSES);

export const ALL_COURSES_VISIBILITY_CASES: Array<{
  viewer: ManagementViewer;
  managesAssignedGroup: boolean;
  expectedCourses: VisibilityCourse[];
}> = [
  {
    viewer: MANAGEMENT_VIEWERS.ADMIN,
    managesAssignedGroup: false,
    expectedCourses: ALL_VISIBILITY_COURSES,
  },
  {
    viewer: MANAGEMENT_VIEWERS.CONTENT_CREATOR,
    managesAssignedGroup: false,
    expectedCourses: [VISIBILITY_COURSES.VIEWER_AUTHORED],
  },
  {
    viewer: MANAGEMENT_VIEWERS.CONTENT_CREATOR_WITH_ADMIN_ROLE,
    managesAssignedGroup: false,
    expectedCourses: ALL_VISIBILITY_COURSES,
  },
  {
    viewer: MANAGEMENT_VIEWERS.STUDENT,
    managesAssignedGroup: false,
    expectedCourses: [
      VISIBILITY_COURSES.VIEWER_AUTHORED,
      VISIBILITY_COURSES.PUBLISHED,
      VISIBILITY_COURSES.ENROLLED_PRIVATE,
    ],
  },
  {
    viewer: MANAGEMENT_VIEWERS.STUDENT_GROUP_MANAGER,
    managesAssignedGroup: true,
    expectedCourses: [
      VISIBILITY_COURSES.VIEWER_AUTHORED,
      VISIBILITY_COURSES.PUBLISHED,
      VISIBILITY_COURSES.ENROLLED_PRIVATE,
      VISIBILITY_COURSES.MANAGED_GROUP_DRAFT,
    ],
  },
];

export const FILTER_COURSES = {
  PYTHON: "python",
  JAVASCRIPT: "javascript",
  RUST: "rust",
} as const;

export type FilterCourse = (typeof FILTER_COURSES)[keyof typeof FILTER_COURSES];

export const FILTER_COURSE_FIXTURES: Record<
  FilterCourse,
  { title: string; description: string; status: CourseStatus; createdAt: string }
> = {
  [FILTER_COURSES.PYTHON]: {
    title: "Python Course",
    description: "Analyse data with notebooks",
    status: COURSE_STATUSES.PUBLISHED,
    createdAt: "2023-01-01T00:00:00.000Z",
  },
  [FILTER_COURSES.JAVASCRIPT]: {
    title: "JavaScript Course",
    description: "Build interactive pages",
    status: COURSE_STATUSES.DRAFT,
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  [FILTER_COURSES.RUST]: {
    title: "Rust Course",
    description: "Write safe systems code",
    status: COURSE_STATUSES.PRIVATE,
    createdAt: "2024-06-01T00:00:00.000Z",
  },
};

export const LIST_ORDERS = {
  EXACT: "in exact order",
  ANY: "in any order",
} as const;

export type ListOrder = (typeof LIST_ORDERS)[keyof typeof LIST_ORDERS];

const { PYTHON, JAVASCRIPT, RUST } = FILTER_COURSES;

export const ALL_COURSES_FILTER_CASES: Array<{
  description: string;
  query: Record<string, string | number>;
  order: ListOrder;
  expectedCourses: FilterCourse[];
  expectedTotal: number;
}> = [
  {
    description: "matches a title fragment",
    query: { title: "Python" },
    order: LIST_ORDERS.ANY,
    expectedCourses: [PYTHON],
    expectedTotal: 1,
  },
  {
    description: "matches a description fragment",
    query: { description: "notebooks" },
    order: LIST_ORDERS.ANY,
    expectedCourses: [PYTHON],
    expectedTotal: 1,
  },
  {
    description: "keeps published courses",
    query: { status: COURSE_STATUSES.PUBLISHED },
    order: LIST_ORDERS.ANY,
    expectedCourses: [PYTHON],
    expectedTotal: 1,
  },
  {
    description: "keeps draft courses",
    query: { status: COURSE_STATUSES.DRAFT },
    order: LIST_ORDERS.ANY,
    expectedCourses: [JAVASCRIPT],
    expectedTotal: 1,
  },
  {
    description: "keeps private courses",
    query: { status: COURSE_STATUSES.PRIVATE },
    order: LIST_ORDERS.ANY,
    expectedCourses: [RUST],
    expectedTotal: 1,
  },
  {
    description: "keeps courses created inside the date range",
    query: {
      "creationDateRange[0]": "2023-12-01T00:00:00.000Z",
      "creationDateRange[1]": "2024-02-01T00:00:00.000Z",
    },
    order: LIST_ORDERS.ANY,
    expectedCourses: [JAVASCRIPT],
    expectedTotal: 1,
  },
  {
    description: "returns nothing for a date range without courses",
    query: {
      "creationDateRange[0]": "2025-01-01T00:00:00.000Z",
      "creationDateRange[1]": "2025-01-01T00:00:00.000Z",
    },
    order: LIST_ORDERS.ANY,
    expectedCourses: [],
    expectedTotal: 0,
  },
  {
    description: "sorts by title descending",
    query: { sort: "-title" },
    order: LIST_ORDERS.EXACT,
    expectedCourses: [RUST, PYTHON, JAVASCRIPT],
    expectedTotal: 3,
  },
  {
    description: "returns the requested page",
    query: { sort: "title", page: 2, perPage: 2 },
    order: LIST_ORDERS.EXACT,
    expectedCourses: [RUST],
    expectedTotal: 3,
  },
];

export const POLISH_CATEGORY_TITLE = "Kategoria kursu";
export const ENGLISH_CATEGORY_TITLE = "Course category";

export const CATEGORY_LANGUAGE_CASES: Array<{
  description: string;
  language: string;
  categoryFilter?: string;
  expectedCategories: string[];
}> = [
  {
    description: "shows the category in the requested language",
    language: SUPPORTED_LANGUAGES.PL,
    expectedCategories: [POLISH_CATEGORY_TITLE],
  },
  {
    description: "filters by the category title in the requested language",
    language: SUPPORTED_LANGUAGES.PL,
    categoryFilter: POLISH_CATEGORY_TITLE,
    expectedCategories: [POLISH_CATEGORY_TITLE],
  },
  {
    description: "does not match a category title from another language",
    language: SUPPORTED_LANGUAGES.EN,
    categoryFilter: POLISH_CATEGORY_TITLE,
    expectedCategories: [],
  },
];

export const AUTHOR_COURSES = {
  ENROLLED: "enrolled",
  AVAILABLE: "available",
  DRAFT: "draft",
  OTHER_AUTHOR: "other author's",
} as const;

export type AuthorCourse = (typeof AUTHOR_COURSES)[keyof typeof AUTHOR_COURSES];

export const AUTHOR_FIXTURE = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
};

export const ENROLLED_AUTHOR_COURSE_DETAILS = {
  chapterCount: 3,
  priceInCents: 1999,
  currency: "usd",
};

export const AUTHOR_COURSE_SCOPE_CASES: Array<{
  description: string;
  scope?: string;
  excludedCourse?: AuthorCourse;
  expectedCourses: Array<{ course: AuthorCourse; enrolled: boolean }>;
}> = [
  {
    description: "lists the author's published courses",
    expectedCourses: [
      { course: AUTHOR_COURSES.ENROLLED, enrolled: true },
      { course: AUTHOR_COURSES.AVAILABLE, enrolled: false },
    ],
  },
  {
    description: "lists only courses the viewer is enrolled in for the enrolled scope",
    scope: COURSE_ENROLLMENT_SCOPES.ENROLLED,
    expectedCourses: [{ course: AUTHOR_COURSES.ENROLLED, enrolled: true }],
  },
  {
    description: "lists only courses the viewer can still join for the available scope",
    scope: COURSE_ENROLLMENT_SCOPES.AVAILABLE,
    expectedCourses: [{ course: AUTHOR_COURSES.AVAILABLE, enrolled: false }],
  },
  {
    description: "skips the excluded course",
    scope: COURSE_ENROLLMENT_SCOPES.ALL,
    excludedCourse: AUTHOR_COURSES.ENROLLED,
    expectedCourses: [{ course: AUTHOR_COURSES.AVAILABLE, enrolled: false }],
  },
];

export const SHORT_LESSON_DESCRIPTION = "Short readable lesson content.";
export const LONG_LESSON_WORD_COUNT = 500;
export const SHORT_LESSON_ESTIMATE_SECONDS = 2;
export const LONG_LESSON_ESTIMATE_SECONDS = 150;
export const LISTED_DURATION_MINUTES = 15;
