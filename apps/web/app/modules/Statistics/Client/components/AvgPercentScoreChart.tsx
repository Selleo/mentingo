import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { ChartLegendBadge } from "~/modules/Statistics/Client/components/ChartLegendBadge";

import type { ChartConfig } from "~/components/ui/chart";

type AvgPercentScoreChartProps = {
  label: string;
  title: string;
  chartConfig: ChartConfig;
  chartData: { state: string; percentage: number | undefined; fill: string }[];
  isLoading?: boolean;
  className?: string;
};

const emptyChartData = {
  state: "No data",
  percentage: 1,
  fill: "var(--neutral-200)",
};

export const AvgPercentScoreChart = ({
  label,
  title,
  chartConfig,
  chartData,
  className,
  isLoading = false,
}: AvgPercentScoreChartProps) => {
  const { t } = useTranslation();
  const chartLegend = useMemo(() => {
    return Object.values(chartConfig).map((config) => {
      return (
        <ChartLegendBadge
          key={config.label as string}
          label={config.label}
          dotColor={config.color}
        />
      );
    });
  }, [chartConfig]);

  const isEmptyChart = chartData.every(({ percentage }) => !percentage);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex w-full flex-col gap-6 rounded-lg bg-white px-8 py-8 drop-shadow-card",
          className,
        )}
      >
        <Skeleton className="h-[30px] w-full max-w-[240px] rounded-lg" />
        <div className="grid h-[250px] place-items-center">
          <Skeleton className="aspect-square h-full max-h-[200px] w-full rounded-full" />
        </div>
        <div className="flex justify-center gap-2">
          <Skeleton className="h-[27px] w-[126px] rounded-lg" />
          <Skeleton className="h-[27px] w-[126px] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6 rounded-lg bg-white px-8 py-8 drop-shadow-card",
        className,
      )}
    >
      <h2 className="body-lg-md text-center text-neutral-950">{title}</h2>
      <div className="grid h-full place-items-center">
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
                          {isEmptyChart ? t("clientStatisticsView.other.noData") : `${label}%`}
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
      <div className="flex justify-center gap-2">{chartLegend}</div>
    </div>
  );
};
