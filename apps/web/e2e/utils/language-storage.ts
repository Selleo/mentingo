import type { BrowserContext, Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

type LanguageStorageTarget = Pick<BrowserContext, "addInitScript"> | Pick<Page, "addInitScript">;

export const seedLanguageStorage = async (
  target: LanguageStorageTarget,
  language: SupportedLanguages,
) => {
  await target.addInitScript(
    ({ language }: { language: SupportedLanguages }) => {
      localStorage.setItem("language-storage", JSON.stringify({ state: { language }, version: 0 }));
    },
    { language },
  );
};
