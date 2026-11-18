import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, COURSE_SETTINGS_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewSettingsFlow } from "../../flows/courses/open-course-overview-settings.flow";
import {
  assertCourseLessonProgressFlow,
  getLearnerCourseFlow,
} from "../../flows/learning/assert-learning-progress.flow";
import { goToNextLessonFlow } from "../../flows/learning/go-to-next-lesson.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { createTwoContentLessonsCourse } from "../../utils/learning-courses";

test("an opted-in completed course can be repeated, resumed and replaced", async ({
  cleanup,
  factories,
  apiClient,
  withWorkerPage,
}) => {
  const { courseId, lessons } = await createTwoContentLessonsCourse({
    cleanup,
    factories,
    prefix: `repeat-${Date.now()}`,
    withWorkerPage,
  });
  const { firstLesson, secondLesson } = lessons;
  const courseFactory = factories.createCourseFactory();

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    expect((await courseFactory.getSettings(courseId)).repetitionEnabled ?? false).toBe(false);
    await openCourseOverviewSettingsFlow(page, courseId);
    await page.getByTestId(COURSE_SETTINGS_HANDLES.REPETITION_SWITCH).click();
    await expect
      .poll(async () => (await courseFactory.getSettings(courseId)).repetitionEnabled)
      .toBe(true);
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const learningState = async () =>
      (await getLearnerCourseFlow(apiClient, courseId)).learningState;

    await factories.createEnrollmentFactory().selfEnroll(courseId);
    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPEAT_BUTTON)).toHaveCount(0);

    await startLearningFlow(page);
    await assertCourseLessonProgressFlow(apiClient, courseId, {
      completedLessonCount: 1,
      lessonId: firstLesson.id,
      lessonStatus: "completed",
    });
    await goToNextLessonFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(secondLesson.title);
    await expect
      .poll(async () => Boolean((await learningState())?.current?.completedAt))
      .toBe(true);
    const accepted = (await learningState())?.current;

    // Repeating keeps the accepted completion and starts a separate repetition.
    await openCourseOverviewFlow(page, courseId);
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.REPEAT_BUTTON).click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${firstLesson.id}$`));
    await expect
      .poll(async () => {
        const state = await learningState();
        return {
          currentId: state?.current?.id,
          currentCompletedAt: state?.current?.completedAt,
          hasRepetition: Boolean(state?.repetition?.id),
        };
      })
      .toEqual({
        currentId: accepted?.id,
        currentCompletedAt: accepted?.completedAt,
        hasRepetition: true,
      });
    await assertCourseLessonProgressFlow(apiClient, courseId, {
      lessonId: secondLesson.id,
      lessonStatus: "not_started",
    });
    const repetitionId = (await learningState())?.repetition?.id;

    // The repetition survives a reload and is resumed from the overview.
    await page.reload();
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(firstLesson.title);
    expect((await learningState())?.repetition?.id).toBe(repetitionId);
    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPETITION_PROGRESS)).toHaveCount(0);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(secondLesson.title);

    // Finishing the repetition replaces the accepted completion.
    await expect
      .poll(async () => {
        const state = await learningState();
        return { currentId: state?.current?.id, repetition: state?.repetition ?? null };
      })
      .toEqual({ currentId: repetitionId, repetition: null });
    expect(repetitionId).not.toBe(accepted?.id);

    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPEAT_BUTTON)).toBeVisible();
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toHaveCount(0);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPETITION_PROGRESS)).toHaveCount(0);
  });
});
