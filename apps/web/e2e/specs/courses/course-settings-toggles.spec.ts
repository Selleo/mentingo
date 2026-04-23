import { USER_ROLE } from "~/config/userRoles";

import { COURSE_SETTINGS_HANDLES, COURSE_TAB_VALUES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";

test("admin can toggle course certificate and settings switches", async ({
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
      hasCertificate: false,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.SETTINGS);
    await page.getByTestId(COURSE_SETTINGS_HANDLES.CERTIFICATE_SWITCH).click();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.LESSON_SEQUENCE_SWITCH).click();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.QUIZ_FEEDBACK_SWITCH).click();

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        const settings = await courseFactory.getSettings(course.id);
        return {
          hasCertificate: updatedCourse.hasCertificate,
          lessonSequenceEnabled: settings.lessonSequenceEnabled,
          quizFeedbackEnabled: settings.quizFeedbackEnabled,
        };
      })
      .toEqual({
        hasCertificate: true,
        lessonSequenceEnabled: true,
        quizFeedbackEnabled: false,
      });
  });
});
