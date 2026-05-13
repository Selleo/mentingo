import { basename } from "node:path";

import { RICH_TEXT_HANDLES } from "../../data/common/handles";

import type { Page } from "@playwright/test";

type UploadContentResourceInput = {
  path: string | string[];
  displayMode?: "preview" | "download";
};

const uploadAndInsertAsset = async (
  page: Page,
  filePath: string,
  displayMode?: UploadContentResourceInput["displayMode"],
) => {
  const fileName = basename(filePath);

  await page.getByTestId(RICH_TEXT_HANDLES.ASSET_LIBRARY_BUTTON).click();

  const dialog = page.getByTestId(RICH_TEXT_HANDLES.ASSET_LIBRARY_DIALOG);
  await dialog.waitFor();

  await page.getByTestId(RICH_TEXT_HANDLES.ASSET_LIBRARY_UPLOAD_INPUT).setInputFiles(filePath);

  const assetRow = dialog
    .locator('[data-testid^="rich-text-asset-library-row-"]')
    .filter({ hasText: fileName })
    .first();

  await assetRow.waitFor({ state: "visible", timeout: 30_000 });
  await assetRow.locator('[data-testid^="rich-text-asset-library-insert-button-"]').click();

  if (displayMode) {
    await page.getByTestId(RICH_TEXT_HANDLES.UPLOAD_DISPLAY_MODE_DIALOG).waitFor();
    await page.getByTestId(RICH_TEXT_HANDLES.uploadDisplayModeOption(displayMode)).click();
    await page.getByTestId(RICH_TEXT_HANDLES.UPLOAD_DISPLAY_MODE_CONFIRM_BUTTON).click();
  }

  await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
};

export const uploadContentResourceFlow = async (
  page: Page,
  { path, displayMode }: UploadContentResourceInput,
) => {
  const paths = Array.isArray(path) ? path : [path];

  for (const filePath of paths) {
    await uploadAndInsertAsset(page, filePath, displayMode);
  }
};
