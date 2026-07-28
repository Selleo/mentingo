import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseStatBar } from "./CourseStatBar";

const mocks = vi.hoisted(() => ({
  enrolledGroups: [
    {
      id: "mandatory-group",
      name: "Mandatory group",
      isMandatory: true,
      dueDate: "2026-08-01T00:00:00Z",
    },
    {
      id: "optional-group",
      name: "Optional group",
      isMandatory: false,
      dueDate: "2026-08-02T00:00:00Z",
    },
  ],
  useContentCreatorCourses: vi.fn(() => ({
    data: [],
  })),
  toggleLearningMode: vi.fn(),
  updateCourse: vi.fn(),
  updateGroupDeadlines: vi.fn(),
}));

vi.mock("~/api/mutations", () => ({
  useToggleCourseStudentMode: () => ({
    mutate: mocks.toggleLearningMode,
  }),
}));

vi.mock("~/api/mutations/admin/useBulkGroupCourseEnroll", () => ({
  useBulkGroupCourseEnroll: () => ({
    mutate: mocks.updateGroupDeadlines,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useUpdateCourse", () => ({
  useUpdateCourse: () => ({
    mutateAsync: mocks.updateCourse,
    isPending: false,
  }),
}));

vi.mock("~/api/queries/admin/useGroupsByCourse", () => ({
  useGroupsByCourseQuery: () => ({
    data: mocks.enrolledGroups,
  }),
}));

vi.mock("~/api/queries/useContentCreatorCourses", () => ({
  useContentCreatorCourses: mocks.useContentCreatorCourses,
}));

vi.mock("~/api/queries/useUserDetails", () => ({
  useUserDetails: () => ({
    data: undefined,
  }),
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: {
      id: "course-1",
      authorId: "author-1",
      chapters: [],
      completedChapterCount: 0,
      courseChapterCount: 0,
      dueDate: null,
      hasCertificate: false,
      showAuthorSection: true,
      title: "Course title",
    },
    canEditCourse: true,
    isAdminExperience: true,
  }),
}));

vi.mock("./ProgressStatCard", () => ({
  default: () => null,
}));

vi.mock("./DeadlineStatCard", () => ({
  default: ({ onOpen }: { onOpen: () => void }) => (
    <button type="button" onClick={onOpen}>
      Open deadline settings
    </button>
  ),
}));

vi.mock("./CertificateStatCard", () => ({
  default: () => null,
}));

vi.mock("./AuthorStatCard", () => ({
  default: () => null,
}));

describe("CourseStatBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads all other published courses by the author", () => {
    renderWith().render(<CourseStatBar language="en" />);

    expect(mocks.useContentCreatorCourses).toHaveBeenCalledWith(
      "author-1",
      {
        scope: "all",
        excludeCourseId: "course-1",
        language: "en",
      },
      true,
    );
  });

  it("preserves each group's assignment status when disabling deadlines", async () => {
    const user = userEvent.setup();

    renderWith().render(<CourseStatBar language="en" />);

    await user.click(screen.getByRole("button", { name: "Open deadline settings" }));
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mocks.updateGroupDeadlines).toHaveBeenCalledWith(
      {
        groups: [
          {
            id: "mandatory-group",
            isMandatory: true,
            dueDate: null,
          },
          {
            id: "optional-group",
            isMandatory: false,
            dueDate: null,
          },
        ],
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
  });
});
