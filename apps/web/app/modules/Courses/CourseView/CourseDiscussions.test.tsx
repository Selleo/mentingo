import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseDiscussions } from "./CourseDiscussions";

const mockUseDiscussions = vi.fn();

vi.mock("~/api/queries/useDiscussions", () => ({
  useDiscussions: (courseId: string) => mockUseDiscussions(courseId),
}));

describe("CourseDiscussions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when API returns no threads", () => {
    mockUseDiscussions.mockReturnValue({ data: [], isLoading: false });

    renderWith().render(<CourseDiscussions courseId="course-1" />);

    expect(screen.getByTestId("discussions-empty")).toHaveTextContent(/no discussions yet/i);
  });
});
