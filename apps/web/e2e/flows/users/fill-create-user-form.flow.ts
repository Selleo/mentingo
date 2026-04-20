import { CREATE_USER_PAGE_HANDLES } from "../../data/users/handles";

import { closeMultiselectFlow } from "./close-multiselect.flow";

import type { Page } from "@playwright/test";

type FillCreateUserFormFlowInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  roleSlugs?: string[];
  language?: string;
};

export const fillCreateUserFormFlow = async (
  page: Page,
  { firstName, lastName, email, roleSlugs, language }: FillCreateUserFormFlowInput,
) => {
  if (firstName !== undefined) {
    await page.getByTestId(CREATE_USER_PAGE_HANDLES.FIRST_NAME_INPUT).fill(firstName);
  }

  if (lastName !== undefined) {
    await page.getByTestId(CREATE_USER_PAGE_HANDLES.LAST_NAME_INPUT).fill(lastName);
  }

  if (email !== undefined) {
    await page.getByTestId(CREATE_USER_PAGE_HANDLES.EMAIL_INPUT).fill(email);
  }

  if (roleSlugs?.length) {
    await page.getByTestId(CREATE_USER_PAGE_HANDLES.ROLE_SELECT).click();

    for (const roleSlug of roleSlugs) {
      await page.getByTestId(CREATE_USER_PAGE_HANDLES.roleOption(roleSlug)).click();
    }

    await closeMultiselectFlow(page, {
      closeTarget: page.getByTestId(CREATE_USER_PAGE_HANDLES.EMAIL_INPUT),
    });
  }

  if (language) {
    await page.getByTestId(CREATE_USER_PAGE_HANDLES.LANGUAGE_SELECT).click();
    await page.getByTestId(CREATE_USER_PAGE_HANDLES.languageOption(language)).click();
  }
};
