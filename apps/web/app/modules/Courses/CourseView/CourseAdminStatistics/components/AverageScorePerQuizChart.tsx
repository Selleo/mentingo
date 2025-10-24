import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Customized, XAxis, Text } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";

import { getCourseAverageScorePerQuizChartOptions } from "../utils/getCourseAverageScorePerQuizChartOptions";

import type { GetAverageQuizScoresResponse } from "~/api/generated-api";

interface AverageScorePerQuizChartProps {
  averageQuizScores?: GetAverageQuizScoresResponse["data"];
}

export function AverageScorePerQuizChart({ averageQuizScores }: AverageScorePerQuizChartProps) {
  const { t } = useTranslation();

  const { chartConfig, chartData, isEmpty } = useMemo(
    () => getCourseAverageScorePerQuizChartOptions(t, averageQuizScores),
    [t, averageQuizScores],
  );

  return (
    <div className="rounded-sm p-6 outline outline-1 outline-neutral-200 flex flex-col justify-center gap-6">
      <div className="text-center space-y-2">
        <p className="body-base-md">
          {t("adminCourseView.statistics.overview.averageScorePerQuiz")}
        </p>
        <p className="body-sm">
          {t("adminCourseView.statistics.overview.averageScorePerQuizSubtitle")}
        </p>
      </div>
      <ChartContainer config={chartConfig} className="max-h-64">
        <BarChart accessibilityLayer data={chartData}>
          {isEmpty && (
            <Customized
              component={() => {
                return (
                  <Text
                    x={0}
                    textAnchor="middle"
                    verticalAnchor="middle"
                    className="h6 translate-x-1/2 translate-y-1/2 fill-primary-950"
                  >
                    {t("enrollmentChartView.other.noData")}
                  </Text>
                );
              }}
            />
          )}
          <CartesianGrid vertical={false} />
          {!isEmpty && (
            <>
              <XAxis
                dataKey="quizName"
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                fontSize={10}
                tickFormatter={(value) => value.slice(0, 10)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    nameKey="quizName"
                    labelFormatter={(value) => {
                      return value;
                    }}
                  />
                }
              />
            </>
          )}
          <Bar
            dataKey="averageQuizScore"
            name={t("adminCourseView.statistics.overview.averageQuizScore")}
            fill="var(--primary)"
            radius={8}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
