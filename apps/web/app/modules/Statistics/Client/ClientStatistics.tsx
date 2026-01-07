import { OnboardingPages } from "@repo/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useUserStatistics } from "~/api/queries/useUserStatistics";
import { PageWrapper } from "~/components/PageWrapper";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { useTourSetup } from "~/modules/Onboarding/hooks/useTourSetup";
import { studentDashboardSteps } from "~/modules/Onboarding/routes/student";
import { parseRatesChartData } from "~/modules/Statistics/utils";

import { AvgPercentScoreChart, ActivityCalendar, RatesChart } from "./components";

import type { ChartConfig } from "~/components/ui/chart";

export default function ClientStatistics() {
  const { data: user, isLoading: isUserLoading } = useCurrentUser();

  const { language } = useLanguageStore();

  const { data: userStatistics, isLoading } = useUserStatistics(language);
  const { t } = useTranslation();

  const steps = useMemo(() => studentDashboardSteps(t), [t]);

  useTourSetup({
    steps,
    isLoading: isLoading || isUserLoading,
    hasCompletedTour: user?.onboardingStatus.dashboard,
    page: OnboardingPages.DASHBOARD,
  });

  const coursesChartData = useMemo(
    () => [
      {
        state: "Completed Courses",
        percentage: userStatistics?.averageStats.courseStats.completed,
        fill: "var(--primary-700)",
      },
      {
        state: "Started Courses",
        percentage: userStatistics?.averageStats.courseStats.started,
        fill: "var(--primary-300)",
      },
    ],
    [
      userStatistics?.averageStats.courseStats.completed,
      userStatistics?.averageStats.courseStats.started,
    ],
  );

  const coursesChartConfig = {
    completed: {
      label: t("clientStatisticsView.other.completedCourses"),
      color: "var(--primary-700)",
    },
    notCompleted: {
      label: t("clientStatisticsView.other.startedCourses"),
      color: "var(--primary-300)",
    },
  } satisfies ChartConfig;

  const quizzesChartData = useMemo(
    () => [
      {
        state: "Correct Answers",
        percentage: userStatistics?.quizzes.totalCorrectAnswers,
        fill: "var(--primary-700)",
      },
      {
        state: "Wrong Answers",
        percentage: userStatistics?.quizzes.totalWrongAnswers,
        fill: "var(--primary-300)",
      },
    ],
    [userStatistics?.quizzes.totalCorrectAnswers, userStatistics?.quizzes.totalWrongAnswers],
  );

  const quizzesChartConfig = {
    completed: {
      label: t("clientStatisticsView.other.correctAnswers"),
      color: "var(--primary-700)",
    },
    notCompleted: {
      label: t("clientStatisticsView.other.wrongAnswers"),
      color: "var(--primary-300)",
    },
  } satisfies ChartConfig;

  const lessonRatesChartData = parseRatesChartData(userStatistics?.lessons);
  const coursesRatesChartData = parseRatesChartData(userStatistics?.courses);
  const breadcrumbs = [{ title: t("navigationSideBar.progress"), href: "/progress" }];

  return (
    <PageWrapper id="client-statistics" breadcrumbs={breadcrumbs} className="2xl:!pt-8">
      <div className="flex flex-col gap-4 2xl:gap-6">
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ActivityCalendar
            isLoading={isLoading || isUserLoading}
            streak={userStatistics?.streak}
          />
          <AvgPercentScoreChart
            label={`${userStatistics?.quizzes.averageScore}`}
            title={t("clientStatisticsView.other.avgQuizScorePercentage")}
            chartConfig={quizzesChartConfig}
            chartData={quizzesChartData}
            isLoading={isLoading}
          />
          <AvgPercentScoreChart
            label={`${userStatistics?.averageStats.courseStats.completionRate}`}
            title={t("clientStatisticsView.other.avgQuizCompletionPercentage")}
            chartConfig={coursesChartConfig}
            chartData={coursesChartData}
            isLoading={isLoading}
            className="md:col-span-2 xl:col-span-1"
          />
        </div>
        <div id="course-stats" className="grid w-full grid-cols-1 gap-4 xl:grid-cols-2">
          <RatesChart
            resourceName={t("clientStatisticsView.other.courses")}
            chartData={coursesRatesChartData}
            isLoading={isLoading}
          />
          <RatesChart
            resourceName={t("clientStatisticsView.other.lessons")}
            chartData={lessonRatesChartData}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
