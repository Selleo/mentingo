import { createRemixStub } from "@remix-run/testing";
import { COURSE_CHAT_SOCKET_EVENTS, PERMISSIONS } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { fakeSocket } from "~/utils/mocks/socket.mock";
import { renderWith } from "~/utils/testUtils";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import ForumCourseDiscussionPage from "./ForumCourseDiscussion.page";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      settingsControllerGetPublicGlobalSettings: vi.fn(),
      forumControllerGetCourseDiscussion: vi.fn(),
      courseChatControllerGetMessages: vi.fn(),
      courseChatControllerGetReplies: vi.fn(),
      courseChatControllerGetCourseChatUsers: vi.fn(),
      courseChatControllerCreateMessage: vi.fn(),
    },
  },
}));

vi.mock("~/api/socket", async () => {
  const { fakeSocket } = await import("~/utils/mocks/socket.mock");

  return { acquireSocket: () => fakeSocket, releaseSocket: () => undefined };
});

const currentUserPermissions = vi.hoisted(() => ({ value: [] as string[] }));

const CURRENT_USER_ID = "user-1";

vi.mock("~/api/queries/useCurrentUser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/api/queries/useCurrentUser")>()),
  useCurrentUser: () => ({ data: { id: "user-1", permissions: currentUserPermissions.value } }),
}));

const COURSE_ID = "course-1";
const COURSE_TITLE = "Advanced English";
const CLASSMATE = {
  id: "user-2",
  firstName: "Bea",
  lastName: "Classmate",
  avatarReference: null,
  isOnline: false,
};

const buildMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "message-1",
  courseId: COURSE_ID,
  userId: CURRENT_USER_ID,
  content: "Does anyone have notes from lesson 3?",
  parentMessageId: null,
  deletedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  user: { id: CURRENT_USER_ID, firstName: "Ada", lastName: "Author", avatarReference: null },
  reactions: [],
  replyCount: 0,
  latestReply: null,
  replyParticipants: [],
  ...overrides,
});

const olderMessage = buildMessage({ replyCount: 1 });
const newerMessage = buildMessage({
  id: "message-2",
  content: "See you on Friday",
  createdAt: "2026-11-01T11:00:00.000Z",
});
const reply = buildMessage({
  id: "reply-1",
  content: "I added them to the materials",
  parentMessageId: olderMessage.id,
});

const mockMessages = (messages: unknown[]) =>
  vi.mocked(ApiClient.api.courseChatControllerGetMessages).mockResolvedValue({
    data: { data: messages, pagination: { totalItems: messages.length, page: 1, perPage: 10 } },
  } as never);

const renderCourseDiscussion = () => {
  const RemixStub = createRemixStub([
    { path: "/forum/courses/:courseId", Component: ForumCourseDiscussionPage },
  ]);

  return renderWith().render(
    <QueryClientProvider client={queryClient}>
      <RemixStub initialEntries={[`/forum/courses/${COURSE_ID}`]} />
    </QueryClientProvider>,
  );
};

