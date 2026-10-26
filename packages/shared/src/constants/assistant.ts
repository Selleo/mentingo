import { MESSAGE_ROLE } from "./messageRole";

export const ASSISTANT_MESSAGE_ROLES = {
  USER: MESSAGE_ROLE.USER,
  ASSISTANT: MESSAGE_ROLE.MENTOR,
} as const;

export type AssistantMessageRole =
  (typeof ASSISTANT_MESSAGE_ROLES)[keyof typeof ASSISTANT_MESSAGE_ROLES];

/** User-visible phases backed by actual Core Assistant runtime operations. */
export const ASSISTANT_RUN_ACTIVITIES = {
  STARTING: "starting",
  THINKING: "thinking",
  SEARCHING: "searching",
  READING: "reading",
  WRITING: "writing",
} as const;

export type AssistantRunActivity =
  (typeof ASSISTANT_RUN_ACTIVITIES)[keyof typeof ASSISTANT_RUN_ACTIVITIES];

/** Canonical entity kinds available in a verified Assistant source preview. */
export const ASSISTANT_SOURCE_TYPES = {
  COURSE: "course",
  LESSON: "lesson",
  USER: "user",
  GROUP: "group",
  CATEGORY: "category",
  ARTICLE: "article",
  NEWS: "news",
  QA: "qa",
  DEVELOPMENT_PATH: "development_path",
  RESOURCE: "resource",
} as const;
export type AssistantSourceType =
  (typeof ASSISTANT_SOURCE_TYPES)[keyof typeof ASSISTANT_SOURCE_TYPES];

/** Persisted generation lifecycle; completed runs can contain complete messages. */
export const ASSISTANT_RUN_STATUSES = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;
export type AssistantRunStatus =
  (typeof ASSISTANT_RUN_STATUSES)[keyof typeof ASSISTANT_RUN_STATUSES];

export const ASSISTANT_MESSAGE_STATUSES = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETE: "complete",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;
export type AssistantMessageStatus =
  (typeof ASSISTANT_MESSAGE_STATUSES)[keyof typeof ASSISTANT_MESSAGE_STATUSES];

export const ASSISTANT_OUTCOME_KINDS = {
  ANSWER: "answer",
  CONVERSATION: "conversation",
} as const;
export type AssistantOutcomeKind =
  (typeof ASSISTANT_OUTCOME_KINDS)[keyof typeof ASSISTANT_OUTCOME_KINDS];

export const ASSISTANT_WORKFLOW_RUN_STATES = {
  ...ASSISTANT_RUN_STATUSES,
  MISSING: "missing",
} as const;
export type AssistantWorkflowRunState =
  (typeof ASSISTANT_WORKFLOW_RUN_STATES)[keyof typeof ASSISTANT_WORKFLOW_RUN_STATES];

export const ASSISTANT_OUTCOME_VALIDATION_CODES = {
  EMPTY_RESPONSE: "EMPTY_RESPONSE",
  NO_VERIFIED_EVIDENCE: "NO_VERIFIED_EVIDENCE",
  NO_READABLE_EVIDENCE: "NO_READABLE_EVIDENCE",
} as const;
export type AssistantOutcomeValidationCode =
  (typeof ASSISTANT_OUTCOME_VALIDATION_CODES)[keyof typeof ASSISTANT_OUTCOME_VALIDATION_CODES];

export const ASSISTANT_RUN_ERROR_CODES = {
  TENANT_INACTIVE: "TENANT_INACTIVE",
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  GENERATION_FAILED: "GENERATION_FAILED",
  OUTCOME_VALIDATION_FAILED: "OUTCOME_VALIDATION_FAILED",
  WORKFLOW_FAILED: "WORKFLOW_FAILED",
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  WORKFLOW_COMPLETION_NOT_SAVED: "WORKFLOW_COMPLETION_NOT_SAVED",
  WORKFLOW_UNAVAILABLE: "WORKFLOW_UNAVAILABLE",
} as const;
