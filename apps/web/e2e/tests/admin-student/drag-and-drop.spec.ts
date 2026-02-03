import { test, expect, type Page } from "@playwright/test";

const COURSE_TITLE = "Artificial Intelligence in Business: Fundamentals";
const COURSE_HEADING = "Artificial Intelligence in";
const CHAPTER_TITLE = "Understanding AI Basics";
const TOAST_TEXT = "Lesson display order updated successfully";
const LESSON_TITLES = {
  keyConcepts: "Key Concepts and Terminologies in AI",
  applications: "AI Applications Across Industries",
  quizPrimaryGoal: "AI Quiz: Primary Goal of AI in Business (1)",
};
const expectedLastLessons = [
  LESSON_TITLES.keyConcepts,
  LESSON_TITLES.applications,
  "AI Quiz: Primary Goal of AI in Business",
];
const EDITED_CHAPTER_NAME = "Edited chapter";

const openCourseEdit = async (page: Page) => {
  await page.getByTestId(COURSE_TITLE).first().click();
  await page.waitForURL(/course\/[\w-]+/);
  const editBtn = page.getByRole("button", { name: "Edit Course" });
  await editBtn.waitFor({ state: "visible", timeout: 10000 });
  await expect(editBtn).toBeVisible();
  await expect(page.getByRole("heading", { name: COURSE_HEADING })).toBeVisible();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await expect(page.getByText("Chapter 1 • Number of lessons")).toBeVisible();
  await page.getByTestId(/^accordion - [\w-]{36}$/).click();
};

const getLessonTitlesInEditor = (page: Page) => {
  return page.locator(".p-0 > div").getByTestId("lesson-title");
};

const confirmOrderChangeToast = async (page: Page) => {
  await expect(page.getByText(TOAST_TEXT, { exact: true })).toBeVisible();
  await page.getByLabel("Notifications (F8)").getByRole("button").click();
  await page.waitForTimeout(300);
};

const assertLessonOrderInPreview = async (page: Page) => {
  const chapterButton = page.getByTestId(new RegExp(`${CHAPTER_TITLE}|${EDITED_CHAPTER_NAME}`));
  await chapterButton.waitFor({ state: "visible" });
  await chapterButton.click();

  const lessonTitles = await page.getByTestId("lesson-title").all();
  expect(lessonTitles.length).toBe(9);
  const lastTitles = lessonTitles.slice(-expectedLastLessons.length);

  for (const [index, title] of expectedLastLessons.entries()) {
    await expect(lastTitles[index]).toContainText(title);
  }
};

const moveLessonToEnd = async (page: Page, labelPrefix: string, expectedTitle: string) => {
  const lessons = await getLessonTitlesInEditor(page).all();
  expect(await lessons.at(0)?.textContent()).toBe(expectedTitle);
  const dragHandle = page.getByLabel(labelPrefix).getByRole("button");
  const elementAfterLastLesson = page.getByText("Add lessonFree chapter");
  await dragHandle.dragTo(elementAfterLastLesson);
  await confirmOrderChangeToast(page);
  const updatedLessons = await getLessonTitlesInEditor(page).all();
  expect(await updatedLessons.at(-1)?.textContent()).toBe(expectedTitle);
};

test.describe("Drag and drop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("drag and drop lessons", async ({ page }) => {
    await openCourseEdit(page);

    await moveLessonToEnd(page, "Lesson: Key Concepts and", LESSON_TITLES.keyConcepts);
    await moveLessonToEnd(page, "Lesson: AI Applications", LESSON_TITLES.applications);
    await moveLessonToEnd(page, "Lesson: AI Quiz: Primary Goal", LESSON_TITLES.quizPrimaryGoal);

    await expect(page.getByRole("link", { name: "Preview" })).toBeVisible();
    await page.getByRole("link", { name: "Preview" }).click();
    await page.waitForResponse(async (response) => {
      return (
        response.url().includes("/api/course?id=") &&
        response.status() === 200 &&
        response.request().method() === "GET"
      );
    });
    await assertLessonOrderInPreview(page);
    await page
      .getByRole("button", { name: /Avatar for email@example.com|Test Admin profile Test Admin/i })
      .click();
    await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
    await page.getByPlaceholder("user@example.com").click();
    await page.getByPlaceholder("user@example.com").fill("student@example.com");
    await page.getByLabel("Password").click();
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("/courses");
    await expect(page.getByTestId(COURSE_TITLE).first()).toBeVisible();
    await page.getByTestId(COURSE_TITLE).first().click();

    await assertLessonOrderInPreview(page);
  });
});
