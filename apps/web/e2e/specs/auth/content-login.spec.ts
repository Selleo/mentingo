import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { CONTENT_ACCESS_HANDLES, LOGIN_PAGE_HANDLES } from "../../data/auth/handles";
import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { expect, test } from "../../fixtures/test.fixture";
import { fillLoginFormFlow } from "../../flows/auth/fill-login-form.flow";
import { submitLoginFormFlow } from "../../flows/auth/submit-login-form.flow";
import { createContentLoginCourse, setUnregisteredCourseAccess } from "../../utils/content-login";

const LOGIN_PROMPTS = {
  course: {
    prompt: CONTENT_ACCESS_HANDLES.COURSE_LOGIN_REQUIRED,
    signInLink: CONTENT_ACCESS_HANDLES.COURSE_LOGIN_REQUIRED_SIGN_IN_LINK,
  },
  lesson: {
    prompt: CONTENT_ACCESS_HANDLES.LESSON_LOGIN_REQUIRED,
    signInLink: CONTENT_ACCESS_HANDLES.LESSON_LOGIN_REQUIRED_SIGN_IN_LINK,
  },
} as const;

for (const target of ["course", "lesson"] as const) {
  test(`anonymous ${target} sign-in preserves the content destination and permits enrolled access`, async ({
    cleanup,
    createIsolatedWorkspace,
    createWorkspacePage,
  }) => {
    const workspace = await createIsolatedWorkspace();
    const { course, lesson } = await createContentLoginCourse(workspace);
    await setUnregisteredCourseAccess(workspace, false);
    const student = await workspace.createTenantUserWithPasswordAndRole({
      role: USER_ROLE.student,
    });
    await workspace.factories.createEnrollmentFactory().enrollUsers(course.id, [student.user.id]);
    const destination =
      target === "course"
        ? `/course/${course.slug}?language=en&source=content-login`
        : `/course/${course.slug}/lesson/${lesson.id}?language=en&source=content-login`;
    const { prompt, signInLink } = LOGIN_PROMPTS[target];
    const { context, page } = await createWorkspacePage({ origin: workspace.origin });
    cleanup.add(() => context.close());

    await page.goto(destination);
    await expect(page.getByTestId(prompt)).toBeVisible();
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId(prompt)).toBeVisible();

    await expect(page.getByTestId(signInLink)).toHaveAttribute(
      "href",
      `/auth/login?returnTo=${encodeURIComponent(destination)}`,
    );
    await page.getByTestId(signInLink).click();
    await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
    // Reload the login URL: the destination must not depend only on in-memory history.
    await page.reload();
    await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
    await fillLoginFormFlow(page, student.user.email, TEST_PASSWORD);
    await submitLoginFormFlow(page);

    await expect(page).toHaveURL(`${workspace.origin}${destination}`);
    const contentTitle =
      target === "lesson"
        ? page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)
        : page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE);
    const expectedTitle = target === "lesson" ? lesson.title : course.title;
    await expect(contentTitle).toHaveText(expectedTitle);

    await page.reload();
    await expect(page).toHaveURL(`${workspace.origin}${destination}`);
    await expect(contentTitle).toHaveText(expectedTitle);
  });
}

test("sign-in does not grant a non-enrolled student protected lesson access", async ({
  cleanup,
  createIsolatedWorkspace,
  createWorkspacePage,
}) => {
  const workspace = await createIsolatedWorkspace();
  const { course, lesson } = await createContentLoginCourse(workspace);
  await setUnregisteredCourseAccess(workspace, false);
  const student = await workspace.createTenantUserWithPasswordAndRole({ role: USER_ROLE.student });
  const destination = `/course/${course.slug}/lesson/${lesson.id}?language=en`;
  const { context, page } = await createWorkspacePage({ origin: workspace.origin });
  cleanup.add(() => context.close());

  await page.goto(destination);
  await expect(page.getByTestId(CONTENT_ACCESS_HANDLES.LESSON_LOGIN_REQUIRED)).toBeVisible();
  await page.getByTestId(CONTENT_ACCESS_HANDLES.LESSON_LOGIN_REQUIRED_SIGN_IN_LINK).click();
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
  await fillLoginFormFlow(page, student.user.email, TEST_PASSWORD);
  await submitLoginFormFlow(page);

  await expect(page).toHaveURL(`${workspace.origin}${destination}`);
  await expect(page.getByTestId(CONTENT_ACCESS_HANDLES.LESSON_NOT_AUTHORIZED)).toBeVisible();
  await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveCount(0);
  const requestHeaders = { Origin: workspace.origin, Referer: `${workspace.origin}/` };
  const currentUser = await context.request.get(`${workspace.origin}/api/auth/current-user`, {
    headers: requestHeaders,
  });
  expect(currentUser).toBeOK();
  expect((await currentUser.json()).data.id).toBe(student.user.id);
  const denied = await context.request.get(
    `${workspace.origin}/api/lesson/${lesson.id}?language=en&studentId=${student.user.id}`,
    { headers: requestHeaders },
  );
  // The existing lesson service deliberately responds with 401 for missing assignment.
  expect(denied.status()).toBe(401);

  await page.reload();
  await expect(page.getByTestId(CONTENT_ACCESS_HANDLES.LESSON_NOT_AUTHORIZED)).toBeVisible();
  await page.getByTestId(CONTENT_ACCESS_HANDLES.LESSON_NOT_AUTHORIZED_BACK_LINK).click();
  await expect(page).toHaveURL(`${workspace.origin}/course/${course.slug}`);

  await page.goto(`/course/${randomUUID()}`);
  await expect(page.getByTestId(CONTENT_ACCESS_HANDLES.COURSE_NOT_FOUND)).toBeVisible();
  await expect(page.getByTestId(CONTENT_ACCESS_HANDLES.COURSE_LOGIN_REQUIRED)).toHaveCount(0);
});

test("public course and freemium lesson previews remain available anonymously", async ({
  cleanup,
  createIsolatedWorkspace,
  createWorkspacePage,
}) => {
  const workspace = await createIsolatedWorkspace();
  const { course, lesson, chapter } = await createContentLoginCourse(workspace);
  await setUnregisteredCourseAccess(workspace, true);
  await workspace.factories.createCurriculumFactory().setChapterFreemium(chapter.id, true);
  const { context, page } = await createWorkspacePage({ origin: workspace.origin });
  cleanup.add(() => context.close());

  await page.goto(`/course/${course.slug}?language=en`);
  await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE)).toHaveText(course.title);
  await expect(page.getByTestId(CONTENT_ACCESS_HANDLES.COURSE_LOGIN_REQUIRED)).toHaveCount(0);

  const lessonResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/lesson/${lesson.id}`,
  );
  await page.goto(`/course/${course.slug}/lesson/${lesson.id}?language=en`);
  const response = await lessonResponse;
  expect(response.status(), `Anonymous lesson request: ${response.url()}`).toBe(200);
  expect(new URL(response.url()).searchParams.has("studentId")).toBe(false);
  await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lesson.title);
  await expect(page.getByTestId(CONTENT_ACCESS_HANDLES.LESSON_LOGIN_REQUIRED)).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lesson.title);
});
