import { ASSESSMENT_FEEDBACK_MODES } from "@repo/shared";

export const QUIZ_VIEWERS = {
  ENROLLED_STUDENT: "an enrolled student before any attempt",
  ADMIN_AFTER_ATTEMPT: "an admin after a learning-mode attempt",
  AUTHOR_AFTER_ATTEMPT: "the course author after a learning-mode attempt",
} as const;

export type QuizViewer = (typeof QUIZ_VIEWERS)[keyof typeof QUIZ_VIEWERS];

export const LESSON_FEEDBACK_REDACTION_CASES = [
  {
    viewer: QUIZ_VIEWERS.ENROLLED_STUDENT,
    quizFeedbackEnabled: false,
    expectedRedacted: true,
    expectedRevealsCorrectAnswer: false,
  },
  {
    viewer: QUIZ_VIEWERS.ENROLLED_STUDENT,
    quizFeedbackEnabled: true,
    expectedRedacted: false,
    expectedRevealsCorrectAnswer: false,
  },
  {
    viewer: QUIZ_VIEWERS.ADMIN_AFTER_ATTEMPT,
    quizFeedbackEnabled: false,
    expectedRedacted: true,
    expectedRevealsCorrectAnswer: false,
  },
  {
    viewer: QUIZ_VIEWERS.ADMIN_AFTER_ATTEMPT,
    quizFeedbackEnabled: true,
    expectedRedacted: false,
    expectedRevealsCorrectAnswer: true,
  },
  {
    viewer: QUIZ_VIEWERS.AUTHOR_AFTER_ATTEMPT,
    quizFeedbackEnabled: false,
    expectedRedacted: true,
    expectedRevealsCorrectAnswer: false,
  },
];

export const FEEDBACK_RANGES = [
  { minPercent: 0, maxPercent: 50, message: "<p>Keep practising {{firstName}}.</p>" },
  {
    minPercent: 51,
    maxPercent: 100,
    message: "<p>Well done {{firstName}}! You scored {{score}}%.</p>",
  },
];

export const LEARNER_FIRST_NAME = "Ada";

export const TOP_BAND_MESSAGE = "<p>Well done Ada! You scored 100%.</p>";

export const FEEDBACK_MODE_CASES = [
  {
    feedbackMode: ASSESSMENT_FEEDBACK_MODES.FULL,
    expectedRedacted: false,
    expectedRevealsCorrectAnswer: true,
    expectedFeedbackMessage: TOP_BAND_MESSAGE,
  },
  {
    feedbackMode: ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY,
    expectedRedacted: true,
    expectedRevealsCorrectAnswer: false,
    expectedFeedbackMessage: TOP_BAND_MESSAGE,
  },
  {
    feedbackMode: ASSESSMENT_FEEDBACK_MODES.NONE,
    expectedRedacted: true,
    expectedRevealsCorrectAnswer: false,
    expectedFeedbackMessage: null,
  },
];
