import { expect, type Page } from "@playwright/test";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

export const setInviteOnlyRegistrationFlow = async (page: Page, enabled: boolean) => {
  const inviteOnlySwitch = page.getByTestId(SETTINGS_PAGE_HANDLES.INVITE_ONLY_REGISTRATION_SWITCH);

  await expect(inviteOnlySwitch).toBeVisible();

  if ((await inviteOnlySwitch.isChecked()) === enabled) return;

  await inviteOnlySwitch.click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.INVITE_ONLY_REGISTRATION_SAVE).click();
};
