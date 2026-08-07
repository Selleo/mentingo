import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useDashboardIncompleteCourses } from "~/api/queries/useDashboardIncompleteCourses";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetFooter,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

export function WidgetAdminIncompleteCourses() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data, isLoading, isError, refetch } = useDashboardIncompleteCourses(language);
  const courses = data?.courses ?? [];
  const hasEnrollments = data?.hasEnrollments ?? false;
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.ADMIN_INCOMPLETE_COURSES];

  return (
    <DashboardWidgetCard>
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
      />
      <DashboardWidgetContent>
        {isLoading || isError ? (
          <DashboardWidgetQueryState
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
          />
        ) : courses.length === 0 ? (
          <p className="text-neutral-600">
            {t(
              !hasEnrollments
                ? "dashboardHome.widgets.incomplete_courses.noEnrollments"
                : "dashboardHome.widgets.incomplete_courses.allCompleted",
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                to={`/course/${course.id}?tab=Statistics`}
                className="block rounded-lg border border-neutral-100 p-3 transition-colors hover:border-primary-100 hover:bg-primary-50"
                title={course.title}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="body-sm-md line-clamp-1 text-neutral-950">{course.title}</p>
                  <span className="details shrink-0 text-neutral-500">
                    {course.total} {t("dashboardHome.widgets.incomplete_courses.enrollments")}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="bg-success-500"
                    style={{ width: `${(course.completed / course.total) * 100}%` }}
                  />
                  <span
                    className="bg-warning-500"
                    style={{ width: `${(course.inProgress / course.total) * 100}%` }}
                  />
                  <span
                    className="bg-neutral-300"
                    style={{ width: `${(course.notStarted / course.total) * 100}%` }}
                  />
                </div>
                <p className="details mt-1.5 text-neutral-500">
                  {t("dashboardHome.widgets.incomplete_courses.notCompleted", {
                    count: course.inProgress + course.notStarted,
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </DashboardWidgetContent>
      {courses.length > 0 && (
        <DashboardWidgetFooter>
          <div className="flex justify-between flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success-500" />
              {t("dashboardHome.widgets.training_completion.completed")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warning-500" />
              {t("dashboardHome.widgets.training_completion.inProgress")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-neutral-300" />
              {t("dashboardHome.widgets.training_completion.notStarted")}
            </span>
          </div>
        </DashboardWidgetFooter>
      )}
    </DashboardWidgetCard>
  );
}
