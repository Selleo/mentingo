import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAiMentorLesson } from "~/api/mutations/admin/useCreateAiMentorLesson";
import { useDeleteLesson } from "~/api/mutations/admin/useDeleteLesson";
import { useUpdateAiMentorLesson } from "~/api/mutations/admin/useUpdateAiMentorLesson";
import { useUploadAiMentorAvatar } from "~/api/mutations/admin/useUploadAiMentorAvatar";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import {
  type Chapter,
  ContentTypes,
  type Lesson,
} from "~/modules/Admin/EditCourse/EditCourse.types";

import { mapAiJudgeConfigurationDraftToBaseInput } from "../AiJudge/aiJudgeConfiguration.mappers";
import { mapAiMentorConfigurationDraftToBaseInput } from "../AiMentorConfiguration/aiMentorConfiguration.mappers";
import { aiMentorLessonFormSchema } from "../validators/useAiMentorLessonFormSchema";

import {
  getAiMentorLessonFormDefaultValues,
  type LessonFormScope,
} from "./useAiMentorLessonForm.helpers";

import type { AiJudgeConfigurationDraft } from "../AiJudge/aiJudgeConfiguration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";
import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { SupportedLanguages } from "@repo/shared";

type AiMentorLessonFormProps = {
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  setOpenChapter?: (chapterId: string) => void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  onSaveStagedAiMentorConfiguration?: (configuration: AiMentorConfigurationDraft) => Promise<void>;
  onSaveStagedAiJudgeConfiguration?: (configuration: AiJudgeConfigurationDraft) => Promise<void>;
};

export const useAiMentorLessonForm = ({
  chapterToEdit,
  lessonToEdit,
  setContentTypeToDisplay,
  setOpenChapter,
  language,
  baseLanguage,
  onSaveStagedAiMentorConfiguration,
  onSaveStagedAiJudgeConfiguration,
}: AiMentorLessonFormProps) => {
  const { id: courseId } = useParams();
  const { t } = useTranslation();
  const { mutateAsync: createAiMentorLesson } = useCreateAiMentorLesson();
  const { mutateAsync: updateAiMentorLesson } = useUpdateAiMentorLesson();
  const { mutateAsync: deleteAiMentorLesson } = useDeleteLesson();
  const { mutateAsync: uploadAvatar } = useUploadAiMentorAvatar();
  const lessonFormScopeRef = useRef<LessonFormScope | null>(null);

  const form = useForm<AiMentorLessonFormValues>({
    resolver: zodResolver(aiMentorLessonFormSchema(t, !lessonToEdit)),
    defaultValues: getAiMentorLessonFormDefaultValues(lessonToEdit),
  });

  const { register, reset } = form;
  register("aiMentorConfiguration");
  register("aiJudgeConfiguration");

  useEffect(() => {
    if (!lessonToEdit) return;

    const nextScope = { lessonId: lessonToEdit.id, language };
    const shouldKeepDirtyValues =
      lessonFormScopeRef.current?.lessonId === nextScope.lessonId &&
      lessonFormScopeRef.current.language === nextScope.language;

    reset(
      getAiMentorLessonFormDefaultValues(lessonToEdit),
      shouldKeepDirtyValues ? { keepDirtyValues: true } : undefined,
    );
    lessonFormScopeRef.current = nextScope;
  }, [language, lessonToEdit, reset]);

  const onSubmit = async (values: AiMentorLessonFormValues, file?: File | null) => {
    if (!chapterToEdit) return;

    const { aiJudgeConfiguration, aiMentorConfiguration, ...lessonValues } = values;

    const normalizedVoiceValues = {
      voiceMode: lessonValues.voiceMode,
      ttsPreset: lessonValues.ttsPreset,
      customTtsReference: lessonValues.customTtsReference?.trim() || null,
    };

    try {
      if (lessonToEdit) {
        await updateAiMentorLesson({
          data: { ...lessonValues, ...normalizedVoiceValues, language },
          lessonId: lessonToEdit.id,
        });

        if (
          aiMentorConfiguration &&
          form.formState.dirtyFields.aiMentorConfiguration &&
          language === baseLanguage &&
          onSaveStagedAiMentorConfiguration
        ) {
          await onSaveStagedAiMentorConfiguration(aiMentorConfiguration);
        }

        if (
          aiJudgeConfiguration &&
          form.formState.dirtyFields.aiJudgeConfiguration &&
          language === baseLanguage &&
          onSaveStagedAiJudgeConfiguration
        ) {
          await onSaveStagedAiJudgeConfiguration(aiJudgeConfiguration);
        }

        if (file !== undefined) {
          await uploadAvatar({ lessonId: lessonToEdit?.id, file });
        }
      } else {
        if (!aiMentorConfiguration || !aiJudgeConfiguration) return;

        await createAiMentorLesson({
          data: {
            ...lessonValues,
            ...normalizedVoiceValues,
            chapterId: chapterToEdit.id,
            aiMentorConfiguration: mapAiMentorConfigurationDraftToBaseInput(aiMentorConfiguration),
            aiJudgeConfiguration: mapAiJudgeConfigurationDraftToBaseInput(aiJudgeConfiguration),
          },
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
  };
};
