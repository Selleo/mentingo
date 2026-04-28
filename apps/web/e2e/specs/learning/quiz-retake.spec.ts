import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertQuizLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { retakeQuizFlow } from "../../flows/learning/retake-quiz.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import {
  getUserQuizAttemptCountFlow,
  waitForUserQuizAttemptCountFlow,
} from "../../flows/learning/wait-for-quiz-attempt-count.flow";

import { createSingleChoiceQuizLessonCourse } from "./learning-test-helpers";

test("student can submit and retake a quiz lesson", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  let quizWasSubmitted = false;

  const { courseId, lessons } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `learning-quiz-retake-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      const studentId = await enrollmentFactory.getCurrentUserId();

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);
      await expect(page.getByTestId(LEARNING_HANDLES.CURRENT_LESSON_NUMBER)).toHaveText("1");
      await expect(page.getByTestId(LEARNING_HANDLES.LESSONS_COUNT)).toHaveText("1");
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

      const initialQuizAttemptCount = await getUserQuizAttemptCountFlow(apiClient);

      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);
      quizWasSubmitted = true;
      const firstExpectedQuizAttemptCount = initialQuizAttemptCount + 1;

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();

      await assertQuizLessonProgressFlow(apiClient, {
        courseId,
        lessonId: quizLesson.id,
        studentId,
        expected: {
          completedLessonCount: 1,
          courseLessonStatus: "completed",
          lessonCompleted: true,
          attempts: 1,
        },
      });

      await waitForUserQuizAttemptCountFlow(apiClient, firstExpectedQuizAttemptCount);

      await retakeQuizFlow(page);

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeEnabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeDisabled();

      await expect
        .poll(
          async () => {
            const { data } = await apiClient.api.lessonControllerGetLessonById(quizLesson.id, {
              language: "en",
              studentId,
            });

            const lessonData = data.data;

            return {
              attempts: lessonData.attempts ?? 0,
            };
          },
          { timeout: 15_000 },
        )
        .toEqual({
          attempts: 2,
        });

      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);
      const secondExpectedQuizAttemptCount = initialQuizAttemptCount + 2;

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();

      await assertQuizLessonProgressFlow(apiClient, {
        courseId,
        lessonId: quizLesson.id,
        studentId,
        expected: {
          completedLessonCount: 1,
          courseLessonStatus: "completed",
          lessonCompleted: true,
          attempts: 2,
        },
      });

      await waitForUserQuizAttemptCountFlow(apiClient, secondExpectedQuizAttemptCount);
    },
    { root: true },
  );
});
