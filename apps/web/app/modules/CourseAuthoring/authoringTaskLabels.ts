import { match } from "ts-pattern";

import { authoringOutlineProgressLabel } from "./authoringOutlineProgress";
import {
  AUTHORING_OUTLINE_PHASE,
  AUTHORING_TASK_KIND,
  AUTHORING_TASK_STATUS,
  AUTHORING_WORK_PROGRESS_STAGE,
} from "./courseAuthoring.constants";

import type { AuthoringTask } from "./courseAuthoring.types";

/** Names what the task is doing from its kind, falling back to the reported phase. */
export const authoringPhaseLabel = (
  task: AuthoringTask,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  if (task.phase === "preparing") return t("courseAuthoring.conversation.preparingResponse");
  if (
    task.status === AUTHORING_TASK_STATUS.QUEUED ||
    task.status === AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES
  ) {
    return t("courseAuthoring.conversation.preparingResponse");
  }
  if (task.status === AUTHORING_TASK_STATUS.WAITING_AUTHOR)
    return t("courseAuthoring.conversation.waiting");
  if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.RECOVERING)
    return t("courseAuthoring.activityRail.recoveringFailedParts");
  if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.REPAIRING) {
    return t(
      task.kind === AUTHORING_TASK_KIND.LESSON
        ? "courseAuthoring.activityRail.taskKind.revisingLesson"
        : "courseAuthoring.activityRail.taskKind.revisingLessonPlan",
    );
  }
  if (task.phase === "researching" || task.phase === "source_working") {
    return t("courseAuthoring.conversation.readingSources");
  }
  if (
    task.kind === AUTHORING_TASK_KIND.PLAN &&
    task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.OUTLINE &&
    task.workProgress.outlinePhase
  ) {
    return authoringOutlineProgressLabel(task.workProgress, t);
  }
  if (
    task.kind === AUTHORING_TASK_KIND.COURSE_REVIEW ||
    task.phase === AUTHORING_OUTLINE_PHASE.REVIEWING
  ) {
    return t("courseAuthoring.conversation.checkingCourse");
  }
  if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.VALIDATION) {
    return t(
      task.kind === AUTHORING_TASK_KIND.LESSON
        ? "courseAuthoring.activityRail.taskKind.checkingLesson"
        : "courseAuthoring.activityRail.taskKind.checkingLessonPlan",
    );
  }
  if (
    task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.OUTLINE ||
    task.kind === AUTHORING_TASK_KIND.PLAN
  ) {
    return t("courseAuthoring.conversation.planningOutline");
  }
  if (
    task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.LESSON_PLANNING ||
    task.kind === AUTHORING_TASK_KIND.DETAILED_PLAN
  ) {
    return t("courseAuthoring.conversation.planningLessons");
  }
  if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.LESSON_GENERATION) {
    return t("courseAuthoring.conversation.writingLesson");
  }
  const key = match(task.kind ?? task.phase)
    .with(AUTHORING_TASK_KIND.ROUTE, "route_working", () => "conversation.understandingRequest")
    .with(AUTHORING_TASK_KIND.PLAN, () => "conversation.planningOutline")
    .with(AUTHORING_TASK_KIND.DETAILED_PLAN, () => "conversation.planningLessons")
    .with("planning", () => "activityRail.taskKind.planningCourse")
    .with(
      AUTHORING_TASK_KIND.LESSON,
      "generating_lesson",
      "writing",
      () => "conversation.writingLesson",
    )
    .with(
      AUTHORING_TASK_KIND.EDIT,
      "updating_course",
      "editing",
      () => "conversation.updatingCourse",
    )
    .with(
      AUTHORING_TASK_KIND.SOURCE,
      "source_working",
      "researching",
      () => "conversation.readingSources",
    )
    .with(AUTHORING_TASK_KIND.ASSET, "asset_working", () => "conversation.creatingVisual")
    .otherwise(() => "conversation.working");
  return t(`courseAuthoring.${key}`);
};

/**
 * Overrides a task's own displayed label only when that label would otherwise be ambiguous: a
 * known lesson/chapter title always wins, and a plain phase name ("Writing a lesson…") is only
 * given here when two or more concurrent tasks in the same request share it. A single task in
 * its phase is left out entirely, so its own view (Live work row, tool call) keeps showing just
 * once instead of repeating the same generic phase text next to itself.
 */
export const authoringTaskDisplayLabels = (
  tasks: AuthoringTask[],
  knownLabels: Record<string, string>,
  t: (key: string, options?: Record<string, unknown>) => string,
): Record<string, string> => {
  const labels: Record<string, string> = {};
  const groups = new Map<string, AuthoringTask[]>();

  tasks.forEach((task) => {
    const knownLabel = knownLabels[task.taskId] ?? task.workProgress?.lessonTitle;
    if (knownLabel) {
      labels[task.taskId] = knownLabel;
      return;
    }
    const groupKey = `${task.requestId}:${authoringPhaseLabel(task, t)}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), task]);
  });

  groups.forEach((group) => {
    const uniqueTasks = [...new Map(group.map((task) => [task.taskId, task])).values()].sort(
      (left, right) => left.taskId.localeCompare(right.taskId),
    );
    if (uniqueTasks.length < 2) return;

    uniqueTasks.forEach((task, index) => {
      labels[task.taskId] = t("courseAuthoring.conversation.distinctTaskLabel", {
        label: authoringPhaseLabel(task, t),
        number: index + 1,
      });
    });
  });

  return labels;
};
