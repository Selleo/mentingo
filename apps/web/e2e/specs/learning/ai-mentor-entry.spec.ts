import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertAiMentorEntryFlow } from "../../flows/learning/assert-ai-mentor-entry.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";

import { createAiMentorLessonCourse } from "./learning-test-helpers";

test("student can access AI mentor interaction entry points", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  const { courseId, lessons } = await createAiMentorLessonCourse({
    cleanup,
    factories,
    prefix: `learning-ai-mentor-entry-${Date.now()}`,
    withWorkerPage,
  });
  const { aiMentorLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();

      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${aiMentorLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
        aiMentorLesson.title,
      );

      await assertAiMentorEntryFlow(page);
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON)).toBeHidden();
    },
    { root: true },
  );
});
