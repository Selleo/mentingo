import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseOverview from "./CourseOverview";

import type { GetCourseResponse } from "~/api/generated-api";

vi.mock("@remix-run/react", () => ({ useNavigate: () => vi.fn() }));
vi.mock("~/api/mutations", () => ({
  useToggleCourseStudentMode: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("~/api/queries", () => ({ useCurrentUser: () => ({ data: null }) }));
vi.mock("~/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAccess: false }) }));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({ isCourseStudentModeActive: false }),
}));
vi.mock("~/components/RichText/Viever", () => ({ default: () => <div>Description</div> }));

describe("CourseOverview completed by block", () => {
  const baseCourse = {
    id: "course-1",
    title: "Course title",
    description: "<p>Description</p>",
    category: "Category",
    availableLocales: ["en"],
    baseLanguage: "en",
    status: "published",
    completedStudentsCount: 0,
    completedStudentAvatars: [],
  } as unknown as GetCourseResponse["data"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides completed block when count is zero", () => {
    renderWith().render(<CourseOverview course={baseCourse} />);

    expect(screen.queryByText(/completed by/i)).not.toBeInTheDocument();
  });

  it("shows exact avatars for one student", () => {
    renderWith().render(
      <CourseOverview
        course={{
          ...baseCourse,
          completedStudentsCount: 1,
          completedStudentAvatars: [{ userId: "user-1", avatarUrl: "https://example.com/a.png" }],
        }}
      />,
    );

    expect(screen.getByText(/completed by/i)).toBeInTheDocument();
    expect(screen.getByTestId("completed-student-avatar")).toBeInTheDocument();
  });

  it("shows +1 when more completions than avatars", () => {
    renderWith().render(
      <CourseOverview
        course={{
          ...baseCourse,
          completedStudentsCount: 4,
          completedStudentAvatars: [
            { userId: "user-1", avatarUrl: "https://example.com/a.png" },
            { userId: "user-2", avatarUrl: "https://example.com/b.png" },
            { userId: "user-3", avatarUrl: "https://example.com/c.png" },
          ],
        }}
      />,
    );

    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
