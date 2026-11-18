import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, COURSE_SETTINGS_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewSettingsFlow } from "../../flows/courses/open-course-overview-settings.flow";

test("admin can toggle course settings switches", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Toggle Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `toggle-course-${Date.now()}`,
      categoryId: category.id,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCourseOverviewSettingsFlow(page, course.id);
    const settingsDrawer = page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER);

    const lessonSequenceSwitch = settingsDrawer.getByTestId(
      COURSE_SETTINGS_HANDLES.LESSON_SEQUENCE_SWITCH,
    );
    const quizFeedbackSwitch = settingsDrawer.getByTestId(
      COURSE_SETTINGS_HANDLES.QUIZ_FEEDBACK_SWITCH,
    );
    await expect(lessonSequenceSwitch).toBeVisible();
    await expect(quizFeedbackSwitch).toBeVisible();
    await expect(lessonSequenceSwitch).toBeEnabled();
    await expect(quizFeedbackSwitch).toBeEnabled();

    await lessonSequenceSwitch.click();

    await expect
      .poll(async () => {
        const settings = await courseFactory.getSettings(course.id);
        return settings.lessonSequenceEnabled;
      })
      .toBe(true);

    await expect(quizFeedbackSwitch).toBeEnabled();
    await quizFeedbackSwitch.click();

    await expect
      .poll(async () => {
        const settings = await courseFactory.getSettings(course.id);
        return {
          lessonSequenceEnabled: settings.lessonSequenceEnabled,
          quizFeedbackEnabled: settings.quizFeedbackEnabled,
        };
      })
      .toEqual({
        lessonSequenceEnabled: true,
        quizFeedbackEnabled: false,
      });

    await openCourseOverviewSettingsFlow(page, course.id);
    await expect(lessonSequenceSwitch).toBeChecked();
    await expect(quizFeedbackSwitch).not.toBeChecked();
  });
});
