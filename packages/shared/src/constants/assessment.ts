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
