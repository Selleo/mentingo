export const QUIZ_SUBMITTERS = {
  ENROLLED_CONTENT_CREATOR: "an enrolled content creator taking another author's quiz",
  ENROLLED_AUTHOR: "the enrolled course author outside learning mode",
  AUTHOR_IN_LEARNING_MODE: "the course author in learning mode",
  ADMIN: "an admin outside learning mode",
  ADMIN_IN_LEARNING_MODE: "an admin in learning mode",
} as const;

export type QuizSubmitter = (typeof QUIZ_SUBMITTERS)[keyof typeof QUIZ_SUBMITTERS];

export const SUBMISSION_OUTCOMES = {
  GRADED: "graded",
  LEARNING_MODE_REQUIRED: "rejected until learning mode is on",
} as const;

export const LEARNING_MODE_SUBMISSION_CASES = [
  { submitter: QUIZ_SUBMITTERS.ENROLLED_CONTENT_CREATOR, outcome: SUBMISSION_OUTCOMES.GRADED },
  {
    submitter: QUIZ_SUBMITTERS.ENROLLED_AUTHOR,
    outcome: SUBMISSION_OUTCOMES.LEARNING_MODE_REQUIRED,
  },
  { submitter: QUIZ_SUBMITTERS.AUTHOR_IN_LEARNING_MODE, outcome: SUBMISSION_OUTCOMES.GRADED },
  { submitter: QUIZ_SUBMITTERS.ADMIN, outcome: SUBMISSION_OUTCOMES.LEARNING_MODE_REQUIRED },
  { submitter: QUIZ_SUBMITTERS.ADMIN_IN_LEARNING_MODE, outcome: SUBMISSION_OUTCOMES.GRADED },
];

export const OPEN_ANSWER = "My open answer";
