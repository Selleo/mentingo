import { REGISTER_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const fillRegisterFormFlow = async (
  page: Page,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  },
) => {
  await page.getByTestId(REGISTER_PAGE_HANDLES.FIRST_NAME).fill(input.firstName);
  await page.getByTestId(REGISTER_PAGE_HANDLES.LAST_NAME).fill(input.lastName);
  await page.getByTestId(REGISTER_PAGE_HANDLES.EMAIL).fill(input.email);
  await page.getByTestId(REGISTER_PAGE_HANDLES.PASSWORD).fill(input.password);
};
