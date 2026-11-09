import { USER_ROLE } from "~/config/userRoles";

import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";

import { createSingleChoiceQuizLessonCourse } from "./learning-test-helpers";

const TIME_LIMIT_MINUTES = 5;
// a 5-minute limit shows 05:00 right after start and stays above 03:00 for this test
const RUNNING_TIMER_TEXT = /0[34]:\d{2}|05:00/;

test("author sets and clears a quiz time limit; the student resumes the timed attempt after reload", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const courseFactory = factories.createCourseFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();

  let quizWasStarted = false;

  const { courseId, lessons } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `learning-quiz-time-limit-${Date.now()}`,
    settings: { lessonSequenceEnabled: false },
    // the helper registers cleanup; as in quiz-retake.spec, a course with learner attempts is
    // only unpublished, not deleted
    shouldKeepCourseAfterTest: () => quizWasStarted,
    withWorkerPage,
  });
  const { quizLesson } = lessons;

  const setTimeLimitAsAuthor = (timeLimit: number | null) =>
    withWorkerPage(
      USER_ROLE.admin,
      async ({ page }) => {
        const course = await courseFactory.getById(courseId);
        const quizChapter = course.chapters.find((chapter) =>
          chapter.lessons?.some((lesson) => lesson.id === quizLesson.id),
        );

        if (!quizChapter) {
          throw new Error(`Chapter for quiz lesson ${quizLesson.id} was not found`);
        }

        await openCurriculumPageFlow(page, courseId);
        await openExistingLessonFlow(page, quizChapter.id, quizLesson.id);
        await page
          .getByTestId(QUIZ_LESSON_FORM_HANDLES.TIME_LIMIT_INPUT)
          .fill(timeLimit === null ? "" : String(timeLimit));
        await saveQuizLessonFormFlow(page);

        await expect
          .poll(async () => {
            const { data } = await apiClient.api.lessonControllerGetLessonById(quizLesson.id, {
              language: "en",
            });

            return data.data.timeLimitMinutes ?? null;
          })
          .toBe(timeLimit);
      },
      { root: true },
    );

  await setTimeLimitAsAuthor(TIME_LIMIT_MINUTES);

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      const studentId = await enrollmentFactory.getCurrentUserId();

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_TIME_LIMIT_INFO)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();

      await page.getByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON).click();
      quizWasStarted = true;

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_TIMER)).toHaveText(RUNNING_TIMER_TEXT);

      await selectFirstSingleChoiceAnswerFlow(page);

      await expect
        .poll(async () => {
          const { data } = await apiClient.api.lessonControllerGetLessonById(quizLesson.id, {
            language: "en",
            studentId,
          });

          return data.data.quizAttempt?.draftAnswers.length ?? 0;
        })
        .toBe(1);

      await page.reload();

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_START_BUTTON)).toHaveCount(0);
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_TIMER)).toHaveText(RUNNING_TIMER_TEXT);
      await expect(page.locator('input[name^="singleAnswerQuestions."]').first()).toBeChecked();

      await submitQuizFlow(page);

      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_TIMER)).toHaveCount(0);
    },
    { root: true },
  );

  await setTimeLimitAsAuthor(null);
});
