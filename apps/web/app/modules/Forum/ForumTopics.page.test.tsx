import { createRemixStub } from "@remix-run/testing";
import { FORUM_SOCKET_EVENTS, PERMISSIONS } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { fakeSocket } from "~/utils/mocks/socket.mock";
import { renderWith } from "~/utils/testUtils";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import ForumTopicsPage from "./ForumTopics.page";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      settingsControllerGetPublicGlobalSettings: vi.fn(),
      forumControllerGetCourseDiscussions: vi.fn(),
      forumControllerGetTopics: vi.fn(),
    },
  },
}));

vi.mock("~/api/socket", async () => {
  const { fakeSocket } = await import("~/utils/mocks/socket.mock");

  return { acquireSocket: () => fakeSocket, releaseSocket: () => undefined };
});

const currentUserPermissions = vi.hoisted(() => ({ value: [] as string[] }));

vi.mock("~/api/queries/useCurrentUser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/api/queries/useCurrentUser")>()),
  useCurrentUser: () => ({
    data: { id: "user-1", permissions: currentUserPermissions.value },
  }),
}));

type TopicsQuery = NonNullable<Parameters<typeof ApiClient.api.forumControllerGetTopics>[0]>;

const COURSE_ID = "course-1";
const COURSE_TITLE = "Sales";
const TOPIC_TITLE = "Onboarding tips";

const topic = {
  id: "topic-1",
  title: TOPIC_TITLE,
  author: { id: "user-2", firstName: "Ada", lastName: "Author", avatarReference: null },
  replyCount: 0,
  lastActivityAt: "2026-11-01T10:00:00.000Z",
  createdAt: "2026-11-01T10:00:00.000Z",
  excerpt: "Start here",
  isDeleted: false,
};

const mockSettings = (forumEnabled: boolean, courseDiscussionsEnabled = true) =>
  vi.mocked(ApiClient.api.settingsControllerGetPublicGlobalSettings).mockResolvedValue({
    data: { data: { forumEnabled, courseDiscussionsEnabled } },
  } as never);

const mockCourseDiscussions = (totalItems: number) =>
  vi.mocked(ApiClient.api.forumControllerGetCourseDiscussions).mockResolvedValue({
    data: {
      data: [
        {
          courseId: COURSE_ID,
          courseTitle: COURSE_TITLE,
          messageCount: 3,
          lastActivityAt: "2026-11-01T10:00:00.000Z",
        },
      ],
      pagination: { totalItems, page: 1, perPage: 5 },
    },
  } as never);

const mockTopics = (
  resolveTopics: (query: TopicsQuery) => { data: unknown[]; totalItems: number },
) =>
  vi.mocked(ApiClient.api.forumControllerGetTopics).mockImplementation((async (
    query: TopicsQuery,
  ) => {
    const { data, totalItems } = resolveTopics(query);

    return { data: { data, pagination: { totalItems, page: query.page, perPage: query.perPage } } };
  }) as never);

const renderForum = (url: string) => {
  const RemixStub = createRemixStub([
    { path: "/forum", Component: ForumTopicsPage },
    { path: "/", Component: () => <p>home page</p> },
  ]);

  return renderWith().render(
    <QueryClientProvider client={queryClient}>
      <RemixStub initialEntries={[url]} />
    </QueryClientProvider>,
  );
};

const lastTopicsQuery = () => vi.mocked(ApiClient.api.forumControllerGetTopics).mock.lastCall?.[0];

