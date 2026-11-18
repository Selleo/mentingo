import { expect, type Page } from "@playwright/test";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

/**
 * Sets invite-only registration on the organization settings tab.
 * `current` is the value read from the API; the switch is trusted only once it shows it.
 */
export const setInviteOnlyRegistrationFlow = async (
  page: Page,
  { current, enabled }: { current: boolean; enabled: boolean },
) => {
  const inviteOnlySwitch = page.getByTestId(SETTINGS_PAGE_HANDLES.INVITE_ONLY_REGISTRATION_SWITCH);

  await expect(inviteOnlySwitch).toBeChecked({ checked: current });

  if (current === enabled) return;

  await inviteOnlySwitch.click();
  await expect(inviteOnlySwitch).toBeChecked({ checked: enabled });

  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settings/admin/invite-only-registration") &&
      response.request().method() !== "GET",
  );
  await page.getByTestId(SETTINGS_PAGE_HANDLES.INVITE_ONLY_REGISTRATION_SAVE).click();
  expect((await saved).ok()).toBe(true);
};
