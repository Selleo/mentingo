import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertQuizLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { retakeQuizFlow } from "../../flows/learning/retake-quiz.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { createTextGapFillQuizCourse } from "../../utils/learning-courses";

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
    root: false,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, textBlankAnswer, wrongTextBlankAnswer } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

    await page.getByTestId(LEARNING_HANDLES.textBlank(1)).fill(wrongTextBlankAnswer);
    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(
      page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
    ).toContainText(textBlankAnswer);
  });
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
    root: false,
    settings: { quizFeedbackEnabled: false },
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, wrongTextBlankAnswer } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);
    const studentId = await enrollmentFactory.getCurrentUserId();
    const textBlank = page.getByTestId(LEARNING_HANDLES.textBlank(1));

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

    await textBlank.fill(wrongTextBlankAnswer);
    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(
      page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
    ).toBeHidden();

    // The rule under test: feedback stays hidden for the retaken attempt too.
    await retakeQuizFlow(page);

    await expect(textBlank).toBeEditable();
    await expect(textBlank).toHaveValue("");
    await textBlank.fill(`${wrongTextBlankAnswer}-retake`);
    await submitQuizFlow(page);

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(
      page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
    ).toBeHidden();

    await assertQuizLessonProgressFlow(apiClient, {
      courseId,
      lessonId: quizLesson.id,
      studentId,
      expected: { attempts: 2, isQuizFeedbackRedacted: true },
    });
  });
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
    root: false,
    settings: { quizFeedbackEnabled: false },
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, wrongTextBlankAnswer } = lessons;

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const courseFactory = factories.createCourseFactory();

    await courseFactory.setStudentMode(courseId, true);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

    await page.getByTestId(LEARNING_HANDLES.textBlank(1)).fill(wrongTextBlankAnswer);
    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(
      page.getByTestId(LEARNING_HANDLES.FILL_IN_THE_BLANKS_CORRECT_SENTENCE),
    ).toBeHidden();
  });
});
