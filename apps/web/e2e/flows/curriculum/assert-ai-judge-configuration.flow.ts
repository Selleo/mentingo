import { expect, type Page } from "@playwright/test";

import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { AiJudgeConfigurationInput } from "./fill-ai-judge-configuration.flow";

/** Checks every field of an open AI Judge configuration dialog. */
export const assertAiJudgeConfigurationFlow = async (
  page: Page,
  configuration: AiJudgeConfigurationInput,
) => {
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_TASK_GOAL_INPUT).locator(".ProseMirror"),
  ).toContainText(configuration.taskGoal);
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_PASSING_THRESHOLD_INPUT),
  ).toHaveValue(String(configuration.passingThresholdPercent));

  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionToggle(0)).click();
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionTitleInput(0)),
  ).toHaveValue(configuration.criterion.title);
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionExpectedBehaviorInput(0)),
  ).toHaveValue(configuration.criterion.expectedBehavior);
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionMaxScoreInput(0)),
  ).toHaveValue(String(configuration.criterion.maxScore));

  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoringGuidanceToggle(0)).click();
  for (const guidance of configuration.criterion.scoreGuidance) {
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoreDescriptionInput(0, guidance.score)),
    ).toHaveValue(guidance.description);
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoreExampleInput(0, guidance.score)),
    ).toHaveValue(guidance.example);
  }

  const blockingErrorsSection = page.getByTestId(
    AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_BLOCKING_ERRORS_SECTION,
  );
  if ((await blockingErrorsSection.getAttribute("open")) === null)
    await blockingErrorsSection.click();
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeBlockingErrorInput(0)),
  ).toHaveValue(configuration.blockingError);
};