describe("ForumCourseDiscussionPage", () => {
  beforeEach(() => {
    currentUserPermissions.value = [PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE];
    queryClient.clear();
    fakeSocket.reset();
    vi.clearAllMocks();
    vi.mocked(ApiClient.api.settingsControllerGetPublicGlobalSettings).mockResolvedValue({
      data: { data: { forumEnabled: true } },
    } as never);
    vi.mocked(ApiClient.api.forumControllerGetCourseDiscussion).mockResolvedValue({
      data: {
        data: {
          courseId: COURSE_ID,
          courseTitle: COURSE_TITLE,
          messageCount: 3,
          lastActivityAt: "2026-11-01T11:00:00.000Z",
        },
      },
    } as never);
    vi.mocked(ApiClient.api.courseChatControllerGetCourseChatUsers).mockResolvedValue({
      data: { data: [CLASSMATE] },
    } as never);
    vi.mocked(ApiClient.api.courseChatControllerGetReplies).mockResolvedValue({
      data: { data: [reply], pagination: { totalItems: 1, page: 1, perPage: 100 } },
    } as never);
    vi.mocked(ApiClient.api.courseChatControllerCreateMessage).mockResolvedValue({
      data: { data: buildMessage({ id: "message-3" }) },
    } as never);
    mockMessages([olderMessage, newerMessage]);
  });

  it("shows the course discussion as one topic with replies under their message", async () => {
    renderCourseDiscussion();

    expect(await screen.findByTestId(FORUM_HANDLES.COURSE_DISCUSSION_TITLE)).toHaveTextContent(
      COURSE_TITLE,
    );

    const replies = await screen.findByTestId(FORUM_HANDLES.postReplies(olderMessage.id));
    expect(within(replies).getByText(reply.content)).toBeInTheDocument();
    expect(screen.getByTestId(FORUM_HANDLES.postContent(newerMessage.id))).toHaveTextContent(
      newerMessage.content,
    );
    expect(ApiClient.api.courseChatControllerGetReplies).toHaveBeenCalledTimes(1);
  });

  it("reports a missing course discussion instead of failing the page", async () => {
    vi.mocked(ApiClient.api.forumControllerGetCourseDiscussion).mockRejectedValue(
      new AxiosError("Not found", "404", undefined, undefined, { status: 404 } as never),
    );

    renderCourseDiscussion();

    expect(
      await screen.findByTestId(FORUM_HANDLES.COURSE_DISCUSSION_NOT_FOUND),
    ).toBeInTheDocument();
    expect(ApiClient.api.courseChatControllerGetMessages).not.toHaveBeenCalled();
  });

  it("posts a new message with the mentioned classmates", async () => {
    const content = `@${CLASSMATE.firstName} ${CLASSMATE.lastName} are you coming?`;

    renderCourseDiscussion();

    const messageInput = await screen.findByTestId(FORUM_HANDLES.MESSAGE_INPUT);
    await screen.findByText(newerMessage.content);
    fireEvent.change(messageInput, { target: { value: content } });
    fireEvent.click(screen.getByTestId(FORUM_HANDLES.MESSAGE_SUBMIT_BUTTON));

    await waitFor(() =>
      expect(ApiClient.api.courseChatControllerCreateMessage).toHaveBeenCalledWith(COURSE_ID, {
        content,
        mentionedUserIds: [CLASSMATE.id],
      }),
    );
  });

  it("replies under the chosen message", async () => {
    renderCourseDiscussion();

    fireEvent.click(await screen.findByTestId(FORUM_HANDLES.postReplyButton(newerMessage.id)));
    fireEvent.change(screen.getByTestId(FORUM_HANDLES.postReplyInput(newerMessage.id)), {
      target: { value: "Yes, at ten" },
    });
    fireEvent.click(screen.getByTestId(FORUM_HANDLES.postReplySubmitButton(newerMessage.id)));

    await waitFor(() =>
      expect(ApiClient.api.courseChatControllerCreateMessage).toHaveBeenCalledWith(COURSE_ID, {
        content: "Yes, at ten",
        parentMessageId: newerMessage.id,
        mentionedUserIds: [],
      }),
    );
  });

  it("offers no posting to a user who may only read the discussion", async () => {
    currentUserPermissions.value = [];

    renderCourseDiscussion();

    expect(await screen.findByText(newerMessage.content)).toBeInTheDocument();
    expect(screen.queryByTestId(FORUM_HANDLES.MESSAGE_INPUT)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(FORUM_HANDLES.postReplyButton(newerMessage.id)),
    ).not.toBeInTheDocument();
  });

  it("reloads the messages when someone posts in the course", async () => {
    renderCourseDiscussion();
    await screen.findByText(newerMessage.content);
    vi.mocked(ApiClient.api.courseChatControllerGetMessages).mockClear();

    fakeSocket.receive(
      COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED,
      buildMessage({ id: "message-3" }),
    );

    await waitFor(() => expect(ApiClient.api.courseChatControllerGetMessages).toHaveBeenCalled());
  });
});
