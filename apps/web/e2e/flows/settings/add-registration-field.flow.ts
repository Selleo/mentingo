import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

import type { Page } from "@playwright/test";

/** Adds a required checkbox labelled `${baseLabel} ${language}` in every language and saves the form. */
export const addRegistrationFieldFlow = async (page: Page, index: number, baseLabel: string) => {
  await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_ADD_FIELD).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldEdit(index)).click();

  for (const language of Object.values(SUPPORTED_LANGUAGES)) {
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldLabel(index, language))
      .fill(`${baseLabel} ${language}`);
  }

  await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldRequired(index)).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldClose(index)).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_SAVE).click();
};
