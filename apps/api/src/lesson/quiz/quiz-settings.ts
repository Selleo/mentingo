import { BadRequestException } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { sql } from "drizzle-orm";

import { lessons } from "src/storage/schema";

import type { QuizSettingsInput } from "./quiz.schema";
import type { QuizSettings } from "./quiz.types";

export function mergeQuizSettings(
  input: QuizSettingsInput | undefined,
  language: SupportedLanguages,
  previous: QuizSettings = {},
): QuizSettings {
  if (!input) return previous;
  const { passedFeedback, failedFeedback, ...settings } = input;
  const result = { ...previous, ...settings };
  if (passedFeedback !== undefined)
    result.passedFeedback = { ...previous.passedFeedback, [language]: passedFeedback };
  if (failedFeedback !== undefined)
    result.failedFeedback = { ...previous.failedFeedback, [language]: failedFeedback };
  if (
    result.availableFrom &&
    result.availableUntil &&
    new Date(result.availableFrom) >= new Date(result.availableUntil)
  ) {
    throw new BadRequestException("quizPoc.errors.invalidDates");
  }
  return result;
}

export function localizedQuizSettings(language: SupportedLanguages = SUPPORTED_LANGUAGES.EN) {
  return sql<QuizSettingsInput>`(${lessons.quizSettings} - 'passedFeedback' - 'failedFeedback') || jsonb_build_object(
    'passedFeedback', coalesce(${lessons.quizSettings}->'passedFeedback'->>${language}, ''),
    'failedFeedback', coalesce(${lessons.quizSettings}->'failedFeedback'->>${language}, '')
  )`.mapWith((value): QuizSettingsInput => (typeof value === "string" ? JSON.parse(value) : value));
}

export function hasQuizAttemptConfiguration(settings: QuizSettings | QuizSettingsInput): boolean {
  return Boolean(
    settings.shuffleQuestions ||
      settings.shuffleAnswers ||
      settings.availableFrom ||
      settings.availableUntil ||
      settings.timeLimitMinutes,
  );
}
