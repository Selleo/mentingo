import { expect, type Page } from "@playwright/test";

import { ENV_PAGE_HANDLES, type EnvSecretName } from "../../data/environment/handles";

export const revealEnvSecretFlow = async (page: Page, name: EnvSecretName) => {
  await page.getByTestId(ENV_PAGE_HANDLES.toggle(name)).click();

  const input = page.getByTestId(ENV_PAGE_HANDLES.input(name));

  await expect(input).toBeEnabled();

  return input;
};
