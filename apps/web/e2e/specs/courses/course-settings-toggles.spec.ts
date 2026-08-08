import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, COURSE_SETTINGS_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

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

    await openCourseOverviewFlow(page, course.id);
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON).click();
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER).waitFor();

    await page.getByTestId(COURSE_SETTINGS_HANDLES.LESSON_SEQUENCE_SWITCH).click();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.QUIZ_FEEDBACK_SWITCH).click();

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
  });
});
