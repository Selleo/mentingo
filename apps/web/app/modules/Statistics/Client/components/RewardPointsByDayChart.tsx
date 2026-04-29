import { t } from "i18next";
import { Bar, BarChart, CartesianGrid, Customized, Text, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Skeleton } from "~/components/ui/skeleton";
import { ChartLegendBadge } from "~/modules/Statistics/Client/components/ChartLegendBadge";

import type { RewardPointsByDay } from "~/api/queries/rewards/useRewardPointsByDay";
import type { ChartConfig } from "~/components/ui/chart";

const chartConfig = {
  points: {
    label: t("clientStatisticsView.other.rewardPoints", "Reward points"),
    color: "var(--primary-700)",
  },
} satisfies ChartConfig;

type RewardPointsByDayChartProps = {
  chartData: RewardPointsByDay[];
  isLoading?: boolean;
};

export function RewardPointsByDayChart({
  chartData,
  isLoading = false,
}: RewardPointsByDayChartProps) {
  const dataMax = Math.max(...chartData.map(({ points }) => points), 0);
  const yAxisMax = Math.max(dataMax, 1);
  const isEmptyChart = chartData.every(({ points }) => !points);

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-lg bg-white p-8 drop-shadow-card">
        <hgroup className="flex flex-col items-center gap-y-[5px] py-3">
          <Skeleton className="h-6 w-[240px] rounded-lg" />
          <Skeleton className="h-4 w-40 rounded-lg" />
        </hgroup>
        <Skeleton className="h-[273px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg bg-white p-8 drop-shadow-card">
      <hgroup>
        <h2 className="body-lg-md text-center text-neutral-950">
          {t("clientStatisticsView.other.rewardPointsByDay", "Reward points by day")}
        </h2>
        <p className="body-sm-md text-center text-neutral-800">
          {t("clientStatisticsView.other.rewardPointsByDayDescription", "Points gained each day")}
        </p>
      </hgroup>
      <div className="mt-2 grid h-full place-items-center">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-full max-h-[224px] w-full"
        >
          <BarChart accessibilityLayer data={chartData} margin={{ left: -28 }}>
            <Customized
              component={() =>
                isEmptyChart ? (
                  <Text
                    x={0}
                    textAnchor="middle"
                    verticalAnchor="middle"
                    className="h5 md:h3 translate-x-1/2 translate-y-1/2 fill-primary-950"
                  >
                    {t("clientStatisticsView.other.noDataAvailable")}
                  </Text>
                ) : null
              }
            />
            <CartesianGrid horizontal={true} vertical={false} />
            {!isEmptyChart && (
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={[0, yAxisMax]}
                allowDecimals={false}
              />
            )}
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(5)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="points" fill="var(--color-points)" />
          </BarChart>
        </ChartContainer>
      </div>
      <div className="flex justify-center gap-2">
        <ChartLegendBadge
          label={t("clientStatisticsView.other.rewardPoints", "Reward points")}
          dotColor="var(--primary-700)"
        />
      </div>
    </div>
  );
}
