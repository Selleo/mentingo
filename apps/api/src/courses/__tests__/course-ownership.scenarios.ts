export const COURSE_OWNERSHIP_ENDPOINTS = {
  GET: "GET /api/course/course-ownership/:courseId",
  TRANSFER: "POST /api/course/course-ownership/transfer",
} as const;

export type CourseOwnershipEndpoint =
  (typeof COURSE_OWNERSHIP_ENDPOINTS)[keyof typeof COURSE_OWNERSHIP_ENDPOINTS];

export const COURSE_OWNERSHIP_ACTORS = {
  ANONYMOUS: "an anonymous visitor",
  CONTENT_CREATOR: "a content creator",
} as const;

export type CourseOwnershipActor =
  (typeof COURSE_OWNERSHIP_ACTORS)[keyof typeof COURSE_OWNERSHIP_ACTORS];

export const COURSE_OWNERSHIP_ACCESS_REJECTIONS = [
  { actor: COURSE_OWNERSHIP_ACTORS.ANONYMOUS, expectedStatus: 401 },
  { actor: COURSE_OWNERSHIP_ACTORS.CONTENT_CREATOR, expectedStatus: 403 },
];

export const OWNERSHIP_TRANSFER_REJECTIONS = {
  NOT_A_CANDIDATE: "the new owner cannot author courses",
  EXPORTED_COURSE: "the course was exported from a master course",
} as const;

export type OwnershipTransferRejection =
  (typeof OWNERSHIP_TRANSFER_REJECTIONS)[keyof typeof OWNERSHIP_TRANSFER_REJECTIONS];

export const OWNERSHIP_TRANSFER_REJECTION_CASES = [
  {
    rejection: OWNERSHIP_TRANSFER_REJECTIONS.NOT_A_CANDIDATE,
    expectedStatus: 400,
    expectedMessage: "adminCourseView.toast.candidateNotAvailable",
  },
  {
    rejection: OWNERSHIP_TRANSFER_REJECTIONS.EXPORTED_COURSE,
    expectedStatus: 403,
    expectedMessage: "adminCourseView.errors.forbidden.updateCourse",
  },
];

export const OWNERSHIP_LOOKUP_REJECTIONS = {
  UNKNOWN_COURSE: "the course does not exist",
  EXPORTED_COURSE: "the course was exported from a master course",
} as const;

export type OwnershipLookupRejection =
  (typeof OWNERSHIP_LOOKUP_REJECTIONS)[keyof typeof OWNERSHIP_LOOKUP_REJECTIONS];

export const OWNERSHIP_LOOKUP_REJECTION_CASES = [
  {
    rejection: OWNERSHIP_LOOKUP_REJECTIONS.UNKNOWN_COURSE,
    expectedStatus: 404,
    expectedMessage: "adminCourseView.toast.courseNotFound",
  },
  {
    rejection: OWNERSHIP_LOOKUP_REJECTIONS.EXPORTED_COURSE,
    expectedStatus: 403,
    expectedMessage: "adminCourseView.errors.forbidden.updateCourse",
  },
];
