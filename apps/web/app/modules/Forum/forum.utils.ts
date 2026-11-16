import {
  DISCUSSION_SCOPES,
  FORUM_TOPIC_SORTS,
  PERMISSIONS,
  type DiscussionScope,
  type ForumTopicSort,
} from "@repo/shared";
import { match } from "ts-pattern";

import { hasPermission } from "~/common/permissions/permission.utils";

import type { TFunction } from "i18next";
import type { ForumTopic } from "~/api/queries/forum/forumTypes";
import type { ForumTopicsQuery } from "~/api/queries/forum/useForumTopics";

type Permissions = Parameters<typeof hasPermission>[0];

export const FORUM_FILTERS = {
  ALL: "all",
  GENERAL: "general",
} as const;

export const FORUM_URL_PARAMS = {
  FILTER: "filter",
  SORT: "sort",
} as const;

export const parsePageParam = (value: string | null) => {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const parseSortParam = (value?: string | null): ForumTopicSort =>
  Object.values(FORUM_TOPIC_SORTS).find((sort) => sort === value) ??
  FORUM_TOPIC_SORTS.LAST_ACTIVITY;

export const isForumTopicFilter = (value: string, courseIds: readonly string[]) =>
  Object.values<string>(FORUM_FILTERS).includes(value) || courseIds.includes(value);

/** Values other than the fixed filters are course ids. */
export const toTopicFilterQuery = (filter: string): Pick<ForumTopicsQuery, "scope" | "courseId"> =>
  match(filter)
    .with(FORUM_FILTERS.ALL, () => ({}))
    .with(FORUM_FILTERS.GENERAL, () => ({ scope: DISCUSSION_SCOPES.GENERAL }))
    .otherwise((courseId) => ({ scope: DISCUSSION_SCOPES.COURSE, courseId }));

export const getLastPage = (totalItems: number, perPage: number) =>
  Math.max(1, Math.ceil(totalItems / perPage));

export const getTopicHeading = (topic: Pick<ForumTopic, "title" | "course">, t: TFunction) => {
  if (topic.title) return topic.title;
  if (topic.course) return t("forum.topic.courseThreadTitle", { course: topic.course.title });

  return t("forum.title");
};

export const canReadCourseThreads = (permissions: Permissions, courseDiscussionsEnabled = false) =>
  courseDiscussionsEnabled && hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_READ);

export const canReplyInTopic = (scope: DiscussionScope, permissions: Permissions) =>
  hasPermission(permissions, PERMISSIONS.FORUM_POST_CREATE) &&
  (scope === DISCUSSION_SCOPES.GENERAL ||
    hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE));

export const canDeleteForumPost = ({
  authorId,
  currentUserId,
  scope,
  permissions,
}: {
  authorId: string;
  currentUserId?: string;
  scope: DiscussionScope;
  permissions: Permissions;
}) => {
  const deleteAnyPostPermission =
    scope === DISCUSSION_SCOPES.GENERAL
      ? PERMISSIONS.FORUM_POST_DELETE
      : PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE;

  if (hasPermission(permissions, deleteAnyPostPermission)) return true;
  if (authorId !== currentUserId) return false;

  return (
    scope === DISCUSSION_SCOPES.GENERAL ||
    hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN)
  );
};
