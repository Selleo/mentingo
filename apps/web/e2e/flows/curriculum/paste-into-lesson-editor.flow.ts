import { RICH_TEXT_HANDLES } from "../../data/common/handles";

import type { Page } from "@playwright/test";

/** Pastes plain text (e.g. a video URL the editor turns into an embed) into the lesson body editor. */
export const pasteIntoLessonEditorFlow = async (page: Page, text: string) => {
  await page
    .getByTestId(RICH_TEXT_HANDLES.CONTENT)
    .locator(".ProseMirror")
    .evaluate((element, pastedText) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", pastedText);
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer,
        }),
      );
    }, text);
};
