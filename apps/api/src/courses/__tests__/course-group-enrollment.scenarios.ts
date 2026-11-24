import { LESSON_TYPES } from "@repo/shared";

export const GROUP_ENROLLMENT_COURSE_CONTENT = [{ lessonTypes: [LESSON_TYPES.QUIZ] }];

export const GROUP_DUE_DATE = "2025-01-15T12:00:00.000Z";
export const UPDATED_GROUP_DUE_DATE = "2025-03-02T10:45:00.000Z";

export const CALENDAR_RANGE = {
  start: "2025-01-01T00:00:00.000Z",
  end: "2025-02-01T00:00:00.000Z",
};

export const GROUP_REQUEST_REJECTIONS = {
  ANONYMOUS: "the requester is anonymous",
  STUDENT: "the requester is a student",
  MISSING_COURSE: "the course does not exist",
  GROUP_NOT_ENROLLED: "the group is not enrolled in the course",
} as const;

export type GroupRequestRejection =
  (typeof GROUP_REQUEST_REJECTIONS)[keyof typeof GROUP_REQUEST_REJECTIONS];

export const GROUP_ENROLLMENT_REJECTION_CASES = [
  { rejection: GROUP_REQUEST_REJECTIONS.ANONYMOUS, expectedStatus: 401 },
  { rejection: GROUP_REQUEST_REJECTIONS.STUDENT, expectedStatus: 403 },
  { rejection: GROUP_REQUEST_REJECTIONS.MISSING_COURSE, expectedStatus: 404 },
];

export const GROUP_UNENROLLMENT_REJECTION_CASES = [
  { rejection: GROUP_REQUEST_REJECTIONS.ANONYMOUS, expectedStatus: 401 },
  { rejection: GROUP_REQUEST_REJECTIONS.STUDENT, expectedStatus: 403 },
  { rejection: GROUP_REQUEST_REJECTIONS.GROUP_NOT_ENROLLED, expectedStatus: 404 },
];

export const GROUP_MEMBER_ENROLLMENT_CASES = [
  { members: "some members are directly enrolled", memberCount: 3, directlyEnrolledCount: 2 },
  { members: "every member is directly enrolled", memberCount: 2, directlyEnrolledCount: 2 },
];
