import { COURSE_STATUSES } from "@repo/shared";

export const CATALOG_COURSES = {
  ALPHA: "alpha",
  BRAVO: "bravo",
  CHARLIE: "charlie",
  DRAFT: "draft",
  ARCHIVED: "archived",
} as const;

export const SORT_EXPECTATIONS = {
  EXACT_ORDER: "in exact order",
  ANY_ORDER: "in any order",
} as const;

export const ENROLLMENT_STATES = {
  ENROLLED: "enrolled",
  NOT_ENROLLED: "unenrolled",
  NONE: "never enrolled",
} as const;

export type CatalogCourse = (typeof CATALOG_COURSES)[keyof typeof CATALOG_COURSES];
export type SortExpectation = (typeof SORT_EXPECTATIONS)[keyof typeof SORT_EXPECTATIONS];
export type EnrollmentState = (typeof ENROLLMENT_STATES)[keyof typeof ENROLLMENT_STATES];

export type CatalogCourseFixture = {
  title: string;
  categoryTitle: string;
  author: { firstName: string; lastName: string };
  createdAt: string;
  status: (typeof COURSE_STATUSES)[keyof typeof COURSE_STATUSES];
  isArchived: boolean;
};

export const CATALOG_COURSE_FIXTURES: Record<CatalogCourse, CatalogCourseFixture> = {
  [CATALOG_COURSES.ALPHA]: {
    title: "Alpha catalog course",
    categoryTitle: "Zulu category",
    author: { firstName: "Carol", lastName: "Cole" },
    createdAt: "2025-01-03T00:00:00.000Z",
    status: COURSE_STATUSES.PUBLISHED,
    isArchived: false,
  },
  [CATALOG_COURSES.BRAVO]: {
    title: "Bravo catalog course",
    categoryTitle: "Alpha category",
    author: { firstName: "Alice", lastName: "Abbot" },
    createdAt: "2025-01-01T00:00:00.000Z",
    status: COURSE_STATUSES.PUBLISHED,
    isArchived: false,
  },
  [CATALOG_COURSES.CHARLIE]: {
    title: "Charlie catalog course",
    categoryTitle: "Mike category",
    author: { firstName: "Bob", lastName: "Baker" },
    createdAt: "2025-01-02T00:00:00.000Z",
    status: COURSE_STATUSES.PUBLISHED,
    isArchived: false,
  },
  [CATALOG_COURSES.DRAFT]: {
    title: "Delta draft course",
    categoryTitle: "Draft category",
    author: { firstName: "Dana", lastName: "Doe" },
    createdAt: "2025-01-04T00:00:00.000Z",
    status: COURSE_STATUSES.DRAFT,
    isArchived: false,
  },
  [CATALOG_COURSES.ARCHIVED]: {
    title: "Echo archived course",
    categoryTitle: "Archived category",
    author: { firstName: "Eve", lastName: "Evans" },
    createdAt: "2025-01-05T00:00:00.000Z",
    status: COURSE_STATUSES.PUBLISHED,
    isArchived: true,
  },
};

const { ALPHA, BRAVO, CHARLIE } = CATALOG_COURSES;

export const AVAILABLE_COURSE_SORT_CASES: {
  sort: string;
  expectation: SortExpectation;
  expectedCourses: CatalogCourse[];
}[] = [
  {
    sort: "title",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [ALPHA, BRAVO, CHARLIE],
  },
  {
    sort: "-title",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [CHARLIE, BRAVO, ALPHA],
  },
  {
    sort: "category",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [BRAVO, CHARLIE, ALPHA],
  },
  {
    sort: "-category",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [ALPHA, CHARLIE, BRAVO],
  },
  {
    sort: "author",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [BRAVO, CHARLIE, ALPHA],
  },
  {
    sort: "-author",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [ALPHA, CHARLIE, BRAVO],
  },
  {
    sort: "creationDate",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [BRAVO, CHARLIE, ALPHA],
  },
  {
    sort: "-creationDate",
    expectation: SORT_EXPECTATIONS.EXACT_ORDER,
    expectedCourses: [ALPHA, CHARLIE, BRAVO],
  },
  {
    sort: "chapterCount",
    expectation: SORT_EXPECTATIONS.ANY_ORDER,
    expectedCourses: [ALPHA, BRAVO, CHARLIE],
  },
  {
    sort: "enrolledParticipantsCount",
    expectation: SORT_EXPECTATIONS.ANY_ORDER,
    expectedCourses: [ALPHA, BRAVO, CHARLIE],
  },
];

