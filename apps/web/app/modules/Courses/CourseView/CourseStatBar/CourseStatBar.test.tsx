import { PERMISSIONS } from "@repo/shared";
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
  useGroupsByCourseQuery: vi.fn(),
  permissions: [] as string[],
  isAuthenticated: true,
  courseAccessState: {
    canEditCourse: true,
    dueDate: null as string | null,
    isAdminExperience: true,
  },
  toggleLearningMode: vi.fn(),
  transferCourseOwnership: vi.fn(),
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

vi.mock("~/api/mutations/admin/useTransferCourseOwnership", () => ({
  useTransferCourseOwnership: () => ({
    mutateAsync: mocks.transferCourseOwnership,
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
  useGroupsByCourseQuery: (courseId: string, language: string) => {
    mocks.useGroupsByCourseQuery(courseId, language);

    return {
      data: courseId ? mocks.enrolledGroups : undefined,
    };
  },
}));

vi.mock("~/api/queries/admin/useCourseOwnershipCandidates", () => ({
  useCourseOwnershipCandidates: () => ({
    data: undefined,
  }),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({
    data: mocks.isAuthenticated ? { permissions: mocks.permissions } : undefined,
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
      dueDate: mocks.courseAccessState.dueDate,
      hasCertificate: false,
      showAuthorSection: true,
      title: "Course title",
    },
    canEditCourse: mocks.courseAccessState.canEditCourse,
    isAdminExperience: mocks.courseAccessState.isAdminExperience,
  }),
}));

vi.mock("./ProgressStatCard", () => ({
  default: () => null,
}));

vi.mock("../CourseCertificate", () => ({
  default: () => null,
}));

vi.mock("./DeadlineStatCard", () => ({
  default: ({ isAdminExperience, onOpen }: { isAdminExperience: boolean; onOpen: () => void }) =>
    isAdminExperience ? (
      <button type="button" onClick={onOpen}>
        Open deadline settings
      </button>
    ) : (
      <div>Deadline information</div>
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
    mocks.permissions = [PERMISSIONS.COURSE_ENROLLMENT, PERMISSIONS.GROUP_READ];
    mocks.isAuthenticated = true;
    mocks.courseAccessState.canEditCourse = true;
    mocks.courseAccessState.dueDate = null;
    mocks.courseAccessState.isAdminExperience = true;
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

  it("hides deadline management from a content creator", () => {
    mocks.permissions = [PERMISSIONS.COURSE_UPDATE_OWN];

    renderWith().render(<CourseStatBar language="en" />);

    expect(
      screen.queryByRole("button", { name: "Open deadline settings" }),
    ).not.toBeInTheDocument();
    expect(mocks.useGroupsByCourseQuery).toHaveBeenCalledWith("", "en");
  });

  it("hides deadline management without group read access", () => {
    mocks.permissions = [PERMISSIONS.COURSE_ENROLLMENT];

    renderWith().render(<CourseStatBar language="en" />);

    expect(
      screen.queryByRole("button", { name: "Open deadline settings" }),
    ).not.toBeInTheDocument();
    expect(mocks.useGroupsByCourseQuery).toHaveBeenCalledWith("", "en");
  });

  it("shows an assigned deadline as read-only to an unauthenticated visitor", () => {
    mocks.isAuthenticated = false;
    mocks.permissions = [];
    mocks.courseAccessState.canEditCourse = false;
    mocks.courseAccessState.dueDate = "2026-08-01T00:00:00Z";
    mocks.courseAccessState.isAdminExperience = false;

    renderWith().render(<CourseStatBar language="en" />);

    expect(screen.getByText("Deadline information")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open deadline settings" }),
    ).not.toBeInTheDocument();
    expect(mocks.useGroupsByCourseQuery).toHaveBeenCalledWith("", "en");
  });
});
