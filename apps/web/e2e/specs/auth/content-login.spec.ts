import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { USER_ROLE } from "~/config/userRoles";

import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";

import type { IsolatedWorkspaceHandle } from "../../fixtures/test.fixture";
import type { Browser, Page, TestInfo } from "@playwright/test";

const PASSWORD = "Password123@"; // Generated E2E accounts only, never a real account.

test.use({ locale: "pl-PL" });

const screenshot = async (page: Page, testInfo: TestInfo, name: string) => {
  if (!process.env.CONTENT_LOGIN_SCREENSHOT_DIR) return;
  await mkdir(process.env.CONTENT_LOGIN_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(
      process.env.CONTENT_LOGIN_SCREENSHOT_DIR,
      `${testInfo.project.name}-${name}.png`,
    ),
    fullPage: true,
  });
};

const createCourse = async (workspace: IsolatedWorkspaceHandle) => {
  const categoryFactory = workspace.factories.createCategoryFactory();
  const courseFactory = workspace.factories.createCourseFactory();
  const curriculumFactory = workspace.factories.createCurriculumFactory();
  const suffix = randomUUID().slice(0, 8);
  const category = await categoryFactory.create(`Content login ${suffix}`);
  const course = await courseFactory.create({
    categoryId: category.id,
    title: `Content login course ${suffix}`,
    language: "en",
    status: "draft",
  });
  const chapter = await curriculumFactory.createChapter({
    courseId: course.id,
    title: `Protected chapter ${suffix}`,
    isFreemium: false,
  });
  const lesson = await curriculumFactory.createContentLesson(course.id, {
    chapterId: chapter.id,
    title: `Protected lesson ${suffix}`,
    description: `<p>Protected lesson body ${suffix}</p>`,
  });
  await courseFactory.updateSettings(course.id, { lessonSequenceEnabled: false });
  await courseFactory.update(course.id, { status: "published", language: "en" });
  const published = await workspace.apiClient.api.courseControllerGetCourse({
    id: course.id,
    language: "en",
  });
  return { course: published.data.data, lesson, chapter };
};

const setPublicAccess = async (workspace: IsolatedWorkspaceHandle, enabled: boolean) => {
  const settings = await workspace.apiClient.api.settingsControllerGetPublicGlobalSettings();
  if (settings.data.data.unregisteredUserCoursesAccessibility !== enabled) {
    await workspace.apiClient.api.settingsControllerUpdateUnregisteredUserCoursesAccessibility();
  }
  const updated = await workspace.apiClient.api.settingsControllerGetPublicGlobalSettings();
  expect(updated.data.data.unregisteredUserCoursesAccessibility).toBe(enabled);
};

const anonymousPage = async (browser: Browser, origin: string) => {
  const context = await browser.newContext({ baseURL: origin, locale: "pl-PL" });
  await context.addInitScript(() => {
    (window as Window & { ENV?: Record<string, string> }).ENV = {
      VITE_API_URL: window.location.origin,
      VITE_APP_URL: window.location.origin,
    };
  });
  return { context, page: await context.newPage() };
};

const signInFromPrompt = async (page: Page, origin: string, destination: string, email: string) => {
  const action = page.getByRole("link", { name: "Przejdź do logowania", exact: true });
  await expect(action).toHaveAttribute(
    "href",
    `/auth/login?returnTo=${encodeURIComponent(destination)}`,
  );
  await action.click();
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
  // Reload the actual login URL: the destination must not depend only on in-memory history.
  await page.reload();
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
  await page.getByTestId(LOGIN_PAGE_HANDLES.EMAIL).fill(email);
  await page.getByTestId(LOGIN_PAGE_HANDLES.PASSWORD).fill(PASSWORD);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url() === `${origin}/api/auth/login` && response.request().method() === "POST",
  );
  await page.getByTestId(LOGIN_PAGE_HANDLES.LOGIN).click();
  expect((await loginResponse).ok()).toBe(true);
};

