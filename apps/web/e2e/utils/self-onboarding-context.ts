import { SUPPORTED_LANGUAGES, SELF_ONBOARDING_DEMO_COVER_KEY } from "@repo/shared";
import { createInstance } from "i18next";

import english from "~/locales/en/translation.json" with { type: "json" };
import polish from "~/locales/pl/translation.json" with { type: "json" };

export function getSelfOnboardingLanguage() {
  if (process.env.SELF_ONBOARDING_DEMO !== "1") return SUPPORTED_LANGUAGES.EN;
  const code = process.env.SELF_ONBOARDING_LANGUAGE || SUPPORTED_LANGUAGES.EN;
  if (code !== SUPPORTED_LANGUAGES.EN && code !== SUPPORTED_LANGUAGES.PL) {
    throw new Error("Self-onboarding recording language must be en or pl");
  }
  return code;
}

export function recordingValue<T>(values: { en: T; pl: T }): T {
  return values[getSelfOnboardingLanguage()];
}

const translator = createInstance();
void translator.init({
  lng: getSelfOnboardingLanguage(),
  fallbackLng: false,
  initImmediate: false,
  resources: { en: { translation: english }, pl: { translation: polish } },
});

/** Use actual application translation keys for selectors, rather than translating English labels by guesswork. */
export function recordingText(key: string, values: Record<string, string | number> = {}) {
  if (!translator.exists(key)) throw new Error(`Missing recording UI translation: ${key}`);
  return translator.t(key, values);
}

export const recordingCoverKey = SELF_ONBOARDING_DEMO_COVER_KEY;
