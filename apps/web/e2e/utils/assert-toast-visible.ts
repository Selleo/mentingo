import { expect, type Page } from "@playwright/test";

import { TOAST_HANDLES } from "../data/common/handles";

import type { ToastProps } from "~/components/ui/toast";

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

/** Expects a toast of the given variant, independent of its copy. */
export const assertToastVariantVisible = async (
  page: Page,
  variant: NonNullable<ToastProps["variant"]>,
) => {
  const toast = page
    .getByTestId(TOAST_HANDLES.ROOT)
    .and(page.locator(`[data-variant="${variant}"]`))
    .first();

  await expect(toast).toBeVisible();
};
