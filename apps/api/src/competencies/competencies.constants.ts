import type { JobsOptions } from "bullmq";

export const COMPETENCIES_PEOPLE_SYNC_BATCH_SIZE = 1000;
export const COMPETENCIES_PEOPLE_SYNC_INTERVAL_MS = 60_000;
export const COMPETENCIES_FACT_RECONCILE_CONCURRENCY = 8;

export const COMPETENCIES_COMMAND_OPERATIONS = {
  SAVE_CATEGORY: "save_category",
  DELETE_CATEGORY: "delete_category",
  SAVE_COMPETENCY: "save_competency",
  DELETE_COMPETENCY: "delete_competency",
  SAVE_PROFILE: "save_profile",
  DELETE_PROFILE: "delete_profile",
  ASSIGN_PROFILE: "assign_profile",
  SUBMIT_EVIDENCE: "submit_evidence",
  REVIEW_EVIDENCE: "review_evidence",
  REVOKE_CONFIRMATION: "revoke_confirmation",
  SET_CONDITION_OVERRIDE: "set_condition_override",
  SETTINGS: "settings",
} as const;

export const COMPETENCIES_JOB_OPERATIONS = {
  SYNC: "sync",
} as const;

export const COMPETENCIES_SYNC_JOB_STATES = {
  FAILED: "failed",
  ACTIVE: "active",
} as const;

export const COMPETENCIES_BOOLEAN_QUERY_VALUES = {
  TRUE: "true",
  FALSE: "false",
} as const;

export const COMPETENCIES_SYNC_JOB_OPTIONS = {
  priority: 10,
  attempts: 8,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: true,
  removeOnFail: 100,
} as const satisfies JobsOptions;
