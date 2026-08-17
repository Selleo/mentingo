import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { WidgetAdminTrainingCompletion } from "./admin-training-completion";

vi.mock("recharts", () => ({
  Label: ({
    content,
  }: {
    content: (props: { viewBox: { cx: number; cy: number } }) => React.ReactNode;
  }) => content({ viewBox: { cx: 80, cy: 80 } }),
  Legend: () => null,
  Pie: ({
    children,
    innerRadius,
    outerRadius,
    strokeWidth,
  }: {
    children: React.ReactNode;
    innerRadius: number | string;
    outerRadius: number | string;
    strokeWidth: number;
  }) => (
    <svg
      data-testid="training-completion-donut"
      data-inner-radius={innerRadius}
      data-outer-radius={outerRadius}
      data-stroke-width={strokeWidth}
    >
      {children}
    </svg>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
}));

vi.mock("~/api/queries/useDashboardTrainingCompletion", () => ({
  useDashboardTrainingCompletion: () => ({
    data: {
      completed: 4,
      inProgress: 2,
      notStarted: 1,
      total: 7,
      percentage: 57,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("WidgetAdminTrainingCompletion", () => {
  it("renders the shadcn labeled donut chart", () => {
    renderWith().render(
      <MemoryRouter>
        <WidgetAdminTrainingCompletion />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("img", {
        name: "4 of 7 enrollments completed, 57 percent.",
      }),
    ).toBeVisible();
    expect(screen.getByText("57%")).toBeVisible();
    expect(screen.getByText("4/7")).toBeVisible();
    expect(screen.getByTestId("training-completion-donut")).toHaveAttribute(
      "data-inner-radius",
      "55%",
    );
    expect(screen.getByTestId("training-completion-donut")).toHaveAttribute(
      "data-outer-radius",
      "94%",
    );
    expect(screen.getByTestId("training-completion-donut")).toHaveAttribute(
      "data-stroke-width",
      "4",
    );
  });
});
