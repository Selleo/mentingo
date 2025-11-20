import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { type Languages, SUPPORTED_LANGUAGES } from "@repo/shared";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateBetaTextLesson } from "~/api/mutations/admin/useBetaCreateTextLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateTextLesson } from "~/api/mutations/admin/useUpdateTextLesson";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import {
  type Chapter,
  ContentTypes,
  type Lesson,
} from "~/modules/Admin/EditCourse/EditCourse.types";

import { textLessonFormSchema } from "../validators/useTextLessonFormSchema";

import type { TextLessonFormValues } from "../validators/useTextLessonFormSchema";

type TextLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setOpenChapter?: (chapterId: string) => void;
};

export const useTextLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
  setOpenChapter,
}: TextLessonFormProps) => {
  const { id: courseId } = useParams();
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
          // @ts-expect-error - Need to be refactored
          data: { ...values, language: SUPPORTED_LANGUAGES.EN as Languages },
          lessonId: lessonToEdit.id,
        });
      } else {
        await createTextBlock({
          // @ts-expect-error - Need to be refactored
          data: {
            ...values,
            chapterId: chapterToEdit.id,
          },
        });
        setOpenChapter && setOpenChapter(chapterToEdit.id);
      }

      setContentTypeToDisplay(ContentTypes.EMPTY);
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
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
      queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId }],
      });
      setContentTypeToDisplay(ContentTypes.EMPTY);
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  };

  return { form, onSubmit, onDelete };
};
