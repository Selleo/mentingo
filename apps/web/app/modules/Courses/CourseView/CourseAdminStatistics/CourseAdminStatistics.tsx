import { useParams } from "@remix-run/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCourseAverageScorePerQuiz } from "~/api/queries/admin/useCourseAverageScorePerQuiz";
import { useCourseStatistics } from "~/api/queries/admin/useCourseStatistics";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useUserRole } from "~/hooks/useUserRole";
import Loader from "~/modules/common/Loader/Loader";

import {
  CourseAdminStatisticsCard,
  CourseStatusDistributionChart,
  AverageScorePerQuizChart,
  CourseStudentsProgressTable,
} from "./components";

interface CourseAdminStatisticsProps {
  lessonCount: number;
}

export function CourseAdminStatistics({ lessonCount }: CourseAdminStatisticsProps) {
  const { t } = useTranslation();

  const { id = "" } = useParams();
  const { isAdminLike } = useUserRole();

  const { data: courseStatistics, isLoading: isLoadingCourseStatistics } = useCourseStatistics({
    id,
    enabled: isAdminLike,
  });
  const { data: averageQuizScores, isLoading: isLoadingAverageScores } =
    useCourseAverageScorePerQuiz({ id, enabled: isAdminLike });

  const isLoading = useMemo(
    () => isLoadingCourseStatistics || isLoadingAverageScores,
    [isLoadingCourseStatistics, isLoadingAverageScores],
  );

  if (isLoading) {
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

        <CardContent className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 grid-rows-auto md:grid-rows-3">
            <CourseAdminStatisticsCard
              title={t("adminCourseView.statistics.overview.enrolledCount")}
              statistic={courseStatistics?.enrolledCount ?? 0}
            />
            <CourseAdminStatisticsCard
              title={t("adminCourseView.statistics.overview.completionRate")}
              statistic={courseStatistics?.completionPercentage ?? 0}
              type="percentage"
            />
            <CourseAdminStatisticsCard
              title={t("adminCourseView.statistics.overview.averageCompletionPercentage")}
              statistic={courseStatistics?.averageCompletionPercentage ?? 0}
              type="percentage"
            />
            <CourseStatusDistributionChart
              courseStatistics={courseStatistics}
              className="md:row-span-3 md:row-start-1 md:col-start-2"
            />
          </div>
          <AverageScorePerQuizChart averageQuizScores={averageQuizScores} />
          <CourseStudentsProgressTable lessonCount={lessonCount} />
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
