import { USER_ROLE } from "~/config/userRoles";

import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import {
  getUserQuizAttemptCountFlow,
  waitForUserQuizAttemptCountFlow,
} from "../../flows/learning/wait-for-quiz-attempt-count.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";
import { createSingleChoiceQuizLessonCourse } from "../learning/learning-test-helpers";

test("admin can delete a quiz lesson after a student submitted answers", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const courseFactory = factories.createCourseFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();

  const { courseId, lessons } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `curriculum-delete-answered-quiz-${Date.now()}`,
    settings: { lessonSequenceEnabled: false },
    withWorkerPage,
  });
  const { quizLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);

      const expectedQuizAttemptCount = (await getUserQuizAttemptCountFlow(apiClient)) + 1;

      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);

      await waitForUserQuizAttemptCountFlow(apiClient, expectedQuizAttemptCount);
    },
    { root: true },
  );

  await withWorkerPage(
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

      await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.DELETE_BUTTON).click();
      await page.getByRole("button", { name: "Delete" }).click();

      await assertToastVisible(page, "Lesson deleted successfully");

      await expect
        .poll(async () => {
          const updatedCourse = await courseFactory.getById(courseId);
          const chapter = updatedCourse.chapters.find((item) => item.id === quizChapter.id);

          return chapter?.lessons?.some((lesson) => lesson.id === quizLesson.id) ?? false;
        })
        .toBe(false);
    },
    { root: true },
  );
});
