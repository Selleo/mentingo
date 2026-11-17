import { expect, type Page } from "@playwright/test";

import { NOTIFICATIONS_HANDLES } from "../../data/announcements/handles";

import type { SupportedLanguages } from "@repo/shared";

type CreateAnnouncementFlowInput = {
  groupId?: string;
  translations: Array<{ language: SupportedLanguages; title: string; content: string }>;
};

/** Creates an announcement from the open notification center; the first translation is the base one. */
export const createAnnouncementFlow = async (
  page: Page,
  { groupId, translations }: CreateAnnouncementFlowInput,
) => {
  await page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_BUTTON).click();
  await expect(page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_DIALOG)).toBeVisible();

  for (const [index, { language, title, content }] of translations.entries()) {
    if (index > 0) {
      await page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_LANGUAGE_SELECT).click();
      await page.getByTestId(NOTIFICATIONS_HANDLES.languageOption(language)).click();
    }

    await page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_TITLE_INPUT).fill(title);
    await page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_CONTENT_INPUT).fill(content);
  }

  if (groupId) {
    await page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_GROUP_SELECT).click();
    await page.getByTestId(NOTIFICATIONS_HANDLES.groupOption(groupId)).click();
  }

  await page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_SUBMIT_BUTTON).click();
  await expect(page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_DIALOG)).toHaveCount(0);
};
