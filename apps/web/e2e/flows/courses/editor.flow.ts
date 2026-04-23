import type { Page } from "@playwright/test";

export const fillRichTextEditorFlow = async (page: Page, editorTestId: string, text: string) => {
  const editor = page.getByTestId(editorTestId).locator(".ProseMirror");

  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(text);
};
