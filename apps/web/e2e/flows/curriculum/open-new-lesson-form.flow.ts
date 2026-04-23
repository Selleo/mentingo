import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";

import { expandChapterFlow } from "./expand-chapter.flow";

import type { Page } from "@playwright/test";

type CurriculumLessonType = "content" | "quiz" | "ai_mentor" | "embed";

export const openNewLessonFormFlow = async (
  page: Page,
  chapterId: string,
  type: CurriculumLessonType,
) => {
  await expandChapterFlow(page, chapterId);
  await page.getByTestId(CURRICULUM_HANDLES.addLessonButton(chapterId)).click();
  await page.getByTestId(CURRICULUM_HANDLES.lessonTypeOption(type)).click();
};