for (const target of ["course", "lesson"] as const) {
  test(`anonymous ${target} sign-in preserves the content destination and permits enrolled access`, async ({
    browser,
    createIsolatedWorkspace,
  }, testInfo) => {
    const workspace = await createIsolatedWorkspace();
    const { course, lesson } = await createCourse(workspace);
    await setPublicAccess(workspace, false);
    const student = await workspace.createTenantUserWithPasswordAndRole({
      role: USER_ROLE.student,
    });
    await workspace.factories.createEnrollmentFactory().enrollUsers(course.id, [student.user.id]);
    expect(
      await workspace.factories.createEnrollmentFactory().getUser(course.id, student.user.id),
    ).not.toBeNull();
    const destination =
      target === "course"
        ? `/course/${course.slug}?language=en&source=content-login`
        : `/course/${course.slug}/lesson/${lesson.id}?language=en&source=content-login`;
    const { context, page } = await anonymousPage(browser, workspace.origin);
    try {
      await page.goto(destination);
      await expect(
        page.getByText(`Zaloguj się, aby przejść do ${target === "course" ? "kursu" : "lekcji"}`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByText(`Zaloguj się, aby przejść do ${target === "course" ? "kursu" : "lekcji"}`, {
          exact: true,
        }),
      ).toBeVisible();
      await screenshot(page, testInfo, `anonymous-${target}`);
      await signInFromPrompt(page, workspace.origin, destination, student.user.email);
      await expect(page).toHaveURL(`${workspace.origin}${destination}`);
      if (target === "lesson") {
        await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lesson.title);
      } else {
        await expect(page.getByText(course.title, { exact: true }).first()).toBeVisible();
      }
      await screenshot(page, testInfo, `authenticated-${target}`);
      await page.reload();
      await expect(page).toHaveURL(`${workspace.origin}${destination}`);
      await expect(
        page.getByText(target === "lesson" ? lesson.title : course.title, { exact: true }).first(),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

test("sign-in does not grant a non-enrolled student protected lesson access", async ({
  browser,
  createIsolatedWorkspace,
}, testInfo) => {
  const workspace = await createIsolatedWorkspace();
  const { course, lesson } = await createCourse(workspace);
  await setPublicAccess(workspace, false);
  const student = await workspace.createTenantUserWithPasswordAndRole({ role: USER_ROLE.student });
  const destination = `/course/${course.slug}/lesson/${lesson.id}?language=en`;
  const { context, page } = await anonymousPage(browser, workspace.origin);
  try {
    await page.goto(destination);
    await expect(
      page.getByText("Zaloguj się, aby przejść do lekcji", { exact: true }),
    ).toBeVisible();
    await signInFromPrompt(page, workspace.origin, destination, student.user.email);
    await expect(page).toHaveURL(`${workspace.origin}${destination}`);
    await expect(page.getByText("Not authorized", { exact: true })).toBeVisible();
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveCount(0);
    const currentUser = await context.request.get(`${workspace.origin}/api/auth/current-user`, {
      headers: { Origin: workspace.origin, Referer: `${workspace.origin}/` },
    });
    expect(currentUser).toBeOK();
    expect((await currentUser.json()).data.id).toBe(student.user.id);
    const denied = await context.request.get(
      `${workspace.origin}/api/lesson/${lesson.id}?language=en&studentId=${student.user.id}`,
      {
        headers: { Origin: workspace.origin, Referer: `${workspace.origin}/` },
      },
    );
    // The existing lesson service deliberately responds with 401 for missing assignment.
    expect(denied.status()).toBe(401);
    await screenshot(page, testInfo, "authenticated-denied-lesson");
    await page.reload();
    await expect(page.getByText("Not authorized", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Go back to course", exact: true }).click();
    await expect(page).toHaveURL(`${workspace.origin}/course/${course.slug}`);
    await page.goto(`/course/${randomUUID()}`);
    await expect(page.getByText("Course not found", { exact: true })).toBeVisible();
    await expect(page.getByText("Sign in to access the course", { exact: true })).toHaveCount(0);
    await screenshot(page, testInfo, "authenticated-course-not-found");
  } finally {
    await context.close();
  }
});

test("public course and freemium lesson previews remain available anonymously", async ({
  browser,
  createIsolatedWorkspace,
}, testInfo) => {
  const workspace = await createIsolatedWorkspace();
  const { course, lesson, chapter } = await createCourse(workspace);
  await setPublicAccess(workspace, true);
  await workspace.factories.createCurriculumFactory().setChapterFreemium(chapter.id, true);
  const { context, page } = await anonymousPage(browser, workspace.origin);
  try {
    await page.goto(`/course/${course.slug}?language=en`);
    await expect(page.getByText(course.title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Zaloguj się, aby przejść do kursu", { exact: true })).toHaveCount(
      0,
    );
    const publicLesson = await context.request.get(
      `${workspace.origin}/api/lesson/${lesson.id}?language=en`,
      {
        headers: { Origin: workspace.origin, Referer: `${workspace.origin}/` },
      },
    );
    expect(publicLesson).toBeOK();
    expect((await publicLesson.json()).data.id).toBe(lesson.id);
    const lessonResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api/lesson/${lesson.id}`,
    );
    await page.goto(`/course/${course.slug}/lesson/${lesson.id}?language=en`);
    const response = await lessonResponse;
    await screenshot(page, testInfo, "anonymous-public-preview");
    expect(response.status(), `Anonymous lesson request: ${response.url()}`).toBe(200);
    expect(new URL(response.url()).searchParams.has("studentId")).toBe(false);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lesson.title);
    await expect(page.getByText("Zaloguj się, aby przejść do lekcji", { exact: true })).toHaveCount(
      0,
    );
    await screenshot(page, testInfo, "anonymous-public-preview");
    await page.reload();
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lesson.title);
  } finally {
    await context.close();
  }
});
