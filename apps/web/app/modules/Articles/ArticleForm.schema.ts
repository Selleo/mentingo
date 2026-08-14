import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

import type { SupportedLanguages } from "@repo/shared";

export const emptyArticleTranslation = {
  title: "",
  summary: "",
  content: "",
};

export type ArticleTranslationValues = {
  title: string;
  summary: string;
  content: string;
  cover?: File;
};

export type ArticleFormValues = {
  translations: Partial<Record<SupportedLanguages, ArticleTranslationValues>>;
  isPublic: boolean;
};

export const createArticleFormSchema = (
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
      isPublic: z.boolean(),
    })
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
