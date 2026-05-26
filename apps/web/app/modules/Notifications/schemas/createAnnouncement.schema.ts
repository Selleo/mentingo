import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { z } from "zod";

import type { TFunction } from "i18next";

export const createAnnouncementFormSchema = (
  enabledLanguages: SupportedLanguages[],
  t: TFunction,
) =>
  z
    .object({
      groupId: z.string().uuid().nullable(),
      translations: z.object({
        [SUPPORTED_LANGUAGES.EN]: z.object({ title: z.string(), content: z.string() }),
        [SUPPORTED_LANGUAGES.PL]: z.object({ title: z.string(), content: z.string() }),
        [SUPPORTED_LANGUAGES.DE]: z.object({ title: z.string(), content: z.string() }),
        [SUPPORTED_LANGUAGES.LT]: z.object({ title: z.string(), content: z.string() }),
        [SUPPORTED_LANGUAGES.CS]: z.object({ title: z.string(), content: z.string() }),
      }),
    })
    .superRefine(({ translations }, context) => {
      enabledLanguages.forEach((language) => {
        const translation = translations[language];

        if (!translation.title.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["translations", language, "title"],
            message: t("announcements.createPage.validation.title.required"),
          });
        }

        if (translation.title.length > 120) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["translations", language, "title"],
            message: t("announcements.createPage.validation.title.maxLength"),
          });
        }

        if (!translation.content.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["translations", language, "content"],
            message: t("announcements.createPage.validation.content.required"),
          });
        }
      });
    });
