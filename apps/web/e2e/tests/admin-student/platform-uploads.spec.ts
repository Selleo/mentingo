import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

type CertificateBackgroundResponse = {
  data?: {
    certificateBackgroundImage: string | null;
  };
};

type GlobalSettingsResponse = {
  data?: {
    loginBackgroundImageS3Key: string | null;
    certificateBackgroundImage: string | null;
  };
};

type EvaluationQuizResponse = {
  data?: {
    data: {
      correctAnswerCount: number;
    };
  };
};

type CertificateResponse = {
  id: string;
}[];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_IMAGE = path.join(__dirname, "..", "..", "data", "images", "profile_icon_test.png");

const CREDENTIALS = {
  admin: { email: "admin@example.com", password: "password" },
  student: { email: "student@example.com", password: "password" },
};

const COURSE_NAME = "Fake test to certificate";
const CHAPTER_NAME = "Understanding Data and Its Importance";
const LESSON_LINK_NAME = "What is Data Science? Content";
const LESSON_TITLE = "What is Data Science?";
const QUIZ_ANSWER = "Data destruction";

const PROFILE_BUTTON_PATTERN = /Test Admin profile Test Admin|Avatar for email@example.com/i;

async function openProfileMenu(page: Page) {
  await page.getByRole("button", { name: PROFILE_BUTTON_PATTERN }).click();
}

async function logout(page: Page) {
  await openProfileMenu(page);
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
}

