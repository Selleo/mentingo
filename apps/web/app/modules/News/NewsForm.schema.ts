import { NEWS_STATUS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

import type { NewsStatus, SupportedLanguages } from "@repo/shared";

export type TranslationValues = {
  title: string;
  summary: string;
  content: string;
  cover?: File;
};

export type NewsFormValues = {
  translations: Partial<Record<SupportedLanguages, TranslationValues>>;
  status: NewsStatus;
  isPublic: boolean;
};

export const createNewsFormSchema = (
  availableLocales: SupportedLanguages[],
  persistedLocales: SupportedLanguages[],
  titleRequiredMessage: string,
) => {
  const translationSchema = z.object({
    title: z.string(),
    summary: z.string(),
    content: z.string(),
    cover: z.instanceof(File).optional(),
  });

  const translationsShape = Object.fromEntries(
    Object.values(SUPPORTED_LANGUAGES).map((language) => [language, translationSchema.optional()]),
  ) as Record<SupportedLanguages, z.ZodOptional<typeof translationSchema>>;

  return z
    .object({
      translations: z.object(translationsShape).strict(),
      status: z.enum([NEWS_STATUS.DRAFT, NEWS_STATUS.PUBLISHED]),
      isPublic: z.boolean(),
    })
    .superRefine((values, context) => {
      if (values.status !== NEWS_STATUS.PUBLISHED) return;

      availableLocales.forEach((language) => {
        if (!values.translations[language] && persistedLocales.includes(language)) return;
        if (values.translations[language]?.title?.trim()) return;
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["translations", language, "title"],
          message: titleRequiredMessage,
        });
      });
    });
};
