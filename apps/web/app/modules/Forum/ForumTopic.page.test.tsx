import { createRemixStub } from "@remix-run/testing";
import { DISCUSSION_SCOPES } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { renderWith } from "~/utils/testUtils";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import ForumTopicPage from "./ForumTopic.page";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      settingsControllerGetPublicGlobalSettings: vi.fn(),
      forumControllerGetTopic: vi.fn(),
      forumControllerGetTopicPosts: vi.fn(),
      forumControllerDeletePost: vi.fn(),
    },
  },
}));

const CURRENT_USER_ID = "user-1";

vi.mock("~/api/queries/useCurrentUser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/api/queries/useCurrentUser")>()),
  useCurrentUser: () => ({ data: { id: "user-1", permissions: [] } }),
}));

const TOPIC_ID = "topic-1";
const REPLY_CONTENT = "Count me in";

const buildPost = (overrides: Record<string, unknown> = {}) => ({
  id: "post-1",
  topicId: TOPIC_ID,
  userId: CURRENT_USER_ID,
  content: "Who wants to study together?",
  isFirstPost: true,
  deletedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  user: { id: CURRENT_USER_ID, firstName: "Ada", lastName: "Author", avatarReference: null },
  reactions: [],
  ...overrides,
});

const reply = buildPost({ id: "reply-1", content: REPLY_CONTENT, isFirstPost: false });

const buildTopic = (firstPostOverrides: Record<string, unknown> = {}) => ({
  id: TOPIC_ID,
  scope: DISCUSSION_SCOPES.GENERAL,
  title: "Exam preparation",
  course: null,
  author: { id: CURRENT_USER_ID, firstName: "Ada", lastName: "Author", avatarReference: null },
  replyCount: 1,
  lastActivityAt: "2026-11-01T10:00:00.000Z",
  createdAt: "2026-11-01T10:00:00.000Z",
  firstPost: buildPost(firstPostOverrides),
});

const mockTopic = (topic: ReturnType<typeof buildTopic>) =>
  vi
    .mocked(ApiClient.api.forumControllerGetTopic)
    .mockResolvedValue({ data: { data: topic } } as never);

const mockPosts = (resolvePosts: (page: number) => { data: unknown[]; totalItems: number }) =>
  vi.mocked(ApiClient.api.forumControllerGetTopicPosts).mockImplementation((async (
    _topicId: string,
    query: { page: number; perPage: number },
  ) => {
    const { data, totalItems } = resolvePosts(query.page);

    return { data: { data, pagination: { totalItems, page: query.page, perPage: query.perPage } } };
  }) as never);

const renderTopic = (url = `/forum/topics/${TOPIC_ID}`) => {
  const RemixStub = createRemixStub([
    { path: "/forum/topics/:topicId", Component: ForumTopicPage },
    { path: "/forum", Component: () => <p>forum list</p> },
  ]);

  return renderWith().render(
    <QueryClientProvider client={queryClient}>
      <RemixStub initialEntries={[url]} />
    </QueryClientProvider>,
  );
};

describe("ForumTopicPage", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    vi.mocked(ApiClient.api.settingsControllerGetPublicGlobalSettings).mockResolvedValue({
      data: { data: { forumEnabled: true } },
    } as never);
    mockTopic(buildTopic());
    mockPosts(() => ({ data: [reply], totalItems: 1 }));
  });

  it("reports a missing topic instead of failing the page", async () => {
    vi.mocked(ApiClient.api.forumControllerGetTopic).mockRejectedValue(
      new AxiosError("Not found", undefined, undefined, undefined, { status: 404 } as never),
    );

    renderTopic();

    expect(await screen.findByTestId(FORUM_HANDLES.TOPIC_NOT_FOUND)).toBeInTheDocument();
    expect(ApiClient.api.forumControllerGetTopicPosts).not.toHaveBeenCalled();
  });

  it("returns to the last existing page of replies when the requested page is gone", async () => {
    mockPosts((page) =>
      page === 1 ? { data: [reply], totalItems: 20 } : { data: [], totalItems: 20 },
    );

    renderTopic(`/forum/topics/${TOPIC_ID}?page=2`);

    expect(await screen.findByText(REPLY_CONTENT)).toBeInTheDocument();
    expect(screen.queryByTestId(FORUM_HANDLES.NO_REPLIES)).not.toBeInTheDocument();
  });

  it("leaves a closed topic once its last reply is deleted", async () => {
    mockTopic(buildTopic({ content: "", deletedAt: "2026-11-02T10:00:00.000Z" }));
    vi.mocked(ApiClient.api.forumControllerDeletePost).mockResolvedValue({
      data: {
        data: {
          topicId: TOPIC_ID,
          postId: reply.id,
          isFirstPost: false,
          removed: true,
          deletedAt: "2026-11-03T10:00:00.000Z",
          topicRemoved: true,
        },
      },
    } as never);

    renderTopic();

    fireEvent.click(await screen.findByTestId(FORUM_HANDLES.postDeleteButton(reply.id)));
    fireEvent.click(await screen.findByTestId(FORUM_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON));

    expect(await screen.findByText("forum list")).toBeInTheDocument();
  });
});
