"use client";

import { Info } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Label, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { getCourseStatusDistributionOptions } from "./utils/getCourseStatusDistributionOptions";

import type { ProgressStatus } from "../lessonTypes";
import type { GetCourseStatisticsResponse } from "~/api/generated-api";

interface CourseStatusDistributionProps {
  courseStatistics: GetCourseStatisticsResponse["data"];
  className?: string;
}

export function CourseStatusDistributionChart({
  courseStatistics,
  className,
}: CourseStatusDistributionProps) {
  const { t } = useTranslation();

  const statusCounts = courseStatistics.courseStatusDistribution.reduce(
    (acc, item) => {
      acc[item.status] = item.count;
      return acc;
    },
    {} as Record<ProgressStatus, number>,
  );

  const { chartConfig, chartData, isEmpty } = useMemo(() => {
    return getCourseStatusDistributionOptions(t, statusCounts);
  }, [t, statusCounts]);

  return (
    <div
      className={cn(
        "flex flex-col p-6 outline outline-1 outline-neutral-200 h-full justify-between items-center",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <p className="body-base-md">
          {t("adminCourseView.statistics.overview.courseStatusDistribution")}
        </p>
        <Tooltip>
          <TooltipTrigger>
            <Info className="size-4 cursor-pointer" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="body-sm-md">
              {t("adminCourseView.statistics.overview.courseStatusDistributionTooltip")}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square min-h-[250px] max-h-[250px]"
        >
          <PieChart>
            {!isEmpty && (
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            )}
            <Pie data={chartData} dataKey="count" nameKey="status" innerRadius={85}>
              {isEmpty && (
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox && viewBox.cy !== undefined) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="grid place-items-center"
                        >
                          <tspan x={viewBox.cx} y={viewBox.cy - 12} className="h6 fill-primary-950">
                            {t("adminCourseView.statistics.empty.noUsers")}
                          </tspan>
                          <tspan x={viewBox.cx} y={viewBox.cy + 12} className="h6 fill-primary-950">
                            {t("adminCourseView.statistics.empty.enrolled")}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              )}
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>
      {!isEmpty && (
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          {chartData.map((entry) => (
            <div key={entry.status} className="flex items-center">
              <div className="size-2 mr-2 rounded-full" style={{ backgroundColor: entry.fill }} />
              <span className="details-md">{entry.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
