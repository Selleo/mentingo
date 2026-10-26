import type { SearchResponse } from "~/api/generated-api";

export type GlobalSearchResultNode = SearchResponse["data"]["results"][number];
export type GlobalSearchCourseNode = Extract<GlobalSearchResultNode, { type: "course" }>;
export type GlobalSearchLessonNode = GlobalSearchCourseNode["lessons"][number];
export type GlobalSearchLearningPathNode = Extract<
  GlobalSearchResultNode,
  { type: "learningPath" }
>;
export type GlobalSearchContentNode = Extract<
  GlobalSearchResultNode,
  { type: "news" | "article" | "qa" }
>;

export type GlobalSearchAdministrativeResults = Pick<
  SearchResponse["data"],
  "users" | "groups" | "categories"
>;
