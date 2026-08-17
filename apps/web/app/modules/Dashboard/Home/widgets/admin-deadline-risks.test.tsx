import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { WidgetAdminDeadlineRisks } from "./admin-deadline-risks";

vi.mock("~/api/queries/useDashboardDeadlineRiskCourses", () => ({
  useDashboardDeadlineRiskCourses: () => ({
    data: {
      pages: [
        {
          data: [
            {
              id: "course-1",
              title: "Security basics",
              thumbnailUrl: null,
              overdueCount: 1,
              dueSoonCount: 0,
              nearestDueDate: "2026-07-20T00:00:00.000Z",
              urgency: "overdue",
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    hasNextPage: false,
  }),
}));

vi.mock("~/api/queries/useDashboardDeadlineRiskGroups", () => ({
  useDashboardDeadlineRiskGroups: () => ({
    data: {
      pages: [
        {
          data: [
            {
              id: "group-1",
              name: "Sales",
              dueDate: "2026-07-20T00:00:00.000Z",
              urgency: "overdue",
              studentCount: 1,
              students: [{ id: "student-1", name: "Alex Example" }],
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    hasNextPage: false,
  }),
}));

describe("WidgetAdminDeadlineRisks", () => {
  it("shows courses directly and expands learners grouped by deadline assignment", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <MemoryRouter>
        <WidgetAdminDeadlineRisks />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Security basics, Overdue/ }));

    expect(screen.getByRole("heading", { name: "Security basics" })).toBeVisible();
    await user.click(screen.getByText("Sales"));
    expect(screen.getByText("Alex Example")).toBeVisible();
  });
});
