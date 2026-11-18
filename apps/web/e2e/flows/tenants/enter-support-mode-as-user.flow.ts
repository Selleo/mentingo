import { expect, type Page } from "@playwright/test";

import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

/** Opens the support-mode popover, searches all users by email and impersonates the given user. */
export const enterSupportModeAsUserFlow = async (
  page: Page,
  { tenantId, userEmail, userId }: { tenantId: string; userEmail: string; userId: string },
) => {
  await page.getByTestId(TENANTS_PAGE_HANDLES.supportModeButton(tenantId)).click();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_POPOVER).waitFor();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH).fill(userEmail);

  await expect(page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH_ALL_USERS)).toBeVisible();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH_ALL_USERS).click();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_ALL_USERS_TAB).click();

  const userOption = page.getByTestId(TENANTS_PAGE_HANDLES.supportModeUserOption(userId));
  await expect(userOption).toBeVisible();
  await userOption.click();
  await page.getByTestId(TENANTS_PAGE_HANDLES.SUPPORT_MODE_SUBMIT).click();
};
