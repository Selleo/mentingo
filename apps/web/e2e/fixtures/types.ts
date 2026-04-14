import type { BrowserContext, Page } from "@playwright/test";

export type PageHandle = {
  context: BrowserContext;
  page: Page;
};
