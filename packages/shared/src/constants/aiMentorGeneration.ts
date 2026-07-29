export const AI_MENTOR_CONFIGURATION_GENERATION_MODE = {
  CREATE: "create",
  IMPROVE: "improve",
  REPAIR: "repair",
} as const;

export type AiMentorConfigurationGenerationMode =
  (typeof AI_MENTOR_CONFIGURATION_GENERATION_MODE)[keyof typeof AI_MENTOR_CONFIGURATION_GENERATION_MODE];

export const AI_MENTOR_CONFIGURATION_GENERATION_STATUS = {
  DRAFTING: "drafting",
  EVALUATING: "evaluating",
  REVISING: "revising",
  AWAITING_REVISION: "awaiting_revision",
  COMPLETED: "completed",
  REQUIRES_REVIEW: "requires_review",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY = {
  ERROR: "error",
  WARNING: "warning",
} as const;

export const AI_MENTOR_CONFIGURATION_FIELD = {
  TASK_GOAL: "taskGoal",
  EXPERTISE: "expertise",
  CONTENT_SCOPE: "contentScope",
  TEACHING_STYLE: "teachingStyle",
  FEEDBACK_GUIDANCE: "feedbackGuidance",
  SCENARIO: "scenario",
  AI_ROLE: "aiRole",
  LEARNER_ROLE: "learnerRole",
  CHARACTER_GOAL: "characterGoal",
  DIFFICULTY: "difficulty",
  FACTS_AND_CONSTRAINTS: "factsAndConstraints",
  OPENING_INSTRUCTION: "openingInstruction",
  ADDITIONAL_INSTRUCTIONS: "additionalInstructions",
} as const;

export type AiMentorConfigurationField =
  (typeof AI_MENTOR_CONFIGURATION_FIELD)[keyof typeof AI_MENTOR_CONFIGURATION_FIELD];

export const AI_MENTOR_CONFIGURATION_DRAFT_CHANGE_TYPE = {
  ADDED: "added",
  REMOVED: "removed",
  CHANGED: "changed",
} as const;

export const AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS = 3;

export const AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS = {
  PROGRESS: "ai-mentor-configuration-generation:progress",
} as const;
