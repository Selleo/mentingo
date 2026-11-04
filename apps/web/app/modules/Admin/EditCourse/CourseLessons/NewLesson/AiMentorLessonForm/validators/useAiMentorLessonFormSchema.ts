import {
  AI_MENTOR_TTS_PRESET,
  AI_MENTOR_VOICE_MODE,
  MAX_INGESTION_FILE_COUNT,
  MAX_INGESTION_FILE_SIZE_BYTES,
  formatFileSize,
  stripHtmlTags,
} from "@repo/shared";
import { z } from "zod";

import { aiJudgeConfigurationSchema } from "../AiJudge/aiJudgeConfiguration.schema";
import { aiMentorConfigurationSchema } from "../AiMentorConfiguration/aiMentorConfiguration.schema";
import { MAX_AI_MENTOR_TEXT_LENGTH } from "../AiMentorLesson.constants";

import type { TFunction } from "i18next";

export const toTrimmedPlainText = (html: string): string =>
  stripHtmlTags(html)
    .replace(/\u00a0/g, " ")
    .trim();

export const aiMentorLessonFormSchema = (t: TFunction, requireAiMentorConfiguration = false) => {
  const mentorConfigurationField = requireAiMentorConfiguration
    ? aiMentorConfigurationSchema(t)
    : aiMentorConfigurationSchema(t).optional();

  return z
    .object({
      title: z
        .string()
        .min(1, { message: t("adminCourseView.curriculum.lesson.validation.titleRequired") })
        .max(255, { message: t("adminCourseView.curriculum.lesson.validation.titleMaxLength") }),
      description: z
        .string()
        .refine((val) => toTrimmedPlainText(val).length <= MAX_AI_MENTOR_TEXT_LENGTH, {
          message: t("adminCourseView.curriculum.lesson.validation.taskDescriptionMaxLength", {
            count: MAX_AI_MENTOR_TEXT_LENGTH,
          }),
        })
        .optional(),
      aiMentorConfiguration: mentorConfigurationField,
      aiJudgeConfiguration: aiJudgeConfigurationSchema(t),
      name: z.string(),
      voiceMode: z.nativeEnum(AI_MENTOR_VOICE_MODE).default(AI_MENTOR_VOICE_MODE.PRESET),
      ttsPreset: z.nativeEnum(AI_MENTOR_TTS_PRESET).default(AI_MENTOR_TTS_PRESET.MALE),
      customTtsReference: z.string().nullable().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.voiceMode === AI_MENTOR_VOICE_MODE.CUSTOM && !values.customTtsReference?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("adminCourseView.curriculum.lesson.validation.customTTSReferenceRequired"),
          path: ["customTtsReference"],
        });
      }
    });
};

export const aiMentorLessonFileSchema = (t: TFunction) =>
  z.object({
    files: z
      .array(
        z.union([
          z.instanceof(File),
          z.object({
            name: z.string(),
            size: z.number(),
            type: z.string(),
            id: z.string().optional(),
          }),
        ]),
      )
      .max(MAX_INGESTION_FILE_COUNT, {
        message: t(`adminCourseView.curriculum.lesson.validation.maxFileNumber`, {
          count: MAX_INGESTION_FILE_COUNT,
        }),
      })
      .refine((files) => files.every((f) => f.size <= MAX_INGESTION_FILE_SIZE_BYTES), {
        message: t("adminCourseView.curriculum.lesson.validation.maxFileSize", {
          maxSize: formatFileSize(MAX_INGESTION_FILE_SIZE_BYTES),
        }),
      }),
  });

export type AiMentorLessonContextValues = z.infer<ReturnType<typeof aiMentorLessonFileSchema>>;
export type AiMentorLessonFormValues = z.infer<ReturnType<typeof aiMentorLessonFormSchema>>;
