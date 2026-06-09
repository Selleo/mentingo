import { match } from "ts-pattern";

import { buildEntityResourceUrl } from "~/components/RichText/utils/buildEntityResourceUrl";
import { insertContentIntoEditor } from "~/components/RichText/utils/insertContentIntoEditor";
import {
  RICH_TEXT_RESOURCE_DISPLAY_MODE,
  RICH_TEXT_RESOURCE_TYPE,
  type InsertResourceArgs,
} from "~/components/RichText/utils/richTextResource.types";

const RICH_TEXT_EMBED_NODE_TYPE = {
  DOWNLOADABLE_FILE: "downloadableFile",
  PDF_PREVIEW: "pdfPreview",
} as const;

export const insertResourceIntoEditor = ({
  editor,
  resourceId,
  entityType,
  file,
  resourceType = RICH_TEXT_RESOURCE_TYPE.OTHER,
  displayMode = RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW,
}: InsertResourceArgs) => {
  const resourceUrl = buildEntityResourceUrl(resourceId, entityType);

  return match(resourceType)
    .with(RICH_TEXT_RESOURCE_TYPE.IMAGE, () =>
      insertContentIntoEditor(editor, {
        type: RICH_TEXT_RESOURCE_TYPE.IMAGE,
        attrs: {
          src: resourceUrl,
          alt: file.name,
          resourceId,
        },
      }),
    )
    .with(RICH_TEXT_RESOURCE_TYPE.VIDEO, () =>
      insertContentIntoEditor(editor, {
        type: RICH_TEXT_RESOURCE_TYPE.VIDEO,
        attrs: { src: resourceUrl, sourceType: "internal" },
      }),
    )
    .with(RICH_TEXT_RESOURCE_TYPE.PRESENTATION, () =>
      match(displayMode)
        .with(RICH_TEXT_RESOURCE_DISPLAY_MODE.DOWNLOAD, () =>
          insertContentIntoEditor(editor, {
            type: RICH_TEXT_EMBED_NODE_TYPE.DOWNLOADABLE_FILE,
            attrs: {
              src: resourceUrl,
              name: file.name,
            },
          }),
        )
        .otherwise(() =>
          insertContentIntoEditor(editor, {
            type: RICH_TEXT_RESOURCE_TYPE.PRESENTATION,
            attrs: { src: resourceUrl, sourceType: "internal" },
          }),
        ),
    )
    .with(RICH_TEXT_RESOURCE_TYPE.PDF, () =>
      match(displayMode)
        .with(RICH_TEXT_RESOURCE_DISPLAY_MODE.PREVIEW, () =>
          insertContentIntoEditor(editor, {
            type: RICH_TEXT_EMBED_NODE_TYPE.PDF_PREVIEW,
            attrs: {
              src: resourceUrl,
              name: file.name,
            },
          }),
        )
        .otherwise(() =>
          insertContentIntoEditor(editor, {
            type: RICH_TEXT_EMBED_NODE_TYPE.DOWNLOADABLE_FILE,
            attrs: {
              src: resourceUrl,
              name: file.name,
            },
          }),
        ),
    )
    .with(RICH_TEXT_RESOURCE_TYPE.DOCUMENT, () =>
      insertContentIntoEditor(editor, {
        type: RICH_TEXT_EMBED_NODE_TYPE.DOWNLOADABLE_FILE,
        attrs: {
          src: resourceUrl,
          name: file.name,
        },
      }),
    )
    .otherwise(() =>
      insertContentIntoEditor(
        editor,
        `<br /><a href="${resourceUrl}" data-resource-id="${resourceId}">${resourceUrl}</a>`,
      ),
    );
};
