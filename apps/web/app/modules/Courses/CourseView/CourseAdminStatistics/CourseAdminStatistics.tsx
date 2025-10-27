import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useCourseStatistics } from "~/api/queries/admin/useCourseStatistics";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useUserRole } from "~/hooks/useUserRole";
import Loader from "~/modules/common/Loader/Loader";

import { CourseAdminStatisticsCard } from "./CourseAdminStatisticsCard";
import { CourseStatusDistributionChart } from "./CourseStatusDistributionChart";

export function CourseAdminStatistics() {
  const { t } = useTranslation();

  const { id = "" } = useParams();
  const { isAdminLike } = useUserRole();

  const { data: courseStatistics, isLoading } = useCourseStatistics({ id, enabled: isAdminLike });

  if (isLoading || !courseStatistics) {
    return (
      <div className="grid h-full w-full place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <h6 className="h6">{t("adminCourseView.statistics.title")}</h6>
          <p className="body-base-md title-neutral-800">
            {t("adminCourseView.statistics.subtitle")}
          </p>
        </CardHeader>

        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 grid-rows-auto md:grid-rows-3">
          <CourseAdminStatisticsCard
            title={t("adminCourseView.statistics.overview.enrolledCount")}
            tooltipText={t("adminCourseView.statistics.overview.enrolledCountTooltip")}
            statistic={courseStatistics.enrolledCount ?? 0}
          />
          <CourseAdminStatisticsCard
            title={t("adminCourseView.statistics.overview.completionRate")}
            tooltipText={t("adminCourseView.statistics.overview.completionRateTooltip")}
            statistic={courseStatistics.completionPercentage ?? 0}
            type="percentage"
          />
          <CourseAdminStatisticsCard
            title={t("adminCourseView.statistics.overview.averageCompletionPercentage")}
            tooltipText={t(
              "adminCourseView.statistics.overview.averageCompletionPercentageTooltip",
            )}
            statistic={courseStatistics.averageCompletionPercentage ?? 0}
            type="percentage"
          />
          <CourseStatusDistributionChart
            courseStatistics={courseStatistics}
            className="md:row-span-3 md:row-start-1 md:col-start-2"
          />
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
