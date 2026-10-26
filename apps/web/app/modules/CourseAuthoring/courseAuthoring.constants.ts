/** Stable authoring wire values shared by UI contracts and runtime projections. */
import { LESSON_TYPES } from "@repo/shared";

import { PROPOSAL_APPLICATION_STATUS } from "./review/curriculumReview.constants";
export const AUTHORING_SESSION_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  STOPPED: "stopped",
  DISCARDED: "discarded",
} as const;

export const AUTHORING_TASK_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  WAITING_AUTHOR: "waiting_author",
  WAITING_DEPENDENCIES: "waiting_dependencies",
  PAUSED: "paused",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  SUPERSEDED: "superseded",
  STOPPED: "stopped",
  UNKNOWN: "unknown",
} as const;

export const AUTHORING_WORK_PROGRESS_STAGE = {
  OUTLINE: "outline",
  LESSON_PLANNING: "lesson_planning",
  LESSON_GENERATION: "lesson_generation",
  VALIDATION: "validation",
  REPAIRING: "repairing",
  RECOVERING: "recovering",
} as const;

export const AUTHORING_CHAPTER_PROGRESS_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETE: "complete",
  FAILED: "failed",
} as const;

export const AUTHORING_OUTLINE_PHASE = {
  DRAFTING: "drafting",
  REVIEWING: "reviewing",
  REPAIRING: "repairing",
  FINALIZING: "finalizing",
} as const;

export const AUTHORING_FAILURE_CATEGORY = {
  GENERATION: "generation",
  EVIDENCE: "evidence",
  AUTHOR_DECISION: "author_decision",
  PROVIDER: "provider",
  CONFIGURATION: "configuration",
  INTERNAL: "internal",
} as const;

export const AUTHORING_RECOVERY_ACTION = {
  RETRY_FAILED_PARTS: "retry_failed_parts",
  ANSWER_QUESTION: "answer_question",
  RETRY_PROVIDER: "retry_provider",
  SERVICE_FIX: "service_fix",
} as const;

export const AUTHORING_TURN_STATUS = {
  SENDING: "sending",
  QUEUED: "queued",
  RUNNING: "running",
  WAITING_AUTHOR: "waiting_author",
  COMPLETED: "completed",
  FAILED: "failed",
  STOPPED: "stopped",
} as const;

export const AUTHORING_PART_KIND = {
  TEXT: "text",
  TOOL: "tool",
  PROPOSAL: "proposal",
  QUESTION: "question",
} as const;

export const AUTHORING_PART_STATUS = {
  STREAMING: "streaming",
  COMPLETED: "completed",
  FAILED: "failed",
  STARTED: "started",
  STOPPED: "stopped",
  REVIEW: "review",
} as const;

export const AUTHORING_TOOL_STATUS = {
  STARTED: "started",
  COMPLETED: "completed",
  FAILED: "failed",
  STOPPED: "stopped",
} as const;

export const AUTHORING_ARTIFACT_KIND = {
  PROPOSAL: "proposal",
  QUESTION: "question",
} as const;

export const AUTHORING_LESSON_KIND = {
  CONTENT: LESSON_TYPES.CONTENT,
  QUIZ: LESSON_TYPES.QUIZ,
  AI_MENTOR: LESSON_TYPES.AI_MENTOR,
} as const;

export const AUTHORING_SOURCE_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  PARTIAL: "partial",
  FAILED: "failed",
  UNKNOWN: "unknown",
} as const;

export const AUTHORING_SOURCE_REFRESH_STATUS = {
  REFRESHED: "refreshed",
  NEEDS_MAPPING: "needs_mapping",
} as const;

export const AUTHORING_APPLICATION_STATUS = {
  APPLIED: "applied",
  CONFLICT: "conflict",
  FAILED: "failed",
  PENDING: "pending",
} as const;

export const AUTHORING_CONNECTION_STATE = {
  CONNECTING: "connecting",
  LIVE: "live",
  RECOVERING: "recovering",
  OFFLINE: "offline",
} as const;

export const AUTHORING_WORK_OUTCOME = {
  COMPLETED: "completed",
  FAILED: "failed",
  WAITING_AUTHOR: "waiting_author",
  OUTLINE_READY: "outline_ready",
  CHANGES_READY: "changes_ready",
} as const;

/** Known kinds for comparisons; snapshots may supply new task kinds. */
export const AUTHORING_TASK_KIND = {
  ROUTE: "route",
  SOURCE: "source",
  SOURCE_REFRESH: "source_refresh",
  SOURCE_SELECTION: "source_selection",
  RESEARCH: "research",
  PLAN: "plan",
  DETAILED_PLAN: "detailed_plan",
  LESSON: "lesson",
  EDIT: "edit",
  ASSET: "asset",
  COURSE_REVIEW: "course_review",
} as const;

/** Internal watcher states include the outcomes delivered to the author. */
export const AUTHORING_WORK_STATUS = {
  ...AUTHORING_WORK_OUTCOME,
  ACTIVE: "active",
  STOPPED: "stopped",
} as const;

export const AUTHORING_APPLY_STATE = {
  ...PROPOSAL_APPLICATION_STATUS,
  IDLE: "idle",
  PREPARING: "preparing",
} as const;
