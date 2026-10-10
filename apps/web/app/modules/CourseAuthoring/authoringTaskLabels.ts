import { match } from "ts-pattern";

import type { AuthoringTask } from "./courseAuthoring.types";

/** Names what the task is doing from its kind, falling back to the reported phase. */
export const authoringPhaseLabel = (task: AuthoringTask, t: (key: string) => string) => {
  if (task.phase === "preparing") return t("courseAuthoring.conversation.preparingResponse");
  if (task.status === "queued" || task.status === "waiting_dependencies") {
    return t("courseAuthoring.conversation.preparingResponse");
  }
  if (task.status === "waiting_author") return t("courseAuthoring.conversation.waiting");
  if (task.workProgress?.stage === "recovering")
    return t("courseAuthoring.activityRail.recoveringFailedParts");
  if (task.workProgress?.stage === "repairing") {
    return t(
      task.kind === "lesson"
        ? "courseAuthoring.activityRail.taskKind.revisingLesson"
        : "courseAuthoring.activityRail.taskKind.revisingLessonPlan",
    );
  }
  if (task.phase === "researching" || task.phase === "source_working") {
    return t("courseAuthoring.conversation.readingSources");
  }
  if (task.kind === "course_review" || task.phase === "reviewing") {
    return t("courseAuthoring.conversation.checkingCourse");
  }
  if (task.workProgress?.stage === "validation") {
    return t(
      task.kind === "lesson"
        ? "courseAuthoring.activityRail.taskKind.checkingLesson"
        : "courseAuthoring.activityRail.taskKind.checkingLessonPlan",
    );
  }
  if (task.workProgress?.stage === "outline" || task.kind === "plan") {
    return t("courseAuthoring.conversation.planningOutline");
  }
  if (task.workProgress?.stage === "lesson_planning" || task.kind === "detailed_plan") {
    return t("courseAuthoring.conversation.planningLessons");
  }
  if (task.workProgress?.stage === "lesson_generation") {
    return t("courseAuthoring.conversation.writingLesson");
  }
  const key = match(task.kind ?? task.phase)
    .with("route", "route_working", () => "conversation.understandingRequest")
    .with("plan", () => "conversation.planningOutline")
    .with("detailed_plan", () => "conversation.planningLessons")
    .with("planning", () => "activityRail.taskKind.planningCourse")
    .with("lesson", "generating_lesson", "writing", () => "conversation.writingLesson")
    .with("edit", "updating_course", "editing", () => "conversation.updatingCourse")
    .with("source", "source_working", "researching", () => "conversation.readingSources")
    .with("asset", "asset_working", () => "conversation.creatingVisual")
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
