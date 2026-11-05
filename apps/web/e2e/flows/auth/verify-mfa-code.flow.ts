import { fillMfaTokenFlow } from "./fill-mfa-token.flow";
import { submitMfaTokenFlow } from "./submit-mfa-token.flow";

import type { Page } from "@playwright/test";

export const verifyMfaCodeFlow = async (page: Page, code: string) => {
  await fillMfaTokenFlow(page, code);
  await submitMfaTokenFlow(page);
};