export const RECENT_ENROLLMENT_DAYS_AGO = 1;
export const OLD_ENROLLMENT_DAYS_AGO = 60;

/** Bravo has two recent enrollments, Charlie one recent, Alpha only an old one. */
export const TOP_COURSE_ENROLLMENTS: { course: CatalogCourse; enrolledDaysAgo: number }[] = [
  { course: BRAVO, enrolledDaysAgo: RECENT_ENROLLMENT_DAYS_AGO },
  { course: BRAVO, enrolledDaysAgo: RECENT_ENROLLMENT_DAYS_AGO },
  { course: CHARLIE, enrolledDaysAgo: RECENT_ENROLLMENT_DAYS_AGO },
  { course: ALPHA, enrolledDaysAgo: OLD_ENROLLMENT_DAYS_AGO },
];

export const TOP_COURSE_CASES: {
  description: string;
  query: { days?: number; limit?: number };
  expectedCourses: CatalogCourse[];
}[] = [
  {
    description: "ranks by enrollments in the last 30 days, newest course first on ties",
    query: {},
    expectedCourses: [BRAVO, CHARLIE, ALPHA],
  },
  {
    description: "counts older enrollments when the window is widened",
    query: { days: 90 },
    expectedCourses: [BRAVO, ALPHA, CHARLIE],
  },
  {
    description: "returns no more courses than the limit",
    query: { limit: 1 },
    expectedCourses: [BRAVO],
  },
];

export const PUBLISHED_LOOKUP_CASES: {
  description: string;
  query: { title?: string; page?: number; perPage?: number };
  expectedCourses: CatalogCourse[];
  expectedTotal: number;
}[] = [
  {
    description: "lists published, unarchived courses by title",
    query: {},
    expectedCourses: [ALPHA, BRAVO, CHARLIE],
    expectedTotal: 3,
  },
  {
    description: "matches a trimmed, case-insensitive title fragment",
    query: { title: "  BRAVO " },
    expectedCourses: [BRAVO],
    expectedTotal: 1,
  },
  {
    description: "paginates the results",
    query: { page: 2, perPage: 2 },
    expectedCourses: [CHARLIE],
    expectedTotal: 3,
  },
];

export const AVAILABLE_CATEGORY_CASES: {
  description: string;
  viewerEnrolledIn: CatalogCourse[];
  query: { page?: number; perPage?: number };
  expectedCategories: string[];
  expectedTotal: number;
}[] = [
  {
    description: "lists categories of published, unarchived courses by title",
    viewerEnrolledIn: [],
    query: {},
    expectedCategories: ["Alpha category", "Mike category", "Zulu category"],
    expectedTotal: 3,
  },
  {
    description: "skips categories whose only course the viewer is enrolled in",
    viewerEnrolledIn: [BRAVO],
    query: {},
    expectedCategories: ["Mike category", "Zulu category"],
    expectedTotal: 2,
  },
  {
    description: "paginates the categories",
    viewerEnrolledIn: [],
    query: { page: 2, perPage: 1 },
    expectedCategories: ["Mike category"],
    expectedTotal: 3,
  },
];

export const MARK_COURSE_OPENED_CASES: {
  enrollmentState: EnrollmentState;
  expectedStatus: number;
}[] = [
  { enrollmentState: ENROLLMENT_STATES.ENROLLED, expectedStatus: 201 },
  { enrollmentState: ENROLLMENT_STATES.NOT_ENROLLED, expectedStatus: 403 },
  { enrollmentState: ENROLLMENT_STATES.NONE, expectedStatus: 403 },
];

export const LESSON_SEQUENCE_CASES: { lessonSequenceEnabled: boolean }[] = [
  { lessonSequenceEnabled: true },
  { lessonSequenceEnabled: false },
];
