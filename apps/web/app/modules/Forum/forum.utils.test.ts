import { FORUM_TOPIC_SORTS, PERMISSIONS, type PermissionKey } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  canDeleteCourseDiscussionMessage,
  canDeleteForumPost,
  canReadCourseDiscussions,
  getLastPage,
  parsePageParam,
  parseSortParam,
} from "./forum.utils";

describe("forum list params", () => {
  it("falls back to the first page and latest activity for invalid values", () => {
    expect(parsePageParam("3")).toBe(3);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam(null)).toBe(1);
    expect(parseSortParam(FORUM_TOPIC_SORTS.MOST_REPLIES)).toBe(FORUM_TOPIC_SORTS.MOST_REPLIES);
    expect(parseSortParam("random")).toBe(FORUM_TOPIC_SORTS.LAST_ACTIVITY);
    expect(parseSortParam(undefined)).toBe(FORUM_TOPIC_SORTS.LAST_ACTIVITY);
  });

  it("returns the page that holds the last item", () => {
    expect(getLastPage(0, 20)).toBe(1);
    expect(getLastPage(20, 20)).toBe(1);
    expect(getLastPage(21, 20)).toBe(2);
  });
});

describe("forum permissions", () => {
  it("shows course discussions only with discussions enabled and read access", () => {
    const learner = [PERMISSIONS.COURSE_DISCUSSION_READ];

    expect(canReadCourseDiscussions(learner, true)).toBe(true);
    expect(canReadCourseDiscussions(learner, false)).toBe(false);
    expect(canReadCourseDiscussions([], true)).toBe(false);
  });

  it("lets authors delete their own posts and moderators delete any post", () => {
    const post = { authorId: "user-1", currentUserId: "user-1", permissions: [] };

    expect(canDeleteForumPost(post)).toBe(true);
    expect(canDeleteForumPost({ ...post, currentUserId: "user-2" })).toBe(false);
    expect(
      canDeleteForumPost({
        ...post,
        currentUserId: "moderator",
        permissions: [PERMISSIONS.FORUM_POST_DELETE],
      }),
    ).toBe(true);
    expect(
      canDeleteForumPost({
        ...post,
        currentUserId: "moderator",
        permissions: [PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE],
      }),
    ).toBe(false);
  });

  it("applies the course discussion rules to deleting course messages", () => {
    const message = { authorId: "user-1", currentUserId: "user-1" };
    const canDelete = (currentUserId: string, permissions: PermissionKey[]) =>
      canDeleteCourseDiscussionMessage({ ...message, currentUserId, permissions });

    expect(canDelete("user-1", [PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN])).toBe(true);
    expect(canDelete("user-1", [])).toBe(false);
    expect(canDelete("user-2", [PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN])).toBe(false);
    expect(canDelete("user-2", [PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE])).toBe(true);
    expect(canDelete("user-2", [PERMISSIONS.FORUM_POST_DELETE])).toBe(false);
  });
});
