import type {
  GlobalSearchCourseResultNode,
  GlobalSearchLessonResultNode,
  GlobalSearchResult,
  GlobalSearchResultNode,
} from "src/global-search/schemas/global-search.schema";

/** Bound OAuth resource, validated by Core; never accepted from MCP tool arguments. */
export type McpSearchContext = {
  resource: string;
  searchOnly: boolean;
  studentOnly?: boolean;
  includeLearnerLessons?: boolean;
};

type Linked<T> = T & { url: string };

/** Per-type lists with canonical URLs, used by the restricted content and learner projections. */
type McpLinkedSearchLists = {
  [K in keyof GlobalSearchResult]: GlobalSearchResult[K] extends Array<infer Item>
    ? Array<Linked<Item>>
    : GlobalSearchResult[K];
};

/** A result tree node with canonical URLs on the node and on every nested lesson. */
export type McpLinkedResultNode =
  | Linked<
      Omit<GlobalSearchCourseResultNode, "lessons"> & {
        lessons: Array<Linked<GlobalSearchLessonResultNode>>;
      }
    >
  | Linked<Exclude<GlobalSearchResultNode, GlobalSearchCourseResultNode>>;

/** Authoring output: the ranked result tree plus keyword-only administrative lists. */
export type McpLinkedSearchResponse = Pick<GlobalSearchResult, "searchMode" | "semanticStatus"> & {
  results: McpLinkedResultNode[];
} & Pick<McpLinkedSearchLists, "users" | "categories" | "groups">;

export type McpContentSearchResponse = Pick<
  McpLinkedSearchLists,
  | "searchMode"
  | "semanticStatus"
  | "allCourses"
  | "myCourses"
  | "availableCourses"
  | "news"
  | "articles"
  | "qa"
>;

export type McpLearnerContentSearchResponse = McpContentSearchResponse & {
  lessons: Array<
    Pick<GlobalSearchResult["lessons"][number], "id" | "title" | "courseId"> & {
      matchedPassage?: string;
      url: string;
    }
  >;
};
