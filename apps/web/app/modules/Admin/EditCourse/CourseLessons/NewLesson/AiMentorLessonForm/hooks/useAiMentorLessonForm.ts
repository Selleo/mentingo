import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { AI_MENTOR_TYPE } from "@repo/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAiMentorLesson } from "~/api/mutations/admin/useCreateAiMentorLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateAiMentorLesson } from "~/api/mutations/admin/useUpdateAiMentorLesson";
import { useUploadAiMentorAvatar } from "~/api/mutations/admin/useUploadAiMentorAvatar";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import {
  type SuggestionType,
  SUGGESTION_EXAMPLES,
} from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/utils/AiMentor.constants";
import {
  type Chapter,
  ContentTypes,
  type Lesson,
} from "~/modules/Admin/EditCourse/EditCourse.types";

import { aiMentorLessonFormSchema } from "../validators/useAiMentorLessonFormSchema";

import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { SupportedLanguages } from "@repo/shared";

type AiMentorLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setOpenChapter?: (chapterId: string) => void;
  language: SupportedLanguages;
};

export const useAiMentorLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
  setOpenChapter,
  language,
}: AiMentorLessonFormProps) => {
  const { id: courseId } = useParams();
  const { t } = useTranslation();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionType | null>(null);
  const { mutateAsync: createAiMentorLesson } = useCreateAiMentorLesson();
  const { mutateAsync: updateAiMentorLesson } = useUpdateAiMentorLesson();
  const { mutateAsync: deleteAiMentorLesson } = useDeleteLesson();
  const { mutateAsync: uploadAvatar } = useUploadAiMentorAvatar();

  const form = useForm<AiMentorLessonFormValues>({
    resolver: zodResolver(aiMentorLessonFormSchema(t)),
    defaultValues: {
      title: lessonToEdit?.title || "",
      aiMentorInstructions: lessonToEdit?.aiMentor?.aiMentorInstructions || "",
      completionConditions: lessonToEdit?.aiMentor?.completionConditions || "",
      type: lessonToEdit?.aiMentor?.type || AI_MENTOR_TYPE.MENTOR,
      name: lessonToEdit?.aiMentor?.name || "",
    },
  });

  const { reset, setValue, watch } = form;

  useEffect(() => {
    if (lessonToEdit) {
      reset({
        title: lessonToEdit.title,
        aiMentorInstructions: lessonToEdit.aiMentor?.aiMentorInstructions || "",
        completionConditions: lessonToEdit.aiMentor?.completionConditions || "",
        type: lessonToEdit.aiMentor?.type || AI_MENTOR_TYPE.MENTOR,
        name: lessonToEdit.aiMentor?.name || "",
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

  const onSubmit = async (values: AiMentorLessonFormValues, file?: File | null) => {
    if (!chapterToEdit) return;

    try {
      if (lessonToEdit) {
        await updateAiMentorLesson({
          data: { ...values, language },
          lessonId: lessonToEdit.id,
        });
        if (file !== undefined) {
          await uploadAvatar({ lessonId: lessonToEdit?.id, file });
        }
      } else {
        await createAiMentorLesson({
          data: { ...values, chapterId: chapterToEdit.id },
        });
        setOpenChapter && setOpenChapter(chapterToEdit.id);
      }

      setContentTypeToDisplay(ContentTypes.EMPTY);
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
      await queryClient.invalidateQueries({ queryKey: ["lesson", lessonToEdit?.id] });
      await queryClient.invalidateQueries({
        queryKey: ["threadMessages", { lessonId: lessonToEdit?.id }],
      });
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
