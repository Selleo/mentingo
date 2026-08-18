import { Link } from "@remix-run/react";
import {
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
  STUDENT_COURSE_URGENCY,
} from "@repo/shared";
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
  DashboardWidgetFooter,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import type { DashboardWidgetSize } from "../types";

export function WidgetStudentRequiredCourse({
  widgetSize = DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
}: {
  widgetSize?: DashboardWidgetSize;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch } = useStudentDashboardSummary();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES];
  const courses = data?.requiredCourses ?? [];
  const isCompact = widgetSize === DASHBOARD_WIDGET_SIZES.TWO_BY_ONE;
  const overdueCount = courses.filter(
    (course) => course.urgency === STUDENT_COURSE_URGENCY.OVERDUE,
  ).length;

  return (
    <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE}>
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
            {t("dashboardHome.widgets.studentTiles.requiredCourse.empty")}
          </div>
        ) : (
          <div className={isCompact ? "space-y-2" : "space-y-3"}>
            {courses.map((course) => (
              <Link
                key={course.courseId}
                to={`/course/${course.slug}`}
                className={cn(
                  "group flex items-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  isCompact ? "min-h-0 gap-2 p-2" : "min-h-24 gap-3 p-3",
                  {
                    "border-error-100 bg-error-50 hover:border-error-300 focus-visible:ring-error-300":
                      course.urgency === STUDENT_COURSE_URGENCY.OVERDUE,
                    "border-warning-100 bg-warning-50 hover:border-warning-300 focus-visible:ring-warning-300":
                      course.urgency === STUDENT_COURSE_URGENCY.DUE_SOON,
                    "border-neutral-100 hover:border-primary-200 hover:bg-primary-50 focus-visible:ring-primary-300":
                      course.urgency === STUDENT_COURSE_URGENCY.SCHEDULED ||
                      course.urgency === STUDENT_COURSE_URGENCY.NO_DEADLINE,
                  },
                )}
              >
                <img
                  src={course.thumbnailUrl || DefaultPhotoCourse}
                  alt=""
                  className={cn(
                    "shrink-0 rounded-md object-cover",
                    isCompact ? "h-10 w-12" : "h-14 w-20",
                  )}
                  onError={(event) => {
                    event.currentTarget.src = DefaultPhotoCourse;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={cn("details font-medium text-neutral-500", {
                      "text-error-700": course.urgency === STUDENT_COURSE_URGENCY.OVERDUE,
                      "text-warning-700": course.urgency === STUDENT_COURSE_URGENCY.DUE_SOON,
                    })}
                  >
                    {t(`dashboardHome.widgets.studentTiles.requiredCourse.${course.urgency}`)}
                  </span>
                  <h3
                    className={cn(
                      "body-sm-md mt-0.5 text-neutral-950",
                      isCompact ? "line-clamp-1" : "line-clamp-2",
                    )}
                  >
                    {course.title}
                  </h3>
                  <p className="details mt-1 text-neutral-500">
                    {course.dueDate
                      ? t("dashboardHome.widgets.studentTiles.requiredCourse.dueDate", {
                          date: new Intl.DateTimeFormat(i18n.language, {
                            dateStyle: "medium",
                          }).format(new Date(course.dueDate)),
                        })
                      : t("dashboardHome.widgets.studentTiles.requiredCourse.noDueDate")}
                  </p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        )}
      </DashboardWidgetContent>
      {courses.length > 0 && !isCompact && (
        <DashboardWidgetFooter>
          <div className="flex items-center justify-between gap-3">
            <span>
              {t("dashboardHome.widgets.studentTiles.requiredCourse.total", {
                count: courses.length,
              })}
            </span>
            {overdueCount > 0 && (
              <span className="font-medium text-error-700">
                {t("dashboardHome.widgets.studentTiles.requiredCourse.overdueCount", {
                  count: overdueCount,
                })}
              </span>
            )}
          </div>
        </DashboardWidgetFooter>
      )}
    </DashboardWidgetCard>
  );
}
