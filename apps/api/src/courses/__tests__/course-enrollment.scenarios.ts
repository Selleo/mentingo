import { LESSON_TYPES } from "@repo/shared";

export const ENROLLMENT_COURSE_CONTENT = [
  { lessonTypes: [LESSON_TYPES.QUIZ, LESSON_TYPES.CONTENT] },
  { lessonTypes: [] },
];

export const SELF_ENROLLMENT_REJECTIONS = {
  MISSING_COURSE: "the course does not exist",
  OWN_COURSE: "the learner authored the course",
  ARCHIVED_COURSE: "the course is archived",
  ALREADY_ENROLLED: "the learner is already enrolled",
} as const;

export type SelfEnrollmentRejection =
  (typeof SELF_ENROLLMENT_REJECTIONS)[keyof typeof SELF_ENROLLMENT_REJECTIONS];

export const SELF_ENROLLMENT_REJECTION_CASES = [
  {
    rejection: SELF_ENROLLMENT_REJECTIONS.MISSING_COURSE,
    expectedStatus: 404,
    expectedMessage: "adminCourseView.errors.notFound.course",
  },
  {
    rejection: SELF_ENROLLMENT_REJECTIONS.OWN_COURSE,
    expectedStatus: 403,
    expectedMessage: "adminCourseView.errors.forbidden.enrollOwnCourse",
  },
  {
    rejection: SELF_ENROLLMENT_REJECTIONS.ARCHIVED_COURSE,
    expectedStatus: 403,
    expectedMessage: "adminCourseView.errors.forbidden.archivedCourseEnrollment",
  },
  {
    rejection: SELF_ENROLLMENT_REJECTIONS.ALREADY_ENROLLED,
    expectedStatus: 409,
    expectedMessage: "adminCourseView.errors.enrollment.alreadyEnrolled",
  },
];

export const BULK_ENROLLMENT_REJECTIONS = {
  ANONYMOUS_REQUESTER: "the requester is anonymous",
  STUDENT_REQUESTER: "the requester is a student",
  MISSING_COURSE: "the course does not exist",
  NO_STUDENTS: "no students are given",
  UNKNOWN_STUDENT: "a student does not exist",
  DELETED_STUDENT: "a student is deleted",
  ALREADY_ENROLLED: "the students are already enrolled",
} as const;

export type BulkEnrollmentRejection =
  (typeof BULK_ENROLLMENT_REJECTIONS)[keyof typeof BULK_ENROLLMENT_REJECTIONS];

export const BULK_ENROLLMENT_REJECTION_CASES = [
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.ANONYMOUS_REQUESTER,
    expectedStatus: 401,
    expectedBody: {},
  },
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.STUDENT_REQUESTER,
    expectedStatus: 403,
    expectedBody: { message: "auth.error.missingPermission" },
  },
  { rejection: BULK_ENROLLMENT_REJECTIONS.MISSING_COURSE, expectedStatus: 404, expectedBody: {} },
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.NO_STUDENTS,
    expectedStatus: 400,
    expectedBody: { message: "adminCourseView.errors.enrollment.studentsRequired" },
  },
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.UNKNOWN_STUDENT,
    expectedStatus: 400,
    expectedBody: { message: "adminCourseView.errors.enrollment.onlyExistingUsers" },
  },
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.DELETED_STUDENT,
    expectedStatus: 400,
    expectedBody: { message: "adminCourseView.errors.enrollment.onlyExistingUsers" },
  },
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.ALREADY_ENROLLED,
    expectedStatus: 409,
    expectedBody: { message: "adminCourseView.errors.enrollment.studentsAlreadyEnrolled" },
  },
];

export const UNENROLLMENT_REJECTIONS = {
  NEVER_ENROLLED: "the student was never enrolled",
  ALREADY_UNENROLLED: "the student is already unenrolled",
  ENROLLED_BY_GROUP: "the student is enrolled by a group",
  ENROLLED_DIRECTLY_THEN_BY_GROUP: "the student was enrolled directly and then by a group",
} as const;

export type UnenrollmentRejection =
  (typeof UNENROLLMENT_REJECTIONS)[keyof typeof UNENROLLMENT_REJECTIONS];

export const UNENROLLMENT_REJECTION_CASES = [
  {
    rejection: UNENROLLMENT_REJECTIONS.NEVER_ENROLLED,
    expectedBody: { message: "adminCourseView.enrolled.toast.someStudentsUnenrolled", count: 1 },
  },
  {
    rejection: UNENROLLMENT_REJECTIONS.ALREADY_UNENROLLED,
    expectedBody: { message: "adminCourseView.enrolled.toast.someStudentsUnenrolled", count: 1 },
  },
  {
    rejection: UNENROLLMENT_REJECTIONS.ENROLLED_BY_GROUP,
    expectedBody: { message: "adminCourseView.enrolled.toast.studentsEnrolledByGroup", count: 1 },
  },
  {
    rejection: UNENROLLMENT_REJECTIONS.ENROLLED_DIRECTLY_THEN_BY_GROUP,
    expectedBody: { message: "adminCourseView.enrolled.toast.studentsEnrolledByGroup", count: 1 },
  },
];
