import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateBetaTextLesson } from "~/api/mutations/admin/useBetaCreateTextLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateTextLesson } from "~/api/mutations/admin/useUpdateTextLesson";
import {
  type Chapter,
  ContentTypes,
  type Lesson,
} from "~/modules/Admin/EditCourse/EditCourse.types";

import { textLessonFormSchema } from "../validators/useTextLessonFormSchema";

import type { TextLessonFormValues } from "../validators/useTextLessonFormSchema";
import type { SupportedLanguages } from "@repo/shared";

type TextLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setOpenChapter?: (chapterId: string) => void;
  language: SupportedLanguages;
};

export const useTextLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
  setOpenChapter,
  language,
}: TextLessonFormProps) => {
  const { mutateAsync: createTextBlock } = useCreateBetaTextLesson();
  const { mutateAsync: updateTextBlockItem } = useUpdateTextLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();
  const { t } = useTranslation();

  const form = useForm<TextLessonFormValues>({
    resolver: zodResolver(textLessonFormSchema(t)),
    defaultValues: {
      title: lessonToEdit?.title || "",
      description: lessonToEdit?.description || "",
      type: lessonToEdit?.type || "text",
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (lessonToEdit) {
      reset({
        title: lessonToEdit.title,
        description: lessonToEdit?.description,
        type: "text",
      });
    }
  }, [lessonToEdit, reset]);

  const onSubmit = async (values: TextLessonFormValues) => {
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
        await createTextBlock({
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
