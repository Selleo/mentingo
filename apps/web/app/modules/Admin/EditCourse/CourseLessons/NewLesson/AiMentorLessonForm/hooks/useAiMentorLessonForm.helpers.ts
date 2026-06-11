import { AI_MENTOR_TTS_PRESET, AI_MENTOR_TYPE, AI_MENTOR_VOICE_MODE } from "@repo/shared";

import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { SupportedLanguages } from "@repo/shared";
import type { Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

export type LessonFormScope = {
  lessonId: string;
  language: SupportedLanguages;
};

export const getAiMentorLessonFormDefaultValues = (
  lessonToEdit: Lesson | null,
): AiMentorLessonFormValues => ({
  title: lessonToEdit?.title || "",
  description: lessonToEdit?.description || "",
  aiMentorInstructions: lessonToEdit?.aiMentor?.aiMentorInstructions || "",
  completionConditions: lessonToEdit?.aiMentor?.completionConditions || "",
  type: lessonToEdit?.aiMentor?.type || AI_MENTOR_TYPE.MENTOR,
  name: lessonToEdit?.aiMentor?.name || "",
  voiceMode: lessonToEdit?.aiMentor?.voiceMode || AI_MENTOR_VOICE_MODE.PRESET,
  ttsPreset: lessonToEdit?.aiMentor?.ttsPreset || AI_MENTOR_TTS_PRESET.MALE,
  customTtsReference: lessonToEdit?.aiMentor?.customTtsReference || "",
});
