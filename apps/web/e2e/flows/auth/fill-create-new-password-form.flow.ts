import { CREATE_NEW_PASSWORD_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const fillCreateNewPasswordFormFlow = async (
  page: Page,
  input: {
    newPassword: string;
  },
) => {
  await page.getByTestId(CREATE_NEW_PASSWORD_PAGE_HANDLES.NEW_PASSWORD).fill(input.newPassword);
  await page
    .getByTestId(CREATE_NEW_PASSWORD_PAGE_HANDLES.NEW_PASSWORD_CONFIRMATION)
    .fill(input.newPassword);
};
