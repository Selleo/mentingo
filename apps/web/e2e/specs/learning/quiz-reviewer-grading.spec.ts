import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { QUIZ_GRADING_HANDLES } from "../../data/quiz-grading/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { answerAllRenderedQuizQuestionTypesFlow } from "../../flows/learning/answer-all-rendered-quiz-question-types.flow";
import { assertQuizLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { getUserQuizAttemptCountFlow } from "../../flows/learning/wait-for-quiz-attempt-count.flow";
import { gradeQuizAnswerFlow } from "../../flows/quiz-grading/grade-quiz-answer.flow";
import { createDisposableAdminSession } from "../../utils/create-disposable-admin-session";
import { createAllRenderedQuestionTypesQuizCourse } from "../../utils/learning-courses";

const REVIEWER_COMMENT = "Clear reasoning, well done.";
const REVIEWED_ANSWER_COUNT = 2;

test("grading the last answer completes the lesson", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  // Student submission, two manual reviews and the student's result view run in one goal.
  test.slow();
  const enrollmentFactory = factories.createEnrollmentFactory();
  const userFactory = factories.createUserFactory();
  const prefix = `learning-reviewer-grading-${Date.now()}`;

  let quizWasSubmitted = false;
  let studentId = "";
  let quizAttemptCountBeforeSubmit = 0;

  // The reviewer is created first so that its cleanup runs after the course cleanup re-syncs
  // the admin session.
  let reviewerPage: Awaited<ReturnType<typeof createDisposableAdminSession>>["page"] | undefined;
  await withWorkerPage(USER_ROLE.admin, async () => {
    const reviewer = await createDisposableAdminSession({
      cleanup,
      createWorkspacePage,
      email: `${prefix}-reviewer@example.com`,
      roleSlug: SYSTEM_ROLE_SLUGS.REVIEWER,
      userFactory,
    });
    reviewerPage = reviewer.page;
  });

  const { courseId, lessons } = await createAllRenderedQuestionTypesQuizCourse({
    cleanup,
    factories,
    openQuestionsRequireReview: true,
    prefix,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { answers, quizLesson } = lessons;

  await test.step("student submits open answers and waits for review", async () => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      studentId = await enrollmentFactory.getCurrentUserId();

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

      quizAttemptCountBeforeSubmit = await getUserQuizAttemptCountFlow(apiClient);

      await answerAllRenderedQuizQuestionTypesFlow(page, answers);
      await submitQuizFlow(page);
      quizWasSubmitted = true;

      // Open answers marked for review are graded manually, so the attempt waits for a reviewer.
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_AWAITING_REVIEW)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.QUESTION_AWAITING_REVIEW)).toHaveCount(
        REVIEWED_ANSWER_COUNT,
      );
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeDisabled();

      await assertQuizLessonProgressFlow(apiClient, {
        courseId,
        lessonId: quizLesson.id,
        studentId,
        expected: {
          completedLessonCount: 0,
          courseLessonStatus: "awaiting_review",
          lessonCompleted: false,
          isQuizAwaitingReview: true,
          attempts: 1,
          score: null,
        },
      });
      // An attempt awaiting review is not counted in the student's quiz statistics yet.
      expect(await getUserQuizAttemptCountFlow(apiClient)).toBe(quizAttemptCountBeforeSubmit);
    });
  });

  await test.step("reviewer grades every answer from the queue", async () => {
    if (!reviewerPage) throw new Error("Reviewer session was not created");
    const page = reviewerPage;

    await page.goto("/");
    await expect(page).toHaveURL(/\/quiz-grading$/);
    await expect(page.getByTestId(QUIZ_GRADING_HANDLES.PENDING_COUNT)).toBeVisible();

    // The queue is tenant-wide, so scope it to this course instead of following "next answer".
    const courseQueueUrl = `/quiz-grading?courseId=${courseId}`;
    const submittedAnswer = new RegExp(`^(${answers.briefResponse}|${answers.detailedResponse})$`);

    for (let remaining = REVIEWED_ANSWER_COUNT; remaining > 0; remaining--) {
      await page.goto(courseQueueUrl);
      const rows = page.getByTestId(QUIZ_GRADING_HANDLES.ROW);
      await expect(rows).toHaveCount(remaining);

      await rows.first().click();
      await expect(page.getByTestId(QUIZ_GRADING_HANDLES.ANSWER_PAGE)).toBeVisible();
      await expect(page.getByTestId(QUIZ_GRADING_HANDLES.STUDENT_ANSWER)).toHaveText(
        submittedAnswer,
      );

      const answerUrl = page.url();
      await gradeQuizAnswerFlow(page, { verdict: "passed", comment: REVIEWER_COMMENT });
      await expect(page).not.toHaveURL(answerUrl);
    }

    await page.goto(courseQueueUrl);
    await expect(page.getByTestId(QUIZ_GRADING_HANDLES.EMPTY_STATE)).toBeVisible();
    await expect(page.getByTestId(QUIZ_GRADING_HANDLES.ROW)).toHaveCount(0);
  });

  await test.step("student sees the completed lesson with reviewer feedback", async () => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await assertQuizLessonProgressFlow(apiClient, {
        courseId,
        lessonId: quizLesson.id,
        studentId,
        expected: { lessonCompleted: true, isQuizAwaitingReview: false, score: 100 },
      });
      // Once graded, the attempt counts, so the unchanged count before review was not a timing fluke.
      await expect
        .poll(() => getUserQuizAttemptCountFlow(apiClient))
        .toBe(quizAttemptCountBeforeSubmit + 1);

      await page.goto(`/course/${courseId}/lesson/${quizLesson.id}`);
      await expect(page.getByTestId(LEARNING_HANDLES.REVIEWER_FEEDBACK_POINTS)).toHaveCount(
        REVIEWED_ANSWER_COUNT,
      );
      await expect(page.getByTestId(LEARNING_HANDLES.REVIEWER_FEEDBACK_COMMENT)).toHaveText(
        Array(REVIEWED_ANSWER_COUNT).fill(REVIEWER_COMMENT),
      );
      await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_AWAITING_REVIEW)).toHaveCount(0);
    });
  });
});
