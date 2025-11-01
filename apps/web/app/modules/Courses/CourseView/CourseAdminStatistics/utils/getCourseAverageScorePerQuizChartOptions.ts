import { isEmpty } from "lodash-es";

import type i18next from "i18next";
import type { GetAverageQuizScoresResponse } from "~/api/generated-api";
import type { ChartConfig } from "~/components/ui/chart";

export const getCourseAverageScorePerQuizChartOptions = (
  t: typeof i18next.t,
  averageQuizScores?: GetAverageQuizScoresResponse["data"],
) => {
  if (isEmpty(averageQuizScores?.averageScoresPerQuiz) || !averageQuizScores) {
    return { chartConfig: {}, chartData: [], isEmpty: true };
  }

  const chartData = averageQuizScores.averageScoresPerQuiz.map((item) => ({
    quizName: item.name,
    averageQuizScore: item.averageScore,
    finishedCount: item.finishedCount,
  }));

  const chartConfig = {
    averageQuizScore: {
      label: t("adminCourseView.statistics.overview.averageScorePerQuiz"),
      color: "var(--primary)",
    },
  } satisfies ChartConfig;

  return { chartConfig, chartData, isEmpty: false };
};
