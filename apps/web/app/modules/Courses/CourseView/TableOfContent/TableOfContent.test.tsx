import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { TableOfContent } from "./TableOfContent";

const { courseAccessState } = vi.hoisted(() => ({
  courseAccessState: {
    isAdminExperience: true,
  },
}));

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1", permissions: [] } }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: { courseDiscussionsEnabled: false } }),
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: { id: "course-1", enrolled: false },
    isAdminExperience: courseAccessState.isAdminExperience,
  }),
}));

vi.mock("../CourseAdminStatistics/CourseAdminStatistics", () => ({
  CourseAdminStatistics: () => <div>Course statistics content</div>,
}));

vi.mock("./ChapterList", () => ({
  default: () => <div>Course chapters content</div>,
}));

describe("TableOfContent", () => {
  beforeEach(() => {
    courseAccessState.isAdminExperience = true;
  });

  it("returns to the table of contents when learning mode hides statistics", async () => {
    const user = userEvent.setup();
    const view = renderWith().render(<TableOfContent />);

    await user.click(screen.getByRole("button", { name: "Statistics" }));

    expect(screen.getByText("Course statistics content")).toBeInTheDocument();

    courseAccessState.isAdminExperience = false;
    view.rerender(<TableOfContent />);

    expect(await screen.findByText("Course chapters content")).toBeInTheDocument();
    expect(screen.queryByText("Course statistics content")).not.toBeInTheDocument();
  });
});
