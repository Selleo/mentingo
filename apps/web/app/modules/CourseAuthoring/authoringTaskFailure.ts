import {
  AUTHORING_FAILURE_CATEGORY,
  AUTHORING_RECOVERY_ACTION,
  AUTHORING_TASK_STATUS,
} from "./courseAuthoring.constants";

import type { AuthoringRecord, AuthoringTask, AuthoringTaskFailure } from "./courseAuthoring.types";

const categories = Object.values(AUTHORING_FAILURE_CATEGORY);
const actions = Object.values(AUTHORING_RECOVERY_ACTION);
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const parseAuthoringTaskFailure = (value: unknown): AuthoringTaskFailure | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.code !== "string" ||
    typeof item.stage !== "string" ||
    !categories.includes(item.category as AuthoringTaskFailure["category"]) ||
    !actions.includes(item.recoveryAction as AuthoringTaskFailure["recoveryAction"]) ||
    typeof item.retryable !== "boolean" ||
    !isStrings(item.affectedChapterIds) ||
    !isStrings(item.affectedLessonIds) ||
    (item.correlationId !== null && typeof item.correlationId !== "string") ||
    (item.detailKey !== null && typeof item.detailKey !== "string") ||
    typeof item.generationRevision !== "number" ||
    !Number.isSafeInteger(item.generationRevision) ||
    item.generationRevision < 0
  )
    return null;
  return {
    code: item.code,
    category: item.category as AuthoringTaskFailure["category"],
    stage: item.stage,
    recoveryAction: item.recoveryAction as AuthoringTaskFailure["recoveryAction"],
    retryable: item.retryable,
    affectedChapterIds: item.affectedChapterIds,
    affectedLessonIds: item.affectedLessonIds,
    correlationId: item.correlationId,
    detailKey: item.detailKey,
    generationRevision: item.generationRevision,
  };
};

export const canRetryAuthoringTask = (task: AuthoringTask): boolean => {
  if (task.status !== AUTHORING_TASK_STATUS.FAILED) return false;
  if (!task.failure) return true;
  return (
    task.failure.retryable &&
    (task.failure.recoveryAction === AUTHORING_RECOVERY_ACTION.RETRY_FAILED_PARTS ||
      task.failure.recoveryAction === AUTHORING_RECOVERY_ACTION.RETRY_PROVIDER)
  );
};

export const authoringTaskRetryLabel = (task: AuthoringTask): string => {
  if (task.failure?.recoveryAction === AUTHORING_RECOVERY_ACTION.RETRY_FAILED_PARTS)
    return "retryFailedParts";
  if (task.failure?.recoveryAction === AUTHORING_RECOVERY_ACTION.RETRY_PROVIDER)
    return "retryProvider";
  return "retry";
};

export const authoringTaskFailureLabel = (task: AuthoringTask): string => {
  if (task.failure) {
    if (task.failure.recoveryAction === AUTHORING_RECOVERY_ACTION.ANSWER_QUESTION)
      return "failureAnswerQuestion";
    if (
      task.failure.recoveryAction === AUTHORING_RECOVERY_ACTION.SERVICE_FIX ||
      !task.failure.retryable
    )
      return "failureServiceFix";
    if (task.failure.category === AUTHORING_FAILURE_CATEGORY.PROVIDER) return "failureProvider";
    if (task.failure.category === AUTHORING_FAILURE_CATEGORY.EVIDENCE) return "failureEvidence";
    return "failureGeneration";
  }
  return task.errorCode === "task_execution_failed" ? "taskExecutionFailed" : "taskFailed";
};

export const attachAuthoringTaskFailures = (
  tasks: AuthoringTask[],
  records: AuthoringRecord[],
): AuthoringTask[] =>
  tasks.map((task) => {
    if (
      task.status !== AUTHORING_TASK_STATUS.FAILED &&
      task.status !== AUTHORING_TASK_STATUS.WAITING_AUTHOR
    )
      return task;
    if (task.failure !== undefined) return task;
    let latest: AuthoringTaskFailure | null = null;
    let sequence = -1;
    records.forEach((record) => {
      if (record.kind !== "task_failure" && record.kind !== "task.failed") return;
      if (record.payload.taskId !== task.taskId || record.payload.requestId !== task.requestId)
        return;
      const parsed = parseAuthoringTaskFailure(record.payload.failure);
      const recordSequence = record.payload.sequence;
      if (!parsed || typeof recordSequence !== "number" || recordSequence < sequence) return;
      latest = parsed;
      sequence = recordSequence;
    });
    return latest ? { ...task, failure: latest } : task;
  });
