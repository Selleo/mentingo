export const ASSESSMENT_QUESTION_TYPES = {
  SINGLE_CHOICE: "single_choice",
  MULTIPLE_CHOICE: "multiple_choice",
  TRUE_OR_FALSE: "true_or_false",
  PHOTO_QUESTION_SINGLE_CHOICE: "photo_question_single_choice",
  PHOTO_QUESTION_MULTIPLE_CHOICE: "photo_question_multiple_choice",
  FILL_IN_THE_BLANKS_TEXT: "fill_in_the_blanks_text",
  FILL_IN_THE_BLANKS_DND: "fill_in_the_blanks_dnd",
  BRIEF_RESPONSE: "brief_response",
  DETAILED_RESPONSE: "detailed_response",
  SCALE_1_5: "scale_1_5",
  MATCHING: "matching",
} as const;
export type AssessmentQuestionType =
  (typeof ASSESSMENT_QUESTION_TYPES)[keyof typeof ASSESSMENT_QUESTION_TYPES];

export const ASSESSMENT_GRADING_MODES = {
  AUTOMATIC: "automatic",
  MANUAL: "manual",
  PARTICIPATION: "participation",
} as const;
export type AssessmentGradingMode =
  (typeof ASSESSMENT_GRADING_MODES)[keyof typeof ASSESSMENT_GRADING_MODES];

export const ASSESSMENT_SCORING_MODES = {
  ALL_OR_NOTHING: "all_or_nothing",
  PARTIAL: "partial",
} as const;
export type AssessmentScoringMode =
  (typeof ASSESSMENT_SCORING_MODES)[keyof typeof ASSESSMENT_SCORING_MODES];

export const ASSESSMENT_ATTEMPT_LIMIT_MODES = {
  NONE: "none",
  LIFETIME: "lifetime",
  COOLDOWN_WINDOW: "cooldown_window",
} as const;
export type AssessmentAttemptLimitMode =
  (typeof ASSESSMENT_ATTEMPT_LIMIT_MODES)[keyof typeof ASSESSMENT_ATTEMPT_LIMIT_MODES];

export const ASSESSMENT_FEEDBACK_MODES = {
  FULL: "full",
  SCORE_ONLY: "score_only",
  NONE: "none",
} as const;
export type AssessmentFeedbackMode =
  (typeof ASSESSMENT_FEEDBACK_MODES)[keyof typeof ASSESSMENT_FEEDBACK_MODES];

export const ASSESSMENT_TEXT_COMPARISON_MODES = {
  EXACT: "exact",
  NORMALIZED: "normalized",
} as const;
export type AssessmentTextComparisonMode =
  (typeof ASSESSMENT_TEXT_COMPARISON_MODES)[keyof typeof ASSESSMENT_TEXT_COMPARISON_MODES];

export const ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES = {
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  CANCELLED: "cancelled",
} as const;
export type AssessmentAttemptSubmissionStatus =
  (typeof ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES)[keyof typeof ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES];

export const ASSESSMENT_ATTEMPT_GRADING_STATUSES = {
  NOT_STARTED: "not_started",
  PENDING: "pending",
  GRADED: "graded",
} as const;
export type AssessmentAttemptGradingStatus =
  (typeof ASSESSMENT_ATTEMPT_GRADING_STATUSES)[keyof typeof ASSESSMENT_ATTEMPT_GRADING_STATUSES];

export const ASSESSMENT_ANSWER_GRADING_STATUSES = {
  PENDING: "pending",
  GRADED: "graded",
} as const;
export type AssessmentAnswerGradingStatus =
  (typeof ASSESSMENT_ANSWER_GRADING_STATUSES)[keyof typeof ASSESSMENT_ANSWER_GRADING_STATUSES];

export const QUIZ_GRADING_COMMENT_MAX_LENGTH = 5000;

/** How a reviewer grades an open answer. Pass awards the question's full points, fail awards 0. */
export const QUIZ_REVIEW_GRADING_METHODS = {
  PASS_FAIL: "pass_fail",
} as const;
export type QuizReviewGradingMethod =
  (typeof QUIZ_REVIEW_GRADING_METHODS)[keyof typeof QUIZ_REVIEW_GRADING_METHODS];

export const ASSESSMENT_ATTEMPT_RESULTS = {
  PENDING: "pending",
  PASSED: "passed",
  FAILED: "failed",
} as const;
export type AssessmentAttemptResult =
  (typeof ASSESSMENT_ATTEMPT_RESULTS)[keyof typeof ASSESSMENT_ATTEMPT_RESULTS];

export const LEARNER_PROGRESS_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  AWAITING_REVIEW: "awaiting_review",
  COMPLETED: "completed",
} as const;
export type LearnerProgressStatus =
  (typeof LEARNER_PROGRESS_STATUSES)[keyof typeof LEARNER_PROGRESS_STATUSES];

/** Single source for the quiz time limit range (API validation, editor slider); the DB only enforces >= 1, so changing MAX needs no migration. */
export const ASSESSMENT_TIME_LIMIT_MINUTES = {
  MIN: 1,
  MAX: 300,
} as const;

/** Extra time after `expiresAt` in which a timed quiz submit still accepts the sent answers. */
export const ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS = 30;

/** Outcome of `POST /lesson/quiz-attempt/start`; `finalized` means the open attempt had already expired. */
export const QUIZ_ATTEMPT_START_STATUSES = {
  IN_PROGRESS: "in_progress",
  FINALIZED: "finalized",
} as const;
export type QuizAttemptStartStatus =
  (typeof QUIZ_ATTEMPT_START_STATUSES)[keyof typeof QUIZ_ATTEMPT_START_STATUSES];
