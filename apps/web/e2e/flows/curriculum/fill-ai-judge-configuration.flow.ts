import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

type AiJudgeScoreGuidanceInput = {
  score: number;
  description: string;
  example: string;
};

export type AiJudgeConfigurationInput = {
  taskGoal: string;
  passingThresholdPercent: number;
  criterion: {
    title: string;
    expectedBehavior: string;
    maxScore: number;
    scoreGuidance: AiJudgeScoreGuidanceInput[];
  };
  blockingError: string;
};

const fillTaskGoal = async (page: Page, taskGoal: string) => {
  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_TASK_GOAL_INPUT)
    .locator(".ProseMirror")
    .fill(taskGoal);
};

const openCriterion = async (page: Page, criterionIndex: number) => {
  const titleInput = page.getByTestId(
    AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionTitleInput(criterionIndex),
  );

  if (!(await titleInput.isVisible()))
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionToggle(criterionIndex))
      .click();
};

export const fillAiJudgeConfigurationFlow = async (
  page: Page,
  input: AiJudgeConfigurationInput,
  options: { configureStructure?: boolean } = {},
) => {
  const configureStructure = options.configureStructure ?? true;

  await fillTaskGoal(page, input.taskGoal);

  if (configureStructure) {
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_PASSING_THRESHOLD_INPUT)
      .fill(String(input.passingThresholdPercent));
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_ADD_CRITERION_BUTTON).click();
  }

  await openCriterion(page, 0);
  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionTitleInput(0))
    .fill(input.criterion.title);
  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionExpectedBehaviorInput(0))
    .fill(input.criterion.expectedBehavior);

  if (configureStructure)
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionMaxScoreInput(0))
      .fill(String(input.criterion.maxScore));

  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoringGuidanceToggle(0)).click();

  for (const guidance of input.criterion.scoreGuidance) {
    const descriptionInput = page.getByTestId(
      AI_MENTOR_LESSON_FORM_HANDLES.judgeScoreDescriptionInput(0, guidance.score),
    );
    await descriptionInput.waitFor();
    await descriptionInput.fill(guidance.description);
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoreExampleInput(0, guidance.score))
      .fill(guidance.example);
  }

  const blockingErrorsSection = page.getByTestId(
    AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_BLOCKING_ERRORS_SECTION,
  );
  if ((await blockingErrorsSection.getAttribute("open")) === null)
    await blockingErrorsSection.click();

  if (configureStructure)
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_ADD_BLOCKING_ERROR_BUTTON).click();

  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeBlockingErrorInput(0))
    .fill(input.blockingError);
};
