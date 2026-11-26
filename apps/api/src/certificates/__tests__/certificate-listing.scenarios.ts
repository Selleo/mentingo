export const ANONYMOUS_LISTING_PATHS = [
  { path: "/api/certificates/all" },
  { path: "/api/certificates/certificate" },
  { path: "/api/certificates/dashboard" },
  { path: "/api/certificates/dashboard-summary" },
];

export const MISSING_CERTIFICATE_KINDS = {
  NEVER_ISSUED: "was never issued",
  ARCHIVED: "is archived",
} as const;

export type MissingCertificateKind =
  (typeof MISSING_CERTIFICATE_KINDS)[keyof typeof MISSING_CERTIFICATE_KINDS];

export const MISSING_CERTIFICATE_CASES = [
  { kind: MISSING_CERTIFICATE_KINDS.NEVER_ISSUED },
  { kind: MISSING_CERTIFICATE_KINDS.ARCHIVED },
];

export const COURSE_ROW_GROUP_FILTERS = {
  EMPTY_GROUP: "an empty group",
  LEARNER_GROUP: "the learner's group",
} as const;

export type CourseRowGroupFilter =
  (typeof COURSE_ROW_GROUP_FILTERS)[keyof typeof COURSE_ROW_GROUP_FILTERS];

export const COURSE_ROW_GROUP_FILTER_CASES = [
  { groupFilter: COURSE_ROW_GROUP_FILTERS.EMPTY_GROUP, expectedRowCount: 0 },
  { groupFilter: COURSE_ROW_GROUP_FILTERS.LEARNER_GROUP, expectedRowCount: 1 },
];

export const COURSE_ROW_REJECTIONS = {
  ANONYMOUS_REQUESTER: "the requester is anonymous",
  STUDENT_REQUESTER: "the requester is a student",
  FOREIGN_AUTHOR: "the requester authors other courses only",
} as const;

export type CourseRowRejection = (typeof COURSE_ROW_REJECTIONS)[keyof typeof COURSE_ROW_REJECTIONS];

export const COURSE_ROW_REJECTION_CASES = [
  { rejection: COURSE_ROW_REJECTIONS.ANONYMOUS_REQUESTER, expectedStatus: 401, expectedBody: {} },
  {
    rejection: COURSE_ROW_REJECTIONS.STUDENT_REQUESTER,
    expectedStatus: 403,
    expectedBody: { message: "auth.error.missingPermission" },
  },
  {
    rejection: COURSE_ROW_REJECTIONS.FOREIGN_AUTHOR,
    expectedStatus: 403,
    expectedBody: { message: "adminCourseView.errors.statisticsAccessForbidden" },
  },
];
