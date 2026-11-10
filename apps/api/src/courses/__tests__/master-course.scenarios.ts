import { SUPPORTED_LANGUAGES } from "@repo/shared";

export const JSONB_TYPES = {
  OBJECT: "object",
} as const;

export const SOURCE_LEARNING_OUTCOMES = {
  [SUPPORTED_LANGUAGES.EN]: ["Understand the source course"],
  [SUPPORTED_LANGUAGES.PL]: ["Zrozumiec kurs zrodlowy"],
};

export const UPDATED_LEARNING_OUTCOMES = {
  [SUPPORTED_LANGUAGES.EN]: ["Apply the updated course"],
  [SUPPORTED_LANGUAGES.PL]: ["Zastosowac zaktualizowany kurs"],
};

export const SHARED_LEARNING_OUTCOME_LANGUAGES = [
  { language: SUPPORTED_LANGUAGES.EN },
  { language: SUPPORTED_LANGUAGES.PL },
];
