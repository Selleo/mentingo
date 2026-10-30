import { SUPPORTED_LANGUAGES } from "@repo/shared";

export const COURSE_LANGUAGES = {
  BASE: SUPPORTED_LANGUAGES.EN,
  TRANSLATION: SUPPORTED_LANGUAGES.DE,
  NOT_OFFERED: SUPPORTED_LANGUAGES.FR,
} as const;

export const BASE_TEXT = "English text";
export const TRANSLATED_TEXT = "Deutscher Text";

export const TRANSLATED_TEXT_BY_LANGUAGE = {
  [COURSE_LANGUAGES.BASE]: BASE_TEXT,
  [COURSE_LANGUAGES.TRANSLATION]: TRANSLATED_TEXT,
};

export const BASE_TEXT_ONLY = { [COURSE_LANGUAGES.BASE]: BASE_TEXT };

export const INVALID_LANGUAGE_DELETIONS = [
  { deletedLanguage: "the base language", language: COURSE_LANGUAGES.BASE },
  {
    deletedLanguage: "a language the course does not offer",
    language: COURSE_LANGUAGES.NOT_OFFERED,
  },
];
