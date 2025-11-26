import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { useBetaCreateFileItem } from "~/api/mutations/admin/useBetaCreateFile";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateFileItem } from "~/api/mutations/admin/useUpdateFileItem";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { ContentTypes } from "~/modules/Admin/EditCourse/EditCourse.types";

import { fileLessonFormSchema } from "../validators/fileLessonFormSchema";

import type { LessonTypes } from "../../../CourseLessons.types";
import type { FileLessonFormValues } from "../validators/fileLessonFormSchema";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

type FileLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit?: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
};

export const useFileLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
}: FileLessonFormProps) => {
  const { id: courseId } = useParams();
  const { mutateAsync: createFile } = useBetaCreateFileItem();
  const { mutateAsync: updateFileItem } = useUpdateFileItem();
  const { mutateAsync: deleteLesson } = useDeleteLesson();

  const form = useForm<FileLessonFormValues>({
    resolver: zodResolver(fileLessonFormSchema),
    defaultValues: {
      title: lessonToEdit?.title ?? "",
      description: lessonToEdit?.description ?? "",
      type: (lessonToEdit?.type as LessonTypes) ?? "video",
      fileType: lessonToEdit?.fileType ?? "mp4",
      isExternal: lessonToEdit?.isExternal ?? false,
      fileS3Key: lessonToEdit?.fileS3Key ?? "",
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (lessonToEdit) {
      reset();
    }
  }, [lessonToEdit, reset]);

  const onSubmit = async (values: FileLessonFormValues) => {
    if (!chapterToEdit) {
      return;
    }

    try {
      if (lessonToEdit) {
        await updateFileItem({ data: { ...values }, fileLessonId: lessonToEdit.id });
        await queryClient.invalidateQueries({ queryKey: ["lesson", lessonToEdit.id] });
      } else {
        await createFile({
          data: { ...values, chapterId: chapterToEdit.id },
        });
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
      await queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId }],
      });
      setContentTypeToDisplay(ContentTypes.EMPTY);
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  };

  return { form, onSubmit, onDelete };
};
