import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { retakeQuizFlow } from "../../flows/learning/retake-quiz.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";

import { createTextGapFillQuizCourse } from "./learning-test-helpers";

test("student sees the correct answer for an incorrect text gap fill when quiz feedback is enabled", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  let quizWasSubmitted = false;

  const { courseId, lessons } = await createTextGapFillQuizCourse({
    cleanup,
    factories,
    prefix: `learning-quiz-feedback-gap-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, textBlankAnswer, wrongTextBlankAnswer } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

      await page.getByTestId("text-blank-1").fill(wrongTextBlankAnswer);
      await submitQuizFlow(page);
      quizWasSubmitted = true;

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(
        page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
      ).toContainText(textBlankAnswer);
    },
    { root: true },
  );
});

test("student does not see text gap fill feedback after retaking a quiz when feedback is disabled", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  let quizWasSubmitted = false;

  const { courseId, lessons } = await createTextGapFillQuizCourse({
    cleanup,
    factories,
    prefix: `learning-quiz-feedback-disabled-${Date.now()}`,
    settings: { quizFeedbackEnabled: false },
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, wrongTextBlankAnswer } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      const studentId = await enrollmentFactory.getCurrentUserId();

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

      await page.getByTestId("text-blank-1").fill(wrongTextBlankAnswer);
      await submitQuizFlow(page);
      quizWasSubmitted = true;

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(
        page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
      ).toBeHidden();

      await retakeQuizFlow(page);

      await expect(page.getByTestId("text-blank-1")).toBeEditable();
      await page.getByTestId("text-blank-1").fill(`${wrongTextBlankAnswer}-retake`);
      await submitQuizFlow(page);

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(
        page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
      ).toBeHidden();

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.lessonControllerGetLessonById(quizLesson.id, {
              language: "en",
              studentId,
            });

            return response.data.data.isQuizFeedbackRedacted;
          },
          { timeout: 15_000 },
        )
        .toBe(true);
    },
    { root: true },
  );
});

test("admin does not see text gap fill feedback in learning mode when feedback is disabled", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  let quizWasSubmitted = false;

  const { courseId, lessons } = await createTextGapFillQuizCourse({
    cleanup,
    factories,
    prefix: `learning-quiz-feedback-admin-disabled-${Date.now()}`,
    settings: { quizFeedbackEnabled: false },
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, wrongTextBlankAnswer } = lessons;

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const courseFactory = factories.createCourseFactory();

      await courseFactory.setStudentMode(courseId, true);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

      await page.getByTestId("text-blank-1").fill(wrongTextBlankAnswer);
      await submitQuizFlow(page);
      quizWasSubmitted = true;

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(
        page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
      ).toBeHidden();
    },
    { root: true },
  );
});
