import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Skeleton } from "~/components/ui/skeleton";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { ChartLegendBadge } from "~/modules/Statistics/Client/components";

import type { GetContentCreatorStatsResponse } from "~/api/generated-api";

type Data = GetContentCreatorStatsResponse["data"]["fiveMostPopularCourses"];

type MostPopularCoursesChartProps = { data: Data | undefined; isLoading: boolean | undefined };

type ChartData = {
  courseName: string;
  studentCount: number;
  [key: string]: string | number;
}[];

type ChartConfig = {
  [key: string]: {
    label: string;
  };
};

const chartColors = [
  "var(--primary-700)",
  "var(--cabaret-600)",
  "var(--zest-500)",
  "var(--amethyst-600)",
  "var(--mountain-meadow-500)",
];

export const FiveMostPopularCoursesChart = ({ data, isLoading }: MostPopularCoursesChartProps) => {
  const isTablet = useMediaQuery({ minWidth: 768 });
  const { t } = useTranslation();

  function generateChartData(input: Data | undefined): {
    chartData: ChartData | undefined;
    chartConfig: ChartConfig | undefined;
  } {
    const chartData = input?.map(({ courseName, studentCount }, index) => ({
      courseName,
      studentCount,
      fill: chartColors[index % chartColors.length],
    }));

    const chartConfig = input?.reduce((config, { courseName }, index) => {
      const key = `desktop${index === 0 ? "" : index}`;
      config[key] = { label: courseName };
      return config;
    }, {} as ChartConfig);

    return { chartData, chartConfig };
  }

  const { chartData, chartConfig } = generateChartData(data);

  const isEmptyChart =
    chartData?.every(({ studentCount }) => !studentCount) || !data || !chartConfig;

  if (isLoading) {
    return (
      <div className="flex w-full flex-col rounded-lg bg-white p-6 drop-shadow-card md:col-span-2 xl:col-span-2">
        <div className="flex flex-col items-center gap-y-[5px] py-[5px] pb-6 md:pb-4">
          <Skeleton className="h-6 w-[240px] rounded-lg bg-neutral-100" />
          <Skeleton className="h-4 w-40 rounded-lg bg-neutral-100" />
        </div>
        <div className="md:flex md:size-full md:gap-x-3">
          <div className="sr-only md:not-sr-only md:flex md:h-full md:flex-col md:gap-y-10 md:py-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center py-1">
                <Skeleton className="h-4 w-40 rounded-lg bg-neutral-100" />
              </div>
            ))}
          </div>
          <div className="relative flex w-full flex-col gap-y-3 py-2 md:gap-y-10">
            <Skeleton className="h-6 w-[93%] rounded-lg bg-neutral-100" />
            <Skeleton className="h-6 w-[68%] rounded-lg bg-neutral-100" />
            <Skeleton className="h-6 w-[56%] rounded-lg bg-neutral-100" />
            <Skeleton className="h-6 w-[40%] rounded-lg bg-neutral-100" />
            <Skeleton className="h-6 w-[34%] rounded-lg bg-neutral-100" />
            <div className="absolute left-0 top-0 flex h-full w-full justify-between">
              {Array.from({ length: 21 }).map((_, index) => (
                <Skeleton key={index} className="h-full w-[1px]" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between pt-2 md:pl-[172px]">
          <Skeleton className="size-2 rounded-lg bg-neutral-100" />
          <Skeleton className="h-2 w-6 rounded-lg bg-neutral-100" />
          <Skeleton className="h-2 w-6 rounded-lg bg-neutral-100" />
          <Skeleton className="h-2 w-6 rounded-lg bg-neutral-100" />
          <Skeleton className="h-2 w-7 rounded-lg bg-neutral-100" />
        </div>
        <div className="flex flex-col gap-y-2 pt-6 md:sr-only">
          <Skeleton className="h-[27px] rounded-lg bg-neutral-100" />
          <Skeleton className="h-[27px] rounded-lg bg-neutral-100" />
          <Skeleton className="h-[27px] rounded-lg bg-neutral-100" />
          <Skeleton className="h-[27px] rounded-lg bg-neutral-100" />
          <Skeleton className="h-[27px] rounded-lg bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (isEmptyChart) {
    return (
      <div className="flex w-full flex-col gap-y-6 rounded-lg bg-white p-6 drop-shadow-card md:col-span-2 md:gap-y-4 xl:col-span-2">
        <hgroup>
          <h2 className="body-lg-md text-center text-neutral-950">
            {t("mostPopularCoursesView.header")}
          </h2>
          <p className="body-sm-md text-center text-neutral-800">
            {t("mostPopularCoursesView.subHeader")}
          </p>
        </hgroup>
        <div className="md:flex md:size-full md:gap-x-3">
          <div className="relative flex h-full min-h-[200px] w-full items-center justify-between gap-y-3 py-2 md:min-h-[316px] md:gap-y-10">
            {Array.from({ length: 21 }).map((_, index) => (
              <div key={index} className="h-full w-[1px] bg-neutral-100" />
            ))}
            <div className="h5 md:h3 absolute left-0 top-0 z-0 flex size-full items-center justify-center text-primary-950">
              {t("mostPopularCoursesView.other.noData")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-y-6 rounded-lg bg-white p-6 drop-shadow-card md:col-span-2 md:gap-y-4 xl:col-span-2 2xl:gap-y-6">
      <hgroup>
        <h2 className="body-lg-md text-center text-neutral-950">
          {t("mostPopularCoursesView.header")}
        </h2>
        <p className="body-sm-md text-center text-neutral-800">
          {t("mostPopularCoursesView.subHeader")}
        </p>
      </hgroup>
      <ChartContainer config={chartConfig} className="h-[316px]">
        <BarChart
          accessibilityLayer
          data={chartData}
          layout="vertical"
          margin={{
            left: -28,
          }}
          barCategoryGap="16.5"
        >
          <XAxis
            type="number"
            dataKey="studentCount"
            axisLine={false}
            tickFormatter={(value, index) => (index === 0 || index % 5 === 0 ? value : "")}
            tickCount={21}
            tickSize={0}
          />
          <YAxis
            dataKey="courseName"
            type="category"
            tickLine={false}
            tickMargin={10}
            width={isTablet ? 168 : 0}
            axisLine={false}
            tickFormatter={(value) => value}
          />
          <CartesianGrid stroke="#eee" strokeDasharray="1 0" horizontal={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="studentCount">
            <LabelList
              dataKey="studentCount"
              position="insideLeft"
              offset={isTablet ? 8 : 36}
              className="fill-[--color-white]"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="flex flex-col gap-2 md:sr-only">
        {data?.map(({ courseName }, index) => (
          <ChartLegendBadge key={courseName} label={courseName} dotColor={chartColors[index]} />
        ))}
      </div>
    </div>
  );
};
