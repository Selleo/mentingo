import type { AuthoringRecord, AuthoringTask, AuthoringTaskFailure } from "./courseAuthoring.types";

const categories: AuthoringTaskFailure["category"][] = [
  "generation",
  "evidence",
  "author_decision",
  "provider",
  "configuration",
  "internal",
];
const actions: AuthoringTaskFailure["recoveryAction"][] = [
  "retry_failed_parts",
  "answer_question",
  "retry_provider",
  "service_fix",
];
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
  if (task.status !== "failed") return false;
  if (!task.failure) return true;
  return (
    task.failure.retryable &&
    (task.failure.recoveryAction === "retry_failed_parts" ||
      task.failure.recoveryAction === "retry_provider")
  );
};

export const authoringTaskRetryLabel = (task: AuthoringTask): string => {
  if (task.failure?.recoveryAction === "retry_failed_parts") return "retryFailedParts";
  if (task.failure?.recoveryAction === "retry_provider") return "retryProvider";
  return "retry";
};

export const authoringTaskFailureLabel = (task: AuthoringTask): string => {
  if (task.failure) {
    if (task.failure.recoveryAction === "answer_question") return "failureAnswerQuestion";
    if (task.failure.recoveryAction === "service_fix" || !task.failure.retryable)
      return "failureServiceFix";
    if (task.failure.category === "provider") return "failureProvider";
    if (task.failure.category === "evidence") return "failureEvidence";
    return "failureGeneration";
  }
  return task.errorCode === "task_execution_failed" ? "taskExecutionFailed" : "taskFailed";
};

export const attachAuthoringTaskFailures = (
  tasks: AuthoringTask[],
  records: AuthoringRecord[],
): AuthoringTask[] =>
  tasks.map((task) => {
    if (task.status !== "failed" && task.status !== "waiting_author") return task;
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
