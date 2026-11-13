import { DISCUSSION_SCOPES, FORUM_TOPIC_SORTS, PERMISSIONS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  FORUM_FILTERS,
  canDeleteForumPost,
  canReadCourseThreads,
  canReplyInTopic,
  getLastPage,
  getTopicHeading,
  isForumTopicFilter,
  parsePageParam,
  parseSortParam,
  toTopicFilterQuery,
} from "./forum.utils";

import type { TFunction } from "i18next";

const t = ((key: string, options?: { course?: string }) =>
  options?.course ? `${key}:${options.course}` : key) as unknown as TFunction;

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

  it("accepts the fixed filters and only the courses the viewer can pick", () => {
    const courseIds = ["course-id"];

    expect(isForumTopicFilter(FORUM_FILTERS.ALL, courseIds)).toBe(true);
    expect(isForumTopicFilter(FORUM_FILTERS.GENERAL, courseIds)).toBe(true);
    expect(isForumTopicFilter("course-id", courseIds)).toBe(true);
    expect(isForumTopicFilter("other-course-id", courseIds)).toBe(false);
    expect(isForumTopicFilter("foo", [])).toBe(false);
  });

  it("maps the filter to the topic query scope", () => {
    expect(toTopicFilterQuery(FORUM_FILTERS.ALL)).toEqual({});
    expect(toTopicFilterQuery(FORUM_FILTERS.GENERAL)).toEqual({ scope: DISCUSSION_SCOPES.GENERAL });
    expect(toTopicFilterQuery("course-id")).toEqual({
      scope: DISCUSSION_SCOPES.COURSE,
      courseId: "course-id",
    });
  });

  it("returns the page that holds the last item", () => {
    expect(getLastPage(0, 20)).toBe(1);
    expect(getLastPage(20, 20)).toBe(1);
    expect(getLastPage(21, 20)).toBe(2);
  });
});

describe("getTopicHeading", () => {
  it("uses the title, then the course name for untitled course threads", () => {
    expect(getTopicHeading({ title: "Onboarding", course: null }, t)).toBe("Onboarding");
    expect(getTopicHeading({ title: null, course: { id: "course-id", title: "Sales" } }, t)).toBe(
      "forum.topic.courseThreadTitle:Sales",
    );
  });
});

describe("forum permissions", () => {
  const learner = [
    PERMISSIONS.COURSE_DISCUSSION_READ,
    PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE,
    PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN,
  ];

  it("shows course threads only with discussions enabled and read access", () => {
    expect(canReadCourseThreads(learner, true)).toBe(true);
    expect(canReadCourseThreads(learner, false)).toBe(false);
    expect(canReadCourseThreads([], true)).toBe(false);
  });

  it("lets everyone reply to general topics but requires course access for course threads", () => {
    expect(canReplyInTopic(DISCUSSION_SCOPES.GENERAL, [])).toBe(true);
    expect(canReplyInTopic(DISCUSSION_SCOPES.COURSE, [])).toBe(false);
    expect(canReplyInTopic(DISCUSSION_SCOPES.COURSE, learner)).toBe(true);
  });

  it("lets authors delete their own posts and moderators delete any post", () => {
    const ownGeneralPost = {
      authorId: "user-1",
      currentUserId: "user-1",
      scope: DISCUSSION_SCOPES.GENERAL,
    };

    expect(canDeleteForumPost({ ...ownGeneralPost, permissions: [] })).toBe(true);
    expect(
      canDeleteForumPost({ ...ownGeneralPost, currentUserId: "user-2", permissions: [] }),
    ).toBe(false);
    expect(
      canDeleteForumPost({ ...ownGeneralPost, scope: DISCUSSION_SCOPES.COURSE, permissions: [] }),
    ).toBe(false);
    expect(
      canDeleteForumPost({
        ...ownGeneralPost,
        scope: DISCUSSION_SCOPES.COURSE,
        permissions: learner,
      }),
    ).toBe(true);
    expect(
      canDeleteForumPost({
        ...ownGeneralPost,
        currentUserId: "moderator",
        permissions: [PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE],
      }),
    ).toBe(true);
  });
});
