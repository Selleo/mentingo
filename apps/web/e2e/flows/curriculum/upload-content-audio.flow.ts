import { RICH_TEXT_HANDLES } from "../../data/common/handles";

import type { Page } from "@playwright/test";

export const uploadContentAudioFlow = async (page: Page, path: string) => {
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId(RICH_TEXT_HANDLES.AUDIO_UPLOAD_BUTTON).click();
  await (await chooser).setFiles(path);
};
