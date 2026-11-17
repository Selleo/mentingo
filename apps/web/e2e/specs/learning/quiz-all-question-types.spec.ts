import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { answerAllRenderedQuizQuestionTypesFlow } from "../../flows/learning/answer-all-rendered-quiz-question-types.flow";
import { assertQuizLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import {
  getUserQuizAttemptCountFlow,
  waitForUserQuizAttemptCountFlow,
} from "../../flows/learning/wait-for-quiz-attempt-count.flow";
import { createAllRenderedQuestionTypesQuizCourse } from "../../utils/learning-courses";

test("student can submit a quiz containing every rendered question type", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  let quizWasSubmitted = false;

  const { courseId, lessons } = await createAllRenderedQuestionTypesQuizCourse({
    cleanup,
    factories,
    prefix: `learning-all-quiz-types-${Date.now()}`,
    root: false,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { answers, quizLesson } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);
    const studentId = await enrollmentFactory.getCurrentUserId();

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

    const expectedQuizAttemptCount = (await getUserQuizAttemptCountFlow(apiClient)) + 1;

    await answerAllRenderedQuizQuestionTypesFlow(page, answers);

    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUESTION_AWAITING_REVIEW)).toHaveCount(0);

    await assertQuizLessonProgressFlow(apiClient, {
      courseId,
      lessonId: quizLesson.id,
      studentId,
      expected: {
        completedLessonCount: 1,
        courseLessonStatus: "completed",
        lessonCompleted: true,
        attempts: 1,
        correctAnswerCount: 10,
        score: 100,
      },
    });

    await waitForUserQuizAttemptCountFlow(apiClient, expectedQuizAttemptCount);
  });
});
