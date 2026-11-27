import { USER_ROLE } from "~/config/userRoles";

import {
  AI_MENTOR_PRACTICE_CRITERION_TITLE,
  AI_MENTOR_PRACTICE_ID,
  AI_MENTOR_PRACTICE_SCENARIO,
  AI_MENTOR_PRACTICE_TASK_GOAL,
} from "../../data/ai-mentor-practice/ai-mentor-practice.data";
import { AI_MENTOR_PRACTICE_HANDLES } from "../../data/ai-mentor-practice/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import {
  mockAiMentorPracticeDashboardFlow,
  mockAiMentorPracticeSessionFlow,
  mockAiMentorPracticeVoiceEntryFlow,
} from "../../flows/ai-mentor-practice/mock-ai-mentor-practice.flow";

// Practice scenarios, transcripts and feedback come from the LLM, so those endpoints are mocked
// (strategy §9); everything else hits the real backend.

test("student can start a practice from the dashboard and see background preparation", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const dashboard = await mockAiMentorPracticeDashboardFlow(page);

    await page.goto("/dashboard");

    const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
    const scenarioInput = widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.SCENARIO_INPUT);
    await expect(scenarioInput).toHaveValue("");
    await widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.SUGGESTIONS_TRIGGER).click();
    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.SUGGESTION).first().click();
    await expect(scenarioInput).toHaveValue(/\S/);
    await widget
      .getByTestId(AI_MENTOR_PRACTICE_HANDLES.SCENARIO_INPUT)
      .fill(AI_MENTOR_PRACTICE_SCENARIO);

    const createRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" && new URL(request.url()).pathname === "/api/ai/practice",
    );
    await widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.SUBMIT_BUTTON).click();
    expect((await createRequest).postDataJSON()).toEqual({
      language: "en",
      scenario: AI_MENTOR_PRACTICE_SCENARIO,
    });

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET_GENERATING)).toBeVisible();
    await widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CONTINUE_LINK).click();
    await expect(page).toHaveURL(new RegExp(`/ai-mentor/practice/${AI_MENTOR_PRACTICE_ID}$`));
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.PREPARING_STATE)).toBeVisible();
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.GO_TO_DASHBOARD_BUTTON)).toBeVisible();
    expect(dashboard.unexpectedRequests).toEqual([]);
  });
});

test("student can review practice feedback and start the practice again", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const { releaseReplay } = await mockAiMentorPracticeSessionFlow(page);
    const feedbackDialog = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.FEEDBACK_DIALOG);

    await page.goto(`/ai-mentor/practice/${AI_MENTOR_PRACTICE_ID}`);

    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CONVERSATION)).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(AI_MENTOR_PRACTICE_TASK_GOAL);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CHECK_BUTTON).click();
    await expect(feedbackDialog).toBeVisible();
    await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RESULT_CLOSE_BUTTON).click();
    await expect(feedbackDialog).toBeHidden();

    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.VIEW_FEEDBACK_BUTTON).click();
    await expect(feedbackDialog).toContainText(AI_MENTOR_PRACTICE_CRITERION_TITLE);
    await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RESULT_CLOSE_BUTTON).click();

    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.PRACTICE_AGAIN_BUTTON).click();
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.REPLAY_LOADER)).toBeVisible();
    releaseReplay();
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.REPLAY_LOADER)).toBeHidden();
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CONVERSATION)).toBeVisible();
    await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_INPUT)).toBeVisible();
    // The replayed practice starts without the previous feedback.
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.VIEW_FEEDBACK_BUTTON)).toBeHidden();
  });
});

test("student opens the active dashboard practice in full-screen voice mode", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await mockAiMentorPracticeVoiceEntryFlow(page);

    await page.goto("/dashboard");
    const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
    await widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET_VOICE_LINK).click();

    await expect(page).toHaveURL(new RegExp(`/ai-mentor/practice/${AI_MENTOR_PRACTICE_ID}$`));
    const voice = page.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY);
    await expect(voice).toBeVisible();
    await expect(
      voice.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_START_BUTTON),
    ).toBeEnabled();
  });
});
