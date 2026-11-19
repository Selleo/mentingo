import type { Page } from "@playwright/test";

export const fillRichTextEditorFlow = async (page: Page, editorTestId: string, text: string) => {
  const editor = page.getByTestId(editorTestId).locator(".ProseMirror");

  await editor.fill(text);
};

/** Replaces the editor content with `text` typed in bold, using the keyboard shortcut. */
export const typeBoldRichTextFlow = async (page: Page, editorTestId: string, text: string) => {
  const editor = page.getByTestId(editorTestId).locator(".ProseMirror");
  const boldShortcut = process.platform === "darwin" ? "Meta+B" : "Control+B";

  await editor.fill("");
  await editor.click();
  await page.keyboard.press(boldShortcut);
  await page.keyboard.type(text);
  await page.keyboard.press(boldShortcut);
};
