import type { DiscussionScope, ForumTopicSort, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { DeleteForumPostResponse } from "src/forum/schemas/forum.schema";

export type ForumPostDeletion = Pick<
  DeleteForumPostResponse,
  "removed" | "deletedAt" | "topicRemoved"
>;

export type ForumTopicListQuery = {
  page: number;
  perPage: number;
  sort: ForumTopicSort;
  search?: string;
  scope?: DiscussionScope;
  courseId?: UUIDType;
  language: SupportedLanguages;
};

export type ForumTopicVisibility = {
  viewerUserId: UUIDType;
  includeCourseThreads: boolean;
};

export type ForumViewer = Pick<CurrentUserType, "userId" | "permissions">;