async function loginAs(page: Page, email: string, password: string) {
  await page.getByPlaceholder("user@example.com").click();
  await page.getByPlaceholder("user@example.com").fill(email);
  await page.getByLabel("Password").click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

async function navigateToSettings(page: Page) {
  await openProfileMenu(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("/settings", { timeout: 10000 });
}

async function openPlatformCustomizationTab(page: Page) {
  const platformCustomizationTab = page.getByRole("tab", { name: "Platform Customization" });
  await platformCustomizationTab.waitFor({ state: "visible" });
  await platformCustomizationTab.click();
  await expect(page.getByRole("heading", { name: "Certificate Background Upload" })).toBeVisible();
}

async function uploadCertificateBackground(page: Page) {
  await page.locator("#certificate-background-upload").getByTestId("imageUpload").click();
  await page
    .locator("#certificate-background-upload")
    .getByTestId("imageUpload")
    .setInputFiles(SAMPLE_IMAGE);
  await expect(page.getByRole("button", { name: "Remove Background Image" })).toBeVisible();
  await page
    .locator("#certificate-background-upload")
    .getByRole("button", { name: "Save" })
    .click();

  const certificateResponse = await page.waitForResponse(
    (response) =>
      response.url().includes("/api/settings/certificate-background") &&
      response.status() === 200 &&
      response.request().method() === "PATCH",
  );
  const certificateBody = (await certificateResponse.json()) as CertificateBackgroundResponse;
  const uploadedCertificatePath = certificateBody?.data?.certificateBackgroundImage;

  await expect(
    page.getByText("Certificate background image changed successfully", { exact: true }),
  ).toBeVisible();

  return uploadedCertificatePath;
}

async function uploadLoginBackground(page: Page) {
  await page
    .locator("#organization-login-background-image-upload")
    .getByTestId("imageUpload")
    .click();
  await page
    .locator("#organization-login-background-image-upload")
    .getByTestId("imageUpload")
    .setInputFiles(SAMPLE_IMAGE);
  await expect(
    page
      .locator("#organization-login-background-image-upload")
      .getByRole("button", { name: "Remove Background Image" }),
  ).toBeVisible();
  await page
    .locator("#organization-login-background-image-upload")
    .getByRole("button", { name: "Save" })
    .click();
  await expect(
    page.getByText("Login background image changed successfully", { exact: true }),
  ).toBeVisible();
}

async function verifyGlobalSettingsAfterLogout(
  page: Page,
  uploadedCertificatePath: string | null | undefined,
) {
  await page.waitForURL("/auth/login");

  const globalResponse = await page.waitForResponse(
    (response) =>
      response.url().includes("/api/settings/global") &&
      response.status() === 200 &&
      response.request().method() === "GET",
  );
  const globalBody = (await globalResponse.json()) as GlobalSettingsResponse;
  const loginBackgroundImage = globalBody?.data?.loginBackgroundImageS3Key;
  const certificateBackgroundImage = globalBody?.data?.certificateBackgroundImage;
  expect(loginBackgroundImage).toBeTruthy();
  expect(certificateBackgroundImage).toContain(uploadedCertificatePath);
}

async function navigateToCourseEditor(page: Page) {
  await page.getByTestId(COURSE_NAME).click();
  await page.getByTestId(CHAPTER_NAME).click();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByTestId(/Freemium - [a-f0-9-]{36}/).click();
}

async function enrollStudent(page: Page, studentEmail: string) {
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText(studentEmail).click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm enrollment" })).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: "Individually enrolled" }).first()).toBeVisible();
}

async function logoutFromCourseEditor(page: Page) {
  await openProfileMenu(page);
  await page.locator("html").click();
  await page.getByRole("tab", { name: "Settings" }).click();
  await openProfileMenu(page);
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
}

async function studentNavigatesToCourseAndCompletesQuiz(page: Page) {
  await expect(page.getByRole("heading", { name: "Your Courses" })).toBeVisible();
  await page.getByTestId(COURSE_NAME).click();
  await page.getByTestId(CHAPTER_NAME).click();
  await page.getByRole("link", { name: LESSON_LINK_NAME }).click();
  await expect(page.getByText(LESSON_TITLE).first()).toBeVisible();
  await page.getByTestId("next-lesson-button").click();
  await page.locator("label").filter({ hasText: QUIZ_ANSWER }).first().click();
  await page.getByRole("button", { name: "Submit" }).click();
}

async function verifyQuizSubmission(page: Page) {
  const quizResponse = await page.waitForResponse(
    (response) =>
      response.url().includes("/api/lesson/evaluation-quiz") &&
      response.status() === 201 &&
      response.request().method() === "POST",
  );
  const quizBody = (await quizResponse.json()) as EvaluationQuizResponse;
  const correctAnswerCount = quizBody?.data?.data.correctAnswerCount;
  expect(correctAnswerCount).toBe(1);
}

async function verifyCertificateIsAvailable(page: Page) {
  await page.goBack();
  await page.goBack();

  const certificateResponse2 = await page.waitForResponse(
    (response) =>
      response.url().includes("/api/certificates/certificate") &&
      response.status() === 200 &&
      response.request().method() === "GET",
  );
  const certificateBody2 = (await certificateResponse2.json()) as CertificateResponse;
  const certificateId = certificateBody2?.[0].id;
  expect(certificateId).toBeTruthy();

  const certificateHeader = page.getByText("Congratulations! You have");
  await certificateHeader.waitFor({ state: "visible" });
  await expect(certificateHeader).toBeVisible();
  await expect(page.getByRole("button", { name: "View Certificate" })).toBeVisible();
  await page.getByRole("button", { name: "View Certificate" }).click();
}

test.describe("Platform uploads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should upload login background and certificate background and verify that it works", async ({
    page,
  }) => {
    await navigateToSettings(page);
    await openPlatformCustomizationTab(page);
    const uploadedCertificatePath = await uploadCertificateBackground(page);
    await uploadLoginBackground(page);

    await logout(page);
    await verifyGlobalSettingsAfterLogout(page, uploadedCertificatePath);

    await loginAs(page, CREDENTIALS.admin.email, CREDENTIALS.admin.password);
    await navigateToCourseEditor(page);
    await enrollStudent(page, CREDENTIALS.student.email);

    await logoutFromCourseEditor(page);

    await loginAs(page, CREDENTIALS.student.email, CREDENTIALS.student.password);
    await studentNavigatesToCourseAndCompletesQuiz(page);

    await verifyQuizSubmission(page);

    await verifyCertificateIsAvailable(page);
  });
});
