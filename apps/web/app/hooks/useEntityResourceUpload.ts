import { ENTITY_TYPES } from "@repo/shared";
import { match } from "ts-pattern";

import { useLessonFileUpload } from "~/api/mutations/admin/useLessonFileUpload";
import { useUploadArticleFile } from "~/api/mutations/useUploadArticleFile";
import { useUploadNewsFile } from "~/api/mutations/useUploadNewsFile";

import type { UploadResourceArgs } from "~/components/RichText/utils/richTextResource.types";

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
