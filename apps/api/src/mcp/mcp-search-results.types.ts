import type { GlobalSearchResponse } from "src/global-search/schemas/global-search.schema";

/** Bound OAuth resource, validated by Core; never accepted from MCP tool arguments. */
export type McpSearchContext = {
  resource: string;
  searchOnly: boolean;
};

export type McpLinkedSearchResponse = {
  [K in keyof GlobalSearchResponse]: GlobalSearchResponse[K] extends Array<infer Item>
    ? Array<Item & { url: string }>
    : GlobalSearchResponse[K];
};

export type McpContentSearchResponse = Pick<
  McpLinkedSearchResponse,
  | "searchMode"
  | "semanticStatus"
  | "allCourses"
  | "myCourses"
  | "availableCourses"
  | "news"
  | "articles"
  | "qa"
>;
