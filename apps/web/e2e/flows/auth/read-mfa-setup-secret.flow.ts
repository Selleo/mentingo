import { MFA_PAGE_HANDLES } from "../../data/auth/handles";

import type { Page } from "@playwright/test";

export const readMfaSetupSecretFlow = async (page: Page) => {
  const secret = (await page.getByTestId(MFA_PAGE_HANDLES.SECRET).textContent())?.trim();

  if (!secret) throw new Error("Expected MFA setup secret to be visible");

  return secret;
};
