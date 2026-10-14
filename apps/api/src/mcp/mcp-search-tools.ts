import { PERMISSIONS, type PermissionKey } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { GLOBAL_SEARCH_MIN_QUERY_LENGTH } from "src/global-search/global-search.constants";
import { globalSearchQuerySchema } from "src/global-search/schemas/global-search.schema";

import { shapeMcpSearchResults } from "./mcp-search-results";
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
  const permissions = context.searchOnly
    ? MCP_CONTENT_SEARCH_PERMISSIONS
    : MCP_GLOBAL_SEARCH_PERMISSIONS;
  server.registerTool(
    "global_search",
    {
      description: context.searchOnly
        ? "Search accessible Mentingo course metadata, news, articles and Q&A in an explicit language. Returns grouped matches with IDs and canonical tenant URLs. Course lesson content is excluded. Choose keyword or hybrid mode; results follow your current permissions."
        : "Search Mentingo globally in an explicit language. Returns grouped matches with IDs and canonical tenant URLs for accessible courses, lessons, development paths, news, articles, Q&A, users, categories and groups. Choose keyword or hybrid mode; results follow your current permissions and course access.",
      inputSchema: asMcpInputSchema(globalSearchInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ searchQuery, language, mode }) =>
      run(permissions, async (user) => {
        const result = mode
          ? await searchService.search(searchQuery, language, user, mode)
          : await searchService.search(searchQuery, language, user);
        return shapeMcpSearchResults(result, context);
      }),
  );
}
