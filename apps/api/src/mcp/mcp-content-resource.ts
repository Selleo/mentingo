import { BadRequestException } from "@nestjs/common";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
} from "@repo/shared";

export const MCP_RESOURCE_DISPLAY_MODES = {
  PREVIEW: "preview",
  DOWNLOAD: "download",
} as const;

export type McpResourceDisplayMode =
  (typeof MCP_RESOURCE_DISPLAY_MODES)[keyof typeof MCP_RESOURCE_DISPLAY_MODES];

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** Match the HTML attributes used by the web Tiptap resource nodes. */
export function renderLessonResourceNode(input: {
  resourceId: string;
  contentType: string;
  name: string;
  displayMode: McpResourceDisplayMode;
}): string {
  const url = `/api/lesson/lesson-resource/${input.resourceId}`;
  const name = escapeAttribute(input.name);

  if (input.contentType.startsWith("image/")) {
    if (input.displayMode !== MCP_RESOURCE_DISPLAY_MODES.PREVIEW)
      throw new BadRequestException("Images support preview mode only");
    return `<div data-node-type="image" data-src="${url}" data-alt="${name}" data-resource-id="${input.resourceId}"></div>`;
  }

  if (input.contentType.startsWith("video/")) {
    if (input.displayMode !== MCP_RESOURCE_DISPLAY_MODES.PREVIEW)
      throw new BadRequestException("Videos support preview mode only");
    return `<div data-node-type="video" data-source-type="internal" data-provider="self" data-src="${url}"></div>`;
  }

  if (ALLOWED_PRESENTATION_FILE_TYPES.includes(input.contentType)) {
    return input.displayMode === MCP_RESOURCE_DISPLAY_MODES.PREVIEW
      ? `<div data-node-type="presentation" data-source-type="internal" data-provider="self" data-src="${url}"></div>`
      : `<div data-node-type="downloadable-file" data-src="${url}" data-name="${name}"></div>`;
  }

  if (input.contentType === "application/pdf") {
    return input.displayMode === MCP_RESOURCE_DISPLAY_MODES.PREVIEW
      ? `<div data-node-type="pdf-preview" data-src="${url}" data-name="${name}"></div>`
      : `<div data-node-type="downloadable-file" data-src="${url}" data-name="${name}"></div>`;
  }

  if (
    ALLOWED_WORD_FILE_TYPES.includes(input.contentType) ||
    ALLOWED_EXCEL_FILE_TYPES.includes(input.contentType)
  ) {
    if (input.displayMode !== MCP_RESOURCE_DISPLAY_MODES.DOWNLOAD)
      throw new BadRequestException("Documents support download mode only");
    return `<div data-node-type="downloadable-file" data-src="${url}" data-name="${name}"></div>`;
  }

  throw new BadRequestException("This resource type cannot be inserted into lesson content");
}
