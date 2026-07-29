import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

const MOBILE_VIEWPORT = { width: 320, height: 844 };

test("admin course controls stay in one compact row on a small screen", async ({
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
    await expect(courseActions).toBeVisible();
    await expect(learningModeButton).toBeVisible();
    await expect(detailsButton).toBeVisible();
    await expect(learningOutcomes).toBeHidden();
    await expect(settingsButton.locator("span")).toBeHidden();
    await expect(editMediaButton.locator("span")).toBeHidden();
    await expect(languageSelect.locator("span.hidden", { hasText: "English" })).toBeHidden();

    const settingsBox = await settingsButton.boundingBox();
    const editMediaBox = await editMediaButton.boundingBox();
    const languageBox = await languageSelect.boundingBox();
    const heroBox = await hero.boundingBox();
    const heroContentBox = await heroContent.boundingBox();
    const heroTitleBox = await heroTitle.boundingBox();
    const learningModeBox = await learningModeButton.boundingBox();
    const detailsBox = await detailsButton.boundingBox();

    expect(settingsBox).not.toBeNull();
    expect(editMediaBox).not.toBeNull();
    expect(languageBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(heroContentBox).not.toBeNull();
    expect(heroTitleBox).not.toBeNull();
    expect(learningModeBox).not.toBeNull();
    expect(detailsBox).not.toBeNull();

    if (
      !(
        settingsBox &&
        editMediaBox &&
        languageBox &&
        heroBox &&
        heroContentBox &&
        heroTitleBox &&
        learningModeBox &&
        detailsBox
      )
    ) {
      throw new Error("Course overview hero, controls, and content must have measurable bounds");
    }

    const toolbarBottom = Math.max(
      settingsBox.y + settingsBox.height,
      editMediaBox.y + editMediaBox.height,
      languageBox.y + languageBox.height,
    );
    const actionsBottom = Math.max(
      learningModeBox.y + learningModeBox.height,
      detailsBox.y + detailsBox.height,
    );
    const heroBottom = heroBox.y + heroBox.height;
    const heroRight = heroBox.x + heroBox.width;

    expect(heroBox.x).toBeGreaterThanOrEqual(0);
    expect(heroRight).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    expect(Math.abs(settingsBox.y - editMediaBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(settingsBox.y - languageBox.y)).toBeLessThanOrEqual(2);
    expect(settingsBox.x + settingsBox.width).toBeLessThanOrEqual(editMediaBox.x);
    expect(editMediaBox.x + editMediaBox.width).toBeLessThanOrEqual(languageBox.x);
    expect(languageBox.width).toBeLessThanOrEqual(60);
    expect(languageBox.x).toBeGreaterThanOrEqual(heroBox.x);
    expect(languageBox.x + languageBox.width).toBeLessThanOrEqual(heroRight);
    expect(toolbarBottom).toBeLessThanOrEqual(heroContentBox.y);
    expect(heroTitleBox.x).toBeGreaterThanOrEqual(heroBox.x);
    expect(heroTitleBox.x + heroTitleBox.width).toBeLessThanOrEqual(heroRight);
    expect(heroTitleBox.y + heroTitleBox.height).toBeLessThanOrEqual(heroBottom);
    expect(actionsBottom).toBeLessThanOrEqual(heroBottom);
  });
});

test("student course actions stay visible on a small screen", async ({
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

        const primaryActionButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON);
        const detailsButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.DETAILS_BUTTON);
        const hero = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO);
        const heroTitle = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE);

        await expect(primaryActionButton).toBeVisible();
        await expect(detailsButton).toBeVisible();
        await expect(primaryActionButton).toHaveText("No lessons available");
        await expect(primaryActionButton).toBeDisabled();
        await expect(detailsButton).toHaveText("Course details");

        const primaryActionBox = await primaryActionButton.boundingBox();
        const detailsBox = await detailsButton.boundingBox();
        const heroBox = await hero.boundingBox();
        const heroTitleBox = await heroTitle.boundingBox();

        expect(primaryActionBox).not.toBeNull();
        expect(detailsBox).not.toBeNull();
        expect(heroBox).not.toBeNull();
        expect(heroTitleBox).not.toBeNull();

        if (!(primaryActionBox && detailsBox && heroBox && heroTitleBox)) {
          throw new Error("Student course hero and actions must have measurable bounds");
        }

        const actionsBottom = Math.max(
          primaryActionBox.y + primaryActionBox.height,
          detailsBox.y + detailsBox.height,
        );
        const heroBottom = heroBox.y + heroBox.height;
        const heroRight = heroBox.x + heroBox.width;

        expect(heroBox.x).toBeGreaterThanOrEqual(0);
        expect(heroRight).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
        expect(heroTitleBox.x).toBeGreaterThanOrEqual(heroBox.x);
        expect(heroTitleBox.x + heroTitleBox.width).toBeLessThanOrEqual(heroRight);
        expect(heroTitleBox.y + heroTitleBox.height).toBeLessThanOrEqual(heroBottom);
        expect(actionsBottom).toBeLessThanOrEqual(heroBottom);
      },
      { root: true },
    );
  } finally {
    await withWorkerPage(USER_ROLE.admin, async () => {}, { root: true });
  }
});
