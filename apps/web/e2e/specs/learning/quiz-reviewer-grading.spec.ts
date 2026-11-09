import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_HANDLES } from "../../data/learning/handles";
import { QUIZ_GRADING_HANDLES } from "../../data/quiz-grading/handles";
import { authenticateContext } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { answerAllRenderedQuizQuestionTypesFlow } from "../../flows/learning/answer-all-rendered-quiz-question-types.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { createFixtureApiClient } from "../../utils/api-client";
import { markAllOnboardingComplete } from "../../utils/onboarding";

import { createAllRenderedQuestionTypesQuizCourse } from "./learning-test-helpers";

const REVIEWER_PASSWORD = "Password123@";
const REVIEWER_COMMENT = "Clear reasoning, well done.";
const REVIEWED_ANSWER_COUNT = 2;

test("grading the last answer completes the lesson", async ({
  apiClient,
  cleanup,
  createWorkspaceContext,
  factories,
  withWorkerPage,
}) => {
  test.slow();
  const enrollmentFactory = factories.createEnrollmentFactory();
  const userFactory = factories.createUserFactory();

  let quizWasSubmitted = false;
  let studentId = "";

  const { courseId, lessons } = await createAllRenderedQuestionTypesQuizCourse({
    cleanup,
    factories,
    openQuestionsRequireReview: true,
    prefix: `learning-reviewer-grading-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson, textBlankAnswer, dndBlankAnswer, dndBlankAnswerId } = lessons;

  let reviewerEmail = "";
  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      const reviewer = await userFactory.register({ password: REVIEWER_PASSWORD });
      await userFactory.update(reviewer.id, { roleSlugs: [SYSTEM_ROLE_SLUGS.REVIEWER] });
      reviewerEmail = reviewer.email;

      cleanup.add(async () => {
        await withWorkerPage(USER_ROLE.admin, () => userFactory.delete(reviewer.id), {
          root: true,
        });
      });
    },
    { root: true },
  );

  await test.step("student submits open answers for review", async () => {
    await withWorkerPage(
      USER_ROLE.student,
      async ({ page }) => {
        await enrollmentFactory.selfEnroll(courseId);
        studentId = await enrollmentFactory.getCurrentUserId();

        await openCourseOverviewFlow(page, courseId);
        await startLearningFlow(page);
        await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();

        await answerAllRenderedQuizQuestionTypesFlow(page, {
          dndBlankAnswer,
          dndBlankAnswerId,
          textBlankAnswer,
        });
        await submitQuizFlow(page);
        quizWasSubmitted = true;

        await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_AWAITING_REVIEW)).toBeVisible();
      },
      { root: true },
    );
  });

  await test.step("reviewer grades every answer from the queue", async () => {
    const { context, origin } = await createWorkspaceContext({ root: true });
    const reviewerClient = createFixtureApiClient();

    try {
      await authenticateContext(context, origin, reviewerEmail, REVIEWER_PASSWORD);
      await reviewerClient.syncFromContext(context, origin);
      await markAllOnboardingComplete(reviewerClient);

      const page = await context.newPage();
      await page.goto("/");
      await expect(page).toHaveURL(/\/quiz-grading$/);
      await expect(page.getByTestId(QUIZ_GRADING_HANDLES.PENDING_COUNT)).toBeVisible();

      // The queue is tenant-wide, so scope it to this course instead of following "next answer".
      const courseQueueUrl = `/quiz-grading?courseId=${courseId}`;

      for (let remaining = REVIEWED_ANSWER_COUNT; remaining > 0; remaining--) {
        await page.goto(courseQueueUrl);
        const rows = page.getByTestId(QUIZ_GRADING_HANDLES.ROW);
        await expect(rows).toHaveCount(remaining);

        await rows.first().click();
        await expect(page.getByTestId(QUIZ_GRADING_HANDLES.ANSWER_PAGE)).toBeVisible();
        await expect(page.getByTestId(QUIZ_GRADING_HANDLES.STUDENT_ANSWER)).toHaveText(
          /^(Brief answer|Detailed answer)$/,
        );

        const answerUrl = page.url();
        const answerId = new URL(answerUrl).pathname.split("/").pop() ?? "";
        const { maximumPoints } = (
          await reviewerClient.api.quizGradingControllerGetAnswerDetails(answerId)
        ).data.data;

        await page.getByTestId(QUIZ_GRADING_HANDLES.POINTS_INPUT).fill(String(maximumPoints));
        await page.getByTestId(QUIZ_GRADING_HANDLES.COMMENT_INPUT).fill(REVIEWER_COMMENT);
        await page.getByTestId(QUIZ_GRADING_HANDLES.SUBMIT_BUTTON).click();

        await expect(page).not.toHaveURL(answerUrl);
      }

      await page.goto(courseQueueUrl);
      await expect(page.getByTestId(QUIZ_GRADING_HANDLES.ROW)).toHaveCount(0);
    } finally {
      reviewerClient.clearCookies();
      await context.close();
    }
  });

  await test.step("student sees the completed lesson with reviewer feedback", async () => {
    await withWorkerPage(
      USER_ROLE.student,
      async ({ page }) => {
        await expect
          .poll(
            async () => {
              const lesson = (
                await apiClient.api.lessonControllerGetLessonById(quizLesson.id, {
                  language: "en",
                  studentId,
                })
              ).data.data;

              return {
                lessonCompleted: lesson.lessonCompleted ?? false,
                isQuizAwaitingReview: lesson.isQuizAwaitingReview ?? false,
                score: lesson.quizDetails?.score ?? null,
              };
            },
            { timeout: 15_000 },
          )
          .toEqual({ lessonCompleted: true, isQuizAwaitingReview: false, score: 100 });

        await page.goto(`/course/${courseId}/lesson/${quizLesson.id}`);
        await expect(page.getByTestId(LEARNING_HANDLES.REVIEWER_FEEDBACK_POINTS)).toHaveCount(
          REVIEWED_ANSWER_COUNT,
        );
        await expect(page.getByTestId(LEARNING_HANDLES.REVIEWER_FEEDBACK_COMMENT)).toHaveText(
          Array(REVIEWED_ANSWER_COUNT).fill(REVIEWER_COMMENT),
        );
        await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_AWAITING_REVIEW)).toHaveCount(0);
      },
      { root: true },
    );
  });
});
