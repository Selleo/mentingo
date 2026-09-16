import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";

import { createPublishedLearningCourse } from "./learning-test-helpers";

test("configured quiz preserves its timer and order after reload and shows authored feedback", async ({
  cleanup,
  factories,
  withWorkerPage,
  apiClient,
}) => {
  const { courseId, lessons: quiz } = await createPublishedLearningCourse({
    cleanup,
    factories,
    withWorkerPage,
    prefix: `configured-quiz-${Date.now()}`,
    settings: { quizFeedbackEnabled: true },
    buildLessons: async ({ courseId, chapterId, curriculumFactory }) =>
      curriculumFactory.createQuizLesson(courseId, {
        chapterId,
        title: "Configured assessment",
        thresholdScore: 100,
        attemptsLimit: 2,
        quizSettings: {
          shuffleQuestions: true,
          shuffleAnswers: true,
          timeLimitMinutes: 10,
          passedFeedback: "You mastered these questions.",
          failedFeedback: "Review the explanations.",
        },
        questions: [1, 2, 3].map((index) => ({
          type: "single_choice",
          title: `Question ${index}`,
          displayOrder: index,
          feedback: `Explanation ${index}`,
          options: [
            { optionText: `Correct ${index}`, isCorrect: true, displayOrder: 1 },
            { optionText: `Incorrect ${index}`, isCorrect: false, displayOrder: 2 },
          ],
        })),
      }),
  });
  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await factories.createEnrollmentFactory().selfEnroll(courseId);
      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);
      await page.getByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON).click();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_TIMER)).toBeVisible();
      const before = (
        await apiClient.api.lessonControllerGetLessonById(quiz.id, {
          language: "en",
          studentId: "",
        })
      ).data.data.quizAttempt;
      const titles = await page.getByTestId("single-choice").allTextContents();
      await page.reload();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_TIMER)).toBeVisible();
      const after = (
        await apiClient.api.lessonControllerGetLessonById(quiz.id, {
          language: "en",
          studentId: "",
        })
      ).data.data.quizAttempt;
      expect(after).toEqual(before);
      expect(await page.getByTestId("single-choice").allTextContents()).toEqual(titles);
      for (const index of [1, 2, 3])
        await page.getByText(`Correct ${index}`, { exact: true }).click();
      await page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON).click();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FEEDBACK)).toHaveText(
        "You mastered these questions.",
      );
      await expect(page.getByText("Explanation 1", { exact: true })).toBeVisible();
      await page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON).click();
      await page.getByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON).click();
      await expect
        .poll(
          async () =>
            (
              await apiClient.api.lessonControllerGetLessonById(quiz.id, {
                language: "en",
                studentId: "",
              })
            ).data.data.attempts,
        )
        .toBe(2);
    },
    { root: true },
  );
});

test("timed quiz expires without passing a zero-threshold assessment", async ({
  cleanup,
  factories,
  withWorkerPage,
  apiClient,
}) => {
  test.setTimeout(180_000);
  const { courseId, lessons: quiz } = await createPublishedLearningCourse({
    cleanup,
    factories,
    withWorkerPage,
    prefix: `quiz-timeout-${Date.now()}`,
    buildLessons: async ({ courseId, chapterId, curriculumFactory }) =>
      curriculumFactory.createQuizLesson(courseId, {
        chapterId,
        title: "Timed assessment",
        thresholdScore: 0,
        attemptsLimit: 1,
        quizSettings: { timeLimitMinutes: 1 },
        questions: [
          {
            type: "single_choice",
            title: "Choose an answer",
            displayOrder: 1,
            options: [
              { optionText: "Correct", isCorrect: true, displayOrder: 1 },
              { optionText: "Incorrect", isCorrect: false, displayOrder: 2 },
            ],
          },
        ],
      }),
  });
  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await factories.createEnrollmentFactory().selfEnroll(courseId);
      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);
      await page.getByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON).click();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_TIMER)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_EXPIRED)).toBeVisible({
        timeout: 70_000,
      });
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeDisabled();
      await expect
        .poll(
          async () =>
            (
              await apiClient.api.lessonControllerGetLessonById(quiz.id, {
                language: "en",
                studentId: "",
              })
            ).data.data.isQuizPassed,
        )
        .toBe(false);
    },
    { root: true },
  );
});
