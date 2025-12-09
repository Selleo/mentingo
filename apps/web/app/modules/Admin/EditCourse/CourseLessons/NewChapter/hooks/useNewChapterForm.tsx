import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { useBetaCreateChapter } from "~/api/mutations/admin/useBetaCreateChapter";
import { useDeleteChapter } from "~/api/mutations/admin/useDeleteChapter";
import { useUpdateChapter } from "~/api/mutations/admin/useUpdateChapter";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";

import { type Chapter, ContentTypes } from "../../../EditCourse.types";
import { newChapterFormSchema } from "../validators/newChapterFormSchema";

import type { NewChapterFormValues } from "../validators/newChapterFormSchema";
import type { SupportedLanguages } from "@repo/shared";

type UseNewChapterFormProps = {
  courseId: string;
  chapter: Chapter | null;
  language: SupportedLanguages;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
};

export const useNewChapterForm = ({
  courseId,
  chapter,
  setContentTypeToDisplay,
  language,
}: UseNewChapterFormProps) => {
  const { mutateAsync: createChapter } = useBetaCreateChapter();
  const { mutateAsync: updateChapter } = useUpdateChapter();
  const { mutateAsync: deleteChapter } = useDeleteChapter();

  const form = useForm<NewChapterFormValues>({
    resolver: zodResolver(newChapterFormSchema),
    defaultValues: {
      title: chapter?.title || "",
    },
  });

  const { reset } = form;

  useEffect(() => {
    reset({
      title: chapter?.title || "",
    });
  }, [chapter, reset]);

  const onSubmit = async (data: NewChapterFormValues) => {
    try {
      if (chapter) {
        await updateChapter({ data: { ...data, language }, chapterId: chapter.id });
        queryClient.invalidateQueries({
          queryKey: [COURSE_QUERY_KEY, { id: courseId }],
        });
        setContentTypeToDisplay(ContentTypes.EMPTY);
      } else {
        await createChapter({
          data: { ...data, courseId },
        });
        queryClient.invalidateQueries({
          queryKey: [COURSE_QUERY_KEY, { id: courseId }],
        });
        setContentTypeToDisplay(ContentTypes.EMPTY);
      }
    } catch (error) {
      console.error("Error during chapter submission:", error);
    }
  };

  const onDelete = async () => {
    if (!courseId || !chapter?.id) {
      console.error("Course ID or Chapter ID is missing.");
      return;
    }

    try {
      await deleteChapter({ chapterId: chapter.id });
      setContentTypeToDisplay(ContentTypes.EMPTY);
      queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId }],
      });
    } catch (error) {
      console.error("Failed to delete chapter:", error);
    }
  };
  return { form, onSubmit, onDelete };
};
