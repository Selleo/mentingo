import type { Page } from "@playwright/test";

type LumaConfig = {
  enabled: boolean;
  courseGenerationEnabled: boolean;
  voiceMentorEnabled: boolean;
};

/** Luma (AI provider) is not available in E2E; fake the capability flags the authoring UI reads. */
export const mockLumaConfigFlow = async (page: Page, config: LumaConfig) => {
  await page.route("**/api/env/luma", (route) =>
    route.fulfill({ contentType: "application/json", json: { data: config } }),
  );
};
