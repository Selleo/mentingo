import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { mockLumaConfigFlow } from "../../flows/ai/mock-luma.flow";
import { assertAiMentorEntryFlow } from "../../flows/learning/assert-ai-mentor-entry.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { createAiMentorLessonCourse } from "../../utils/learning-courses";

const VOICE_VARIANTS = [
  { voiceMentorEnabled: false, actionMode: "send", label: "unavailable" },
  { voiceMentorEnabled: true, actionMode: "voice", label: "available" },
] as const;

for (const { voiceMentorEnabled, actionMode, label } of VOICE_VARIANTS) {
  test(`student opens an AI mentor lesson and sees the ${actionMode} action when Luma voice is ${label}`, async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const enrollmentFactory = factories.createEnrollmentFactory();
    const { courseId, lessons } = await createAiMentorLessonCourse({
      cleanup,
      factories,
      prefix: `learning-ai-mentor-voice-${label}-${Date.now()}`,
      withWorkerPage,
    });
    const { aiMentorLesson } = lessons;

    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      const taskDescriptionDialog = page.getByTestId(
        LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION_DIALOG,
      );
      const actionButton = page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON);

      await mockLumaConfigFlow(page, { voiceMentorEnabled });
      await enrollmentFactory.selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${aiMentorLesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
        aiMentorLesson.title,
      );

      // The task description opens on entry and can be reopened from the lesson.
      await expect(taskDescriptionDialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(taskDescriptionDialog).toBeHidden();
      await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION).click();
      await expect(taskDescriptionDialog).toBeVisible();
      await page.keyboard.press("Escape");

      await assertAiMentorEntryFlow(page);
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON)).toBeHidden();
      await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MIC_BUTTON)).toBeVisible();
      await expect(actionButton).toHaveAttribute("data-mode", actionMode);
      // Without voice, the action sends a typed message and is disabled while the input is empty.
      await expect(actionButton).toBeEnabled({ enabled: voiceMentorEnabled });
    });
  });
}
