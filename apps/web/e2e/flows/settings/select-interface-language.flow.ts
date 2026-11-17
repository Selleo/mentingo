import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

export const selectInterfaceLanguageFlow = async (page: Page, language: SupportedLanguages) => {
  await page.getByTestId(SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.languageOption(language)).click();
};
