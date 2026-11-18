import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertCourseLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openLessonFromSidebarFlow } from "../../flows/learning/open-lesson-from-sidebar.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import {
  createEmbedLessonCourse,
  createThreeContentLessonsCourse,
} from "../../utils/learning-courses";

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

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${firstLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_SIDEBAR)).toBeVisible();
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(thirdLesson.id)),
    ).toBeVisible();
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarBlockedIndicator(thirdLesson.id)),
    ).toHaveCount(0);

    await openLessonFromSidebarFlow(page, thirdLesson.id);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${thirdLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(thirdLesson.title);

    await assertCourseLessonProgressFlow(apiClient, courseId, {
      lessonId: thirdLesson.id,
      lessonStatus: "completed",
    });
  });
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

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${embedLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(embedLesson.title);
    await expect(page.getByTestId(LEARNING_HANDLES.EMBED_IFRAME)).toBeVisible();

    await assertCourseLessonProgressFlow(apiClient, courseId, {
      completedLessonCount: 1,
      lessonId: embedLesson.id,
      lessonStatus: "completed",
    });
  });
});
