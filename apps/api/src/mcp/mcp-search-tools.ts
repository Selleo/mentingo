import { PERMISSIONS, type PermissionKey } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { GLOBAL_SEARCH_MIN_QUERY_LENGTH } from "src/global-search/global-search.constants";
import { globalSearchQuerySchema } from "src/global-search/schemas/global-search.schema";

import { asMcpInputSchema } from "./mcp-tool.schema";

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

export const globalSearchInputSchema = Type.Object(
  {
    searchQuery: Type.String({ minLength: GLOBAL_SEARCH_MIN_QUERY_LENGTH, maxLength: 500 }),
    language: Type.Required(globalSearchQuerySchema).properties.language,
  },
  { additionalProperties: false },
);

export function registerMcpSearchTools(
  server: McpServer,
  run: McpToolRunner,
  searchService: GlobalSearchService,
) {
  server.registerTool(
    "global_search",
    {
      description:
        "Search Mentingo globally in an explicit language. Returns grouped matches with IDs for accessible courses, lessons, development paths, news, articles, Q&A, users, categories and groups. Results follow your current permissions and course access; this is the platform search, not a semantic/vector search.",
      inputSchema: asMcpInputSchema(globalSearchInputSchema),
      annotations: { readOnlyHint: true },
    },
    async ({ searchQuery, language }) =>
      run(MCP_GLOBAL_SEARCH_PERMISSIONS, async (user) =>
        searchService.search(searchQuery, language, user),
      ),
  );
}
