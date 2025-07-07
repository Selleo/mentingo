import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useUserStatistics } from "~/api/queries/useUserStatistics";
import { Gravatar } from "~/components/Gravatar";
import { PageWrapper } from "~/components/PageWrapper";
import { Avatar } from "~/components/ui/avatar";
import { parseRatesChartData } from "~/modules/Statistics/utils";

import {
  AvgPercentScoreChart,
  ContinueLearningCard,
  ProfileWithCalendar,
  RatesChart,
} from "./components";

import type { ChartConfig } from "~/components/ui/chart";

export default function ClientStatistics() {
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { data: userStatistics, isLoading } = useUserStatistics();
  const { t } = useTranslation();

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

  return (
    <PageWrapper className="2xl:!pt-8">
      <div className="flex flex-col gap-y-6 2xl:gap-y-6">
        <div className="flex items-center gap-x-2 2xl:gap-x-4">
          <p className="h5 2xl:h2 text-neutral-950">
            {t("clientStatisticsView.header")} {user?.firstName}
          </p>
          <Avatar className="size-12">
            <Gravatar email={user?.email} />
          </Avatar>
        </div>
        <div className="grid h-full grid-cols-1 flex-col-reverse items-center gap-x-7 gap-y-4 2xl:h-full 2xl:grid-cols-[1fr_384px]">
          <div className="flex h-full w-full flex-col gap-y-4 2xl:gap-x-4 2xl:gap-y-6">
            <div className="flex h-full w-full flex-wrap gap-4 2xl:flex-nowrap">
              <ContinueLearningCard isLoading={isLoading} lesson={userStatistics?.nextLesson} />
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
              />
            </div>
            <div className="flex h-full w-full flex-col gap-y-4 2xl:flex-row 2xl:gap-x-4">
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
          <ProfileWithCalendar
            user={user}
            isLoading={isLoading || isUserLoading}
            streak={userStatistics?.streak}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
