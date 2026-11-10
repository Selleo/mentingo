import type { DiscussionScope, ForumTopicSort, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

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
