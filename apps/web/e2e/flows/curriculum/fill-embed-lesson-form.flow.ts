import { EMBED_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

type FillEmbedLessonFormInput = {
  title: string;
  resources: string[];
};

export const fillEmbedLessonFormFlow = async (
  page: Page,
  { title, resources }: FillEmbedLessonFormInput,
) => {
  await page.getByTestId(EMBED_LESSON_FORM_HANDLES.TITLE_INPUT).fill(title);

  for (const [index, resourceUrl] of resources.entries()) {
    const resourceInput = page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceUrlInput(index));

    if ((await resourceInput.count()) === 0) {
      await page.getByTestId(EMBED_LESSON_FORM_HANDLES.ADD_RESOURCE_BUTTON).click();
    }

    await resourceInput.fill(resourceUrl);
  }
};
