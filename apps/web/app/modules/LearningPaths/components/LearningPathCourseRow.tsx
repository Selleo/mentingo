import { format } from "date-fns";
import { CheckCircle2, CircleDashed, Clock3, Lock, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import type { GetLearningPathByIdResponse } from "~/api/generated-api";

type LearningPathCourse = GetLearningPathByIdResponse["data"]["courses"][number];
type LearningPathCourseState = LearningPathCourse["progress"] | "locked";

type LearningPathCourseRowProps = {
  course: LearningPathCourse;
  index: number;
};

export function LearningPathCourseRow({ course, index }: LearningPathCourseRowProps) {
  const { t } = useTranslation();
  const isCompleted = course.progress === "completed";
  const isLocked = course.isLocked || course.progress === "blocked";
  const courseState: LearningPathCourseState = isLocked ? "locked" : course.progress;
  const courseStateConfig = match(courseState)
    .with("completed", () => ({
      badgeVariant: "success" as const,
      icon: <CheckCircle2 className="size-4" />,
      label: t("learningPathsView.courseState.completed"),
      helperText: course.completedAt
        ? t("learningPathsView.detail.completedAt", {
            date: format(new Date(course.completedAt), "dd.MM.yyyy"),
          })
        : t("learningPathsView.courseState.completed"),
    }))
    .with("in_progress", () => ({
      badgeVariant: "inProgress" as const,
      icon: <Clock3 className="size-4" />,
      label: t("learningPathsView.courseState.inProgress"),
      helperText: t("learningPathsView.courseState.inProgressDescription"),
    }))
    .with("not_started", () => ({
      badgeVariant: "notStarted" as const,
      icon: <CircleDashed className="size-4" />,
      label: t("learningPathsView.courseState.notStarted"),
      helperText: t("learningPathsView.courseState.notStartedDescription"),
    }))
    .with("blocked", "locked", () => ({
      badgeVariant: "blocked" as const,
      icon: <Lock className="size-4" />,
      label: t("learningPathsView.courseState.locked"),
      helperText: t("learningPathsView.courseState.lockedDescription"),
    }))
    .exhaustive();

  return (
    <li
      className={cn(
        "group grid gap-4 rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm transition duration-300 md:grid-cols-[auto_1fr_auto]",
        {
          "border-success-200 bg-success-50/70": isCompleted,
          "border-neutral-200 bg-neutral-50": isLocked,
        },
      )}
    >
      <div
        className={cn(
          "grid size-12 place-items-center rounded-full border bg-white text-sm font-semibold text-neutral-700 shadow-sm",
          {
            "border-success-300 bg-success-50 text-success-700": isCompleted,
            "border-neutral-300 text-neutral-500": isLocked,
          },
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="size-5" />
        ) : isLocked ? (
          <Lock className="size-5" />
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold leading-6 text-neutral-950">
            {t("learningPathsView.detail.courseTitle", {
              number: course.displayOrder,
            })}
          </h3>
        </div>
        <p className="details-md mt-1 break-all text-neutral-600">
          {t("learningPathsView.detail.courseId", {
            courseId: course.courseId,
          })}
        </p>
      </div>

      <div className="flex items-start justify-between gap-3 md:min-w-[190px] md:flex-col md:items-end">
        <Badge variant={courseStateConfig.badgeVariant} className="gap-1.5">
          {courseStateConfig.icon}
          {courseStateConfig.label}
        </Badge>
        <p
          className={cn("details-md text-right text-neutral-600", {
            "text-success-700": isCompleted,
          })}
        >
          {courseStateConfig.helperText}
        </p>
        {!isLocked && (
          <div className="hidden items-center text-primary-700 transition group-hover:text-primary-900 md:flex">
            <PlayCircle className="size-5" />
          </div>
        )}
      </div>
    </li>
  );
}
