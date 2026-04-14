import { expect, type Page } from "@playwright/test";

import { TOAST_HANDLES } from "../data/common/handles";

type AssertToastVisibleOptions = {
  optional?: boolean;
};

export const assertToastVisible = async (
  page: Page,
  message: string,
  { optional = false }: AssertToastVisibleOptions = {},
) => {
  const toast = page.getByTestId(TOAST_HANDLES.ROOT).filter({ hasText: message }).first();

  if (optional && (await toast.count()) === 0) {
    return;
  }

  await expect(toast).toBeVisible();
};
