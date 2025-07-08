import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAiMentorLesson } from "~/api/mutations/admin/useCreateAiMentorLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateAiMentorLesson } from "~/api/mutations/admin/useUpdateAiMentorLesson";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import {
  type SuggestionType,
  SUGGESTION_EXAMPLES,
} from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/utils/AiMentor.helper";
import {
  type Chapter,
  ContentTypes,
  type Lesson,
} from "~/modules/Admin/EditCourse/EditCourse.types";

import { aiMentorLessonFormSchema } from "../validators/useAiMentorLessonFormSchema";

import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";

type AiMentorLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setOpenChapter?: (chapterId: string) => void;
};

export const useAiMentorLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
  setOpenChapter,
}: AiMentorLessonFormProps) => {
  const { id: courseId } = useParams();
  const { t } = useTranslation();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionType | null>(null);
  const { mutateAsync: createAiMentorLesson } = useCreateAiMentorLesson();
  const { mutateAsync: updateAiMentorLesson } = useUpdateAiMentorLesson();
  const { mutateAsync: deleteAiMentorLesson } = useDeleteLesson();
  const form = useForm<AiMentorLessonFormValues>({
    resolver: zodResolver(aiMentorLessonFormSchema(t)),
    defaultValues: {
      title: lessonToEdit?.title || "",
      aiMentorInstructions: lessonToEdit?.aiMentor?.aiMentorInstructions || "",
      completionConditions: lessonToEdit?.aiMentor?.completionConditions || "",
    },
  });

  const { reset, setValue, watch } = form;

  useEffect(() => {
    if (lessonToEdit) {
      reset({
        title: lessonToEdit.title,
        aiMentorInstructions: lessonToEdit?.aiMentor?.aiMentorInstructions || "",
        completionConditions: lessonToEdit?.aiMentor?.completionConditions || "",
      });
    }
  }, [lessonToEdit, reset]);

  const handleSuggestionClick = (suggestionType: SuggestionType) => {
    const currentInstructions = watch("aiMentorInstructions");
    const currentConditions = watch("completionConditions");

    const hasContent =
      (currentInstructions && currentInstructions.trim() !== "") ||
      (currentConditions && currentConditions.trim() !== "");

    if (hasContent) {
      setSelectedSuggestion(suggestionType);
      setIsConfirmDialogOpen(true);
    } else {
      applySuggestion(suggestionType);
    }
  };

  const applySuggestion = (suggestionType: SuggestionType) => {
    const suggestion = SUGGESTION_EXAMPLES[suggestionType];
    setValue("aiMentorInstructions", t(suggestion.instructions));
    setValue("completionConditions", t(suggestion.conditions));
    setIsConfirmDialogOpen(false);
    setSelectedSuggestion(null);
  };

  const onConfirmOverwrite = () => {
    if (selectedSuggestion) {
      applySuggestion(selectedSuggestion);
    }
  };

  const onCancelOverwrite = () => {
    setIsConfirmDialogOpen(false);
    setSelectedSuggestion(null);
  };

  const onSubmit = async (values: AiMentorLessonFormValues) => {
    if (!chapterToEdit) return;

    try {
      if (lessonToEdit) {
        await updateAiMentorLesson({
          data: { ...values },
          lessonId: lessonToEdit.id,
        });
      } else {
        await createAiMentorLesson({
          data: { ...values, chapterId: chapterToEdit.id },
        });
        setOpenChapter && setOpenChapter(chapterToEdit.id);
      }

      setContentTypeToDisplay(ContentTypes.EMPTY);
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
    } catch (error) {
      console.error("Error creating/updating AI Mentor lesson:", error);
    }
  };

  const onDelete = async () => {
    if (!chapterToEdit?.id || !lessonToEdit?.id) {
      console.error("Course ID or Chapter ID is missing.");
      return;
    }

    try {
      await deleteAiMentorLesson({ chapterId: chapterToEdit?.id, lessonId: lessonToEdit.id });
      await queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId }],
      });
      setContentTypeToDisplay(ContentTypes.EMPTY);
    } catch (error) {
      console.error("Failed to delete AI Mentor lesson:", error);
    }
  };

  return {
    form,
    onSubmit,
    onDelete,
    handleSuggestionClick,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    onConfirmOverwrite,
    onCancelOverwrite,
    selectedSuggestion,
  };
};
