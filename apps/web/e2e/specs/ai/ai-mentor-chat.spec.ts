import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertAiMentorEntryFlow } from "../../flows/learning/assert-ai-mentor-entry.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { createAiMentorLessonCourse } from "../learning/learning-test-helpers";

test.setTimeout(240 * 1000);

test("student can chat with AI mentor, check the lesson, and retake it", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      const aiConfig = await apiClient.api.envControllerGetAiConfigured();

      test.skip(!aiConfig.data.data.enabled, "OpenAI is not configured for this environment");
    },
    { root: true },
  );

  const enrollmentFactory = factories.createEnrollmentFactory();
  const message = `Explain this lesson in one short sentence ${Date.now()}`;

  const { courseId, lessons } = await createAiMentorLessonCourse({
    cleanup,
    factories,
    prefix: `learning-ai-mentor-chat-${Date.now()}`,
    withWorkerPage,
  });
  const { aiMentorLesson } = lessons;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      const studentId = await enrollmentFactory.getCurrentUserId();

      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${aiMentorLesson.id}$`));
      await assertAiMentorEntryFlow(page);
      await expect(
        page.getByTestId(LEARNING_HANDLES.aiMentorMessageRole("assistant")).first(),
      ).toBeVisible({ timeout: 60_000 });

      const lessonResponse = await apiClient.api.lessonControllerGetLessonById(aiMentorLesson.id, {
        language: "en",
        studentId,
      });
      const threadId = lessonResponse.data.data.threadId;

      if (!threadId) {
        throw new Error(`AI mentor thread was not initialized for lesson ${aiMentorLesson.id}`);
      }

      await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_INPUT).fill(message);
      await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON).click();

      await expect(
        page.getByTestId(LEARNING_HANDLES.aiMentorMessageRole("user")).filter({ hasText: message }),
      ).toBeVisible();

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.aiControllerGetThreadMessages({
              thread: threadId,
            });

            return response.data.data.some(
              (item) => item.role === "user" && item.content === message,
            );
          },
          { timeout: 90_000 },
        )
        .toBe(true);

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.aiControllerGetThreadMessages({
              thread: threadId,
            });

            return response.data.data.filter((item) => item.role === "assistant").length;
          },
          { timeout: 90_000 },
        )
        .toBeGreaterThan(1);

      await page.reload();
      await assertAiMentorEntryFlow(page);
      await expect(
        page.getByTestId(LEARNING_HANDLES.aiMentorMessageRole("user")).filter({ hasText: message }),
      ).toBeVisible();

      await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON).click();
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON)).toBeVisible({
        timeout: 90_000,
      });

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.lessonControllerGetLessonById(aiMentorLesson.id, {
              language: "en",
              studentId,
            });

            return response.data.data.status;
          },
          { timeout: 90_000 },
        )
        .toBe("completed");

      await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON).click();
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_MODAL)).toBeVisible();
      await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_CONFIRM_BUTTON).click();

      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_INPUT)).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON)).toBeHidden();

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.lessonControllerGetLessonById(aiMentorLesson.id, {
              language: "en",
              studentId,
            });

            return response.data.data.threadId;
          },
          { timeout: 30_000 },
        )
        .not.toBe(threadId);
    },
    { root: true },
  );
});
