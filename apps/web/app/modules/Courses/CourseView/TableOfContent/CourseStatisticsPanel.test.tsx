import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseStatisticsPanel from "./CourseStatisticsPanel";

import type { ReactNode } from "react";
import type { GetCourseStatisticsResponse } from "~/api/generated-api";

vi.mock("~/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Bar: Passthrough,
    BarChart: Passthrough,
    CartesianGrid: Passthrough,
    Cell: () => null,
    Label: () => null,
    LabelList: () => null,
    Legend: () => null,
    Pie: Passthrough,
    PieChart: Passthrough,
    ResponsiveContainer: Passthrough,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const courseStatistics = {
  enrolledCount: 12,
  averageSeconds: 4_500,
  averageCompletionPercentage: 64,
  completionPercentage: 25,
  courseStatusDistribution: [
    {
      status: "completed",
      count: 3,
    },
    {
      status: "in_progress",
      count: 4,
    },
    {
      status: "not_started",
      count: 5,
    },
  ],
} as GetCourseStatisticsResponse["data"];

describe("CourseStatisticsPanel", () => {
  it("renders overview statistics and mapped course status distribution labels", () => {
    renderWith().render(
      <CourseStatisticsPanel courseStatistics={courseStatistics} isLoading={false} />,
    );

    expect(screen.getByText("Course statistics")).toBeInTheDocument();
    expect(screen.getByText("Total students")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Avg. time spent")).toBeInTheDocument();
    expect(screen.getByText("1 h 15 min")).toBeInTheDocument();
    expect(screen.getByText("Course status distribution")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Not Started")).toBeInTheDocument();
    expect(screen.getAllByText("Completion rate")).toHaveLength(2);
  });

  it("renders empty chart states when no students are enrolled", () => {
    renderWith().render(
      <CourseStatisticsPanel
        courseStatistics={{
          ...courseStatistics,
          enrolledCount: 0,
          courseStatusDistribution: [],
        }}
        isLoading={false}
      />,
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
