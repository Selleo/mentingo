import { BadRequestException } from "@nestjs/common";
import {
  RICH_TEXT_RESOURCE_DISPLAY_MODE,
  RICH_TEXT_RESOURCE_TYPE,
  classifyRichTextResourceType,
  type RichTextResourceDisplayMode,
} from "@repo/shared";
import { match } from "ts-pattern";

export const MCP_RESOURCE_DISPLAY_MODES = RICH_TEXT_RESOURCE_DISPLAY_MODE;
export type McpResourceDisplayMode = RichTextResourceDisplayMode;

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
  const resourceType = classifyRichTextResourceType(input.contentType);

  return match(resourceType)
    .with(RICH_TEXT_RESOURCE_TYPE.IMAGE, () => {
      if (input.displayMode !== RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW)
        throw new BadRequestException("Images support preview mode only");
      return `<div data-node-type="image" data-src="${url}" data-alt="${name}" data-resource-id="${input.resourceId}"></div>`;
    })
    .with(RICH_TEXT_RESOURCE_TYPE.VIDEO, () => {
      if (input.displayMode !== RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW)
        throw new BadRequestException("Videos support preview mode only");
      return `<div data-node-type="video" data-source-type="internal" data-provider="self" data-src="${url}"></div>`;
    })
    .with(RICH_TEXT_RESOURCE_TYPE.PRESENTATION, () =>
      input.displayMode === RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW
        ? `<div data-node-type="presentation" data-source-type="internal" data-provider="self" data-src="${url}"></div>`
        : `<div data-node-type="downloadable-file" data-src="${url}" data-name="${name}"></div>`,
    )
    .with(RICH_TEXT_RESOURCE_TYPE.PDF, () =>
      input.displayMode === RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW
        ? `<div data-node-type="pdf-preview" data-src="${url}" data-name="${name}"></div>`
        : `<div data-node-type="downloadable-file" data-src="${url}" data-name="${name}"></div>`,
    )
    .with(RICH_TEXT_RESOURCE_TYPE.DOCUMENT, () => {
      if (input.displayMode !== RICH_TEXT_RESOURCE_DISPLAY_MODE.DOWNLOAD)
        throw new BadRequestException("Documents support download mode only");
      return `<div data-node-type="downloadable-file" data-src="${url}" data-name="${name}"></div>`;
    })
    .with(RICH_TEXT_RESOURCE_TYPE.OTHER, () => {
      throw new BadRequestException("This resource type cannot be inserted into lesson content");
    })
    .exhaustive();
}
