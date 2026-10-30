import { expect, type Page } from "@playwright/test";

import { ENV_PAGE_HANDLES, type EnvSecretName } from "../../data/environment/handles";

export const revealEnvSecretFlow = async (page: Page, name: EnvSecretName) => {
  const editor = page.locator("section").filter({
    has: page.getByTestId(ENV_PAGE_HANDLES.field(name)),
  });
  const editorId = await editor.getAttribute("id");
  if (!editorId) throw new Error(`No environment editor contains ${name}`);

  const groupButton = page.locator(`button[aria-controls="${editorId}"]`);
  if ((await groupButton.getAttribute("aria-expanded")) === "false") {
    await groupButton.click();
  }

  await page.getByTestId(ENV_PAGE_HANDLES.toggle(name)).click();

  const input = page.getByTestId(ENV_PAGE_HANDLES.input(name));

  await expect(input).toBeEnabled();

  return input;
};