describe("ForumTopicsPage", () => {
  beforeEach(() => {
    currentUserPermissions.value = [
      PERMISSIONS.COURSE_DISCUSSION_READ,
      PERMISSIONS.FORUM_TOPIC_CREATE,
    ];
    queryClient.clear();
    fakeSocket.reset();
    vi.clearAllMocks();
    mockSettings(true);
    mockCourseDiscussions(1);
    mockTopics(() => ({ data: [topic], totalItems: 1 }));
  });

  it("links each course discussion to its page in the forum", async () => {
    renderForum("/forum");

    const courseDiscussion = await screen.findByTestId(FORUM_HANDLES.courseDiscussion(COURSE_ID));

    expect(courseDiscussion).toHaveTextContent(COURSE_TITLE);
    expect(courseDiscussion).toHaveAttribute("href", `/forum/courses/${COURSE_ID}`);
  });

  it("previews the most active course discussions and links to all of them", async () => {
    mockCourseDiscussions(587);
    renderForum("/forum");

    const allLink = await screen.findByTestId(FORUM_HANDLES.COURSE_DISCUSSIONS_ALL_LINK);

    expect(allLink).toHaveAttribute("href", "/forum/courses");
    expect(allLink).toHaveTextContent("587");
    expect(ApiClient.api.forumControllerGetCourseDiscussions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 5 }),
    );
  });

  it("shows no link to all course discussions when the preview holds them all", async () => {
    renderForum("/forum");

    await screen.findByTestId(FORUM_HANDLES.courseDiscussion(COURSE_ID));

    expect(screen.queryByTestId(FORUM_HANDLES.COURSE_DISCUSSIONS_ALL_LINK)).not.toBeInTheDocument();
  });

  it("loads no course discussions for a viewer who may not read them", async () => {
    currentUserPermissions.value = [PERMISSIONS.FORUM_TOPIC_CREATE];
    renderForum("/forum");

    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    expect(ApiClient.api.forumControllerGetCourseDiscussions).not.toHaveBeenCalled();
    expect(screen.queryByTestId(FORUM_HANDLES.COURSE_DISCUSSIONS)).not.toBeInTheDocument();
  });

  it("returns to the last existing page when the requested page is gone", async () => {
    mockTopics((query) =>
      query.page === 1 ? { data: [topic], totalItems: 20 } : { data: [], totalItems: 20 },
    );

    renderForum("/forum?page=2");

    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    expect(lastTopicsQuery()).toMatchObject({ page: 1 });
    expect(screen.queryByTestId(FORUM_HANDLES.EMPTY_STATE)).not.toBeInTheDocument();
  });

  it("offers a new topic only to users who may create one", async () => {
    const { unmount } = renderForum("/forum");

    expect(await screen.findByTestId(FORUM_HANDLES.NEW_TOPIC_BUTTON)).toBeInTheDocument();

    unmount();
    currentUserPermissions.value = [];
    renderForum("/forum");

    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    expect(screen.queryByTestId(FORUM_HANDLES.NEW_TOPIC_BUTTON)).not.toBeInTheDocument();
  });

  it("reloads the list when the forum changes elsewhere", async () => {
    renderForum("/forum");
    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    expect(fakeSocket.emitted).toContainEqual([FORUM_SOCKET_EVENTS.JOIN, undefined]);
    const requestsBefore = vi.mocked(ApiClient.api.forumControllerGetTopics).mock.calls.length;

    fakeSocket.receive(FORUM_SOCKET_EVENTS.CHANGED, {});

    await waitFor(() =>
      expect(vi.mocked(ApiClient.api.forumControllerGetTopics).mock.calls.length).toBeGreaterThan(
        requestsBefore,
      ),
    );
  });

  it("reloads the list after the live connection comes back", async () => {
    renderForum("/forum");
    expect(await screen.findByText(TOPIC_TITLE)).toBeInTheDocument();
    const requestsBefore = vi.mocked(ApiClient.api.forumControllerGetTopics).mock.calls.length;

    fakeSocket.receive("connect");

    await waitFor(() =>
      expect(vi.mocked(ApiClient.api.forumControllerGetTopics).mock.calls.length).toBeGreaterThan(
        requestsBefore,
      ),
    );
  });

  it("redirects away without loading topics while the forum is disabled", async () => {
    mockSettings(false);

    renderForum("/forum");

    expect(await screen.findByText("home page")).toBeInTheDocument();
    await waitFor(() => expect(ApiClient.api.forumControllerGetTopics).not.toHaveBeenCalled());
  });
});
