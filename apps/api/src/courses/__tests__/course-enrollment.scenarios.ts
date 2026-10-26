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
    expectedMessage: "You don't have permission to enroll in your own course",
  },
  {
    rejection: SELF_ENROLLMENT_REJECTIONS.ARCHIVED_COURSE,
    expectedStatus: 403,
    expectedMessage: "adminCourseView.errors.forbidden.archivedCourseEnrollment",
  },
  {
    rejection: SELF_ENROLLMENT_REJECTIONS.ALREADY_ENROLLED,
    expectedStatus: 409,
    expectedMessage: "Course is already enrolled",
  },
];

export const BULK_ENROLLMENT_REJECTIONS = {
  NO_STUDENTS: "no students are given",
  UNKNOWN_STUDENT: "a student does not exist",
  DELETED_STUDENT: "a student is deleted",
} as const;

export type BulkEnrollmentRejection =
  (typeof BULK_ENROLLMENT_REJECTIONS)[keyof typeof BULK_ENROLLMENT_REJECTIONS];

export const BULK_ENROLLMENT_REJECTION_CASES = [
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.NO_STUDENTS,
    expectedMessage: "Student ids not found",
  },
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.UNKNOWN_STUDENT,
    expectedMessage: "You can only enroll existing users",
  },
  {
    rejection: BULK_ENROLLMENT_REJECTIONS.DELETED_STUDENT,
    expectedMessage: "You can only enroll existing users",
  },
];

export const UNENROLLMENT_REJECTIONS = {
  NEVER_ENROLLED: "the student was never enrolled",
  ALREADY_UNENROLLED: "the student is already unenrolled",
  ENROLLED_BY_GROUP: "the student is enrolled by a group",
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
];
