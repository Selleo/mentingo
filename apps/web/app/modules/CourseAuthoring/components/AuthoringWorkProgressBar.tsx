import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import type { AuthoringTask } from "../courseAuthoring.types";

/** A unit counter is meaningful only when the server supplies the planned total. */
export const AuthoringWorkProgressBar = ({
  tasks,
  busy,
  showLabel = true,
}: {
  tasks: AuthoringTask[];
  busy?: boolean;
  showLabel?: boolean;
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

  const done = hasCount && completed >= total;

  return (
    <div className={cn("space-y-2", showLabel && "px-1")} aria-live="polite">
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs text-neutral-600",
          done && "font-medium text-success-700",
          !showLabel && "sr-only",
        )}
      >
        {done && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />}
        {label}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={label}
        className={cn("overflow-hidden rounded-full bg-neutral-200", showLabel ? "h-1.5" : "h-1")}
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary-700 transition-[width,background-color] duration-500",
            {
              "w-1/3 animate-pulse motion-reduce:animate-none": !hasCount,
              "animate-pulse motion-reduce:animate-none": hasCount && !done && (active || busy),
              "bg-success-600": done,
            },
          )}
          style={hasCount ? { width: `${Math.max(value ?? 0, done ? 0 : 4)}%` } : undefined}
        />
      </div>
    </div>
  );
};
