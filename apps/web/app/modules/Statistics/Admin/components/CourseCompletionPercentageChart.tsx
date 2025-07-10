import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Skeleton } from "~/components/ui/skeleton";
import { ChartLegendBadge } from "~/modules/Statistics/Client/components/ChartLegendBadge";

import type { ChartConfig } from "~/components/ui/chart";

type CourseCompletionPercentageChartProps = {
  label: string;
  title: string;
  chartConfig: ChartConfig;
  chartData: { state: string; percentage: number | undefined; fill: string }[];
  isLoading?: boolean;
};

const emptyChartData = {
  state: "No data",
  percentage: 1,
  fill: "var(--neutral-200)",
};

export const CourseCompletionPercentageChart = ({
  label,
  title,
  chartConfig,
  chartData,
  isLoading = false,
}: CourseCompletionPercentageChartProps) => {
  const { t } = useTranslation();
  const chartLegend = useMemo(() => {
    return Object.values(chartConfig).map((config) => {
      return (
        <ChartLegendBadge
          key={config.label as string}
          label={`${config.label}`}
          dotColor={config.color}
        />
      );
    });
  }, [chartConfig]);

  const isEmptyChart = chartData.every(({ percentage }) => !percentage);

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col items-center rounded-lg bg-white p-6 drop-shadow-card md:col-span-1 md:gap-y-6 xl:col-span-1 2xl:p-8">
        <Skeleton className="h-[30px] w-full max-w-[240px] rounded-lg" />
        <div className="grid h-[250px] place-items-center">
          <Skeleton className="aspect-square h-full max-h-[200px] w-full rounded-full" />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <Skeleton className="h-[27px] w-[126px] rounded-lg" />
          <Skeleton className="h-[27px] w-[126px] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col rounded-lg bg-white p-6 drop-shadow-card md:col-span-1 md:gap-y-6 xl:col-span-1 2xl:p-8">
      <h2 className="body-lg-md text-center text-neutral-950">{title}</h2>
      <div className="grid place-items-center">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square size-full max-h-[250px]"
        >
          <PieChart>
            {!isEmptyChart && (
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            )}
            <Pie
              data={isEmptyChart ? [emptyChartData, ...chartData] : chartData}
              dataKey="percentage"
              nameKey="state"
              innerRadius={84}
              strokeWidth={5}
              startAngle={90}
              endAngle={-270}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan x={viewBox.cx} y={viewBox.cy} className="h3 fill-primary-950">
                          {isEmptyChart ? t("adminStatisticsView.other.noData") : `${label}%`}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>
      <div className="flex flex-col items-center justify-center gap-2">{chartLegend}</div>
    </div>
  );
};
