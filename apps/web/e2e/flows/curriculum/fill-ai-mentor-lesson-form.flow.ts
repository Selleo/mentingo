import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { fillRichTextEditorFlow } from "../courses/editor.flow";

import type { Page } from "@playwright/test";

type FillAiMentorLessonFormInput = {
  title: string;
  name: string;
  description: string;
  scenario: string;
  aiRole?: string;
  learnerRole?: string;
  characterGoal?: string;
  taskGoal?: string;
};

export const fillAiMentorLessonFormFlow = async (
  page: Page,
  input: FillAiMentorLessonFormInput,
) => {
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.TITLE_INPUT).fill(input.title);
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.NAME_INPUT).fill(input.name);
  await fillRichTextEditorFlow(
    page,
    AI_MENTOR_LESSON_FORM_HANDLES.DESCRIPTION_INPUT,
    input.description,
  );
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_BUTTON).click();
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_SCENARIO_INPUT).fill(input.scenario);
  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_AI_ROLE_INPUT)
    .fill(input.aiRole ?? "Customer");
  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_LEARNER_ROLE_INPUT)
    .fill(input.learnerRole ?? "Employee");
  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CHARACTER_GOAL_INPUT)
    .fill(input.characterGoal ?? "Reach a realistic agreement.");
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_APPLY_BUTTON).click();
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();
  await page
    .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_TASK_GOAL_INPUT)
    .locator(".ProseMirror")
    .fill(input.taskGoal ?? "Complete the AI Mentor exercise.");
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_APPLY_BUTTON).click();
};
