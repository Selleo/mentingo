import {
  CERTIFICATE_VALIDITY_TYPES,
  CERTIFICATE_VALIDITY_UNITS,
  COURSE_FEATURE,
  COURSE_FEATURE_ERROR_TRANSLATION_KEY,
} from "@repo/shared";

export const COURSE_SETTINGS_ENDPOINTS = {
  GET: "GET /api/course/settings/:courseId",
  PATCH: "PATCH /api/course/settings/:courseId",
} as const;

export type CourseSettingsEndpoint =
  (typeof COURSE_SETTINGS_ENDPOINTS)[keyof typeof COURSE_SETTINGS_ENDPOINTS];

export const COURSE_SETTINGS_ACTORS = {
  ANONYMOUS: "an anonymous visitor",
  STUDENT: "a student",
  AUTHOR: "the content creator who authored the course",
} as const;

export type CourseSettingsActor =
  (typeof COURSE_SETTINGS_ACTORS)[keyof typeof COURSE_SETTINGS_ACTORS];

export const COURSE_SETTINGS_ACCESS_CASES = [
  { actor: COURSE_SETTINGS_ACTORS.ANONYMOUS, expectedStatus: 401 },
  { actor: COURSE_SETTINGS_ACTORS.STUDENT, expectedStatus: 403 },
  { actor: COURSE_SETTINGS_ACTORS.AUTHOR, expectedStatus: 200 },
];

export const COURSE_SETTINGS_UPDATES = [
  {
    change: "disables quiz feedback",
    initialSettings: { lessonSequenceEnabled: false, quizFeedbackEnabled: true },
    body: { quizFeedbackEnabled: false },
    expectedSettings: { lessonSequenceEnabled: false, quizFeedbackEnabled: false },
  },
  {
    change: "enables quiz feedback",
    initialSettings: { lessonSequenceEnabled: false, quizFeedbackEnabled: false },
    body: { quizFeedbackEnabled: true },
    expectedSettings: { lessonSequenceEnabled: false, quizFeedbackEnabled: true },
  },
  {
    change: "changes quiz feedback and lesson sequence together",
    initialSettings: { lessonSequenceEnabled: false, quizFeedbackEnabled: true },
    body: { quizFeedbackEnabled: false, lessonSequenceEnabled: true },
    expectedSettings: { lessonSequenceEnabled: true, quizFeedbackEnabled: false },
  },
  {
    change: "keeps the settings that are not sent",
    initialSettings: { lessonSequenceEnabled: true, quizFeedbackEnabled: true },
    body: { quizFeedbackEnabled: false },
    expectedSettings: { lessonSequenceEnabled: true, quizFeedbackEnabled: false },
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
  {
    setting: "videoCompletionTrackingEnabled",
    body: { videoCompletionTrackingEnabled: true },
    expectedMessage:
      COURSE_FEATURE_ERROR_TRANSLATION_KEY[COURSE_FEATURE.VIDEO_COMPLETION_TRACKING_SETTING],
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
