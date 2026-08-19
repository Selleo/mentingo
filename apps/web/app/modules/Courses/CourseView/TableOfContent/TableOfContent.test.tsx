import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { TableOfContent } from "./TableOfContent";

const {
  courseAccessState,
  currentUserState,
  missingTranslationsState,
  useMissingTranslationsMock,
} = vi.hoisted(() => {
  const missingTranslationsState = { hasMissingTranslations: false };

  return {
    courseAccessState: {
      isAdminExperience: true,
      isCourseStudentModeActive: false,
    },
    currentUserState: {
      id: "user-1",
      permissions: ["course.statistics", "course.update_own"],
    },
    missingTranslationsState,
    useMissingTranslationsMock: vi.fn(() => ({
      data: {
        data: {
          hasMissingTranslations: missingTranslationsState.hasMissingTranslations,
        },
      },
    })),
  };
});

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({
    data: { id: currentUserState.id, permissions: currentUserState.permissions },
  }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: { courseDiscussionsEnabled: false } }),
}));

vi.mock("~/api/queries/admin/useHasMissingTranslations", () => ({
  useMissingTranslations: useMissingTranslationsMock,
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: {
      authorId: "user-1",
      id: "course-1",
      enrolled: false,
    },
    isAdminExperience: courseAccessState.isAdminExperience,
    isCourseStudentModeActive: courseAccessState.isCourseStudentModeActive,
  }),
}));

vi.mock("../CourseAdminStatistics/CourseAdminStatistics", () => ({
  CourseAdminStatistics: () => <div>Course statistics content</div>,
}));

vi.mock("~/modules/Courses/CourseView/components/ChapterListOverview", () => ({
  ChapterListOverview: () => <div>Course chapters content</div>,
}));

describe("TableOfContent", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    courseAccessState.isAdminExperience = true;
    courseAccessState.isCourseStudentModeActive = false;
    currentUserState.id = "user-1";
    currentUserState.permissions = ["course.statistics", "course.update_own"];
    missingTranslationsState.hasMissingTranslations = false;
    useMissingTranslationsMock.mockClear();
  });

  it("shows the table of contents heading on mobile when there is no tab bar", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    });
    courseAccessState.isAdminExperience = false;
    currentUserState.permissions = [];

    renderWith().render(<TableOfContent language="en" />);

    expect(screen.getByRole("heading", { name: "Table of contents" })).toBeInTheDocument();
  });

  it("returns to the table of contents when learning mode hides statistics", async () => {
    const user = userEvent.setup();
    const view = renderWith().render(<TableOfContent language="en" />);

    await user.click(screen.getByRole("button", { name: "Statistics" }));

    expect(screen.getByText("Course statistics content")).toBeInTheDocument();

    courseAccessState.isAdminExperience = false;
    courseAccessState.isCourseStudentModeActive = true;
    view.rerender(<TableOfContent language="en" />);

    expect(await screen.findByText("Course chapters content")).toBeInTheDocument();
    expect(screen.queryByText("Course statistics content")).not.toBeInTheDocument();
  });

  it("shows statistics to the course author with the required permissions", async () => {
    courseAccessState.isAdminExperience = false;
    const user = userEvent.setup();

    renderWith().render(<TableOfContent language="en" />);
    await user.click(screen.getByRole("button", { name: "Statistics" }));

    expect(screen.getByText("Course statistics content")).toBeInTheDocument();
  });

  it("hides statistics from a non-author with the own-course permission", () => {
    currentUserState.id = "user-2";

    renderWith().render(<TableOfContent language="en" />);

    expect(screen.queryByRole("button", { name: "Statistics" })).not.toBeInTheDocument();
  });

  it("hides statistics from an administrator without the statistics permission", () => {
    currentUserState.permissions = [];

    renderWith().render(<TableOfContent language="en" />);

    expect(screen.queryByRole("button", { name: "Statistics" })).not.toBeInTheDocument();
  });

  it("uses the existing missing translations query for the selected course language", () => {
    missingTranslationsState.hasMissingTranslations = true;

    renderWith().render(<TableOfContent language="pl" />);

    expect(useMissingTranslationsMock).toHaveBeenCalledWith("course-1", "pl", true);
    expect(screen.getByRole("button", { name: "Missing translations" })).toBeInTheDocument();
  });
});
