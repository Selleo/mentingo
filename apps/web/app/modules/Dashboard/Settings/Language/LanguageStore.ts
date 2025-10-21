import { create } from "zustand";
import { persist } from "zustand/middleware";

import { detectBrowserLanguage, isSupportedLanguage } from "../../../../utils/browser-language";

export type Language = "en" | "pl";

type LanguageStore = {
  language: Language;
  setLanguage: (lang: Language) => void;
  initializeLanguage: (applicationLang?: string | null) => Language;
};

function getDefaultLanguage(): Language {
  return detectBrowserLanguage();
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: getDefaultLanguage(),
      setLanguage: (lang) => set({ language: lang }),
      initializeLanguage: (applicationLang) => {
        const currentState = get();

        if (applicationLang && isSupportedLanguage(applicationLang)) {
          set({ language: applicationLang });
          return applicationLang;
        }

        if (currentState.language && isSupportedLanguage(currentState.language)) {
          return currentState.language as Language;
        }

        const browserLang = detectBrowserLanguage();
        set({ language: browserLang });
        return browserLang;
      },
    }),
    {
      name: "language-storage",
    },
  ),
);
