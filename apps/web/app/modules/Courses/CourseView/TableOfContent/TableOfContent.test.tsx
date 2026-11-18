import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useEffect } from "react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { TableOfContent } from "./TableOfContent";

const {
  courseAccessState,
  globalSettingsState,
  currentUserState,
  missingTranslationsState,
  useMissingTranslationsMock,
} = vi.hoisted(() => {
  const missingTranslationsState = { hasMissingTranslations: false };

  return {
    courseAccessState: {
      isAdminExperience: true,
      isCourseStudentModeActive: false,
      enrolled: false,
    },
    globalSettingsState: { courseDiscussionsEnabled: false },
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
  useGlobalSettings: () => ({ data: globalSettingsState }),
}));

vi.mock("~/api/queries/admin/useHasMissingTranslations", () => ({
  useMissingTranslations: useMissingTranslationsMock,
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: {
      authorId: "user-1",
      id: "course-1",
      enrolled: courseAccessState.enrolled,
    },
    isAdminExperience: courseAccessState.isAdminExperience,
    isCourseStudentModeActive: courseAccessState.isCourseStudentModeActive,
  }),
}));

vi.mock("../CourseAdminStatistics/CourseAdminStatistics", () => ({
  CourseAdminStatistics: () => <div>Course statistics content</div>,
}));

vi.mock("../CourseChat/CourseChatTab", () => ({
  CourseChatTab: function CourseChatTabStub({
    requestedThreadId,
    onRequestedThreadShown,
  }: {
    requestedThreadId?: string;
    onRequestedThreadShown?: () => void;
  }) {
    useEffect(() => {
      if (requestedThreadId) threadsShown.push(requestedThreadId);
    }, [requestedThreadId]);

    return (
      <div>
        Course discussion content
        <button type="button" onClick={onRequestedThreadShown}>
          finish showing the thread
        </button>
      </div>
    );
  },
}));

vi.mock("~/modules/Courses/CourseView/components/ChapterListOverview", () => ({
  ChapterListOverview: () => <div>Course chapters content</div>,
}));

const THREAD_LINK = "/course/course-1?tab=Discussion&thread=message-1";
const DISCUSSION_TAB_NAME = "Discussion";

const threadsShown: string[] = [];

function CurrentSearch() {
  return <output aria-label="current search">{useLocation().search}</output>;
}

const tableOfContent = ({
  url = "/course/course-1",
  language = "en",
}: { url?: string; language?: SupportedLanguages } = {}) => (
  <MemoryRouter initialEntries={[url]}>
    <TableOfContent language={language} />
    <Link to={THREAD_LINK}>open the notification</Link>
    <CurrentSearch />
  </MemoryRouter>
);

const allowDiscussion = () => {
  courseAccessState.enrolled = true;
  globalSettingsState.courseDiscussionsEnabled = true;
  currentUserState.permissions = [PERMISSIONS.COURSE_DISCUSSION_READ];
};

describe("TableOfContent", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    courseAccessState.isAdminExperience = true;
    courseAccessState.isCourseStudentModeActive = false;
    courseAccessState.enrolled = false;
    globalSettingsState.courseDiscussionsEnabled = false;
    threadsShown.length = 0;
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

    renderWith().render(tableOfContent());

    expect(screen.getByRole("heading", { name: "Table of contents" })).toBeInTheDocument();
  });

  it("returns to the table of contents when learning mode hides statistics", async () => {
    const user = userEvent.setup();
    const view = renderWith().render(tableOfContent());

    await user.click(screen.getByRole("button", { name: "Statistics" }));

    expect(screen.getByText("Course statistics content")).toBeInTheDocument();

    courseAccessState.isAdminExperience = false;
    courseAccessState.isCourseStudentModeActive = true;
    view.rerender(tableOfContent());

    expect(await screen.findByText("Course chapters content")).toBeInTheDocument();
    expect(screen.queryByText("Course statistics content")).not.toBeInTheDocument();
  });

  it("opens the discussion on the linked thread and takes the link out of the URL", async () => {
    allowDiscussion();

    renderWith().render(tableOfContent({ url: THREAD_LINK }));

    expect(screen.getByText("Course discussion content")).toBeInTheDocument();
    expect(screen.queryByText("Course chapters content")).not.toBeInTheDocument();
    expect(threadsShown).toEqual(["message-1"]);
    await waitFor(() => expect(screen.getByLabelText("current search")).toBeEmptyDOMElement());
  });

  it("does not jump back to the linked thread when the discussion is reopened", async () => {
    allowDiscussion();
    const user = userEvent.setup();
    renderWith().render(tableOfContent({ url: THREAD_LINK }));
    await user.click(screen.getByRole("button", { name: "finish showing the thread" }));

    await user.click(screen.getByRole("button", { name: "Table of contents" }));
    await user.click(screen.getByRole("button", { name: DISCUSSION_TAB_NAME }));

    expect(screen.getByText("Course discussion content")).toBeInTheDocument();
    expect(threadsShown).toEqual(["message-1"]);
  });

  it("follows the same thread link again after the user moved to another tab", async () => {
    allowDiscussion();
    const user = userEvent.setup();
    renderWith().render(tableOfContent({ url: THREAD_LINK }));
    await user.click(screen.getByRole("button", { name: "finish showing the thread" }));
    await user.click(screen.getByRole("button", { name: "Table of contents" }));
    expect(screen.getByText("Course chapters content")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "open the notification" }));

    expect(await screen.findByText("Course discussion content")).toBeInTheDocument();
    expect(threadsShown).toEqual(["message-1", "message-1"]);
  });

  it("shows the table of contents when a discussion link is opened without access", () => {
    renderWith().render(tableOfContent({ url: THREAD_LINK }));

    expect(screen.getByText("Course chapters content")).toBeInTheDocument();
    expect(screen.queryByText(/Course discussion content/)).not.toBeInTheDocument();
  });

  it("shows statistics to the course author with the required permissions", async () => {
    courseAccessState.isAdminExperience = false;
    const user = userEvent.setup();

    renderWith().render(tableOfContent());
    await user.click(screen.getByRole("button", { name: "Statistics" }));

    expect(screen.getByText("Course statistics content")).toBeInTheDocument();
  });

  it("hides statistics from a non-author with the own-course permission", () => {
    currentUserState.id = "user-2";

    renderWith().render(tableOfContent());

    expect(screen.queryByRole("button", { name: "Statistics" })).not.toBeInTheDocument();
  });

  it("hides statistics from an administrator without the statistics permission", () => {
    currentUserState.permissions = [];

    renderWith().render(tableOfContent());

    expect(screen.queryByRole("button", { name: "Statistics" })).not.toBeInTheDocument();
  });

  it("uses the existing missing translations query for the selected course language", () => {
    missingTranslationsState.hasMissingTranslations = true;

    renderWith().render(tableOfContent({ language: "pl" }));

    expect(useMissingTranslationsMock).toHaveBeenCalledWith("course-1", "pl", true);
    expect(screen.getByRole("button", { name: "Missing translations" })).toBeInTheDocument();
  });
});
