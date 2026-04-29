import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CoursesAccessibilityPreferences from "./CoursesAccessibilityPreferences";

const mockToggleCoursesVisibility = vi.fn();
const mockToggleModernCourseList = vi.fn();
const mockToggleCohortLearning = vi.fn();

vi.mock("~/api/mutations/admin/useUnregisteredUserCoursesAccessibility", () => ({
  useUnregisteredUserCoursesAccessibility: () => ({
    mutate: mockToggleCoursesVisibility,
  }),
}));

vi.mock("~/api/mutations/admin/useToggleModernCourseList", () => ({
  useToggleModernCourseList: () => ({
    mutate: mockToggleModernCourseList,
  }),
}));

vi.mock("~/api/mutations/admin/useToggleCohortLearning", () => ({
  useToggleCohortLearning: () => ({
    mutate: mockToggleCohortLearning,
  }),
}));

describe("CoursesAccessibilityPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cohort learning switch", () => {
    renderWith({ withQuery: true }).render(
      <CoursesAccessibilityPreferences
        globalSettings={
          {
            unregisteredUserCoursesAccessibility: false,
            modernCourseListEnabled: true,
            cohortLearningEnabled: false,
          } as never
        }
      />,
    );

    expect(screen.getByLabelText(/cohort learning/i)).toBeInTheDocument();
  });

  it("calls toggleCohortLearning when switch clicked", async () => {
    const user = userEvent.setup();

    renderWith({ withQuery: true }).render(
      <CoursesAccessibilityPreferences
        globalSettings={
          {
            unregisteredUserCoursesAccessibility: false,
            modernCourseListEnabled: true,
            cohortLearningEnabled: false,
          } as never
        }
      />,
    );

    await user.click(screen.getByLabelText(/cohort learning/i));

    await waitFor(() => {
      expect(mockToggleCohortLearning).toHaveBeenCalledTimes(1);
    });
  });
});
