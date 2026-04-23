import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";
import type { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

export const addQuizQuestionFlow = async (page: Page, type: QuestionType, questionIndex = 0) => {
  const addQuestionButton = page.getByTestId(QUIZ_LESSON_FORM_HANDLES.ADD_QUESTION_BUTTON);
  const questionTitleInput = page.getByTestId(
    QUIZ_LESSON_FORM_HANDLES.questionTitleInput(questionIndex),
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await addQuestionButton.scrollIntoViewIfNeeded();
    await addQuestionButton.click();

    const typeOption = page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTypeOption(type));

    try {
      await typeOption.waitFor({ state: "visible" });
      await typeOption.scrollIntoViewIfNeeded();
      await typeOption.click();
      await questionTitleInput.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await typeOption.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
};
