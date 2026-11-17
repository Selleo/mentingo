import { beforeEach, describe, expect, it } from "vitest";

import { FORUM_QUERY_KEY } from "~/api/queries/forum/forumQueryKeys";
import { queryClient } from "~/api/queryClient";

import {
  invalidateCourseChatMessageCreated,
  invalidateMessageReactions,
  updateMessageReactionsInCache,
} from "./courseChatCache";
import { getCourseChatMessagesQueryKey } from "./useCourseChatMessages";
import { getInfiniteCourseChatRepliesQueryKey } from "./useInfiniteCourseChatReplies";

const COURSE_ID = "course-1";

const isInvalidated = (queryKey: readonly unknown[]) =>
  queryClient.getQueryState(queryKey)?.isInvalidated;

const cacheReplies = (parentMessageId: string, replyId: string) => {
  const queryKey = getInfiniteCourseChatRepliesQueryKey(parentMessageId);

  queryClient.setQueryData(queryKey, {
    pages: [{ data: [{ id: replyId }], pagination: { totalItems: 1, page: 1, perPage: 100 } }],
    pageParams: [1],
  });

  return queryKey;
};

describe("course chat cache", () => {
  const topicsKey = [...FORUM_QUERY_KEY, "topics", { page: 1 }];
  const courseDiscussionsKey = [...FORUM_QUERY_KEY, "course-discussions", { page: 1 }];
  const courseDiscussionKey = [...FORUM_QUERY_KEY, "course-discussion", COURSE_ID, "en"];

  beforeEach(() => {
    queryClient.clear();
    for (const queryKey of [topicsKey, courseDiscussionsKey, courseDiscussionKey]) {
      queryClient.setQueryData<object>(queryKey, {});
    }
  });

  it("refreshes only the forum's course discussion summaries after a new course message", () => {
    invalidateCourseChatMessageCreated({ courseId: COURSE_ID });

    expect(isInvalidated(courseDiscussionsKey)).toBe(true);
    expect(isInvalidated(courseDiscussionKey)).toBe(true);
    expect(isInvalidated(topicsKey)).toBe(false);
  });

  it("reloads only the replies that hold the message whose reactions changed", () => {
    const reactedRepliesKey = cacheReplies("message-1", "reply-1");
    const otherRepliesKey = cacheReplies("message-2", "reply-2");

    updateMessageReactionsInCache({ courseId: COURSE_ID, messageId: "reply-1", reactions: [] });

    expect(isInvalidated(reactedRepliesKey)).toBe(true);
    expect(isInvalidated(otherRepliesKey)).toBe(false);
    expect(isInvalidated(courseDiscussionsKey)).toBe(false);
    expect(isInvalidated(topicsKey)).toBe(false);
  });

  it("reloads a message after someone else's reaction instead of copying their own flags", () => {
    const reactedPageKey = getCourseChatMessagesQueryKey(COURSE_ID, 1);
    const otherPageKey = getCourseChatMessagesQueryKey(COURSE_ID, 2);
    const reactedPage = {
      data: [
        {
          id: "message-1",
          latestReply: null,
          reactions: [{ reaction: "👍", count: 1, reactedByCurrentUser: false }],
        },
      ],
    };
    queryClient.setQueryData<object>(reactedPageKey, reactedPage);
    queryClient.setQueryData<object>(otherPageKey, {
      data: [{ id: "message-2", latestReply: null, reactions: [] }],
    });

    invalidateMessageReactions({ courseId: COURSE_ID, messageId: "message-1" });

    expect(queryClient.getQueryData(reactedPageKey)).toEqual(reactedPage);
    expect(isInvalidated(reactedPageKey)).toBe(true);
    expect(isInvalidated(otherPageKey)).toBe(false);
  });
});
