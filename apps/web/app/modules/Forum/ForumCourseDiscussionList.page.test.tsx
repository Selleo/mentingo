import { createRemixStub } from "@remix-run/testing";
import { FORUM_SOCKET_EVENTS } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { fakeSocket } from "~/utils/mocks/socket.mock";
import { renderWith } from "~/utils/testUtils";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import ForumCourseDiscussionListPage from "./ForumCourseDiscussionList.page";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      settingsControllerGetPublicGlobalSettings: vi.fn(),
      forumControllerGetCourseDiscussions: vi.fn(),
    },
  },
}));

vi.mock("~/api/socket", async () => {
  const { fakeSocket } = await import("~/utils/mocks/socket.mock");

  return { acquireSocket: () => fakeSocket, releaseSocket: () => undefined };
});

type CourseDiscussionsQuery = NonNullable<
  Parameters<typeof ApiClient.api.forumControllerGetCourseDiscussions>[0]
>;

const COURSE_ID = "course-1";

const courseDiscussion = {
  courseId: COURSE_ID,
  courseTitle: "Sales basics",
  messageCount: 3,
  lastActivityAt: "2026-11-01T10:00:00.000Z",
};

const mockCourseDiscussions = (
  resolveCourseDiscussions: (query: CourseDiscussionsQuery) => {
    data: unknown[];
    totalItems: number;
  },
) =>
  vi.mocked(ApiClient.api.forumControllerGetCourseDiscussions).mockImplementation((async (
    query: CourseDiscussionsQuery,
  ) => {
    const { data, totalItems } = resolveCourseDiscussions(query);

    return { data: { data, pagination: { totalItems, page: query.page, perPage: query.perPage } } };
  }) as never);

const renderCourseDiscussions = (url: string) => {
  const RemixStub = createRemixStub([
    { path: "/forum/courses", Component: ForumCourseDiscussionListPage },
  ]);

  return renderWith().render(
    <QueryClientProvider client={queryClient}>
      <RemixStub initialEntries={[url]} />
    </QueryClientProvider>,
  );
};

const lastCourseDiscussionsQuery = () =>
  vi.mocked(ApiClient.api.forumControllerGetCourseDiscussions).mock.lastCall?.[0];

describe("ForumCourseDiscussionListPage", () => {
  beforeEach(() => {
    queryClient.clear();
    fakeSocket.reset();
    vi.clearAllMocks();
    vi.mocked(ApiClient.api.settingsControllerGetPublicGlobalSettings).mockResolvedValue({
      data: { data: { forumEnabled: true } },
    } as never);
    mockCourseDiscussions(() => ({ data: [courseDiscussion], totalItems: 1 }));
  });

  it("loads one page of course discussions for the search in the URL", async () => {
    renderCourseDiscussions("/forum/courses?search=sales&page=3");

    const row = await screen.findByTestId(FORUM_HANDLES.courseDiscussion(COURSE_ID));

    expect(row).toHaveAttribute("href", `/forum/courses/${COURSE_ID}`);
    expect(
      vi.mocked(ApiClient.api.forumControllerGetCourseDiscussions).mock.calls[0]?.[0],
    ).toMatchObject({ page: 3, perPage: 20, search: "sales" });
  });

  it("returns to the last existing page when the requested page is gone", async () => {
    mockCourseDiscussions((query) =>
      query.page === 1
        ? { data: [courseDiscussion], totalItems: 20 }
        : { data: [], totalItems: 20 },
    );

    renderCourseDiscussions("/forum/courses?page=2");

    expect(
      await screen.findByTestId(FORUM_HANDLES.courseDiscussion(COURSE_ID)),
    ).toBeInTheDocument();
    expect(lastCourseDiscussionsQuery()).toMatchObject({ page: 1 });
  });

  it("tells a search without matches apart from having no course discussions", async () => {
    mockCourseDiscussions(() => ({ data: [], totalItems: 0 }));

    renderCourseDiscussions("/forum/courses?search=nothing");

    expect(
      await screen.findByTestId(FORUM_HANDLES.COURSE_DISCUSSIONS_EMPTY_STATE),
    ).toHaveTextContent("No course discussions match your search.");
  });

  it("reloads the list when a course discussion changes elsewhere", async () => {
    renderCourseDiscussions("/forum/courses");
    await screen.findByTestId(FORUM_HANDLES.courseDiscussion(COURSE_ID));
    vi.mocked(ApiClient.api.forumControllerGetCourseDiscussions).mockClear();

    vi.useFakeTimers();
    try {
      await act(async () => {
        fakeSocket.receive(FORUM_SOCKET_EVENTS.CHANGED, {});
        await vi.runOnlyPendingTimersAsync();
      });

      expect(ApiClient.api.forumControllerGetCourseDiscussions).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
