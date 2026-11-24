import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

export const STUDENT_LIST_VIEWERS = {
  ANONYMOUS: "an anonymous visitor",
  STUDENT: "a student",
} as const;

export type StudentListViewer = (typeof STUDENT_LIST_VIEWERS)[keyof typeof STUDENT_LIST_VIEWERS];

export const STUDENT_LIST_REJECTION_CASES = [
  { viewer: STUDENT_LIST_VIEWERS.ANONYMOUS, expectedStatus: 401, expectedBody: {} },
  {
    viewer: STUDENT_LIST_VIEWERS.STUDENT,
    expectedStatus: 403,
    expectedBody: { message: "auth.error.missingPermission" },
  },
];

export const MATCHING_LEARNER = {
  email: "target.learner@example.com",
  firstName: "Target",
  lastName: "UniqueLastName",
};

export const OTHER_LEARNER = {
  email: "unrelated.student@example.com",
  firstName: "Unrelated",
  lastName: "Student",
};

export const KEYWORD_FILTER_CASES = [
  { field: "first name", keyword: MATCHING_LEARNER.firstName },
  { field: "last name", keyword: MATCHING_LEARNER.lastName },
  { field: "email", keyword: MATCHING_LEARNER.email },
];

export const COURSE_CANDIDATES = [
  {
    roleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    email: "admin-candidate@example.com",
    firstName: "Admin",
    lastName: "Candidate",
    isEnrolled: true,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    email: "content-creator-candidate@example.com",
    firstName: "Content",
    lastName: "Creator",
    isEnrolled: false,
  },
  {
    roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    email: "student-candidate@example.com",
    firstName: "Student",
    lastName: "Candidate",
    isEnrolled: false,
  },
];
