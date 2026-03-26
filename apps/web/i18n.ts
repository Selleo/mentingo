import { SUPPORTED_LANGUAGES } from "@repo/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import csTranslations from "app/locales/cs/translation.json";
import deTranslations from "app/locales/de/translation.json";
import enTranslations from "app/locales/en/translation.json";
import ltTranslations from "app/locales/lt/translation.json";
import plTranslations from "app/locales/pl/translation.json";

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  fallbackLng: SUPPORTED_LANGUAGES.EN,
  lng: import.meta.env.VITE_E2E === "true" ? "en" : "pl",
  ns: ["translation"],
  defaultNS: "translation",
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translation: enTranslations,
    },
    pl: {
      translation: plTranslations,
    },
    de: {
      translation: deTranslations,
    },
    lt: {
      translation: ltTranslations,
    },
    cs: {
      translation: csTranslations,
    },
  },
});

export default i18n;
