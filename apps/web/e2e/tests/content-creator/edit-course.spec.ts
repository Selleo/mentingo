import { test, expect } from "@playwright/test";

export const TEST_EDIT_COURSE = {
  button: {
    save: "save",
  },
  label: {
    title: "Title",
  },
  chapterName: "Edited chapter",
} as const;

test.describe("Content creator edit course", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should edit chapter name in course", async ({ page }) => {
    await page.goto("admin/courses");

    await page.waitForSelector("tbody > tr");
    const courseRows = await page.locator("tbody > tr");
    const courseCount = await courseRows.count();
    if (courseCount === 0) {
      test.skip();
      return;
    }

    await courseRows.first().click();
    await page.waitForURL(/\/beta-courses\/[a-f0-9-]{36}/);

    await page.waitForSelector("ul > li");

    const chapterList = await page.locator("ul > li");
    const chapterCount = await chapterList.count();
    if (chapterCount === 0) {
      test.skip();
      return;
    }

    await chapterList.first().click();

    await page.getByLabel(TEST_EDIT_COURSE.label.title).fill(TEST_EDIT_COURSE.chapterName);
    await page.getByRole("button", { name: new RegExp(TEST_EDIT_COURSE.button.save, "i") }).click();

    await page
      .getByRole("heading", { name: TEST_EDIT_COURSE.chapterName, level: 3 })
      .waitFor({ state: "visible" });

    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Chapter updated successfully", { exact: true }),
    ).toBeVisible();

    const chapterTitle = await page.locator("ul li h3").first().innerText();
    expect(chapterTitle).toBe(TEST_EDIT_COURSE.chapterName);
  });
});
