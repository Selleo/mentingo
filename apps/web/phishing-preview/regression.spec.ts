import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

const screens = path.join(os.homedir(), "genie-coder/screens");
mkdirSync(screens, { recursive: true });

for (const viewport of [
  { width: 1440, height: 1100 },
  { width: 390, height: 844 },
]) {
  test(`fixture journey: create, review, edit, list, report and hall at ${viewport.width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/phishing/new?lang=en");
    await expect(page.getByRole("note")).toContainText("FIXTURE DATA");
    await page.getByLabel("Campaign name", { exact: true }).fill("Preview regression campaign");
    await page.getByRole("combobox", { name: "Scenario", exact: true }).click();
    await page.getByRole("option", { name: "Invoice reminder" }).click();
    await page.getByRole("combobox", { name: "Educational course (published, free)" }).click();
    await page.getByRole("option", { name: "Security awareness" }).click();
    await page.getByRole("combobox", { name: "People", exact: true }).fill("Ada");
    await page.getByRole("option", { name: /Ada Example/ }).click();
    await page.getByRole("combobox", { name: "People", exact: true }).press("Escape");
    await page.getByRole("button", { name: "Remove Ada Example — ada@example.test" }).click();
    await page.getByRole("combobox", { name: "People", exact: true }).press("Escape");
    await page.getByRole("combobox", { name: "Groups / departments" }).click();
    await page.getByRole("option", { name: "Security team" }).click();
    await page.getByRole("combobox", { name: "Groups / departments" }).press("Escape");
    await page.getByRole("checkbox").check();
    await page.getByLabel("Start (local time)", { exact: true }).fill("2030-01-01T10:00");
    await page.getByLabel("End (local time)", { exact: true }).fill("2030-01-01T11:00");
    await page.screenshot({
      path: path.join(screens, `phishing-fixture-create-${viewport.width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Review campaign", exact: true }).click();
    await expect(page.getByText(/2 unique recipients/)).toBeVisible();
    await page.screenshot({
      path: path.join(screens, `phishing-fixture-review-${viewport.width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Campaign name", { exact: true })).toHaveValue(
      "Preview regression campaign",
    );
    await page.getByRole("button", { name: "Review campaign", exact: true }).click();
    await page.getByRole("button", { name: "Launch campaign", exact: true }).click();
    await expect(page).toHaveURL(/\/phishing$/);
    await expect(page.getByText("Preview regression campaign", { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(screens, `phishing-fixture-list-${viewport.width}.png`),
      fullPage: true,
    });
    await page.getByRole("link", { name: "Campaign report", exact: true }).first().click();
    await expect(page.getByRole("table", { name: "People" })).toBeVisible();
    await page.screenshot({
      path: path.join(screens, `phishing-fixture-report-${viewport.width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel pending messages", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.screenshot({
      path: path.join(screens, `phishing-fixture-cancel-${viewport.width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Back to campaigns", exact: true }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await page.getByRole("link", { name: "Hall of Shame", exact: true }).click();
    await expect(page.getByRole("table", { name: "People" }).getByText("Jan Example")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("table", { name: "People" }).getByText("Ada Example"),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: path.join(screens, `phishing-fixture-hall-${viewport.width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

for (const route of [
  "/phishing",
  "/phishing/new",
  "/phishing/campaign-1",
  "/phishing/campaign-1/hall-of-shame",
]) {
  test(`fixture capability states at ${route}`, async ({ page }) => {
    await page.goto(`${route}?lang=en&state=loading`);
    await expect(page.getByRole("status")).toContainText("Loading");
    await page.goto(`${route}?lang=en&state=error`);
    await expect(page.getByRole("alert")).toContainText("unavailable");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.goto(`${route}?lang=en&state=disabled`);
    await expect(page.getByText(/not enabled for this organization/)).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0);
  });
}

test("Polish creation preview keeps localized labels", async ({ page }) => {
  await page.goto("/phishing/new?lang=pl");
  await expect(page.getByRole("heading", { level: 1 })).not.toContainText("phishing.");
  await expect(page.getByRole("combobox")).toHaveCount(4);
  await page.screenshot({
    path: path.join(screens, "phishing-fixture-create-pl.png"),
    fullPage: true,
  });
});
