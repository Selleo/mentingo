import { test, expect, type Page } from "@playwright/test";

import { LANGUAGE_PAGE_UI } from "./tests/admin/data/language-data";

const navigateToPage = async (page: Page, name: string, headerText: string) => {
  const userAvatar = page.getByRole("button", { name: /(avatar for|profile test)/i });
  const pageLinkButton = page.getByRole("link", { name: new RegExp(name, "i") });

  if (!(await pageLinkButton.isVisible())) {
    await userAvatar.click();
  }

  await pageLinkButton.click();

  await page.waitForURL(/.*/);

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
    const translation = page
      .getByRole("button", { name: new RegExp(element, "i") })
      .getByRole("link");
    await expect(translation).toHaveText(new RegExp(element, "i"));
  }
};

test.describe("Switch language flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    const announcementsButton = page.getByRole("link", { name: /announcements/i });

    if (!(await announcementsButton.isVisible())) {
      await page
        .getByRole("button", { name: /manage/i })
        .first()
        .click();
    }

    await navigateToPage(
      page,
      LANGUAGE_PAGE_UI.button.settings,
      LANGUAGE_PAGE_UI.header.changeLanguage,
    );
  });

  test("should switch to Polish and verify translations", async ({ page }) => {
    await changeLanguage(page, LANGUAGE_PAGE_UI.languages.polish.language);
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
