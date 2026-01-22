import { ENTITY_TYPES, type EntityType, type SupportedLanguages } from "@repo/shared";
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

type InsertResourceArgs = {
  editor?: TiptapEditor | null;
  resourceId: string;
  entityType: EntityType;
  file: File;
  isPresentation?: boolean;
  isDocument?: boolean;
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

export const insertResourceIntoEditor = ({
  editor,
  resourceId,
  entityType,
  file,
  isPresentation = false,
  isDocument = false,
}: InsertResourceArgs) => {
  const resourceUrl = buildEntityResourceUrl(resourceId, entityType);
  const chain = editor?.chain().insertContent("<br />");

  if (isPresentation) {
    chain?.setPresentationEmbed({ src: resourceUrl, sourceType: "internal" }).run();
    return;
  }

  if (isDocument) {
    chain
      ?.setDownloadableFile({
        src: resourceUrl,
        name: file.name,
      })
      .run();
    return;
  }

  chain
    ?.insertContent(`<a href="${resourceUrl}" data-resource-id="${resourceId}">${resourceUrl}</a>`)
    .run();
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
