import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertCourseLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { goToNextLessonFlow } from "../../flows/learning/go-to-next-lesson.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";

import { createTwoContentLessonsCourse } from "./learning-test-helpers";

test("student can start learning and continue to the next content lesson", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  const { courseId, lessons } = await createTwoContentLessonsCourse({
    cleanup,
    factories,
    prefix: `learning-${Date.now()}`,
    withWorkerPage,
  });
  const { firstLesson, secondLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();

      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${firstLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(firstLesson.title);
      await expect(page.getByTestId(LEARNING_HANDLES.CURRENT_LESSON_NUMBER)).toHaveText("1");
      await expect(page.getByTestId(LEARNING_HANDLES.LESSONS_COUNT)).toHaveText("2");
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TYPE)).toBeVisible();

      await assertCourseLessonProgressFlow(apiClient, courseId, {
        completedLessonCount: 1,
        lessonId: firstLesson.id,
        lessonStatus: "completed",
      });

      await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeEnabled();
      await goToNextLessonFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${secondLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(secondLesson.title);

      await assertCourseLessonProgressFlow(apiClient, courseId, {
        completedLessonCount: 2,
        lessonId: secondLesson.id,
        lessonStatus: "completed",
      });

      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${firstLesson.id}$`));
    },
    { root: true },
  );
});
