import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

const MOBILE_VIEWPORT = { width: 320, height: 844 };

test("admin course controls remain accessible on a small screen", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Responsive Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `Kotlin for Beginners: Modern Android Development ${Date.now()}`,
      categoryId: category.id,
      language: "en",
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await page.setViewportSize(MOBILE_VIEWPORT);
    await openCourseOverviewFlow(page, course.id);

    const settingsButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON);
    const editMediaButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.EDIT_MEDIA_BUTTON);
    const languageSelect = page.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT);
    const hero = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO);
    const heroContent = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_CONTENT);
    const heroTitle = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE);
    const courseActions = page.getByTestId(COURSE_OVERVIEW_HANDLES.ACTIONS);
    const learningModeButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.STUDENT_MODE_BUTTON);
    const detailsButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.DETAILS_BUTTON);
    const learningOutcomes = page.getByTestId(COURSE_OVERVIEW_HANDLES.LEARNING_OUTCOMES);

    await expect(settingsButton).toBeVisible();
    await expect(editMediaButton).toBeVisible();
    await expect(languageSelect).toBeVisible();
    await expect(heroContent).toBeVisible();
    await expect(courseActions).toBeVisible();
    await expect(learningModeButton).toBeVisible();
    await expect(detailsButton).toBeVisible();
    await expect(learningOutcomes).toBeHidden();
    await expect(settingsButton.locator("span")).toBeHidden();
    await expect(editMediaButton.locator("span")).toBeHidden();
    await expect(languageSelect.locator("span.hidden", { hasText: "English" })).toBeHidden();

    for (const element of [
      settingsButton,
      editMediaButton,
      languageSelect,
      hero,
      heroTitle,
      courseActions,
      learningModeButton,
      detailsButton,
    ]) {
      await expect(element).toBeInViewport({ ratio: 1 });
    }
  });
});

test("student course actions remain accessible on a small screen", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();
  let courseId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      const category = await categoryFactory.create(`Responsive Student Category ${Date.now()}`);
      const course = await courseFactory.create({
        title: `Kotlin for Beginners: Modern Android Development ${Date.now()}`,
        categoryId: category.id,
        language: "en",
        status: "published",
      });

      courseId = course.id;

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });
    },
    { root: true },
  );

  try {
    await withWorkerPage(
      USER_ROLE.student,
      async ({ page }) => {
        await enrollmentFactory.selfEnroll(courseId);
        await page.setViewportSize(MOBILE_VIEWPORT);
        await openCourseOverviewFlow(page, courseId);

        const continueLearningButton = page.getByTestId(
          COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON,
        );
        const detailsButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.DETAILS_BUTTON);
        const hero = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO);
        const heroTitle = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE);

        await expect(continueLearningButton).toBeVisible();
        await expect(detailsButton).toBeVisible();
        await expect(continueLearningButton).toHaveText("Continue learning");
        await expect(detailsButton).toHaveText("Course details");

        for (const element of [hero, heroTitle, continueLearningButton, detailsButton]) {
          await expect(element).toBeInViewport({ ratio: 1 });
        }
      },
      { root: true },
    );
  } finally {
    await withWorkerPage(USER_ROLE.admin, async () => {}, { root: true });
  }
});
