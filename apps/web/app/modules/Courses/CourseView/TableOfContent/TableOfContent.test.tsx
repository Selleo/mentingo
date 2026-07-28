import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { TableOfContent } from "./TableOfContent";

const { courseAccessState, currentUserState } = vi.hoisted(() => ({
  courseAccessState: {
    hasMissingCurriculumTranslations: false,
    isAdminExperience: true,
    isCourseStudentModeActive: false,
  },
  currentUserState: { permissions: ["course.statistics"] },
}));

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1", permissions: currentUserState.permissions } }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: { courseDiscussionsEnabled: false } }),
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: {
      id: "course-1",
      enrolled: false,
      hasMissingCurriculumTranslations: courseAccessState.hasMissingCurriculumTranslations,
    },
    isAdminExperience: courseAccessState.isAdminExperience,
    isCourseStudentModeActive: courseAccessState.isCourseStudentModeActive,
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
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    courseAccessState.hasMissingCurriculumTranslations = false;
    courseAccessState.isAdminExperience = true;
    courseAccessState.isCourseStudentModeActive = false;
    currentUserState.permissions = ["course.statistics"];
  });

  it("shows the table of contents heading on mobile when there is no tab bar", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    courseAccessState.isAdminExperience = false;
    currentUserState.permissions = [];

    renderWith().render(<TableOfContent />);

    expect(screen.getByRole("heading", { name: "Table of contents" })).toBeInTheDocument();
  });

  it("returns to the table of contents when learning mode hides statistics", async () => {
    const user = userEvent.setup();
    const view = renderWith().render(<TableOfContent />);

    await user.click(screen.getByRole("button", { name: "Statistics" }));

    expect(screen.getByText("Course statistics content")).toBeInTheDocument();

    courseAccessState.isAdminExperience = false;
    courseAccessState.isCourseStudentModeActive = true;
    view.rerender(<TableOfContent />);

    expect(await screen.findByText("Course chapters content")).toBeInTheDocument();
    expect(screen.queryByText("Course statistics content")).not.toBeInTheDocument();
  });

  it("shows statistics to a user with the statistics permission", async () => {
    courseAccessState.isAdminExperience = false;
    const user = userEvent.setup();

    renderWith().render(<TableOfContent />);
    await user.click(screen.getByRole("button", { name: "Statistics" }));

    expect(screen.getByText("Course statistics content")).toBeInTheDocument();
  });

  it("hides statistics from an administrator without the statistics permission", () => {
    currentUserState.permissions = [];

    renderWith().render(<TableOfContent />);

    expect(screen.queryByRole("button", { name: "Statistics" })).not.toBeInTheDocument();
  });
});
