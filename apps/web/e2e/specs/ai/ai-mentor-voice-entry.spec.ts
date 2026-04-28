import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertAiMentorEntryFlow } from "../../flows/learning/assert-ai-mentor-entry.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { createAiMentorLessonCourse } from "../learning/learning-test-helpers";

import type { Page } from "@playwright/test";

const mockLumaConfig = async (page: Page, voiceMentorEnabled: boolean) => {
  await page.route("**/api/env/luma", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          enabled: voiceMentorEnabled,
          courseGenerationEnabled: false,
          voiceMentorEnabled,
        },
      },
    });
  });
};

test("student sees voice input but no voice mentor action when Luma voice is unavailable", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const { courseId } = await createAiMentorLessonCourse({
    cleanup,
    factories,
    prefix: `learning-ai-mentor-voice-unavailable-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await mockLumaConfig(page, false);
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
      await startLearningFlow(page);
      await assertAiMentorEntryFlow(page);

      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MIC_BUTTON)).toBeVisible();
      await expect(
        page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON),
      ).toHaveAttribute("data-mode", "send");
      await expect(
        page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON),
      ).toBeDisabled();
    },
    { root: true },
  );
});

test("student sees voice mentor action when Luma voice is available", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const { courseId } = await createAiMentorLessonCourse({
    cleanup,
    factories,
    prefix: `learning-ai-mentor-voice-available-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await mockLumaConfig(page, true);
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
      await startLearningFlow(page);
      await assertAiMentorEntryFlow(page);

      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MIC_BUTTON)).toBeVisible();
      await expect(
        page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON),
      ).toHaveAttribute("data-mode", "voice");
      await expect(
        page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON),
      ).toBeEnabled();
    },
    { root: true },
  );
});
