import {
  CERTIFICATE_VALIDITY_TYPES,
  CERTIFICATE_VALIDITY_UNITS,
  COURSE_FEATURE,
  COURSE_FEATURE_ERROR_TRANSLATION_KEY,
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
    field: "thumbnailS3Key",
    body: { thumbnailS3Key: "course/new-thumbnail.png" },
    expectedCourse: { thumbnailS3Key: "course/new-thumbnail.png" },
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

export const SCORM_UNAVAILABLE_SETTINGS = [
  {
    setting: "lessonSequenceEnabled",
    body: { lessonSequenceEnabled: true },
    expectedMessage: COURSE_FEATURE_ERROR_TRANSLATION_KEY[COURSE_FEATURE.LESSON_SEQUENCE_SETTING],
  },
  {
    setting: "quizFeedbackEnabled",
    body: { quizFeedbackEnabled: true },
    expectedMessage: COURSE_FEATURE_ERROR_TRANSLATION_KEY[COURSE_FEATURE.QUIZ_FEEDBACK_SETTING],
  },
];

export const EXPORTED_COURSE_SETTINGS_UPDATES = [
  {
    change: "certificate font color",
    body: { certificateFontColor: "#123456" },
    expectedStatus: 200,
  },
  { change: "certificate validity", body: { certificateValidity: null }, expectedStatus: 200 },
  {
    change: "certificate signature removal",
    body: { removeCertificateSignature: true },
    expectedStatus: 200,
  },
  { change: "lesson sequence", body: { lessonSequenceEnabled: false }, expectedStatus: 403 },
  { change: "quiz feedback", body: { quizFeedbackEnabled: false }, expectedStatus: 403 },
];

export const CERTIFICATE_VALIDITY_PERIOD = {
  type: CERTIFICATE_VALIDITY_TYPES.PERIOD,
  value: 2,
  unit: CERTIFICATE_VALIDITY_UNITS.YEARS,
};
