import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { z } from "zod";

import { stripHtmlTags } from "~/utils/stripHtmlTags";

import type { TFunction } from "i18next";

const optionalText = z.string().nullable().optional();

const requiredText = (t: TFunction) =>
  z
    .string()
    .refine(
      (value) => stripHtmlTags(value).trim().length > 0,
      t("adminCourseView.curriculum.lesson.aiMentorConfiguration.validation.required"),
    );

export const aiMentorConfigurationSchema = (t: TFunction) =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal(AI_MENTOR_TYPE.TEACHER),
      taskGoal: requiredText(t),
      expertise: requiredText(t),
      contentScope: requiredText(t),
      teachingStyle: z.nativeEnum(AI_MENTOR_TEACHING_STYLE),
      feedbackGuidance: optionalText,
      openingInstruction: optionalText,
      additionalInstructions: optionalText,
    }),
    z.object({
      type: z.literal(AI_MENTOR_TYPE.ROLEPLAY),
      scenario: requiredText(t),
      aiRole: requiredText(t),
      learnerRole: requiredText(t),
      characterGoal: requiredText(t),
      difficulty: z.nativeEnum(AI_MENTOR_ROLEPLAY_DIFFICULTY),
      factsAndConstraints: optionalText,
      openingInstruction: optionalText,
      additionalInstructions: optionalText,
    }),
  ]);
