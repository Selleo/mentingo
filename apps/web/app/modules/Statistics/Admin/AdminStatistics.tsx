import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser, useStatistics } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { AvgScoreAcrossAllQuizzesChart } from "~/modules/Statistics/Admin/components/AvgScoreAcrossAllQuizzessChart";
import { ConversionsAfterFreemiumLessonChart } from "~/modules/Statistics/Admin/components/ConversionsAfterFreemiumLessonChart";
import { EnrollmentChart } from "~/modules/Statistics/Admin/components/EnrollmentChart";
import { setPageTitle } from "~/utils/setPageTitle";

import { CourseCompletionPercentageChart, FiveMostPopularCoursesChart } from "./components";

import type { MetaFunction } from "@remix-run/react";
import type { ChartConfig } from "~/components/ui/chart";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.dashboard");

export const AdminStatistics = () => {
  const { data: user } = useCurrentUser();

  const { language } = useLanguageStore();

  const { data: statistics, isLoading } = useStatistics(language);
  const { t } = useTranslation();
  const totalCoursesCompletion =
    statistics?.totalCoursesCompletionStats.totalCoursesCompletion ?? 0;
  const totalCourses = statistics?.totalCoursesCompletionStats.totalCourses ?? 0;

  const purchasedCourses = statistics?.conversionAfterFreemiumLesson.purchasedCourses ?? 0;
  const remainedOnFreemium = statistics?.conversionAfterFreemiumLesson.remainedOnFreemium ?? 0;

  const correctAnswers = statistics?.avgQuizScore.correctAnswerCount ?? 0;
  const totalAnswers = statistics?.avgQuizScore.answerCount ?? 0;

  const coursesCompletionChartConfig = {
    completed: {
      label: `${t("adminStatisticsView.other.completed")} - ${totalCoursesCompletion}`,
      color: "var(--primary-700)",
    },
    notCompleted: {
      label: `${t("adminStatisticsView.other.enrolled")} - ${totalCourses}`,
      color: "var(--primary-300)",
    },
  } satisfies ChartConfig;

  const coursesCompletionChartData = useMemo(
    () => [
      {
        state: t("adminStatisticsView.other.completed"),
        percentage: totalCoursesCompletion,
        fill: "var(--primary-700)",
      },
      {
        state: t("adminStatisticsView.other.enrolled"),
        percentage: totalCourses,
        fill: "var(--primary-300)",
      },
    ],
    [t, totalCoursesCompletion, totalCourses],
  );

  const conversionsChartConfig = {
    completed: {
      label: `${t("adminStatisticsView.other.purchasedCourse")} - ${purchasedCourses}`,
      color: "var(--primary-700)",
    },
    notCompleted: {
      label: `${t("adminStatisticsView.other.remainedOnFreemium")} - ${remainedOnFreemium}`,
      color: "var(--primary-300)",
    },
  } satisfies ChartConfig;

  const conversionsChartData = useMemo(
    () => [
      {
        state: t("adminStatisticsView.other.purchasedCourse"),
        percentage: purchasedCourses,
        fill: "var(--primary-700)",
      },
      {
        state: t("adminStatisticsView.other.remainedOnFreemium"),
        percentage: remainedOnFreemium,
        fill: "var(--primary-300)",
      },
    ],
    [purchasedCourses, remainedOnFreemium, t],
  );

  const avgQuizScoreChartConfig = {
    completed: {
      label: t("adminStatisticsView.other.correct"),
      color: "var(--primary-700)",
    },
    notCompleted: {
      label: t("adminStatisticsView.other.incorrect"),
      color: "var(--primary-300)",
    },
  } satisfies ChartConfig;

  const avgQuizScoreChartData = useMemo(
    () => [
      {
        state: t("adminStatisticsView.other.correct"),
        percentage: 7,
        fill: "var(--primary-700)",
      },
      {
        state: t("adminStatisticsView.other.incorrect"),
        percentage: 13,
        fill: "var(--primary-300)",
      },
    ],
    [t],
  );

  return (
    <PageWrapper className="flex flex-col gap-y-6 xl:!h-full xl:gap-y-8 2xl:!h-auto">
      <div className="flex items-center gap-x-2 xl:gap-x-4">
        <p className="h5 xl:h2 text-neutral-950">
          {t("adminStatisticsView.header")} {user?.firstName}
        </p>
        <UserAvatar
          className="size-12"
          userName={`${user?.firstName} ${user?.lastName}`}
          profilePictureUrl={user?.profilePictureUrl}
        />
      </div>
      <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-4 md:gap-y-6 xl:h-full xl:grid-cols-4 xl:grid-rows-[minmax(min-content,_auto)]">
        <FiveMostPopularCoursesChart
          data={statistics?.fiveMostPopularCourses}
          isLoading={isLoading}
        />
        <CourseCompletionPercentageChart
          isLoading={isLoading}
          label={`${statistics?.totalCoursesCompletionStats.completionPercentage}`}
          title={t("adminStatisticsView.other.courseCompletionPercentage")}
          chartConfig={coursesCompletionChartConfig}
          chartData={coursesCompletionChartData}
        />
        <ConversionsAfterFreemiumLessonChart
          isLoading={isLoading}
          label={`${statistics?.conversionAfterFreemiumLesson.conversionPercentage}`}
          title={t("adminStatisticsView.other.conversionsAfterFreemiumLesson")}
          chartConfig={conversionsChartConfig}
          chartData={conversionsChartData}
        />
        <EnrollmentChart isLoading={isLoading} data={statistics?.courseStudentsStats} />
        <AvgScoreAcrossAllQuizzesChart
          isLoading={isLoading}
          label={`${correctAnswers}/${totalAnswers}`}
          title={t("adminStatisticsView.other.avgQuizScore")}
          chartConfig={avgQuizScoreChartConfig}
          chartData={avgQuizScoreChartData}
        />
      </div>
    </PageWrapper>
  );
};
