import { CERTIFICATES_HANDLES } from "../../data/certificates/handles";

import type { Page } from "@playwright/test";

export const openProfileCertificatesFlow = async (page: Page, userId: string) => {
  await page.goto(`/profile/${userId}`);
  await page.getByTestId(CERTIFICATES_HANDLES.ROOT).waitFor();
};
