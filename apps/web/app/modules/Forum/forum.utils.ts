import { FORUM_TOPIC_SORTS, PERMISSIONS, type ForumTopicSort } from "@repo/shared";

import { hasPermission } from "~/common/permissions/permission.utils";

type Permissions = Parameters<typeof hasPermission>[0];

export const FORUM_SORT_URL_PARAM = "sort";

export const FORUM_COURSE_DISCUSSIONS_PATH = "/forum/courses";

export const getForumCourseDiscussionPath = (courseId: string) =>
  `${FORUM_COURSE_DISCUSSIONS_PATH}/${courseId}`;

export const parsePageParam = (value: string | null) => {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const parseSortParam = (value?: string | null): ForumTopicSort =>
  Object.values(FORUM_TOPIC_SORTS).find((sort) => sort === value) ??
  FORUM_TOPIC_SORTS.LAST_ACTIVITY;

export const getLastPage = (totalItems: number, perPage: number) =>
  Math.max(1, Math.ceil(totalItems / perPage));

export const canReadCourseDiscussions = (
  permissions: Permissions,
  courseDiscussionsEnabled = false,
) => courseDiscussionsEnabled && hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_READ);

export const canDeleteForumPost = ({
  authorId,
  currentUserId,
  permissions,
}: {
  authorId: string;
  currentUserId?: string;
  permissions: Permissions;
}) => authorId === currentUserId || hasPermission(permissions, PERMISSIONS.FORUM_POST_DELETE);

export const canDeleteCourseDiscussionMessage = ({
  authorId,
  currentUserId,
  permissions,
}: {
  authorId: string;
  currentUserId?: string;
  permissions: Permissions;
}) =>
  hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE) ||
  (authorId === currentUserId &&
    hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN));
