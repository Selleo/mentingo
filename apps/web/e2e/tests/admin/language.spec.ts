import { test, expect, type Page } from "@playwright/test";

const LANGUAGE_PAGE_UI = {
  button: {
    settings: "settings",
  },
  header: {
    changeLanguage: "Change Language",
  },
  languages: {
    polish: {
      language: "polish",
      english: "angielski",
      sidebarItems: {
        dashboard: "pulpit",
        myCourses: "moje kursy",
        browseCourses: "przeglądaj kursy",
        categories: "kategorie",
        users: "użytkownicy",
        groups: "grupy",
        profile: "profil",
      },
    },
    english: {
      language: "english",
      sidebarItems: {
        dashboard: "dashboard",
        myCourses: "my courses",
        browseCourses: "browse courses",
        categories: "categories",
        users: "users",
        groups: "groups",
        profile: "profile",
      },
    },
  },
};

const navigateToPage = async (page: Page, name: string, headerText: string) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();

  const header = page.getByRole("heading").filter({ hasText: headerText });

  await expect(header).toHaveText(headerText);
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
    const translation = page.getByRole("link", { name: new RegExp(element, "i") });
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
    await checkValidSidebarLanguage(page, "polish");
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
