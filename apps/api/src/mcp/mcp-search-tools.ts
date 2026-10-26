import { PERMISSIONS, type PermissionKey } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { GLOBAL_SEARCH_MIN_QUERY_LENGTH } from "src/global-search/global-search.constants";
import { globalSearchQuerySchema } from "src/global-search/schemas/global-search.schema";

import { shapeMcpSearchResults } from "./mcp-search-results";
import { MCP_STUDENT_SEARCH_PERMISSIONS } from "./mcp-student-access";
import { asMcpInputSchema } from "./mcp-tool.schema";

import type { McpSearchContext } from "./mcp-search-results.types";
import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";
import type { GlobalSearchService } from "src/global-search/global-search.service";

export const MCP_GLOBAL_SEARCH_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.COURSE_READ,
  PERMISSIONS.COURSE_READ_ASSIGNED,
  PERMISSIONS.COURSE_UPDATE,
  PERMISSIONS.COURSE_UPDATE_OWN,
  PERMISSIONS.LEARNING_PATH_READ,
  PERMISSIONS.NEWS_READ_PUBLIC,
  PERMISSIONS.NEWS_MANAGE,
  PERMISSIONS.NEWS_MANAGE_OWN,
  PERMISSIONS.ARTICLE_READ_PUBLIC,
  PERMISSIONS.ARTICLE_MANAGE,
  PERMISSIONS.ARTICLE_MANAGE_OWN,
  PERMISSIONS.QA_READ_PUBLIC,
  PERMISSIONS.QA_MANAGE,
  PERMISSIONS.QA_MANAGE_OWN,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.CATEGORY_READ,
  PERMISSIONS.CATEGORY_MANAGE,
  PERMISSIONS.GROUP_READ,
  PERMISSIONS.GROUP_MANAGE,
];

/** SEARCH scope excludes permission alternatives that only expose administrative directories. */
export const MCP_CONTENT_SEARCH_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.COURSE_READ,
  PERMISSIONS.COURSE_READ_ASSIGNED,
  PERMISSIONS.COURSE_UPDATE,
  PERMISSIONS.COURSE_UPDATE_OWN,
  PERMISSIONS.NEWS_READ_PUBLIC,
  PERMISSIONS.NEWS_MANAGE,
  PERMISSIONS.NEWS_MANAGE_OWN,
  PERMISSIONS.ARTICLE_READ_PUBLIC,
  PERMISSIONS.ARTICLE_MANAGE,
  PERMISSIONS.ARTICLE_MANAGE_OWN,
  PERMISSIONS.QA_READ_PUBLIC,
  PERMISSIONS.QA_MANAGE,
  PERMISSIONS.QA_MANAGE_OWN,
];

export const globalSearchInputSchema = Type.Object(
  {
    searchQuery: Type.String({ minLength: GLOBAL_SEARCH_MIN_QUERY_LENGTH, maxLength: 500 }),
    language: Type.Required(globalSearchQuerySchema).properties.language,
    mode: globalSearchQuerySchema.properties.mode,
  },
  { additionalProperties: false },
);

export function registerMcpSearchTools(
  server: McpServer,
  run: McpToolRunner,
  searchService: GlobalSearchService,
  context: McpSearchContext,
) {
  let permissions = MCP_GLOBAL_SEARCH_PERMISSIONS;
  if (context.searchOnly) permissions = MCP_CONTENT_SEARCH_PERMISSIONS;
  if (context.studentOnly) permissions = MCP_STUDENT_SEARCH_PERMISSIONS;
  let description =
    "Search Mentingo globally in an explicit language. Returns `results`, one relevance-ordered list of accessible learning content: courses with their matching lessons nested under `lessons` (each lesson carries its chapter title), plus development paths, news, articles and Q&A. A course with `matched: false` did not match itself and is included only as the parent of matching lessons. Users, categories and groups are listed separately and match by keyword only. Every item has an ID and a canonical tenant URL; `matchedPassage` and `matchedAttachmentFileName` explain why it matched. Order is the ranking; `relevanceScore` only compares items within one search and is not a confidence value. Choose keyword or hybrid mode; results follow your current permissions and course access.";
  if (context.includeLearnerLessons)
    description =
      "Search accessible courses, lessons, articles, news and Q&A using keyword or hybrid semantic search. Lesson results include lesson and course IDs plus a source link; call get_lesson with courseId, lessonId and language to read the content. chapterId is optional for get_lesson: omit it when absent from the result; never invent a chapter ID or use an all-zero placeholder. No chapter-listing call is needed for this lookup. Free public courses and your actively enrolled paid public or private courses only, including for administrators. Excludes drafts, archives, assessment answers, AI prompts and lesson files. Lesson results depend on the current text index.";
  else if (context.searchOnly)
    description =
      "Search accessible Mentingo course metadata, news, articles and Q&A in an explicit language. Returns grouped matches with IDs and canonical tenant URLs. Course lesson content is excluded. Choose keyword or hybrid mode; results follow your current permissions.";
  server.registerTool(
    "global_search",
    {
      description,
      inputSchema: asMcpInputSchema(globalSearchInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ searchQuery, language, mode }) =>
      run(permissions, async (user) => {
        let result;
        if (context.studentOnly) {
          result = await searchService.search(searchQuery, language, user, mode, {
            contentOnly: true,
            learnerOnly: true,
            ...(context.includeLearnerLessons ? { includeLearnerLessons: true } : {}),
          });
        } else if (mode) {
          result = await searchService.search(searchQuery, language, user, mode);
        } else {
          result = await searchService.search(searchQuery, language, user);
        }
        return shapeMcpSearchResults(result, context);
      }),
  );
}
