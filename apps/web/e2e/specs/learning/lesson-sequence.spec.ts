import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertBlockedLessonItemFlow } from "../../flows/learning/assert-blocked-lesson-item.flow";
import {
  assertCourseLessonProgressFlow,
  assertQuizLessonProgressFlow,
} from "../../flows/learning/assert-learning-progress.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openLessonFromSidebarFlow } from "../../flows/learning/open-lesson-from-sidebar.flow";
import { selectQuizOptionFlow } from "../../flows/learning/select-quiz-option.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import {
  getUserQuizAttemptCountFlow,
  waitForUserQuizAttemptCountFlow,
} from "../../flows/learning/wait-for-quiz-attempt-count.flow";
import { createSequencedQuizAndContentCourse } from "../../utils/learning-courses";

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
  const { blockedLesson, correctOptionId, quizLesson } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();
    await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeDisabled();
    await assertBlockedLessonItemFlow(page, blockedLesson.id);

    // A blocked item links back to the current lesson instead of its own, so the click stays put.
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(blockedLesson.id)),
    ).toHaveAttribute("href", new RegExp(`/lesson/${quizLesson.id}#?$`));
    await openLessonFromSidebarFlow(page, blockedLesson.id);
    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}#?$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);

    const expectedQuizAttemptCount = (await getUserQuizAttemptCountFlow(apiClient)) + 1;

    await selectQuizOptionFlow(page, correctOptionId);
    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await assertCourseLessonProgressFlow(apiClient, courseId, {
      lessonId: quizLesson.id,
      lessonStatus: "completed",
    });
    await assertCourseLessonProgressFlow(apiClient, courseId, {
      lessonId: blockedLesson.id,
      lessonStatus: "not_started",
    });
    await waitForUserQuizAttemptCountFlow(apiClient, expectedQuizAttemptCount);

    await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeEnabled();
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarBlockedIndicator(blockedLesson.id)),
    ).toHaveCount(0);

    await openLessonFromSidebarFlow(page, blockedLesson.id);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${blockedLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(blockedLesson.title);
  });
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
    cleanup,
    factories,
    prefix: `learning-sequence-failed-quiz-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    thresholdScore: 100,
    withWorkerPage,
  });
  const { blockedLesson, quizLesson, wrongOptionId } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
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

    await selectQuizOptionFlow(page, wrongOptionId);
    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();
    await expect(page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON)).toBeDisabled();
    await assertBlockedLessonItemFlow(page, blockedLesson.id);

    // A blocked item links back to the current lesson instead of its own, so the click stays put.
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(blockedLesson.id)),
    ).toHaveAttribute("href", new RegExp(`/lesson/${quizLesson.id}#?$`));
    await openLessonFromSidebarFlow(page, blockedLesson.id);
    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}#?$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);

    // A failed attempt finishes the quiz but does not count as a passed lesson.
    await assertQuizLessonProgressFlow(apiClient, {
      courseId,
      lessonId: quizLesson.id,
      studentId,
      expected: { completedLessonCount: 0, lessonCompleted: true, attempts: 1 },
    });
    await assertCourseLessonProgressFlow(apiClient, courseId, {
      lessonId: blockedLesson.id,
      lessonStatus: "not_started",
    });
    await waitForUserQuizAttemptCountFlow(apiClient, expectedQuizAttemptCount);
  });
});
