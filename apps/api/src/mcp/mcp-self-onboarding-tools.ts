import { promptTemplates } from "@repo/prompts";
import { ASSISTANT_SOURCE_TYPES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import {
  helpdeskSearchRequestSchema,
  helpdeskTutorialKeySchema,
  helpdeskTutorialQuerySchema,
} from "src/self-onboarding/schemas/self-onboarding.schema";

import {
  MCP_HELPDESK_GUIDANCE_KIND,
  MCP_HELPDESK_TOOL_NAMES,
} from "./mcp-self-onboarding.constants";
import { asMcpInputSchema } from "./mcp-tool.schema";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpServer } from "@modelcontextprotocol/server";
import type { HelpdeskTutorialResponse } from "src/self-onboarding/schemas/self-onboarding.schema";
import type { HelpdeskService } from "src/self-onboarding/self-onboarding.service";

/** The origin is the bound authenticated tenant resource; external catalog data
 * contributes only validated stable identities, never a navigation origin. */
function tutorialUrl(resource: string, key: string, chapterId?: string): string {
  const url = new URL(`/helpdesk/tutorials/${encodeURIComponent(key)}`, new URL(resource).origin);
  if (chapterId) url.searchParams.set("chapter", chapterId);
  return url.href;
}

function linkedTutorial(tutorial: HelpdeskTutorialResponse, resource: string) {
  const guidance = {
    entityType: ASSISTANT_SOURCE_TYPES.HELPDESK,
    guidanceKind: MCP_HELPDESK_GUIDANCE_KIND,
    tutorialKey: tutorial.key,
  };
  return {
    ...tutorial,
    ...guidance,
    url: tutorialUrl(resource, tutorial.key),
    chapters: tutorial.chapters.map((chapter) => ({
      ...chapter,
      ...guidance,
      chapterId: chapter.id,
      url: tutorialUrl(resource, tutorial.key, chapter.id),
    })),
  };
}

/** Read-only tools share Core's server-derived version/features and authenticated
 * runner. They never send tenant URLs, actors or publishing credentials upstream. */
export function registerMcpHelpdeskTools(
  server: McpServer,
  run: McpToolRunner,
  helpdeskService: HelpdeskService,
  resource: string,
) {
  server.registerTool(
    MCP_HELPDESK_TOOL_NAMES.SEARCH,
    {
      description: promptTemplates.coreAssistantTutorialSearchTool.template.trim(),
      inputSchema: asMcpInputSchema(helpdeskSearchRequestSchema),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (input) =>
      run([], async () => {
        const response = await helpdeskService.search(input);
        return {
          mode: response.mode,
          guidanceKind: MCP_HELPDESK_GUIDANCE_KIND,
          results: response.results.map((hit) => {
            const chapter = hit.tutorial.chapters.find((item) => item.id === hit.chapterId);
            return {
              ...hit,
              tutorial: linkedTutorial(hit.tutorial, resource),
              tutorialKey: hit.tutorial.key,
              title: chapter ? `${hit.tutorial.title}: ${chapter.title}` : hit.tutorial.title,
              description: hit.excerpt,
              entityType: ASSISTANT_SOURCE_TYPES.HELPDESK,
              guidanceKind: MCP_HELPDESK_GUIDANCE_KIND,
              url: tutorialUrl(resource, hit.tutorial.key, hit.chapterId ?? undefined),
            };
          }),
        };
      }),
  );
  server.registerTool(
    MCP_HELPDESK_TOOL_NAMES.TUTORIAL,
    {
      description: promptTemplates.coreAssistantTutorialReadTool.template.trim(),
      inputSchema: asMcpInputSchema(
        Type.Object(
          { key: helpdeskTutorialKeySchema, ...helpdeskTutorialQuerySchema.properties },
          { additionalProperties: false },
        ),
      ),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ key, language }) =>
      run([], async () => ({
        guidanceKind: MCP_HELPDESK_GUIDANCE_KIND,
        tutorial: linkedTutorial(await helpdeskService.getTutorial(key, { language }), resource),
      })),
  );
}
