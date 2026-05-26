import { SUPPORTED_LANGUAGES } from "@repo/shared";

import type { TranslationDraft, TranslationFormValues } from "./types";

const emptyTranslation = (): TranslationDraft => ({ title: "", content: "" });

export const getDefaultAnnouncementFormValues = (): TranslationFormValues => ({
  groupId: null,
  translations: {
    [SUPPORTED_LANGUAGES.EN]: emptyTranslation(),
    [SUPPORTED_LANGUAGES.PL]: emptyTranslation(),
    [SUPPORTED_LANGUAGES.DE]: emptyTranslation(),
    [SUPPORTED_LANGUAGES.LT]: emptyTranslation(),
    [SUPPORTED_LANGUAGES.CS]: emptyTranslation(),
  },
});
