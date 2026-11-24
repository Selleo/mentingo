export const BULK_ACTIONS = {
  ARCHIVE: "PATCH /api/course/bulk/archive",
  STATUS: "PATCH /api/course/bulk/status",
  CATEGORY: "PATCH /api/course/bulk/category",
} as const;

export type BulkAction = (typeof BULK_ACTIONS)[keyof typeof BULK_ACTIONS];

export const BULK_SELECTIONS = {
  OWN_COURSE: "their own course",
  OWN_COURSE_TWICE: "their own course twice",
  OWN_AND_FOREIGN_COURSES: "their own and another author's course",
  MISSING_COURSE: "a course that does not exist",
} as const;

export type BulkSelection = (typeof BULK_SELECTIONS)[keyof typeof BULK_SELECTIONS];

export const BULK_ACTORS = {
  ANONYMOUS: "an anonymous visitor",
  STUDENT: "a student",
} as const;

export type BulkActor = (typeof BULK_ACTORS)[keyof typeof BULK_ACTORS];

export const CONTENT_CREATOR_ALLOWED_BULK_CASES = [
  { action: BULK_ACTIONS.ARCHIVE, selection: BULK_SELECTIONS.OWN_COURSE },
  { action: BULK_ACTIONS.ARCHIVE, selection: BULK_SELECTIONS.OWN_COURSE_TWICE },
  { action: BULK_ACTIONS.STATUS, selection: BULK_SELECTIONS.OWN_COURSE },
  { action: BULK_ACTIONS.CATEGORY, selection: BULK_SELECTIONS.OWN_COURSE },
];

export const CONTENT_CREATOR_FORBIDDEN_BULK_CASES = [
  {
    action: BULK_ACTIONS.ARCHIVE,
    selection: BULK_SELECTIONS.OWN_AND_FOREIGN_COURSES,
    expectedMessage: "adminCoursesView.toast.bulkArchiveUpdateForbidden",
  },
  {
    action: BULK_ACTIONS.ARCHIVE,
    selection: BULK_SELECTIONS.MISSING_COURSE,
    expectedMessage: "adminCoursesView.toast.bulkArchiveUpdateForbidden",
  },
  {
    action: BULK_ACTIONS.STATUS,
    selection: BULK_SELECTIONS.OWN_AND_FOREIGN_COURSES,
    expectedMessage: "adminCoursesView.toast.bulkStatusUpdateForbidden",
  },
  {
    action: BULK_ACTIONS.CATEGORY,
    selection: BULK_SELECTIONS.OWN_AND_FOREIGN_COURSES,
    expectedMessage: "adminCoursesView.toast.bulkCategoryUpdateForbidden",
  },
];

export const BULK_ACTOR_REJECTIONS = [
  { actor: BULK_ACTORS.ANONYMOUS, expectedStatus: 401 },
  { actor: BULK_ACTORS.STUDENT, expectedStatus: 403 },
];

export const INVALID_BULK_ARCHIVE_PAYLOADS = [
  { problem: "no courses", body: { ids: [], isArchived: true } },
  { problem: "a malformed course id", body: { ids: ["not-a-uuid"], isArchived: true } },
  { problem: "no archive flag", body: { ids: ["00000000-0000-4000-8000-000000000000"] } },
];
