import { attachAuthoringTaskFailures } from "./authoringTaskFailure";

import type {
  AuthoringRecord,
  AuthoringTask,
  AuthoringWorkProgress,
  AuthoringWorkProgressChapter,
  AuthoringWorkProgressStage,
} from "./courseAuthoring.types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const integerValue = (value: unknown, minimum: number): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : null;

const isWorkProgressStage = (value: unknown): value is AuthoringWorkProgressStage =>
  value === "outline" ||
  value === "lesson_planning" ||
  value === "lesson_generation" ||
  value === "validation" ||
  value === "repairing" ||
  value === "recovering";

const parseChapter = (value: unknown): AuthoringWorkProgressChapter | null => {
  if (!isObject(value)) return null;
  const chapterId = stringValue(value.chapterId);
  const title = stringValue(value.title);
  const lessonCount = integerValue(value.lessonCount, 0);
  const status = value.status;

  if (
    !chapterId ||
    !title ||
    lessonCount === null ||
    (status !== "pending" && status !== "running" && status !== "complete" && status !== "failed")
  ) {
    return null;
  }

  return {
    chapterId,
    title,
    lessonCount,
    status,
    ...(typeof value.failureCode === "string" ? { failureCode: value.failureCode } : {}),
  };
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const parseWorkProgress = (value: unknown): AuthoringWorkProgress | null => {
  if (!isObject(value) || !isWorkProgressStage(value.stage)) return null;

  const completedLessons =
    value.completedLessons === undefined ? undefined : integerValue(value.completedLessons, 0);
  const totalLessons =
    value.totalLessons === undefined ? undefined : integerValue(value.totalLessons, 0);
  if (completedLessons === null || totalLessons === null) return null;
  if (
    completedLessons !== undefined &&
    totalLessons !== undefined &&
    completedLessons > totalLessons
  ) {
    return null;
  }
  if (value.chapters !== undefined && !Array.isArray(value.chapters)) return null;

  const lessonId = optionalString(value.lessonId);
  const lessonTitle = optionalString(value.lessonTitle);
  const chapterId = optionalString(value.chapterId);
  const chapterTitle = optionalString(value.chapterTitle);

  return {
    stage: value.stage,
    ...(Array.isArray(value.failedLessonIds) &&
    value.failedLessonIds.every((id) => typeof id === "string")
      ? { failedLessonIds: value.failedLessonIds as string[] }
      : {}),
    ...(integerValue(value.repairAttempt, 0) !== null
      ? { repairAttempt: value.repairAttempt as number }
      : {}),
    ...(integerValue(value.repairLimit, 1) !== null
      ? { repairLimit: value.repairLimit as number }
      : {}),
    ...(Array.isArray(value.chapters)
      ? {
          chapters: value.chapters.flatMap((chapter) => {
            const parsed = parseChapter(chapter);
            return parsed ? [parsed] : [];
          }),
        }
      : {}),
    ...(completedLessons !== undefined ? { completedLessons } : {}),
    ...(totalLessons !== undefined ? { totalLessons } : {}),
    ...(lessonId ? { lessonId } : {}),
    ...(lessonTitle ? { lessonTitle } : {}),
    ...(chapterId ? { chapterId } : {}),
    ...(chapterTitle ? { chapterTitle } : {}),
  };
};

const WORK_PROGRESS_RECORD_KINDS = new Set([
  "assistant.progress",
  "task.queued",
  "task.running",
  "task.updated",
  "task.progress",
]);

/** Enriches real tasks with their newest durable work-progress context. */
export const attachAuthoringWorkProgress = (
  tasks: AuthoringTask[],
  records: AuthoringRecord[],
): AuthoringTask[] => {
  const latestByTaskId = new Map<
    string,
    { requestId: string; sequence: number; progress: AuthoringWorkProgress }
  >();

  records.forEach((record) => {
    if (!WORK_PROGRESS_RECORD_KINDS.has(record.kind)) return;

    const taskId = stringValue(record.payload.taskId);
    const requestId = stringValue(record.payload.requestId);
    const sequence = integerValue(record.payload.sequence, 0);
    const progress = parseWorkProgress(record.payload.workProgress);
    if (!taskId || !requestId || sequence === null || !progress) return;

    const previous = latestByTaskId.get(taskId);
    if (!previous || sequence >= previous.sequence) {
      latestByTaskId.set(taskId, { requestId, sequence, progress });
    }
  });

  return attachAuthoringTaskFailures(tasks, records).map((task) => {
    const latest = latestByTaskId.get(task.taskId);
    if (!latest || latest.requestId !== task.requestId) return task;
    return { ...task, workProgress: latest.progress };
  });
};
