import type { ForumTopicSort, SupportedLanguages } from "@repo/shared";

export type ForumTopicListQuery = {
  page: number;
  perPage: number;
  sort: ForumTopicSort;
  search?: string;
};

export type ForumCourseDiscussionListQuery = {
  page: number;
  perPage: number;
  search?: string;
  language: SupportedLanguages;
};
