import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect } from "../../fixtures/test.fixture";

import { openPlatformCustomizationSettingsFlow } from "./open-platform-customization-settings.flow";

import type { Page } from "@playwright/test";

/** Waits until the saved fields are rendered, so a newly added field gets the next index. */
export const openRegistrationFormBuilderFlow = async (page: Page, savedFieldCount: number) => {
  await openPlatformCustomizationSettingsFlow(page);
  await expect(
    page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_BUILDER_CARD),
  ).toBeVisible();

  if (savedFieldCount > 0) {
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormField(savedFieldCount - 1)),
    ).toBeVisible();
  }
};
