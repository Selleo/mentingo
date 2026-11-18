import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ReportCourseActivity } from "./ReportCourseActivity";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));
vi.mock("recharts", () => ({
  BarChart: ({ data }: { data: unknown }) => <pre data-testid="bars">{JSON.stringify(data)}</pre>,
  Bar: () => null,
  CartesianGrid: () => null,
  LabelList: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

it("shows separate popularity and all-time inactivity metrics, keeping never-active courses distinct from zero days", async () => {
  const onPeriodChange = vi.fn();
  render(
    <ReportCourseActivity
      period={{ from: "2026-01-01", to: "2026-01-31" }}
      onPeriodChange={onPeriodChange}
      data={{
        popular: [
          {
            id: "popular",
            label: "Popular",
            activeLearners: 12,
            lastActivityAt: "2026-02-01T00:00:00Z",
            inactiveDays: 0,
          },
        ],
        inactive: [
          {
            id: "never",
            label: "Never",
            activeLearners: 0,
            lastActivityAt: null,
            inactiveDays: null,
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("reports.activity.popular")).toBeInTheDocument();
  expect(screen.getByText("reports.activity.inactive")).toBeInTheDocument();
  expect(screen.getByText("reports.activity.never")).toBeInTheDocument();
  expect(screen.getAllByTestId("bars")[0]).toHaveTextContent('"value":12');
  for (const label of ["reports.activity.from", "reports.activity.to"]) {
    expect(screen.getByLabelText(label)).toHaveClass(
      "[&::-webkit-calendar-picker-indicator]:!static",
      "[&::-webkit-datetime-edit-fields-wrapper]:!left-0",
      "[&::-webkit-datetime-edit]:!left-0",
    );
    expect(screen.getByLabelText(label).parentElement).toHaveClass("w-44", "max-w-full");
  }
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("reports.activity.from"));
  await user.type(screen.getByLabelText("reports.activity.from"), "2026-01-10");
  await user.click(screen.getByRole("button", { name: "reports.activity.apply" }));
  expect(onPeriodChange).toHaveBeenCalledWith({ from: "2026-01-10", to: "2026-01-31" });
});
