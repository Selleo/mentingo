import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { WidgetAdminDeadlineRisks } from "./admin-deadline-risks";

const { detailsQueryState } = vi.hoisted(() => ({
  detailsQueryState: {
    type: "overdue",
    enabled: false,
  },
}));

vi.mock("~/api/queries/useDashboardDeadlineRiskSummary", () => ({
  useDashboardDeadlineRiskSummary: () => ({
    data: {
      overdueCount: 2,
      dueSoonCount: 3,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("~/api/queries/useDashboardDeadlineRisks", () => ({
  useDashboardDeadlineRisks: (params: { type: string }, enabled: boolean) => {
    detailsQueryState.type = params.type;
    detailsQueryState.enabled = enabled;

    return {
      data: {
        data: [
          {
            id: "course-1",
            title: "Security basics",
            students: [
              {
                id: "student-1",
                name: "Alex Example",
                dueDate: "2026-07-20T00:00:00.000Z",
              },
            ],
          },
        ],
        pagination: {
          totalItems: 1,
          page: 1,
          perPage: 20,
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
}));

describe("WidgetAdminDeadlineRisks", () => {
  afterEach(() => {
    detailsQueryState.type = "overdue";
    detailsQueryState.enabled = false;
  });

  it("keeps the due-soon risk type after closing its details", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <MemoryRouter>
        <WidgetAdminDeadlineRisks />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /3 Due soon/ }));

    expect(screen.getByRole("heading", { name: "Required courses due soon" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to course" })).toHaveAttribute(
      "href",
      "/course/course-1?tab=Statistics",
    );
    expect(detailsQueryState).toEqual({
      type: "dueSoon",
      enabled: true,
    });

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(detailsQueryState).toEqual({
        type: "dueSoon",
        enabled: false,
      });
    });
  });
});
