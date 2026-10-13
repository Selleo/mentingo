import { BadRequestException } from "@nestjs/common";
import { ENTITY_TYPES, PERMISSIONS } from "@repo/shared";

import { asMcpInputSchema } from "./mcp-tool.schema";
import { requestGenericFileUploadInputSchema } from "./mcp-tool.schemas";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpUploadGrantService } from "./mcp-upload-grant.service";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerMcpGenericUploadTool(
  server: McpServer,
  run: McpToolRunner,
  uploads: McpUploadGrantService,
): void {
  server.registerTool(
    "request_generic_file_upload",
    {
      description:
        "Start a non-video content file upload. For articles/news supply resource='articles' or 'news', targetId and language. Send local bytes using the returned uploadRequest; the editorial HTTP response returns data.resourceId to insert into Tiptap content before update_article/update_news. For course/quiz images use resource='course' or 'lesson' without targetId/language; the HTTP response returns fileKey/fileUrl. Covers use request_editorial_cover_upload; videos use init_video_upload. The returned contentInsertion guidance explains the exact next step.",
      inputSchema: asMcpInputSchema(requestGenericFileUploadInputSchema),
    },
    async ({ resource, targetId, language, filename, mimeType, size }) => {
      if (resource === ENTITY_TYPES.ARTICLES || resource === ENTITY_TYPES.NEWS) {
        const permissions =
          resource === ENTITY_TYPES.ARTICLES
            ? [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN]
            : [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN];
        return run(permissions, async (user) => {
          if (!targetId || !language)
            throw new BadRequestException("Articles/news uploads require targetId and language");
          return uploads.issueEditorialGrant(user, {
            targetType: resource,
            targetId,
            language,
            filename,
            mimeType,
            size,
          });
        });
      }
      return run([PERMISSIONS.FILE_UPLOAD], async (user) => {
        if (targetId !== undefined || language !== undefined)
          throw new BadRequestException(
            "Course/quiz generic uploads do not take targetId or language; use request_authoring_upload for existing lesson resources",
          );
        return uploads.issueGenericFileGrant(user, { resource, filename, mimeType, size });
      });
    },
  );
}
