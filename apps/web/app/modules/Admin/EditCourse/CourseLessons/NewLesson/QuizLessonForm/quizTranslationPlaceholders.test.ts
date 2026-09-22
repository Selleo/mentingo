import { describe, expect, it } from "vitest";

import { QuestionType, type Question, type QuestionOption } from "./QuizLessonForm.types";
import {
  findBaseLanguageOption,
  findBaseLanguageQuestion,
  getBaseLanguageFillPromptPreview,
} from "./quizTranslationPlaceholders";

const createOption = (id: string, optionText: string, displayOrder: number): QuestionOption => ({
  id,
  sortableId: id,
  optionText,
  displayOrder,
  isCorrect: false,
});

const createQuestion = (
  id: string,
  options: QuestionOption[] = [],
  description?: string,
): Question => ({
  id,
  sortableId: id,
  type: QuestionType.FILL_IN_THE_BLANKS_DND,
  title: `Question ${id}`,
  displayOrder: 1,
  description,
  options,
});

describe("quiz translation placeholders", () => {
  it("matches questions by their shared question ID", () => {
    const firstQuestion = createQuestion("first");
    const secondQuestion = createQuestion("second");

    expect(findBaseLanguageQuestion([firstQuestion, secondQuestion], secondQuestion, 0)).toBe(
      secondQuestion,
    );
  });

  it("matches duplicate display orders by their occurrence", () => {
    const currentOptions = [createOption("target-1", "", 1), createOption("target-2", "", 1)];
    const baseQuestion = createQuestion("question", [
      createOption("base-1", "First", 1),
      createOption("base-2", "Second", 1),
    ]);

    expect(
      findBaseLanguageOption(baseQuestion, currentOptions, currentOptions[1], 1)?.optionText,
    ).toBe("Second");
  });

  it("builds a readable fill-prompt preview with its base-language answers", () => {
    const question = createQuestion(
      "question",
      [createOption("blank-id", "base answer", 1)],
      "<p>Text &amp; <blank-answer-blank-id><strong>after</strong></p>",
    );

    expect(getBaseLanguageFillPromptPreview(question)).toBe("Text & base answer after");
  });
});
