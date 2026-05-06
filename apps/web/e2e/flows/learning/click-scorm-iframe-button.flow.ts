import { LEARNING_HANDLES } from "../../data/learning/handles";

import type { Page } from "@playwright/test";

export const clickScormIframeButtonFlow = async (page: Page, buttonTestId: string) => {
  await page
    .getByTestId(LEARNING_HANDLES.SCORM_IFRAME)
    .contentFrame()
    .getByTestId(buttonTestId)
    .click();
};
