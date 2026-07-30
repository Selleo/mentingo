import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

import type { SupportedLanguages } from "@repo/shared";

export type ArticleSectionTranslationValues = {
  title: string;
};

export type ArticleSectionFormValues = {
  translations: Partial<Record<SupportedLanguages, ArticleSectionTranslationValues>>;
};

export const createArticleSectionFormSchema = (
  availableLocales: SupportedLanguages[],
  persistedLocales: SupportedLanguages[],
  titleRequiredMessage: string,
) => {
  const translationSchema = z.object({
    title: z.string(),
  });

  const translationsShape = Object.fromEntries(
    Object.values(SUPPORTED_LANGUAGES).map((language) => [language, translationSchema.optional()]),
  ) as Record<SupportedLanguages, z.ZodOptional<typeof translationSchema>>;

  return z
    .object({ translations: z.object(translationsShape).strict() })
    .superRefine((values, context) => {
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
