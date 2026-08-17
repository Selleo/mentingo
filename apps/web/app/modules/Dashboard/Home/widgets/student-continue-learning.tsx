import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useStudentDashboardSummary } from "~/api/queries/useStudentDashboardSummary";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { cn } from "~/lib/utils";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import type { DashboardWidgetSize } from "../types";

export function WidgetStudentContinueLearning({
  widgetSize = DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
}: {
  widgetSize?: DashboardWidgetSize;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useStudentDashboardSummary();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING];
  const courses = data?.continueLearningCourses ?? [];
  const isCompact = widgetSize === DASHBOARD_WIDGET_SIZES.TWO_BY_ONE;

  return (
    <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING}>
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent className={isCompact ? "p-2" : "p-3"}>
        {isLoading || isError ? (
          <DashboardWidgetQueryState
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
          />
        ) : courses.length === 0 ? (
          <div
            className={cn(
              "flex h-full items-center justify-center text-center text-neutral-600",
              !isCompact && "min-h-32",
            )}
          >
            {t("dashboardHome.widgets.studentTiles.continueLearning.empty")}
          </div>
        ) : (
          <div className={isCompact ? "space-y-2" : "space-y-3"}>
            {courses.map((course) => {
              const progress =
                course.courseChapterCount > 0
                  ? Math.round((course.completedChapterCount / course.courseChapterCount) * 100)
                  : 0;
              const destination = course.lesson
                ? `/course/${course.slug}/lesson/${course.lesson.id}`
                : `/course/${course.slug}`;

              return (
                <Link
                  key={course.courseId}
                  to={destination}
                  className={cn(
                    "group grid items-center rounded-lg border border-neutral-100 transition-colors hover:border-primary-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                    isCompact
                      ? "grid-cols-[3rem_minmax(0,1fr)_auto] gap-2 p-2"
                      : "grid-cols-[5rem_minmax(0,1fr)_auto] gap-3 p-3",
                  )}
                >
                  <img
                    src={course.thumbnailUrl || DefaultPhotoCourse}
                    alt=""
                    className={cn("rounded-md object-cover", isCompact ? "h-10 w-12" : "h-14 w-20")}
                    onError={(event) => {
                      event.currentTarget.src = DefaultPhotoCourse;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <h3 className="body-sm-md min-w-0 line-clamp-1 text-neutral-950">
                        {course.title}
                      </h3>
                      <span className="details-md whitespace-nowrap text-neutral-700">
                        {progress}%
                      </span>
                    </div>
                    <div
                      className={cn(
                        "h-1.5 overflow-hidden rounded-full bg-neutral-100",
                        isCompact ? "mt-1.5" : "mt-2",
                      )}
                    >
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {!isCompact && (
                      <p className="details mt-1.5 line-clamp-1 text-neutral-500">
                        {course.lesson?.title
                          ? t("dashboardHome.widgets.studentTiles.continueLearning.nextLesson", {
                              title: course.lesson.title,
                            })
                          : t("dashboardHome.widgets.studentTiles.continueLearning.openCourse")}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-700"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </DashboardWidgetContent>
    </DashboardWidgetCard>
  );
}
