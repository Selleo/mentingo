import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { fakeSocket } from "~/utils/mocks/socket.mock";
import { renderWith } from "~/utils/testUtils";

import { COURSE_DISCUSSION_HANDLES } from "../../../../../e2e/data/courses/handles";

import { CourseChatTab } from "./CourseChatTab";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      courseChatControllerGetMessages: vi.fn(),
      courseChatControllerGetReplies: vi.fn(),
      courseChatControllerGetCourseChatUsers: vi.fn(),
      courseChatControllerFollowThread: vi.fn(),
    },
  },
}));

vi.mock("~/api/socket", async () => {
  const { fakeSocket } = await import("~/utils/mocks/socket.mock");

  return { acquireSocket: () => fakeSocket, releaseSocket: () => undefined };
});

const COURSE_ID = "course-1";
const CURRENT_USER_ID = "user-1";
const THREAD_ID = "message-21";

const buildMessage = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  courseId: COURSE_ID,
  userId: CURRENT_USER_ID,
  content: `Content of ${id}`,
  parentMessageId: null,
  deletedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  user: { id: CURRENT_USER_ID, firstName: "Ada", lastName: "Author", avatarReference: null },
  reactions: [],
  replyCount: 0,
  latestReply: null,
  replyParticipants: [],
  isFollowing: false,
  ...overrides,
});

type MessagesQuery = { page?: number; perPage?: number; aroundMessageId?: string };

const messagesRequests = () =>
  vi.mocked(ApiClient.api.courseChatControllerGetMessages).mock.calls.map(([, query]) => query);

const onRequestedThreadShown = vi.fn();

const renderCourseChat = (requestedThreadId?: string) =>
  renderWith().render(
    <QueryClientProvider client={queryClient}>
      <CourseChatTab
        courseId={COURSE_ID}
        currentUserId={CURRENT_USER_ID}
        canDeleteAnyMessage={false}
        requestedThreadId={requestedThreadId}
        onRequestedThreadShown={onRequestedThreadShown}
      />
    </QueryClientProvider>,
  );

const cachedThreadLookups = () =>
  queryClient
    .getQueryCache()
    .findAll({ queryKey: ["course-chat", "messages", COURSE_ID, "thread"] });

describe("CourseChatTab", () => {
  beforeEach(() => {
    queryClient.clear();
    fakeSocket.reset();
    vi.clearAllMocks();
    vi.mocked(ApiClient.api.courseChatControllerGetCourseChatUsers).mockResolvedValue({
      data: { data: [] },
    } as never);
    vi.mocked(ApiClient.api.courseChatControllerGetReplies).mockResolvedValue({
      data: {
        data: [buildMessage("reply-1", { content: "The reply", parentMessageId: THREAD_ID })],
        pagination: { totalItems: 1, page: 1, perPage: 100 },
      },
    } as never);
    // The requested thread sits on the third page of the discussion.
    vi.mocked(ApiClient.api.courseChatControllerGetMessages).mockImplementation((async (
      _courseId: string,
      query: MessagesQuery,
    ) => ({
      data: {
        data: query.aroundMessageId
          ? [buildMessage(THREAD_ID, { replyCount: 1 })]
          : [buildMessage("message-1")],
        pagination: { totalItems: 21, page: query.aroundMessageId ? 3 : 1, perPage: 10 },
      },
    })) as never);
  });

  it("opens the requested thread on the page that holds it, with its replies", async () => {
    renderCourseChat(THREAD_ID);

    expect(await screen.findByText("The reply")).toBeInTheDocument();
    expect(screen.getByTestId(COURSE_DISCUSSION_HANDLES.replies(THREAD_ID))).toBeInTheDocument();
    expect(messagesRequests()).toEqual([{ aroundMessageId: THREAD_ID, perPage: 10 }]);
    expect(ApiClient.api.courseChatControllerGetReplies).toHaveBeenCalledWith(
      THREAD_ID,
      expect.anything(),
    );
    expect(
      screen.getByTestId(COURSE_DISCUSSION_HANDLES.thread(THREAD_ID)).scrollIntoView,
    ).toHaveBeenCalled();
  });

  it("reports the requested thread as shown and keeps no copy of the lookup", async () => {
    const { unmount } = renderCourseChat(THREAD_ID);
    await screen.findByText("The reply");

    expect(onRequestedThreadShown).toHaveBeenCalledTimes(1);

    unmount();
    await waitFor(() => expect(cachedThreadLookups()).toEqual([]));
  });

  it("starts on the newest page when no thread is requested", async () => {
    renderCourseChat();

    expect(await screen.findByText("Content of message-1")).toBeInTheDocument();
    await waitFor(() => expect(messagesRequests()).toEqual([{ page: 1, perPage: 10 }]));
    expect(screen.queryByTestId(COURSE_DISCUSSION_HANDLES.replies("message-1"))).toBeNull();
  });

  it("follows a thread from the discussion and reloads it", async () => {
    vi.mocked(ApiClient.api.courseChatControllerFollowThread).mockResolvedValue({
      data: { data: { messageId: "message-1", isFollowing: true } },
    } as never);

    renderCourseChat();
    fireEvent.click(
      await screen.findByTestId(COURSE_DISCUSSION_HANDLES.threadFollowButton("message-1")),
    );

    await waitFor(() =>
      expect(ApiClient.api.courseChatControllerFollowThread).toHaveBeenCalledWith("message-1"),
    );
    await waitFor(() => expect(messagesRequests()).toHaveLength(2));
  });
});
