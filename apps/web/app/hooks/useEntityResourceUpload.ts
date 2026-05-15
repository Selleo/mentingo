import { ENTITY_TYPES, type EntityType, type SupportedLanguages } from "@repo/shared";
import { TextSelection } from "@tiptap/pm/state";
import { match } from "ts-pattern";

import { useLessonFileUpload } from "~/api/mutations/admin/useLessonFileUpload";
import { useUploadArticleFile } from "~/api/mutations/useUploadArticleFile";
import { useUploadNewsFile } from "~/api/mutations/useUploadNewsFile";
import { baseUrl } from "~/utils/baseUrl";

import type { Editor as TiptapEditor } from "@tiptap/react";

type UploadResourceArgs = {
  file: File;
  entityType: EntityType;
  entityId?: string;
  contextId?: string;
  language?: SupportedLanguages;
  title?: string;
  description?: string;
};

export const RICH_TEXT_RESOURCE_TYPE = {
  VIDEO: "video",
  PRESENTATION: "presentation",
  PDF: "pdf",
  DOCUMENT: "document",
  OTHER: "other",
} as const;

export type RichTextResourceType =
  (typeof RICH_TEXT_RESOURCE_TYPE)[keyof typeof RICH_TEXT_RESOURCE_TYPE];
export type RichTextResourceDisplayMode = "preview" | "download";

type InsertResourceArgs = {
  editor?: TiptapEditor | null;
  resourceId: string;
  entityType: EntityType;
  file: Pick<File, "name">;
  resourceType?: RichTextResourceType;
  displayMode?: RichTextResourceDisplayMode;
};

export const buildEntityResourceUrl = (resourceId: string, entityType: EntityType) => {
  switch (entityType) {
    case ENTITY_TYPES.LESSON:
      return `${baseUrl}/api/lesson/lesson-resource/${resourceId}`;
    case ENTITY_TYPES.ARTICLES:
      return `${baseUrl}/api/articles/articles-resource/${resourceId}`;
    case ENTITY_TYPES.NEWS:
      return `${baseUrl}/api/news/news-resource/${resourceId}`;
    default:
      return `${baseUrl}/api/lesson/lesson-resource/${resourceId}`;
  }
};

const insertContentIntoEditor = (
  editor: TiptapEditor | null | undefined,
  content: Parameters<TiptapEditor["commands"]["insertContentAt"]>[1],
) => {
  if (!editor) return;

  editor.chain().focus().insertContent(content).run();

  const { state, view } = editor;
  const clampedPos = Math.max(0, Math.min(state.selection.to, state.doc.content.size));
  const nextSelection = TextSelection.near(state.doc.resolve(clampedPos), 1);

  view.dispatch(state.tr.setSelection(nextSelection).scrollIntoView());
};

export const insertResourceIntoEditor = ({
  editor,
  resourceId,
  entityType,
  file,
  resourceType = "other",
  displayMode = "preview",
}: InsertResourceArgs) => {
  const resourceUrl = buildEntityResourceUrl(resourceId, entityType);

  if (resourceType === "video") {
    insertContentIntoEditor(editor, {
      type: "video",
      attrs: { src: resourceUrl, sourceType: "internal" },
    });
    return;
  }

  if (resourceType === "presentation") {
    if (displayMode === "download") {
      insertContentIntoEditor(editor, {
        type: "downloadableFile",
        attrs: {
          src: resourceUrl,
          name: file.name,
        },
      });
      return;
    }

    insertContentIntoEditor(editor, {
      type: "presentation",
      attrs: { src: resourceUrl, sourceType: "internal" },
    });
    return;
  }

  if (resourceType === "pdf") {
    if (displayMode === "preview") {
      insertContentIntoEditor(editor, {
        type: "pdfPreview",
        attrs: {
          src: resourceUrl,
          name: file.name,
        },
      });
      return;
    }

    insertContentIntoEditor(editor, {
      type: "downloadableFile",
      attrs: {
        src: resourceUrl,
        name: file.name,
      },
    });
    return;
  }

  if (resourceType === "document") {
    insertContentIntoEditor(editor, {
      type: "downloadableFile",
      attrs: {
        src: resourceUrl,
        name: file.name,
      },
    });
    return;
  }

  insertContentIntoEditor(
    editor,
    `<br /><a href="${resourceUrl}" data-resource-id="${resourceId}">${resourceUrl}</a>`,
  );
};

export const useEntityResourceUpload = () => {
  const { mutateAsync: uploadLessonFile } = useLessonFileUpload();
  const { mutateAsync: uploadArticleFile } = useUploadArticleFile();
  const { mutateAsync: uploadNewsFile } = useUploadNewsFile();

  const uploadResource = async ({
    file,
    entityType,
    entityId,
    contextId,
    language,
    title,
    description,
  }: UploadResourceArgs) => {
    const resolvedTitle = title ?? file.name;
    const resolvedDescription = description ?? file.name;

    if (!language) throw new Error("No language given");

    return match(entityType)
      .with(ENTITY_TYPES.LESSON, async () => {
        const response = await uploadLessonFile({
          file,
          lessonId: entityId,
          contextId,
          language,
          title: resolvedTitle,
          description: resolvedDescription,
        });
        return response.data.resourceId;
      })
      .with(ENTITY_TYPES.ARTICLES, async () => {
        if (!entityId) throw new Error("No entity id given");

        const response = await uploadArticleFile({
          id: entityId,
          file,
          language,
          title: resolvedTitle,
          description: resolvedDescription,
        });
        return response.data.resourceId;
      })
      .with(ENTITY_TYPES.NEWS, async () => {
        if (!entityId) throw new Error("No entity id given");

        const response = await uploadNewsFile({
          id: entityId,
          file,
          language,
          title: resolvedTitle,
          description: resolvedDescription,
        });
        return response.data.resourceId;
      })
      .otherwise(() => {
        throw new Error("Incorrect entity type");
      });
  };

  return { uploadResource };
};
