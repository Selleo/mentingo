import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateBetaContentLesson } from "~/api/mutations/admin/useBetaCreateContentLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateContentLesson } from "~/api/mutations/admin/useUpdateContentLesson";
import {
  type Chapter,
  ContentTypes,
  type Lesson,
} from "~/modules/Admin/EditCourse/EditCourse.types";

import { contentLessonFormSchema } from "../validators/useContentLessonFormSchema";

import type { ContentLessonFormValues } from "../validators/useContentLessonFormSchema";
import type { SupportedLanguages } from "@repo/shared";

type ContentLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setOpenChapter?: (chapterId: string) => void;
  language: SupportedLanguages;
};

export const useContentLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
  setOpenChapter,
  language,
}: ContentLessonFormProps) => {
  const { mutateAsync: createContentLesson } = useCreateBetaContentLesson();
  const { mutateAsync: updateTextBlockItem } = useUpdateContentLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { t } = useTranslation();

  const form = useForm<ContentLessonFormValues>({
    resolver: zodResolver(contentLessonFormSchema(t)),
    defaultValues: {
      title: lessonToEdit?.title || "",
      description: lessonToEdit?.description || "",
      type: lessonToEdit?.type || "content",
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (lessonToEdit) {
      reset({
        title: lessonToEdit.title,
        description: lessonToEdit?.description,
        type: "content",
      });
    }
  }, [lessonToEdit, reset]);

  const onSubmit = async (values: ContentLessonFormValues) => {
    if (!chapterToEdit) return;

    try {
      if (lessonToEdit) {
        await updateTextBlockItem({
          data: {
            ...values,
            language,
          },
          lessonId: lessonToEdit.id,
        });
      } else {
        await createContentLesson({
          data: {
            ...values,
            chapterId: chapterToEdit.id,
          },
        });
        setOpenChapter && setOpenChapter(chapterToEdit.id);
      }

      setContentTypeToDisplay(ContentTypes.EMPTY);
    } catch (error) {
      console.error("Error creating text block:", error);
    }
  };

  const onDelete = async () => {
    if (!chapterToEdit?.id || !lessonToEdit?.id) {
      console.error("Course ID or Chapter ID is missing.");
      return;
    }

    try {
      await deleteLesson({ chapterId: chapterToEdit?.id, lessonId: lessonToEdit.id });
      setContentTypeToDisplay(ContentTypes.EMPTY);
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  };

  return { form, onSubmit, onDelete };
};
