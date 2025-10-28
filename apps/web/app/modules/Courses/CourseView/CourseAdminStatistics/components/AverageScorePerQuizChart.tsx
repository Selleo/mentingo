import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Customized, XAxis, YAxis, Text } from "recharts";

import { ChartContainer, ChartTooltip } from "~/components/ui/chart";

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
              <YAxis
                domain={[0, 100]}
                ticks={[25, 50, 75, 100]}
                tickFormatter={(value) => `${value}%`}
                axisLine={false}
                tickLine={false}
                fontSize={10}
              />
              <XAxis
                dataKey="quizName"
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                fontSize={10}
                tickFormatter={(value) => `${value.slice(0, 7)}...`}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;

                  const data = payload[0].payload;

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="body-sm-md mb-2">{data.quizName}</div>
                      <div className="details">
                        {t("adminCourseView.statistics.overview.averageQuizScore")}:{" "}
                        {data.averageQuizScore}%
                      </div>
                      <div className="details">
                        {t("adminCourseView.statistics.overview.completedBy", {
                          count: data.finishedCount,
                        })}
                      </div>
                    </div>
                  );
                }}
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
