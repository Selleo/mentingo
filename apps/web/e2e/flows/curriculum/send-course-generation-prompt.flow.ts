import { COURSE_GENERATION_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const sendCourseGenerationPromptFlow = async (page: Page, prompt: string) => {
  await page.getByTestId(COURSE_GENERATION_HANDLES.PROMPT_INPUT).fill(prompt);
  await page.getByTestId(COURSE_GENERATION_HANDLES.SEND_BUTTON).click();
};
