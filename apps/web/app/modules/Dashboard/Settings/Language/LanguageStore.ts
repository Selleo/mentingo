import { create } from "zustand";
import { persist } from "zustand/middleware";

type Language = "en" | "pl";

type LanguageStore = {
  language: Language;
  setLanguage: (lang: Language) => void;
};
function getDefaultLanguage(): Language {
  if (typeof navigator !== "undefined") {
    let locale = navigator.language;
    locale = locale.split("-")[0];
    if (locale === "en" || locale === "pl") {
      return locale;
    }
  }
  return "en";
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: getDefaultLanguage(),
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: "language-storage",
    },
  ),
);
