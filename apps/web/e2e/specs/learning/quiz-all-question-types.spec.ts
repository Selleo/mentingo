import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { answerAllRenderedQuizQuestionTypesFlow } from "../../flows/learning/answer-all-rendered-quiz-question-types.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { getUserQuizAttemptCountFlow } from "../../flows/learning/wait-for-quiz-attempt-count.flow";

import { createAllRenderedQuestionTypesQuizCourse } from "./learning-test-helpers";

test("student submits a quiz with every rendered question type and waits for review of open answers", async ({
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
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, textBlankAnswer, dndBlankAnswer, dndBlankAnswerId } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      const studentId = await enrollmentFactory.getCurrentUserId();

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

      const quizAttemptCountBeforeSubmit = await getUserQuizAttemptCountFlow(apiClient);

      await answerAllRenderedQuizQuestionTypesFlow(page, {
        dndBlankAnswer,
        dndBlankAnswerId,
        textBlankAnswer,
      });

      await submitQuizFlow(page);
      quizWasSubmitted = true;

      // Open answers are graded manually, so the attempt waits for a reviewer.
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_AWAITING_REVIEW)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeDisabled();

      await expect
        .poll(
          async () => {
            const [courseResponse, lessonResponse] = await Promise.all([
              apiClient.api.courseControllerGetCourse({
                id: courseId,
                language: "en",
              }),
              apiClient.api.lessonControllerGetLessonById(quizLesson.id, {
                language: "en",
                studentId,
              }),
            ]);

            const chapter = courseResponse.data.data.chapters[0];
            const courseLesson = chapter?.lessons.find((lesson) => lesson.id === quizLesson.id);
            const lessonData = lessonResponse.data.data;

            return {
              completedLessonCount: chapter?.completedLessonCount ?? 0,
              courseLessonStatus: courseLesson?.status,
              lessonCompleted: lessonData.lessonCompleted ?? false,
              isQuizAwaitingReview: lessonData.isQuizAwaitingReview ?? false,
              attempts: lessonData.attempts ?? 0,
              score: lessonData.quizDetails?.score ?? null,
            };
          },
          { timeout: 15_000 },
        )
        .toEqual({
          completedLessonCount: 0,
          courseLessonStatus: "awaiting_review",
          lessonCompleted: false,
          isQuizAwaitingReview: true,
          attempts: 1,
          score: null,
        });

      expect(await getUserQuizAttemptCountFlow(apiClient)).toBe(quizAttemptCountBeforeSubmit);
    },
    { root: true },
  );
});
