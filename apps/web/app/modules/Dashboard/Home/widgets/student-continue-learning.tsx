import { Link } from "@remix-run/react";
import { DASHBOARD_WIDGET_IDS } from "@repo/shared";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useStudentDashboardSummary } from "~/api/queries/useStudentDashboardSummary";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";

import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetFooter,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

export function WidgetStudentContinueLearning() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useStudentDashboardSummary();
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING];
  const courses = data?.continueLearningCourses ?? [];

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
          <div className="flex min-h-32 items-center justify-center text-center text-neutral-600">
            {t("dashboardHome.widgets.studentTiles.continueLearning.empty")}
          </div>
        ) : (
          <div className="space-y-3">
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
                  className="group grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-neutral-100 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <img
                    src={course.thumbnailUrl || DefaultPhotoCourse}
                    alt=""
                    className="h-14 w-20 rounded-md object-cover"
                    onError={(event) => {
                      event.currentTarget.src = DefaultPhotoCourse;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="body-sm-md line-clamp-1 text-neutral-950">{course.title}</h3>
                      <span className="details shrink-0 text-neutral-500">{progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="details mt-1.5 line-clamp-1 text-neutral-500">
                      {course.lesson?.title
                        ? t("dashboardHome.widgets.studentTiles.continueLearning.nextLesson", {
                            title: course.lesson.title,
                          })
                        : t("dashboardHome.widgets.studentTiles.continueLearning.openCourse")}
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-700"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </DashboardWidgetContent>
      {courses.length > 0 && (
        <DashboardWidgetFooter>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:text-primary-800"
          >
            {t("dashboardHome.widgets.studentTiles.continueLearning.viewAll", {
              count: courses.length,
            })}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </DashboardWidgetFooter>
      )}
    </DashboardWidgetCard>
  );
}
