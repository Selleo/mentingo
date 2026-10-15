import type { Page } from "@playwright/test";

export const openSavedReportConfigurationsFlow = async (page: Page) => {
  await page.getByRole("button", { name: /Saved configurations/ }).click();
};

export const saveReportConfigurationFlow = async (page: Page, name: string) => {
  await openSavedReportConfigurationsFlow(page);
  await page.getByRole("button", { name: "Save configuration" }).click();
  await page.getByLabel("Configuration name").fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
};
