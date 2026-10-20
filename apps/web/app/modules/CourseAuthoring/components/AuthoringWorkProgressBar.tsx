import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import type { AuthoringTask } from "../courseAuthoring.types";

/** A unit counter is meaningful only when the server supplies the planned total. */
export const AuthoringWorkProgressBar = ({
  tasks,
  busy,
}: {
  tasks: AuthoringTask[];
  busy?: boolean;
}) => {
  const { t } = useTranslation();
  const active = tasks.some((task) => ["queued", "running"].includes(task.status));
  const sameRequest = new Set(tasks.map((task) => task.requestId)).size === 1;
  const lessonProgress = sameRequest
    ? tasks.flatMap((task) =>
        task.status === "running" &&
        task.workProgress &&
        ["lesson_generation", "validation", "repairing", "recovering"].includes(
          task.workProgress.stage,
        ) &&
        task.workProgress.totalLessons &&
        task.workProgress.completedLessons !== undefined
          ? [task.workProgress]
          : [],
      )
    : [];
  const planningTask = sameRequest
    ? tasks.find(
        (task) =>
          task.status === "running" &&
          task.kind === "detailed_plan" &&
          task.workProgress?.chapters?.length,
      )
    : undefined;
  const chapters = planningTask?.workProgress?.chapters;
  const total =
    chapters?.length ?? Math.max(0, ...lessonProgress.map((item) => item.totalLessons ?? 0));
  const completed = chapters
    ? chapters.filter((chapter) => chapter.status === "complete").length
    : Math.max(0, ...lessonProgress.map((item) => item.completedLessons ?? 0));
  const hasCount = total > 0;
  if (!active && !busy && !hasCount) return null;

  const value = hasCount ? Math.min(100, (completed / total) * 100) : undefined;
  const label = hasCount
    ? t(
        chapters
          ? "courseAuthoring.activityRail.chapterPlanningProgress"
          : "courseAuthoring.activityRail.lessonsProgress",
        { completed, total },
      )
    : t("courseAuthoring.activityRail.inProgress");

  return (
    <div className="space-y-2 px-1" aria-live="polite">
      <p className="text-xs text-neutral-600">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={label}
        className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className={cn("h-full rounded-full bg-primary-700 transition-[width]", {
            "w-1/3 animate-pulse motion-reduce:animate-none": !hasCount,
          })}
          style={hasCount ? { width: `${value}%` } : undefined}
        />
      </div>
    </div>
  );
};
