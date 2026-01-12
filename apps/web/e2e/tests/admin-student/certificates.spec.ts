import fs from "fs/promises";

import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

const USERS = {
  student: { email: "student@example.com", password: "password" },
};

const COURSE = {
  title: "new course",
  categoryTestId: "category-option-E2E Testing",
  categoryName: "E2E Testing",
  description: "desc",
  chapterTitle: "chapter",
  lessonTitle: "title",
  lessonDescription: "title description",
  freemiumTestId: /^Freemium - [0-9a-fA-F-]{36}$/,
};

const TEXT = {
  progressHeading: "Course progress",
  congratsSnippet: "Congratulations! You have",
  viewCertificate: "View Certificate",
  certEn: "CERTIFICATE OF COURSE",
  certPl: "CERTYFIKAT UKOŃCZENIA KURSU",
  languageToggle: "Language Toggle",
  notStartedLesson: "title Text Not Started",
};

const goToCourses = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
};

const startCourseCreation = async (page: Page) => {
  await page.locator(".h-min > button:nth-child(2)").click();
  await page.getByRole("button", { name: "Create new" }).click();
};

const fillCourseBasics = async (page: Page) => {
  await page.getByPlaceholder("Enter title").fill(COURSE.title);
  await page.getByLabel("* Category").click();
  await page.getByTestId(COURSE.categoryTestId).getByText(COURSE.categoryName).click();
  await page.locator("#description div").fill(COURSE.description);
  await page.getByRole("button", { name: "Proceed" }).click();
};

const addChapterWithLesson = async (page: Page) => {
  await page.getByRole("button", { name: "Add chapter" }).click();
  await page.getByLabel("* Title").fill(COURSE.chapterTitle);
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Add lesson" }).click();
  await page.getByLabel("Choose adminCourseView.curriculum.lesson.other.text lesson type").click();
  await page.getByPlaceholder("Provide lesson title...").fill(COURSE.lessonTitle);
  await page.locator("#description div").fill(COURSE.lessonDescription);
  await page.getByRole("button", { name: "Save" }).click();
};

const enableCertificate = async (page: Page) => {
  await page.getByTestId(COURSE.freemiumTestId).click();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Enable certificate").click();
};

const publishAndEnroll = async (page: Page) => {
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByRole("button", { name: "Published Students can" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByRole("cell", { name: "Student", exact: true }).nth(2).click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

const logout = async (page: Page) => {
  await page
    .getByRole("button", { name: /Test Admin profile Test Admin|Avatar for email@example.com/i })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const login = async (page: Page, email: string, password: string) => {
  await page.getByPlaceholder("user@example.com").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
};

const openCourseAsStudent = async (page: Page) => {
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  const nextSlide = page.getByRole("button", { name: "Next slide" });
  await nextSlide.waitFor({ state: "visible" });
  if (await nextSlide.isEnabled()) {
    await nextSlide.click();
  }
  await page.getByTestId(COURSE.title).click();
  await page.getByTestId(COURSE.chapterTitle).click();
  await page.getByRole("link", { name: TEXT.notStartedLesson }).click();

  await page.waitForURL(/course\/[\w-]+\/lesson\/[\w-]+/);
  await page.waitForResponse(
    (response) =>
      response.url().includes("/api/lesson") &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await page.waitForTimeout(1000);

  const backToCourse = page.getByRole("link", { name: "new course" });
  await backToCourse.waitFor({ state: "visible" });
  await backToCourse.click();
};

const verifyCourseProgressAndDownload = async (page: Page) => {
  const progressHeading = page.getByRole("heading", { name: TEXT.progressHeading });
  await progressHeading.waitFor({ state: "visible" });
  await expect(page.locator("svg").filter({ hasText: "/1" })).toBeVisible();
  await expect(
    page.getByRole("main").locator("div").filter({ hasText: TEXT.congratsSnippet }).nth(4),
  ).toBeVisible();

  await expect(page.getByRole("button", { name: TEXT.viewCertificate })).toBeVisible();
  await page.getByRole("button", { name: TEXT.viewCertificate }).click();
  await expect(page.getByRole("button", { name: TEXT.certEn })).toBeVisible();
  await expect(page.getByLabel(TEXT.languageToggle)).toBeVisible();
  await page.getByLabel(TEXT.languageToggle).click();
  await expect(page.getByRole("button", { name: TEXT.certPl })).toBeVisible();
  await expect(
    page.getByRole("button", { name: TEXT.certPl }).getByRole("button").first(),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: TEXT.certPl }).getByRole("button").first().click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  if (downloadPath) {
    const stats = await fs.stat(downloadPath);
    expect(stats.size).toBeGreaterThan(0);
  }
};

test.describe("Certificates flow", () => {
  test("should create a certificate", async ({ page }) => {
    await goToCourses(page);
    await startCourseCreation(page);
    await fillCourseBasics(page);
    await addChapterWithLesson(page);
    await enableCertificate(page);
    await publishAndEnroll(page);
    await logout(page);

    await login(page, USERS.student.email, USERS.student.password);
    await openCourseAsStudent(page);
    await verifyCourseProgressAndDownload(page);

    await page
      .getByRole("button", { name: /Avatar for email@example.com|test Student profile test/i })
      .click();
    await page.getByRole("link", { name: "Profile" }).click();
    await expect(page.getByRole("button", { name: COURSE.title })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Certificates" })).toBeVisible();
  });
});
