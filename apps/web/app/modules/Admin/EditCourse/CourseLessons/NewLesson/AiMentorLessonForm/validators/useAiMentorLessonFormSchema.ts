import { AI_MENTOR_TTS_PRESET, AI_MENTOR_TYPE, AI_MENTOR_VOICE_MODE } from "@repo/shared";
import { z } from "zod";

import {
  MAX_AI_MENTOR_TEXT_LENGTH,
  MAX_MB_PER_FILE,
  MAX_NUM_OF_FILES,
} from "../AiMentorLesson.constants";

import type { TFunction } from "i18next";

export const stripHtmlTags = (str: string): string => {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-zA-Z0-9#]+;/g, "")
    .trim();
};

export const aiMentorLessonFormSchema = (t: TFunction) =>
  z
    .object({
      title: z
        .string()
        .min(1, { message: t("adminCourseView.curriculum.lesson.validation.titleRequired") })
        .max(255, { message: t("adminCourseView.curriculum.lesson.validation.titleMaxLength") }),
      description: z
        .string()
        .max(MAX_AI_MENTOR_TEXT_LENGTH, {
          message: t("adminCourseView.curriculum.lesson.validation.taskDescriptionMaxLength", {
            count: MAX_AI_MENTOR_TEXT_LENGTH,
          }),
        })
        .optional(),
      aiMentorInstructions: z
        .string()
        .min(1, {
          message: t("adminCourseView.curriculum.lesson.validation.aiMentorInstructionsRequired"),
        })
        .refine(
          (val) => {
            const textContent = stripHtmlTags(val);
            return textContent.length > 0;
          },
          {
            message: t("adminCourseView.curriculum.lesson.validation.aiMentorInstructionsRequired"),
          },
        )
        .refine(
          (val) => {
            const textContent = stripHtmlTags(val);
            return textContent.length <= 20_000;
          },
          {
            message: t(
              "adminCourseView.curriculum.lesson.validation.aiMentorInstructionsMaxLength",
            ),
          },
        ),
      completionConditions: z
        .string()
        .min(1, {
          message: t("adminCourseView.curriculum.lesson.validation.completionConditionsRequired"),
        })
        .refine(
          (val) => {
            const textContent = stripHtmlTags(val);
            return textContent.length > 0;
          },
          {
            message: t("adminCourseView.curriculum.lesson.validation.completionConditionsRequired"),
          },
        )
        .refine(
          (val) => {
            const textContent = stripHtmlTags(val);
            return textContent.length <= 20_000;
          },
          {
            message: t(
              "adminCourseView.curriculum.lesson.validation.completionConditionsMaxLength",
            ),
          },
        ),
      type: z.nativeEnum(AI_MENTOR_TYPE).default(AI_MENTOR_TYPE.MENTOR),
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
      .max(MAX_NUM_OF_FILES, {
        message: t(`adminCourseView.curriculum.lesson.validation.maxFileNumber`, {
          count: MAX_NUM_OF_FILES,
        }),
      })
      .refine((files) => files.every((f) => f.size < MAX_MB_PER_FILE * 1024 * 1024), {
        message: t("adminCourseView.curriculum.lesson.validation.maxFileSize", {
          MAX_MB_PER_FILE,
        }),
      }),
  });

export type AiMentorLessonContextValues = z.infer<ReturnType<typeof aiMentorLessonFileSchema>>;
export type AiMentorLessonFormValues = z.infer<ReturnType<typeof aiMentorLessonFormSchema>>;
