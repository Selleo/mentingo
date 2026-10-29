import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, COURSE_SETTINGS_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { goToNextLessonFlow } from "../../flows/learning/go-to-next-lesson.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";

import { createTwoContentLessonsCourse } from "./learning-test-helpers";

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
  const courseFactory = factories.createCourseFactory();
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      expect((await courseFactory.getSettings(courseId)).repetitionEnabled ?? false).toBe(false);
      await openCourseOverviewFlow(page, courseId);
      await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON).click();
      const toggle = page.getByTestId(COURSE_SETTINGS_HANDLES.REPETITION_SWITCH);
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect
        .poll(async () => (await courseFactory.getSettings(courseId)).repetitionEnabled)
        .toBe(true);
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await factories.createEnrollmentFactory().selfEnroll(courseId);
      const read = async () =>
        (await apiClient.api.courseControllerGetCourse({ id: courseId, language: "en" })).data.data;
      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPEAT_BUTTON)).toHaveCount(0);
      await startLearningFlow(page);
      await expect.poll(async () => (await read()).chapters[0].completedLessonCount).toBe(1);
      await goToNextLessonFlow(page);
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
        lessons.secondLesson.title,
      );
      await expect
        .poll(async () => Boolean((await read()).learningState?.current?.completedAt))
        .toBe(true);
      const accepted = (await read()).learningState!.current!;
      await openCourseOverviewFlow(page, courseId);
      await page.getByTestId(COURSE_OVERVIEW_HANDLES.REPEAT_BUTTON).click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${lessons.firstLesson.id}$`));
      const repeating = (await read()).learningState!;
      expect(repeating.current?.id).toBe(accepted.id);
      expect(repeating.current?.completedAt).toBe(accepted.completedAt);
      expect(repeating.repetition?.id).toBeTruthy();
      expect(
        (await read()).chapters[0].lessons.find((lesson) => lesson.id === lessons.secondLesson.id)
          ?.status,
      ).toBe("not_started");
      await page.reload();
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
        lessons.firstLesson.title,
      );
      expect((await read()).learningState?.repetition?.id).toBe(repeating.repetition!.id);
      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPETITION_PROGRESS)).toHaveCount(0);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
      await startLearningFlow(page);
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
        lessons.secondLesson.title,
      );
      await expect.poll(async () => (await read()).learningState?.repetition ?? null).toBeNull();
      const renewed = (await read()).learningState!;
      expect(renewed.current?.id).toBe(repeating.repetition!.id);
      expect(renewed.current?.id).not.toBe(accepted.id);
      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPEAT_BUTTON)).toBeVisible();
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toHaveCount(0);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.REPETITION_PROGRESS)).toHaveCount(0);
    },
    { root: true },
  );
});
