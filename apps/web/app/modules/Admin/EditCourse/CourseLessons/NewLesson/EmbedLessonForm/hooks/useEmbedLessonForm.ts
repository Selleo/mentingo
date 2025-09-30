import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateEmbedLesson } from "~/api/mutations/admin/useCreateEmbedLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateEmbedLesson } from "~/api/mutations/admin/useUpdateEmbedLesson";
import { courseQueryOptions } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import { embedLessonFormSchema } from "../schemas/embedLessonForm.schema";

import type { EmbedLessonFormValues } from "../schemas/embedLessonForm.schema";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

type EmbedLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit?: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
};

export const useEmbedLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
}: EmbedLessonFormProps) => {
  const { t } = useTranslation();

  const { id: courseId } = useParams();

  const { mutateAsync: createLesson } = useCreateEmbedLesson();
  const { mutateAsync: updateLesson } = useUpdateEmbedLesson();
  const { mutateAsync: deleteLesson } = useDeleteLesson();

  const form = useForm<EmbedLessonFormValues>({
    resolver: zodResolver(embedLessonFormSchema(t)),
    defaultValues: {
      title: lessonToEdit?.title ?? "",
      type: "embed",
      resources: lessonToEdit?.lessonResources ?? [],
    },
    mode: "onChange",
  });

  const { reset } = form;

  useEffect(() => {
    if (lessonToEdit) reset();
  }, [lessonToEdit, reset]);

  const onSubmit = async (values: EmbedLessonFormValues) => {
    if (!chapterToEdit || !courseId) return;

    if (lessonToEdit) {
      await updateLesson({
        data: {
          ...values,
          lessonId: lessonToEdit.id,
          resources: values.resources || [],
        },
        lessonId: lessonToEdit.id,
        courseId: courseId,
      });
    } else {
      await createLesson({
        data: {
          ...values,
          chapterId: chapterToEdit.id,
          resources: values.resources || [],
        },
      });
    }

    setContentTypeToDisplay(ContentTypes.EMPTY);
    await queryClient.invalidateQueries(courseQueryOptions(courseId));
  };

  const onDelete = async () => {
    if (!chapterToEdit?.id || !lessonToEdit?.id || !courseId) return;

    await deleteLesson({ chapterId: chapterToEdit?.id, lessonId: lessonToEdit.id });
    await queryClient.invalidateQueries(courseQueryOptions(courseId));
    setContentTypeToDisplay(ContentTypes.EMPTY);
  };

  return { form, onSubmit, onDelete };
};
