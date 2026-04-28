import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertBlockedLessonItemFlow } from "../../flows/learning/assert-blocked-lesson-item.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openLessonFromSidebarFlow } from "../../flows/learning/open-lesson-from-sidebar.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import {
  getUserQuizAttemptCountFlow,
  waitForUserQuizAttemptCountFlow,
} from "../../flows/learning/wait-for-quiz-attempt-count.flow";

import { createSequencedQuizAndContentCourse } from "./learning-test-helpers";

test("student cannot skip ahead when lesson sequence is enabled", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  let quizWasSubmitted = false;

  const { courseId, lessons } = await createSequencedQuizAndContentCourse({
    cleanup,
    factories,
    prefix: `learning-sequence-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, blockedLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeDisabled();
      await assertBlockedLessonItemFlow(page, blockedLesson.id);

      await page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(blockedLesson.id)).click();
      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}#?$`));

      const expectedQuizAttemptCount = (await getUserQuizAttemptCountFlow(apiClient)) + 1;

      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);
      quizWasSubmitted = true;

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.courseControllerGetCourse({
              id: courseId,
              language: "en",
            });
            const chapter = response.data.data.chapters[0];
            const courseQuizLesson = chapter?.lessons.find((lesson) => lesson.id === quizLesson.id);
            const nextLesson = chapter?.lessons.find((lesson) => lesson.id === blockedLesson.id);

            return {
              quizLessonStatus: courseQuizLesson?.status,
              nextLessonStatus: nextLesson?.status,
            };
          },
          { timeout: 15_000 },
        )
        .toEqual({
          quizLessonStatus: "completed",
          nextLessonStatus: "not_started",
        });

      await waitForUserQuizAttemptCountFlow(apiClient, expectedQuizAttemptCount);

      await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeEnabled();
      await expect(
        page.getByTestId(LEARNING_HANDLES.lessonSidebarBlockedIndicator(blockedLesson.id)),
      ).toHaveCount(0);

      await openLessonFromSidebarFlow(page, blockedLesson.id);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${blockedLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(blockedLesson.title);
    },
    { root: true },
  );
});

test("student does not unlock the next lesson after failing a required quiz", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();

  let quizWasSubmitted = false;

  const { courseId, lessons } = await createSequencedQuizAndContentCourse({
    answerOrder: "wrong-first",
    cleanup,
    factories,
    prefix: `learning-sequence-failed-quiz-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    thresholdScore: 100,
    withWorkerPage,
  });
  const { quizLesson, blockedLesson } = lessons;

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
      await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeDisabled();
      await assertBlockedLessonItemFlow(page, blockedLesson.id);

      const expectedQuizAttemptCount = (await getUserQuizAttemptCountFlow(apiClient)) + 1;

      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);
      quizWasSubmitted = true;

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();
      await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeDisabled();
      await assertBlockedLessonItemFlow(page, blockedLesson.id);

      await page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(blockedLesson.id)).click();
      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}#?$`));

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
            const nextLesson = chapter?.lessons.find((lesson) => lesson.id === blockedLesson.id);
            const lessonData = lessonResponse.data.data;

            return {
              completedLessonCount: chapter?.completedLessonCount ?? 0,
              nextLessonStatus: nextLesson?.status,
              lessonCompleted: lessonData.lessonCompleted ?? false,
              attempts: lessonData.attempts ?? 0,
            };
          },
          { timeout: 15_000 },
        )
        .toEqual({
          completedLessonCount: 0,
          nextLessonStatus: "not_started",
          lessonCompleted: true,
          attempts: 1,
        });

      await waitForUserQuizAttemptCountFlow(apiClient, expectedQuizAttemptCount);
    },
    { root: true },
  );
});
