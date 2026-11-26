import { COURSE_PROGRESS_STATUSES, COURSE_STATUSES } from "@repo/shared";

import type { CourseStatus } from "@repo/shared";

export const LEARNER_COURSE_VISIBILITY_CASES: Array<{
  status: CourseStatus;
  enrolled: boolean;
  listed: boolean;
}> = [
  { status: COURSE_STATUSES.PUBLISHED, enrolled: true, listed: true },
  { status: COURSE_STATUSES.PRIVATE, enrolled: true, listed: true },
  { status: COURSE_STATUSES.DRAFT, enrolled: true, listed: false },
  { status: COURSE_STATUSES.PUBLISHED, enrolled: false, listed: false },
];

export const LEARNER_COURSES = {
  PYTHON: "python",
  JAVASCRIPT: "javascript",
} as const;

export type LearnerCourse = (typeof LEARNER_COURSES)[keyof typeof LEARNER_COURSES];

export const LEARNER_COURSE_FIXTURES: Record<
  LearnerCourse,
  { title: string; description: string }
> = {
  [LEARNER_COURSES.PYTHON]: {
    title: "Python Course",
    description: "Learn advanced Python programming",
  },
  [LEARNER_COURSES.JAVASCRIPT]: {
    title: "JavaScript Course",
    description: "Learn the basics of interactive pages",
  },
};

const { PYTHON, JAVASCRIPT } = LEARNER_COURSES;

export const LEARNER_COURSE_QUERY_CASES: Array<{
  description: string;
  query: Record<string, string | number>;
  expectedCourses: LearnerCourse[];
  expectedPagination: { totalItems: number; page: number; perPage: number };
}> = [
  {
    description: "matches a title fragment",
    query: { title: "Python" },
    expectedCourses: [PYTHON],
    expectedPagination: { totalItems: 1, page: 1, perPage: 20 },
  },
  {
    description: "matches a description fragment",
    query: { description: "interactive" },
    expectedCourses: [JAVASCRIPT],
    expectedPagination: { totalItems: 1, page: 1, perPage: 20 },
  },
  {
    description: "sorts by title descending",
    query: { sort: "-title" },
    expectedCourses: [PYTHON, JAVASCRIPT],
    expectedPagination: { totalItems: 2, page: 1, perPage: 20 },
  },
  {
    description: "returns the requested page",
    query: { sort: "title", page: 2, perPage: 1 },
    expectedCourses: [PYTHON],
    expectedPagination: { totalItems: 2, page: 2, perPage: 1 },
  },
];

export const PROGRESS_COURSES = {
  EARLY_PROGRESS: "early progress",
  LATE_PROGRESS: "late progress",
  COMPLETED: "completed",
} as const;

export type ProgressCourse = (typeof PROGRESS_COURSES)[keyof typeof PROGRESS_COURSES];

export const PROGRESS_CHAPTER_COUNT = 4;

/** Titles are chosen so that title order differs from progress order. */
export const PROGRESS_COURSE_FIXTURES: Record<
  ProgressCourse,
  {
    title: string;
    progress: (typeof COURSE_PROGRESS_STATUSES)[keyof typeof COURSE_PROGRESS_STATUSES];
    finishedChapterCount: number;
    completed: boolean;
  }
> = {
  [PROGRESS_COURSES.EARLY_PROGRESS]: {
    title: "M Early Progress Course",
    progress: COURSE_PROGRESS_STATUSES.IN_PROGRESS,
    finishedChapterCount: 1,
    completed: false,
  },
  [PROGRESS_COURSES.LATE_PROGRESS]: {
    title: "Z Late Progress Course",
    progress: COURSE_PROGRESS_STATUSES.IN_PROGRESS,
    finishedChapterCount: 3,
    completed: false,
  },
  [PROGRESS_COURSES.COMPLETED]: {
    title: "A Completed Course",
    progress: COURSE_PROGRESS_STATUSES.COMPLETED,
    finishedChapterCount: 1,
    completed: true,
  },
};

export const COURSE_TRAILER_REFERENCE = "course-trailers/trailer.mp4";
