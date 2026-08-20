import { AI_MENTOR_TTS_PRESET, AI_MENTOR_VOICE_MODE } from "@repo/shared";

import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { SupportedLanguages } from "@repo/shared";
import type { DefaultValues } from "react-hook-form";
import type { Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

export type LessonFormScope = {
  lessonId: string;
  language: SupportedLanguages;
};

export const getAiMentorLessonFormDefaultValues = (
  lessonToEdit: Lesson | null,
): DefaultValues<AiMentorLessonFormValues> => ({
  title: lessonToEdit?.title || "",
  description: lessonToEdit?.description || "",
  aiMentorConfiguration: undefined,
  aiJudgeConfiguration: undefined,
  name: lessonToEdit?.aiMentor?.name || "",
  voiceMode: lessonToEdit?.aiMentor?.voiceMode || AI_MENTOR_VOICE_MODE.PRESET,
  ttsPreset: lessonToEdit?.aiMentor?.ttsPreset || AI_MENTOR_TTS_PRESET.MALE,
  customTtsReference: lessonToEdit?.aiMentor?.customTtsReference || "",
});
