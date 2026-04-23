import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { fillRichTextEditorFlow } from "../courses/editor.flow";

import type { Page } from "@playwright/test";

type FillAiMentorLessonFormInput = {
  title: string;
  name: string;
  description: string;
  instructions: string;
  completionConditions: string;
};

export const fillAiMentorLessonFormFlow = async (
  page: Page,
  input: FillAiMentorLessonFormInput,
) => {
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.TITLE_INPUT).fill(input.title);
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.NAME_INPUT).fill(input.name);
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.DESCRIPTION_INPUT).fill(input.description);
  await fillRichTextEditorFlow(
    page,
    AI_MENTOR_LESSON_FORM_HANDLES.INSTRUCTIONS_INPUT,
    input.instructions,
  );
  await fillRichTextEditorFlow(
    page,
    AI_MENTOR_LESSON_FORM_HANDLES.COMPLETION_CONDITIONS_INPUT,
    input.completionConditions,
  );
};
