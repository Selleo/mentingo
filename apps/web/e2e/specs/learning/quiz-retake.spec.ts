import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertQuizLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { retakeQuizFlow } from "../../flows/learning/retake-quiz.flow";
import { selectQuizOptionFlow } from "../../flows/learning/select-quiz-option.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import {
  getCourseCertificateIdFlow,
  waitForCourseCertificateFlow,
} from "../../flows/learning/wait-for-course-certificate.flow";
import {
  getUserQuizAttemptCountFlow,
  waitForUserQuizAttemptCountFlow,
} from "../../flows/learning/wait-for-quiz-attempt-count.flow";
import { createSingleChoiceQuizLessonCourse } from "../../utils/learning-courses";

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
  const { correctOptionId, quizLesson } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);
    const studentId = await enrollmentFactory.getCurrentUserId();
    const quizProgress = (attempts: number) =>
      assertQuizLessonProgressFlow(apiClient, {
        courseId,
        lessonId: quizLesson.id,
        studentId,
        expected: {
          completedLessonCount: 1,
          courseLessonStatus: "completed",
          lessonCompleted: true,
          attempts,
        },
      });

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${quizLesson.id}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(quizLesson.title);
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(quizLesson.id)),
    ).toContainText(quizLesson.title);
    await page.getByTestId(LEARNING_HANDLES.lessonSidebarTypeIcon(quizLesson.id)).hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

    const initialQuizAttemptCount = await getUserQuizAttemptCountFlow(apiClient);

    await selectQuizOptionFlow(page, correctOptionId);
    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();
    await quizProgress(1);
    await waitForUserQuizAttemptCountFlow(apiClient, initialQuizAttemptCount + 1);

    await retakeQuizFlow(page);

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeEnabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(LEARNING_HANDLES.quizOption(correctOptionId))).not.toBeChecked();
    // Starting a retake opens a new attempt; the lesson is back in progress until it is submitted.
    await assertQuizLessonProgressFlow(apiClient, {
      courseId,
      lessonId: quizLesson.id,
      studentId,
      expected: { attempts: 2, courseLessonStatus: "in_progress", lessonCompleted: false },
    });

    await selectQuizOptionFlow(page, correctOptionId);
    await submitQuizFlow(page);

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();
    await quizProgress(2);
    await waitForUserQuizAttemptCountFlow(apiClient, initialQuizAttemptCount + 2);
  });
});

test("student can retake the final quiz when the completed course already has a certificate", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const courseFactory = factories.createCourseFactory();

  let quizWasSubmitted = false;

  const { courseId, lessons } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `learning-quiz-retake-certificate-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { correctOptionId, quizLesson } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ context, origin, page }) => {
    await enrollmentFactory.selfEnroll(courseId);
    const studentId = await enrollmentFactory.getCurrentUserId();
    const quizProgress = (attempts: number) =>
      assertQuizLessonProgressFlow(apiClient, {
        courseId,
        lessonId: quizLesson.id,
        studentId,
        expected: {
          completedLessonCount: 1,
          courseLessonStatus: "completed",
          lessonCompleted: true,
          attempts,
        },
      });

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    const initialQuizAttemptCount = await getUserQuizAttemptCountFlow(apiClient);

    await selectQuizOptionFlow(page, correctOptionId);
    await submitQuizFlow(page);
    quizWasSubmitted = true;

    await quizProgress(1);
    await waitForUserQuizAttemptCountFlow(apiClient, initialQuizAttemptCount + 1);

    let certificateId = "";
    await withWorkerPage(USER_ROLE.admin, async () => {
      await courseFactory.updateHasCertificate(courseId, true);
      certificateId = await waitForCourseCertificateFlow(apiClient, { courseId, studentId });
    });
    await apiClient.syncFromContext(context, origin ?? new URL(page.url()).origin);

    await retakeQuizFlow(page);

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeEnabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeDisabled();
    // The retake is persisted (lesson back in progress) and the issued certificate is not revoked.
    await assertQuizLessonProgressFlow(apiClient, {
      courseId,
      lessonId: quizLesson.id,
      studentId,
      expected: { attempts: 2, courseLessonStatus: "in_progress", lessonCompleted: false },
    });
    expect(await getCourseCertificateIdFlow(apiClient, { courseId, studentId })).toBe(
      certificateId,
    );

    await selectQuizOptionFlow(page, correctOptionId);
    await submitQuizFlow(page);

    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();

    await quizProgress(2);
    await waitForUserQuizAttemptCountFlow(apiClient, initialQuizAttemptCount + 2);

    // Completing the retake keeps the certificate that was already issued.
    expect(await getCourseCertificateIdFlow(apiClient, { courseId, studentId })).toBe(
      certificateId,
    );
  });
});
