import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import LessonPage from "./Lesson.page";

const mockUseCourse = vi.fn();
const mockUseLesson = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseGlobalSettings = vi.fn();

vi.mock("@remix-run/react", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ courseId: "course-1", lessonId: "lesson-1" }),
}));

vi.mock("~/api/queries", () => ({
  useCourse: (...args: unknown[]) => mockUseCourse(...args),
  useLesson: (...args: unknown[]) => mockUseLesson(...args),
  useCurrentUser: () => mockUseCurrentUser(),
  useGlobalSettings: () => mockUseGlobalSettings(),
}));

vi.mock("~/api/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock("~/hooks/useLearningTimeTracker", () => ({ useLearningTimeTracker: vi.fn() }));
vi.mock("~/components/VideoPlayer/VideoPlayerContext", () => ({
  useVideoPlayer: () => ({ state: { currentUrl: null, index: 0 }, clearVideo: vi.fn() }),
}));
vi.mock("~/modules/common/store/useVideoPreferencesStore", () => ({
  useVideoPreferencesStore: () => ({
    autoplay: false,
    setAutoplaySettings: vi.fn(),
    autoplaySettings: { currentAction: "no_autoplay" },
  }),
}));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  CourseAccessProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/modules/Courses/Lesson/LearningModeBanner", () => ({
  LearningModeBanner: () => <div>Banner</div>,
}));
vi.mock("~/modules/Courses/Lesson/LessonSidebar", () => ({
  LessonSidebar: () => <div>Sidebar</div>,
}));
vi.mock("~/modules/Courses/Lesson/LessonContent", () => ({
  LessonContent: () => <div>Lesson content</div>,
}));
vi.mock("~/modules/Courses/CourseView/CourseDiscussions", () => ({
  CourseDiscussions: ({ lessonId }: { lessonId?: string }) => (
    <div>Lesson discussions {lessonId}</div>
  ),
}));

describe("LessonPage discussions section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLesson.mockReturnValue({
      data: { id: "lesson-1", type: "content", hasAutoplayTrigger: false },
      isFetching: false,
      isError: false,
    });
    mockUseCourse.mockReturnValue({
      data: {
        id: "course-1",
        title: "Course",
        authorId: "author-1",
        enrolled: true,
        chapters: [
          { id: "chapter-1", displayOrder: 1, title: "Chapter 1", lessons: [{ id: "lesson-1" }] },
        ],
      },
    });
    mockUseCurrentUser.mockReturnValue({ data: { id: "student-1", roleSlugs: ["student"] } });
    mockUseGlobalSettings.mockReturnValue({ data: { cohortLearningEnabled: true } });
  });

  it("renders lesson discussions for eligible user", () => {
    renderWith().render(<LessonPage />);

    expect(screen.getByText(/lesson discussions lesson-1/i)).toBeInTheDocument();
  });

  it("hides lesson discussions when switch is off", () => {
    mockUseGlobalSettings.mockReturnValue({ data: { cohortLearningEnabled: false } });

    renderWith().render(<LessonPage />);

    expect(screen.queryByText(/lesson discussions/i)).not.toBeInTheDocument();
  });

  it("hides lesson discussions for unregistered user", () => {
    mockUseCurrentUser.mockReturnValue({ data: null });
    mockUseCourse.mockReturnValue({
      data: {
        id: "course-1",
        title: "Course",
        authorId: "author-1",
        enrolled: false,
        chapters: [
          { id: "chapter-1", displayOrder: 1, title: "Chapter 1", lessons: [{ id: "lesson-1" }] },
        ],
      },
    });

    renderWith().render(<LessonPage />);

    expect(screen.queryByText(/lesson discussions/i)).not.toBeInTheDocument();
  });
});
