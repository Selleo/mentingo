import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { WidgetStudentCourseCompletion } from "./student-course-completion";

import type { ReactElement } from "react";

vi.mock("recharts", async (importOriginal) => {
  const recharts = await importOriginal<typeof import("recharts")>();

  // Segments render at once instead of after the entry animation.
  recharts.Pie.defaultProps = { ...recharts.Pie.defaultProps, isAnimationActive: false };

  // jsdom has no layout, so give the chart a fixed size instead of measuring its container.
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <recharts.ResponsiveContainer width={200} height={200}>
        {children}
      </recharts.ResponsiveContainer>
    ),
  };
});

vi.mock("~/api/queries/useStudentDashboardSummary", () => ({
  useStudentDashboardSummary: () => ({
    data: {
      completion: { completed: 3, inProgress: 1, notStarted: 1, total: 5, percentage: 60 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("WidgetStudentCourseCompletion", () => {
  it("gives the chart and each of its segments a text alternative with the progress", () => {
    renderWith().render(<WidgetStudentCourseCompletion />);

    expect(screen.getByRole("img", { name: "3 of 5 completed" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Completed: 3" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "In progress: 1" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Not started: 1" })).toBeInTheDocument();
  });
});
