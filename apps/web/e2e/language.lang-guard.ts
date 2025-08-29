import { test, expect, type Page } from "@playwright/test";

import { LANGUAGE_PAGE_UI } from "./tests/admin/data/language-data";

const navigateToPage = async (page: Page, name: string, headerText: string) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();

  const header = page.getByRole("heading", { name: new RegExp(headerText, "i") });

  await expect(header).toHaveText(new RegExp(headerText, "i"));
};

const changeLanguage = async (page: Page, language: string) => {
  await page.getByRole("combobox").click();
  await page.getByLabel(language).click();
};

const checkValidSidebarLanguage = async (
  page: Page,
  prefix: keyof typeof LANGUAGE_PAGE_UI.languages,
) => {
  const object = Object.values(LANGUAGE_PAGE_UI.languages[prefix]?.sidebarItems ?? []);

  for (const element of object) {
    await page.waitForLoadState("networkidle");

    let translation;
    try {
      translation = page.getByRole("link", { name: new RegExp(element, "i") });
      await expect(translation).toBeVisible({ timeout: 5000 });
    } catch (error) {
      try {
        translation = page.getByText(new RegExp(element, "i"));
        await expect(translation).toBeVisible({ timeout: 5000 });
      } catch (error2) {
        try {
          translation = page.locator("nav").getByText(new RegExp(element, "i"));
          await expect(translation).toBeVisible({ timeout: 5000 });
        } catch (error3) {
          console.log(`Failed to find element: ${element}`);
          console.log(`Current URL: ${page.url()}`);

          const allLinks = await page.getByRole("link").all();
          console.log(`Found ${allLinks.length} links on page`);

          for (const link of allLinks) {
            const text = await link.textContent();
            console.log(`Link text: ${text}`);
          }

          const navElements = await page.locator("nav").locator("*").all();
          console.log(`Found ${navElements.length} elements in navigation`);

          throw new Error(`Could not find element "${element}" with any selector`);
        }
      }
    }

    await expect(translation).toHaveText(new RegExp(element, "i"));
  }
};

test.describe("Switch language flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await navigateToPage(
      page,
      LANGUAGE_PAGE_UI.button.settings,
      LANGUAGE_PAGE_UI.header.changeLanguage,
    );
  });

  test("should switch to Polish and verify translations", async ({ page }) => {
    await changeLanguage(page, LANGUAGE_PAGE_UI.languages.polish.language);

    console.log(`Current URL after language change: ${page.url()}`);

    await page.waitForLoadState("networkidle");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    const navItems = await nav.locator("*").all();
    console.log(`Navigation has ${navItems.length} elements`);

    await checkValidSidebarLanguage(page, "polish");
    await changeLanguage(page, LANGUAGE_PAGE_UI.languages.polish.english);
  });

  test("should switch to English and verify translations", async ({ page }) => {
    await changeLanguage(page, LANGUAGE_PAGE_UI.languages.english.language);
    await checkValidSidebarLanguage(page, "english");
  });

  test("should switch between languages", async ({ page }) => {
    await changeLanguage(page, LANGUAGE_PAGE_UI.languages.polish.language);
    await checkValidSidebarLanguage(page, "polish");

    await changeLanguage(page, LANGUAGE_PAGE_UI.languages.polish.english);
    await checkValidSidebarLanguage(page, "english");
  });
});
