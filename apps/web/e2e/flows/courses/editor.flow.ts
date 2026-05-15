import type { Page } from "@playwright/test";

export const fillRichTextEditorFlow = async (page: Page, editorTestId: string, text: string) => {
  const editor = page.getByTestId(editorTestId).locator(".ProseMirror");

  await editor.fill(text);
};
