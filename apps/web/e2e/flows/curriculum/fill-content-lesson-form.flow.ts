import { CONTENT_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { fillRichTextEditorFlow } from "../courses/editor.flow";

import type { Page } from "@playwright/test";

type FillContentLessonFormInput = {
  title: string;
  description: string;
};

export const fillContentLessonFormFlow = async (
  page: Page,
  { title, description }: FillContentLessonFormInput,
) => {
  await page.getByTestId(CONTENT_LESSON_FORM_HANDLES.TITLE_INPUT).fill(title);
  await fillRichTextEditorFlow(page, CONTENT_LESSON_FORM_HANDLES.DESCRIPTION_EDITOR, description);
};
