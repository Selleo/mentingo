import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openLessonFromSidebarFlow } from "../../flows/learning/open-lesson-from-sidebar.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";

import { createEmbedLessonCourse, createThreeContentLessonsCourse } from "./learning-test-helpers";

test("student can open lessons out of order from the sidebar when sequence is disabled", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  const { courseId, lessons } = await createThreeContentLessonsCourse({
    cleanup,
    factories,
    prefix: `learning-sidebar-access-${Date.now()}`,
    withWorkerPage,
  });
  const { firstLesson, thirdLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${firstLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_SIDEBAR)).toBeVisible();
      await expect(
        page.getByTestId(LEARNING_HANDLES.lessonSidebarBlockedIndicator(thirdLesson.id)),
      ).toHaveCount(0);

      await openLessonFromSidebarFlow(page, thirdLesson.id);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${thirdLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(thirdLesson.title);
      await expect(page.getByTestId(LEARNING_HANDLES.CURRENT_LESSON_NUMBER)).toHaveText("3");
      await expect(page.getByTestId(LEARNING_HANDLES.LESSONS_COUNT)).toHaveText("3");

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.courseControllerGetCourse({
              id: courseId,
              language: "en",
            });
            const chapter = response.data.data.chapters[0];
            const lesson = chapter?.lessons.find((item) => item.id === thirdLesson.id);

            return lesson?.status;
          },
          { timeout: 15_000 },
        )
        .toBe("completed");
    },
    { root: true },
  );
});

test("student can open an embed lesson and complete it", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  const { courseId, lessons } = await createEmbedLessonCourse({
    cleanup,
    factories,
    prefix: `learning-embed-${Date.now()}`,
    withWorkerPage,
  });
  const { embedLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${embedLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(embedLesson.title);
      await expect(page.getByTestId(LEARNING_HANDLES.CURRENT_LESSON_NUMBER)).toHaveText("1");
      await expect(page.getByTestId(LEARNING_HANDLES.LESSONS_COUNT)).toHaveText("1");
      await expect(page.locator(`iframe[title="${embedLesson.title}"]`)).toBeVisible();

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.courseControllerGetCourse({
              id: courseId,
              language: "en",
            });
            const chapter = response.data.data.chapters[0];
            const lesson = chapter?.lessons.find((item) => item.id === embedLesson.id);

            return {
              completedLessonCount: chapter?.completedLessonCount ?? 0,
              embedLessonStatus: lesson?.status,
            };
          },
          { timeout: 15_000 },
        )
        .toEqual({
          completedLessonCount: 1,
          embedLessonStatus: "completed",
        });
    },
    { root: true },
  );
});
