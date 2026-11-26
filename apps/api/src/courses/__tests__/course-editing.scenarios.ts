import {
  COURSE_STATUSES,
  COURSE_TYPE,
  DEFAULT_CERTIFICATE_FONT_COLOR,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import {
  LESSON_SEQUENCE_ENABLED,
  QUIZ_FEEDBACK_ENABLED,
  VIDEO_COMPLETION_TRACKING_ENABLED,
} from "src/courses/constants";

export const COURSE_EDITORS = {
  ADMIN: "admin",
  CONTENT_CREATOR: "content creator",
  STUDENT: "student",
} as const;

export const COURSE_AUTHORS = {
  EDITOR: "the editor",
  ANOTHER_USER: "another user",
} as const;

export const COURSE_EDIT_ENDPOINTS = {
  UPDATE_COURSE: "PATCH /api/course/:id",
  UPDATE_HAS_CERTIFICATE: "PATCH /api/course/update-has-certificate/:id",
  DELETE_TRAILER: "DELETE /api/course/:id/trailer",
  UPDATE_SETTINGS: "PATCH /api/course/settings/:courseId",
} as const;

export type CourseEditor = (typeof COURSE_EDITORS)[keyof typeof COURSE_EDITORS];
export type CourseAuthor = (typeof COURSE_AUTHORS)[keyof typeof COURSE_AUTHORS];
export type CourseEditEndpoint = (typeof COURSE_EDIT_ENDPOINTS)[keyof typeof COURSE_EDIT_ENDPOINTS];

export const COURSE_EDIT_ACCESS_CASES = [
  { editor: COURSE_EDITORS.ADMIN, author: COURSE_AUTHORS.ANOTHER_USER, expectedStatus: 200 },
  { editor: COURSE_EDITORS.CONTENT_CREATOR, author: COURSE_AUTHORS.EDITOR, expectedStatus: 200 },
  {
    editor: COURSE_EDITORS.CONTENT_CREATOR,
    author: COURSE_AUTHORS.ANOTHER_USER,
    expectedStatus: 403,
  },
  { editor: COURSE_EDITORS.STUDENT, author: COURSE_AUTHORS.EDITOR, expectedStatus: 403 },
];

export const COURSE_FIELD_UPDATES = [
  {
    field: "title",
    body: { title: "Renamed course" },
    expectedCourse: { title: { [SUPPORTED_LANGUAGES.EN]: "Renamed course" } },
  },
  {
    field: "description",
    body: { description: "Rewritten description" },
    expectedCourse: { description: { [SUPPORTED_LANGUAGES.EN]: "Rewritten description" } },
  },
  {
    field: "learningOutcomes",
    body: { learningOutcomes: ["Plan a sprint", "Run a retrospective"] },
    expectedCourse: {
      learningOutcomes: { [SUPPORTED_LANGUAGES.EN]: ["Plan a sprint", "Run a retrospective"] },
    },
  },
  {
    field: "showAuthorSection",
    body: { showAuthorSection: false },
    expectedCourse: { showAuthorSection: false },
  },
  {
    field: "thumbnailPositionY",
    body: { thumbnailPositionY: 80 },
    expectedCourse: { thumbnailPositionY: 80 },
  },
  {
    field: "status",
    body: { status: COURSE_STATUSES.DRAFT },
    expectedCourse: { status: COURSE_STATUSES.DRAFT },
  },
];

export const EXPORTED_COURSE_UPDATES = [
  { change: "status", body: { status: COURSE_STATUSES.DRAFT }, expectedStatus: 200 },
  { change: "price", body: { priceInCents: 4200 }, expectedStatus: 200 },
  { change: "currency", body: { currency: "eur" }, expectedStatus: 200 },
  { change: "title", body: { title: "Local rename" }, expectedStatus: 403 },
  { change: "showAuthorSection", body: { showAuthorSection: false }, expectedStatus: 403 },
];

export const COURSE_KIND_DEFAULTS = [
  {
    kind: "regular",
    isScorm: false,
    expectedCourse: {
      courseType: COURSE_TYPE.DEFAULT,
      settings: {
        repetitionEnabled: false,
        lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
        quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
        videoCompletionTrackingEnabled: VIDEO_COMPLETION_TRACKING_ENABLED,
        certificateSignature: null,
        certificateFontColor: DEFAULT_CERTIFICATE_FONT_COLOR,
        certificateValidity: null,
      },
    },
  },
  {
    kind: "SCORM",
    isScorm: true,
    expectedCourse: {
      courseType: COURSE_TYPE.SCORM,
      // Characterizes current behaviour: the SCORM-specific `false` defaults are not persisted.
      settings: {
        repetitionEnabled: false,
        lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
        quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
        videoCompletionTrackingEnabled: VIDEO_COMPLETION_TRACKING_ENABLED,
        certificateSignature: null,
        certificateFontColor: DEFAULT_CERTIFICATE_FONT_COLOR,
        certificateValidity: null,
      },
    },
  },
];

export const THUMBNAIL_PNG_BYTES = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
];
