import { COURSE_PROGRESS_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { cn } from "~/lib/utils";

import type { LearningPathCoursePreview } from "./learningPaths.types";

const MAX_SEGMENTED_COURSE_COUNT = 20;

type LearningPathProgressBarProps = {
  courses: LearningPathCoursePreview[];
};

const getSegmentClassName = (course: LearningPathCoursePreview) =>
  match(course.progress)
    .with(COURSE_PROGRESS_STATUSES.COMPLETED, () => "bg-success-500")
    .with(COURSE_PROGRESS_STATUSES.IN_PROGRESS, () => "bg-warning-400")
    .otherwise(() => "bg-neutral-200");

export function LearningPathProgressBar({ courses }: LearningPathProgressBarProps) {
  const { t } = useTranslation();

  const completedCourseCount = courses.filter(
    (course) => course.progress === COURSE_PROGRESS_STATUSES.COMPLETED,
  ).length;
  const progressPercent = Math.round((completedCourseCount / courses.length) * 100);
  const isSegmented = courses.length <= MAX_SEGMENTED_COURSE_COUNT;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-neutral-800">
          {t("learningPathsView.progress.title")}
        </span>
        <span className="text-xs font-semibold tabular-nums text-success-500">
          {progressPercent}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-label={t("learningPathsView.progress.title")}
        className="flex h-1.5 gap-1"
      >
        {isSegmented ? (
          courses.map((course) => (
            <span
              key={course.id}
              title={course.title}
              className={cn(
                "h-full flex-1 rounded-full transition-colors duration-500",
                getSegmentClassName(course),
              )}
            />
          ))
        ) : (
          <span className="h-full flex-1 overflow-hidden rounded-full bg-neutral-200">
            <span
              className="block h-full rounded-full bg-success-500 transition-[width] duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </span>
        )}
      </div>

      <span className="text-xs text-neutral-600">
        {t("learningPathsView.progress.summary", {
          completed: completedCourseCount,
          total: courses.length,
        })}
      </span>
    </div>
  );
}
