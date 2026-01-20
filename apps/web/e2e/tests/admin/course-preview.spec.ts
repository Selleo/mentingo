import { test, expect } from "@playwright/test";

import type { Page } from "@playwright/test";

const COURSE_HEADING = "Mathematics for Beginners:";
const COURSE_TITLE = "Mathematics for Beginners: Building a Strong Foundation";
const CHAPTER_TITLE = "Arithmetic Essentials:";
const CHAPTER_TITLE_UPDATED = "Arithmetic Essentials: Numbers and Operations (Changed title)";
const LESSON_TITLE = "Introduction to Arithmetic (changed)";
const NEW_CHAPTER_LABEL = "new chapter";
const CHAPTER_OVERVIEW_PREFIX = "Mathematics Basics Quiz: Test";
const FREEMIUM_TEST_ID =
  /^Freemium - [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const openCourseEditor = async (page: Page) => {
  await expect(page.getByRole("heading", { name: "Available Courses" })).toBeVisible();
  await page.getByTestId(COURSE_TITLE).click();
  await expect(page.getByRole("heading", { name: COURSE_HEADING })).toBeVisible();
  await page.getByRole("button", { name: "Edit Course" }).click();
};

const addChapterAndLesson = async (page: Page) => {
  await page.getByRole("button", { name: "Add chapter" }).click();
  await expect(page.getByText("Create")).toBeVisible();
  await page.getByLabel("* Title").click();
  await page.getByLabel("* Title").fill(NEW_CHAPTER_LABEL);
  await page.getByRole("button", { name: "Save" }).click();

  await page
    .getByRole("heading", { name: "Add content to your chapter" })
    .waitFor({ state: "visible", timeout: 10000 });

  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const contentLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.content lesson type",
  );

  await contentLessonType.waitFor({ state: "visible" });
  await expect(contentLessonType).toBeVisible();
  await contentLessonType.click();

  await page.getByPlaceholder("Provide lesson title...").click();
  await page.getByPlaceholder("Provide lesson title...").fill("lesson title");
  await page.getByRole("paragraph").click();
  await page.locator("#description div").fill("desc");
  await page.getByRole("button", { name: "Save" }).click();
};

const markFreemium = async (page: Page) => {
  await expect(page.getByRole("heading", { name: "Add content to your chapter" })).toBeVisible();
  await expect(page.getByLabel("Lesson: lesson title")).toBeVisible();

  const freemiumRow = page.getByTestId(FREEMIUM_TEST_ID);
  await freemiumRow.nth(0).click();
  await freemiumRow.nth(4).click();
};

const editChapterAndLesson = async (page: Page) => {
  await page
    .locator("li")
    .filter({ hasText: "new chapterChapter 5 • Number" })
    .getByRole("button")
    .first()
    .click();

  await page.getByRole("heading", { name: CHAPTER_TITLE }).click();
  const editButton = page.getByText("Edit:");
  await editButton.waitFor({ state: "visible", timeout: 10000 });
  await expect(editButton).toBeVisible();

  await page.getByLabel("* Title").click();
  await page.getByLabel("* Title").fill(CHAPTER_TITLE_UPDATED);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Add content to your chapter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: CHAPTER_TITLE })).toBeVisible();

  await page.getByLabel("Lesson: Introduction to").click();
  await page.getByPlaceholder("Provide lesson title...").click();
  await page.getByPlaceholder("Provide lesson title...").fill(LESSON_TITLE);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Add content to your chapter" })).toBeVisible();
};

const moveChapterAndDelete = async (page: Page) => {
  const chapterToMove = page.locator(".ml-2 > div > button").first();
  const chapterDropTarget = page.locator("li:nth-child(4) > .p-0 > div");
  await chapterToMove.dragTo(chapterDropTarget);

  await page.getByRole("heading", { name: CHAPTER_OVERVIEW_PREFIX }).click();
  await expect(page.locator("span").filter({ hasText: CHAPTER_OVERVIEW_PREFIX })).toBeVisible();
  await page.getByLabel("Delete chapter").click();
  await expect(page.getByRole("heading", { name: "Are you sure you want to" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
};

const validatePreview = async (page: Page) => {
  await page
    .getByRole("heading", { name: COURSE_HEADING })
    .waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("link", { name: "Preview" }).click();

  await expect(page.getByRole("heading", { name: COURSE_HEADING })).toBeVisible();
  await expect(page.getByTestId(CHAPTER_TITLE_UPDATED)).toBeVisible();
  await expect(page.getByTestId(NEW_CHAPTER_LABEL)).toBeVisible();
  expect(page.getByRole("heading", { name: CHAPTER_OVERVIEW_PREFIX })).not.toBeVisible();

  const freeLabels = await page.getByText("Free").all();
  expect(freeLabels.length).toBe(2);
  await expect(page.getByText("03 new chapter0/0Free")).toBeVisible();
  await page.getByTestId(CHAPTER_TITLE_UPDATED).click();
  await expect(page.getByRole("link", { name: LESSON_TITLE })).toBeVisible();
  await expect(page.getByRole("link", { name: "lesson title Content Not" })).toBeVisible();
};

const changeLanguageAndVerifyIt = async (page: Page) => {
  await page.goBack();
  await expect(
    page
      .locator("div")
      .filter({ hasText: /^EnglishDefault$/ })
      .nth(1),
  ).toBeVisible();
  await page.getByRole("combobox").click();
  await page.getByLabel("Polish").click();
  await expect(page.getByRole("heading", { name: "Create new language" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Generate missing translations" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByLabel("Notifications (F8)").getByRole("button").click();
  await expect(page.getByRole("heading", { name: "nowy rozdział" })).toBeVisible();
  await page.getByRole("link", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Matematyka dla początkujących" })).toBeVisible();
};

test.describe("Course preview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should check course preview", async ({ page }) => {
    await openCourseEditor(page);
    await addChapterAndLesson(page);
    await markFreemium(page);
    await editChapterAndLesson(page);
    await moveChapterAndDelete(page);
    await validatePreview(page);
    await changeLanguageAndVerifyIt(page);
  });
});
