import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

import type { TranslationDraft, TranslationFormValues } from "./types";

const emptyTranslation = (): TranslationDraft => ({ title: "", content: "" });

const getEmptyTranslations = (): Record<SupportedLanguages, TranslationDraft> =>
  Object.fromEntries(
    Object.values(SUPPORTED_LANGUAGES).map((language) => [language, emptyTranslation()]),
  ) as Record<SupportedLanguages, TranslationDraft>;

export const getDefaultAnnouncementFormValues = (): TranslationFormValues => ({
  groupId: null,
  translations: getEmptyTranslations(),
});
