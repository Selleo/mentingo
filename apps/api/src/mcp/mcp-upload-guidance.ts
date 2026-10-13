import {
  ENTITY_TYPES,
  RICH_TEXT_RESOURCE_DISPLAY_MODE,
  RICH_TEXT_RESOURCE_TYPE,
  classifyRichTextResourceType,
} from "@repo/shared";

import { renderLessonResourceNode } from "./mcp-content-resource";

export const MCP_UPLOAD_INSTRUCTIONS_SERVER = [
  "Use request_generic_file_upload as the common entry point for local non-video files: resource, filename, mimeType and exact size in bytes are required. For resource=articles or resource=news also pass the existing targetId and supported language. Those uploads use the native editorial resource workflow; do not upload editorial content through raw /api/file or use a fileKey as a resource ID.",
  "Send local file bytes once using the returned uploadRequest.url, method, Authorization header, fileField and every fields value as multipart/form-data. Let the client supply the multipart boundary. Grants are short-lived, tenant-bound and one-use; request a fresh grant after an upload attempt fails. Never replace the host or send the MCP OAuth token to the upload URL.",
  "For articles/news take data.resourceId from the upload HTTP response, replace {resourceId} in contentInsertion templates with that real ID, read get_article/get_news for the latest content and revision, then call update_article/update_news with the preserved full content plus the resource node and expectedRevision. Use durable /api/articles/articles-resource/{resourceId} or /api/news/news-resource/{resourceId} URLs, not signed storage URLs. Uploading alone does not insert the node into rich content.",
  "For existing lesson content use request_authoring_upload with targetType=lesson, targetId=lessonId, language, filename, mimeType and size; upload, read get_lesson, and call insert_lesson_resource with data.resourceId, courseId, chapterId, lessonId, language, displayMode and expectedRevision.",
  "Raw generic course/lesson uploads return top-level fileKey and fileUrl, not data.resourceId. For create_course pass fileKey as thumbnailS3Key. Native quiz photoS3Key also expects a file key, but current MCP quiz tools do not expose photoS3Key. Raw generic uploads are not automatically attached to rich content.",
  "For localized article/news cover images use request_editorial_cover_upload; its native multipart PATCH includes cover file and translations and applies the cover directly. For videos use init_video_upload and the returned TUS instructions and completion/status flow; never send multipart data to a TUS URL.",
].join("\n");

/** Follow-up metadata describes native response shapes; it never invents a resource ID. */
export function buildMcpUploadFollowUp(
  input: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const resource = input.resource ?? input.targetType;
  if (
    resource !== ENTITY_TYPES.ARTICLES &&
    resource !== ENTITY_TYPES.NEWS &&
    resource !== ENTITY_TYPES.LESSON &&
    resource !== ENTITY_TYPES.COURSE
  )
    return undefined;

  const editorial = resource === ENTITY_TYPES.ARTICLES || resource === ENTITY_TYPES.NEWS;
  if (editorial && Array.isArray(input.translations)) {
    return {
      purpose: "localizedCover",
      appliedByNativeUpload: true,
      instructions:
        "Send the cover file and the exact translations fields in uploadRequest. The native PATCH applies the cover; do not insert the cover into rich content unless separately requested. Read the matching get tool before any subsequent update to obtain a fresh revision.",
      needsFreshRevision: true,
    };
  }

  if (input.transport === "tus") {
    return {
      purpose: "video",
      transport: "tus",
      instructions:
        "Use the returned TUS URL, headers and metadata for file bytes. Do not send multipart data. Complete the native upload flow and check get_video_upload_status before placing the video in content.",
      nextTool: "get_video_upload_status",
    };
  }

  if (input.resource === ENTITY_TYPES.COURSE || input.resource === ENTITY_TYPES.LESSON) {
    return {
      purpose: "rawGenericFile",
      fileKeySource: "fileKey",
      fileUrlSource: "fileUrl",
      resourceIdSource: null,
      courseThumbnailInput: { tool: "create_course", field: "thumbnailS3Key", source: "fileKey" },
      quizImageInput: { nativeField: "photoS3Key", availableThroughMcp: false },
      instructions:
        "The raw /api/file response contains top-level fileKey and fileUrl, not data.resourceId. For create_course use fileKey as thumbnailS3Key. Native quiz photoS3Key also takes a file key, but current MCP quiz tools do not expose that field. For insertion into existing lesson rich content, request_authoring_upload and insert_lesson_resource are required instead.",
    };
  }

  if (!editorial && resource === ENTITY_TYPES.COURSE) return undefined;
  const contentType = typeof input.mimeType === "string" ? input.mimeType : "";
  const resourceType = classifyRichTextResourceType(contentType);
  const displayModes = (() => {
    switch (resourceType) {
      case RICH_TEXT_RESOURCE_TYPE.IMAGE:
      case RICH_TEXT_RESOURCE_TYPE.VIDEO:
        return [RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW];
      case RICH_TEXT_RESOURCE_TYPE.PDF:
      case RICH_TEXT_RESOURCE_TYPE.PRESENTATION:
        return [RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW, RICH_TEXT_RESOURCE_DISPLAY_MODE.DOWNLOAD];
      case RICH_TEXT_RESOURCE_TYPE.DOCUMENT:
        return [RICH_TEXT_RESOURCE_DISPLAY_MODE.DOWNLOAD];
      default:
        return [];
    }
  })();

  if (!editorial) {
    return {
      purpose: "lessonContent",
      resourceIdSource: "data.resourceId",
      nextTool: "insert_lesson_resource",
      needsFreshRevision: true,
      revisionTool: "get_lesson",
      displayModes,
      instructions:
        "After the HTTP upload succeeds, read get_lesson for the current revision and call insert_lesson_resource with the actual data.resourceId plus courseId, chapterId, the same lessonId and language, displayMode, and expectedRevision. Uploading alone does not insert the file in the lesson body.",
    };
  }

  const resourceUrlTemplate = `/api/${resource}/${resource}-resource/{resourceId}`;
  const filename = typeof input.filename === "string" ? input.filename : "Uploaded file";
  const htmlTemplates = Object.fromEntries(
    displayModes.map((displayMode) => [
      displayMode,
      renderLessonResourceNode({
        resourceId: "{resourceId}",
        contentType,
        name: filename,
        displayMode,
      }).replace("/api/lesson/lesson-resource/{resourceId}", resourceUrlTemplate),
    ]),
  );
  const article = resource === ENTITY_TYPES.ARTICLES;
  return {
    purpose: "editorialContent",
    resourceIdSource: "data.resourceId",
    resourceUrlTemplate,
    htmlTemplates,
    displayModes,
    nextTool: article ? "update_article" : "update_news",
    revisionTool: article ? "get_article" : "get_news",
    needsFreshRevision: true,
    targetId: input.targetId,
    language: input.language,
    instructions:
      "Replace every {resourceId} placeholder with the real data.resourceId from the upload HTTP response. Read the matching get tool to obtain current content and revision, preserve the entire existing body, insert the chosen HTML node, then update that same item and language with full content and expectedRevision. Do not use a temporary signed URL, raw fileKey, or placeholder ID in persisted content.",
  };
}
