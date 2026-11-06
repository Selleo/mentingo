import type { Page } from "@playwright/test";

export const openPathAtOriginFlow = async (page: Page, origin: string, path: string) => {
  await page.goto(new URL(path, origin).toString());
};
