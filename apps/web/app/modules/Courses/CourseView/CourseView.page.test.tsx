import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseViewPage from "./CourseView.page";

const mockUseCourse = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseGlobalSettings = vi.fn();
const mockUsePermissions = vi.fn();

vi.mock("@remix-run/react", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "course-1" }),
  useSearchParams: () => [new URLSearchParams()],
  redirect: vi.fn(),
}));

vi.mock("~/api/queries", () => ({
  useCourse: (...args: unknown[]) => mockUseCourse(...args),
  useCurrentUser: () => mockUseCurrentUser(),
  useGlobalSettings: () => mockUseGlobalSettings(),
}));

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/Guards/AccessGuard", () => ({
  ContentAccessGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  CourseAccessProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/modules/Courses/CourseView/CourseOverview", () => ({
  default: () => <div>Overview</div>,
}));

vi.mock("~/modules/Courses/CourseView/CourseViewSidebar/CourseViewSidebar", () => ({
  CourseViewSidebar: () => <div>Sidebar</div>,
}));

vi.mock("~/modules/Courses/CourseView/MoreCoursesByAuthor", () => ({
  MoreCoursesByAuthor: () => <div>More from author</div>,
}));

vi.mock("~/modules/Courses/CourseView/YouMayBeInterestedIn", () => ({
  YouMayBeInterestedIn: () => <div>Interested in</div>,
}));

vi.mock("~/modules/Courses/Lesson/LearningModeBanner", () => ({
  LearningModeBanner: () => <div>Banner</div>,
}));

vi.mock("./components/ChapterListOverview", () => ({
  ChapterListOverview: () => <div>Chapters</div>,
}));

vi.mock("./CourseAdminStatistics/CourseAdminStatistics", () => ({
  CourseAdminStatistics: () => <div>Statistics</div>,
}));

vi.mock("./CourseCertificate", () => ({
  default: () => <div>Certificate</div>,
}));

vi.mock("./CourseDiscussions", () => ({
  CourseDiscussions: () => <div>Discussions content</div>,
}));

describe("CourseViewPage discussion tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCourse.mockReturnValue({
      data: {
        id: "course-1",
        slug: "course-1",
        title: "Course title",
        authorId: "author-1",
        enrolled: false,
        chapters: [],
      },
    });
    mockUseCurrentUser.mockReturnValue({ data: null });
    mockUseGlobalSettings.mockReturnValue({ data: { cohortLearningEnabled: false } });
    mockUsePermissions.mockReturnValue({ hasAccess: false });
  });

  it("shows discussion tab for enrolled student when switch is on", () => {
    mockUseCourse.mockReturnValue({
      data: {
        id: "course-1",
        slug: "course-1",
        title: "Course title",
        authorId: "author-1",
        enrolled: true,
        chapters: [],
      },
    });
    mockUseCurrentUser.mockReturnValue({ data: { id: "student-1", roleSlugs: ["student"] } });
    mockUseGlobalSettings.mockReturnValue({ data: { cohortLearningEnabled: true } });

    renderWith().render(<CourseViewPage />);

    expect(screen.getByRole("tab", { name: /discussion/i })).toBeInTheDocument();
  });

  it("does not show discussion tab for unregistered user", () => {
    mockUseGlobalSettings.mockReturnValue({ data: { cohortLearningEnabled: true } });

    renderWith().render(<CourseViewPage />);

    expect(screen.queryByRole("tab", { name: /discussion/i })).not.toBeInTheDocument();
  });

  it("does not show discussion tab when switch is off", () => {
    mockUseCourse.mockReturnValue({
      data: {
        id: "course-1",
        slug: "course-1",
        title: "Course title",
        authorId: "author-1",
        enrolled: true,
        chapters: [],
      },
    });
    mockUseCurrentUser.mockReturnValue({ data: { id: "student-1", roleSlugs: ["student"] } });

    renderWith().render(<CourseViewPage />);

    expect(screen.queryByRole("tab", { name: /discussion/i })).not.toBeInTheDocument();
  });
});
