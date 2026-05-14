import { RICH_TEXT_HANDLES } from "../../data/common/handles";

import type { Page } from "@playwright/test";

type UploadContentResourceInput = {
  path: string | string[];
  displayMode?: "preview" | "download";
};

export const uploadContentResourceFlow = async (
  page: Page,
  { path, displayMode }: UploadContentResourceInput,
) => {
  const paths = Array.isArray(path) ? path : [path];

  await page.getByTestId(RICH_TEXT_HANDLES.UPLOAD_FILE_INPUT).setInputFiles(paths);

  if (displayMode) {
    await page.getByTestId(RICH_TEXT_HANDLES.UPLOAD_DISPLAY_MODE_DIALOG).waitFor();
    await page.getByTestId(RICH_TEXT_HANDLES.uploadDisplayModeOption(displayMode)).click();
    await page.getByTestId(RICH_TEXT_HANDLES.UPLOAD_DISPLAY_MODE_CONFIRM_BUTTON).click();
  }
};
